import { createHash } from 'node:crypto';
import * as path from 'node:path';
import * as vscode from 'vscode';

export type ResolvedIcon =
  | { kind: 'font'; char: string; color?: string; family: string }
  | { kind: 'svg'; svg: string }
  | { kind: 'image'; uri: string };

export interface ResolvedIconRef {
  key: string;
  icon: ResolvedIcon;
}

export interface IconThemeFont {
  family: string;
  dataUri: string;
}

interface IconDefinition {
  iconPath?: string;
  fontCharacter?: string;
  fontColor?: string;
  fontId?: string;
}

interface IconMappings {
  file?: string;
  folder?: string;
  folderExpanded?: string;
  fileNames: Map<string, string>;
  fileExtensions: Map<string, string>;
  languageIds: Map<string, string>;
  folderNames: Map<string, string>;
  folderNamesExpanded: Map<string, string>;
}

interface ParsedTheme {
  definitions: Map<string, IconDefinition>;
  fonts: Map<string, IconThemeFont>;
  firstFontId?: string;
  base: IconMappings;
  light?: Partial<IconMappings>;
}

/**
 * Resolves the file/folder icons of the user's active VS Code icon theme,
 * so the webview tree matches the Explorer. Supports icon themes that use
 * SVG/PNG images and themes that use an icon font (e.g. the built-in Seti).
 *
 * If a theme cannot be found or an icon cannot be read, callers simply get
 * undefined and the webview falls back to its CSS icons.
 */
export class FileIconThemeResolver {
  private theme?: ParsedTheme;
  private themeDirectory = '';
  private loadPromise?: Promise<void>;
  private readonly iconCache = new Map<string, ResolvedIconRef | null>();
  private readonly assetCache = new Map<string, ResolvedIcon | null>();
  private extensionLanguages = new Map<string, string>();
  private filenameLanguages = new Map<string, string>();

  async ensureLoaded(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.load();
    }
    await this.loadPromise;
  }

  invalidate(): void {
    this.theme = undefined;
    this.themeDirectory = '';
    this.loadPromise = undefined;
    this.iconCache.clear();
    this.assetCache.clear();
    this.extensionLanguages.clear();
    this.filenameLanguages.clear();
  }

  getFonts(): IconThemeFont[] {
    return this.theme ? [...this.theme.fonts.values()] : [];
  }

  async resolveFile(name: string, light: boolean): Promise<ResolvedIconRef | undefined> {
    await this.ensureLoaded();
    const theme = this.theme;
    if (!theme) {
      return undefined;
    }

    const explicit = lookupName(theme, 'fileNames', name, light);
    const languageId = this.languageForFile(name);
    const languageDefinition = languageId
      ? lookupName(theme, 'languageIds', languageId, light)
      : undefined;
    const definitionId =
      explicit ??
      findExtension(theme, name, light) ??
      languageDefinition ??
      (light ? theme.light?.file : undefined) ??
      theme.base.file;

    return definitionId ? this.resolveDefinition(definitionId) : undefined;
  }

  async resolveDefaultFile(light: boolean): Promise<ResolvedIconRef | undefined> {
    return (await this.resolveFile('untitled.txt', light)) ?? this.resolveFile('', light);
  }

  async resolveFolder(
    name: string,
    expanded: boolean,
    light: boolean
  ): Promise<ResolvedIconRef | undefined> {
    await this.ensureLoaded();
    const theme = this.theme;
    if (!theme) {
      return undefined;
    }

    const explicit = lookupName(
      theme,
      expanded ? 'folderNamesExpanded' : 'folderNames',
      name,
      light
    );
    const fallback = expanded
      ? (light ? theme.light?.folderExpanded : undefined) ?? theme.base.folderExpanded
      : (light ? theme.light?.folder : undefined) ?? theme.base.folder;
    const definitionId = explicit ?? fallback;

    return definitionId ? this.resolveDefinition(definitionId) : undefined;
  }

  private languageForFile(name: string): string | undefined {
    const lower = name.toLowerCase();
    const byName = this.filenameLanguages.get(lower);
    if (byName) {
      return byName;
    }

    for (let index = lower.indexOf('.'); index !== -1; index = lower.indexOf('.', index + 1)) {
      const suffix = lower.slice(index + 1);
      const language = this.extensionLanguages.get(suffix);
      if (language) {
        return language;
      }
    }

    const lastPart = lower.split('.').pop() ?? '';
    return FALLBACK_EXTENSION_LANGUAGES[lastPart];
  }

  private loadLanguageAssociations(): void {
    this.extensionLanguages.clear();
    this.filenameLanguages.clear();

    for (const extension of vscode.extensions.all) {
      const contributes = (extension.packageJSON as Record<string, unknown> | undefined)?.contributes as
        | Record<string, unknown>
        | undefined;
      const languages = contributes?.languages;
      if (!Array.isArray(languages)) {
        continue;
      }
      for (const language of languages) {
        if (!language || typeof language !== 'object') {
          continue;
        }
        const record = language as Record<string, unknown>;
        const id = typeof record.id === 'string' ? record.id : undefined;
        if (!id) {
          continue;
        }
        if (Array.isArray(record.extensions)) {
          for (const value of record.extensions) {
            if (typeof value === 'string') {
              this.extensionLanguages.set(value.toLowerCase().replace(/^\./, ''), id);
            }
          }
        }
        if (Array.isArray(record.filenames)) {
          for (const value of record.filenames) {
            if (typeof value === 'string') {
              this.filenameLanguages.set(value.toLowerCase(), id);
            }
          }
        }
      }
    }

    for (const [extension, language] of Object.entries(FALLBACK_EXTENSION_LANGUAGES)) {
      if (!this.extensionLanguages.has(extension)) {
        this.extensionLanguages.set(extension, language);
      }
    }
  }

  private async resolveDefinition(definitionId: string): Promise<ResolvedIconRef | undefined> {
    if (this.iconCache.has(definitionId)) {
      return this.iconCache.get(definitionId) ?? undefined;
    }

    const definition = this.theme?.definitions.get(definitionId);
    let resolved: ResolvedIconRef | undefined;

    if (definition?.iconPath) {
      const absolutePath = path.isAbsolute(definition.iconPath)
        ? definition.iconPath
        : path.resolve(this.themeDirectory, definition.iconPath);
      const icon = await this.readAsset(absolutePath);
      if (icon) {
        resolved = { key: definitionId, icon };
      }
    } else if (definition?.fontCharacter) {
      const fontId = definition.fontId ?? this.theme?.firstFontId;
      const font = fontId ? this.theme?.fonts.get(fontId) : undefined;
      const char = glyphChar(definition.fontCharacter);
      if (font && char) {
        resolved = {
          key: definitionId,
          icon: {
            kind: 'font',
            char,
            color: definition.fontColor,
            family: font.family
          }
        };
      }
    }

    this.iconCache.set(definitionId, resolved ?? null);
    return resolved;
  }

  private async readAsset(absolutePath: string): Promise<ResolvedIcon | undefined> {
    if (this.assetCache.has(absolutePath)) {
      return this.assetCache.get(absolutePath) ?? undefined;
    }

    try {
      const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(absolutePath));
      const extension = path.extname(absolutePath).toLowerCase();
      let icon: ResolvedIcon;

      if (extension === '.svg') {
        icon = {
          kind: 'svg',
          svg: sanitizeSvg(Buffer.from(bytes).toString('utf8'))
        };
      } else {
        const mime =
          extension === '.png'
            ? 'image/png'
            : extension === '.jpg' || extension === '.jpeg'
              ? 'image/jpeg'
              : extension === '.gif'
                ? 'image/gif'
                : 'application/octet-stream';
        icon = {
          kind: 'image',
          uri: `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`
        };
      }

      this.assetCache.set(absolutePath, icon);
      return icon;
    } catch {
      this.assetCache.set(absolutePath, null);
      return undefined;
    }
  }

  private async load(): Promise<void> {
    try {
      const themeUri = findIconThemeUri();
      if (!themeUri) {
        return;
      }

      const raw = await vscode.workspace.fs.readFile(themeUri);
      const json = JSON.parse(Buffer.from(raw).toString('utf8')) as Record<string, unknown>;
      const definitions = parseDefinitions(json.iconDefinitions);
      this.themeDirectory = path.dirname(themeUri.fsPath);
      this.loadLanguageAssociations();
      const fonts = await this.loadFonts(json.fonts, this.themeDirectory);

      this.theme = {
        definitions,
        fonts,
        firstFontId: fonts.size > 0 ? fonts.keys().next().value : undefined,
        base: parseMappings(json),
        light:
          json.light && typeof json.light === 'object'
            ? parsePartialMappings(json.light as Record<string, unknown>)
            : undefined
      };
    } catch {
      this.theme = undefined;
    }
  }

  private async loadFonts(raw: unknown, themeDirectory: string): Promise<Map<string, IconThemeFont>> {
    const fonts = new Map<string, IconThemeFont>();
    if (!Array.isArray(raw)) {
      return fonts;
    }

    for (let index = 0; index < raw.length; index += 1) {
      const entry = raw[index];
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const record = entry as Record<string, unknown>;
      const id = typeof record.id === 'string' && record.id ? record.id : `font-${index}`;
      const sources = Array.isArray(record.src) ? record.src : [];
      const source = sources.find(
        (item): item is Record<string, unknown> =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as Record<string, unknown>).path === 'string'
      );
      if (!source) {
        continue;
      }

      const relativePath = String(source.path);
      const absolutePath = path.isAbsolute(relativePath)
        ? relativePath
        : path.resolve(themeDirectory, relativePath);
      const format = typeof source.format === 'string' ? source.format.toLowerCase() : '';
      const mime =
        format === 'woff2'
          ? 'font/woff2'
          : format === 'woff'
            ? 'font/woff'
            : format === 'truetype' || format === 'ttf'
              ? 'font/ttf'
              : format === 'opentype' || format === 'otf'
                ? 'font/otf'
                : 'application/octet-stream';

      try {
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(absolutePath));
        const dataUri = `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
        const fingerprint = createHash('sha1').update(dataUri).digest('hex').slice(0, 8);
        fonts.set(id, {
          family: `kg-icon-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}-${fingerprint}`,
          dataUri
        });
      } catch {
        // Font unavailable; font-based icons will fall back to CSS icons.
      }
    }

    return fonts;
  }
}

export function isLightColorTheme(): boolean {
  const kind = vscode.window.activeColorTheme.kind;
  return kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight;
}

function findIconThemeUri(): vscode.Uri | undefined {
  const configuredIconTheme = vscode.workspace
    .getConfiguration('workbench')
    .get<string | null>('iconTheme');
  if (configuredIconTheme === null) {
    return undefined;
  }
  const iconThemeId = configuredIconTheme || 'vs-seti';

  for (const extension of vscode.extensions.all) {
    const contributes = (extension.packageJSON as Record<string, unknown> | undefined)?.contributes as
      | Record<string, unknown>
      | undefined;
    const themes = contributes?.iconThemes;
    if (!Array.isArray(themes)) {
      continue;
    }
    for (const theme of themes) {
      if (!theme || typeof theme !== 'object') {
        continue;
      }
      const record = theme as Record<string, unknown>;
      if (record.id === iconThemeId && typeof record.path === 'string') {
        return vscode.Uri.joinPath(vscode.Uri.file(extension.extensionPath), record.path);
      }
    }
  }

  const builtInCandidates: Record<string, string> = {
    'vs-seti': 'extensions/theme-seti/icons/vs-seti-icon-theme.json',
    'vs-minimal': 'extensions/theme-defaults/fileicons/vs_minimal-icon-theme.json',
    'vscode-modern-icons':
      'extensions/theme-modern-icons/fileicons/vscode-modern-icons-icon-theme.json'
  };
  const relative = builtInCandidates[iconThemeId];
  if (relative) {
    return vscode.Uri.joinPath(vscode.Uri.file(vscode.env.appRoot), relative);
  }

  return undefined;
}

function parseDefinitions(raw: unknown): Map<string, IconDefinition> {
  const definitions = new Map<string, IconDefinition>();
  if (!raw || typeof raw !== 'object') {
    return definitions;
  }

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') {
      continue;
    }
    const record = value as Record<string, unknown>;
    const definition: IconDefinition = {};
    if (typeof record.iconPath === 'string') {
      definition.iconPath = record.iconPath;
    }
    if (typeof record.fontCharacter === 'string') {
      definition.fontCharacter = record.fontCharacter;
    }
    if (typeof record.fontColor === 'string') {
      definition.fontColor = record.fontColor;
    }
    if (typeof record.fontId === 'string') {
      definition.fontId = record.fontId;
    }
    definitions.set(key, definition);
  }

  return definitions;
}

function parseMappings(raw: Record<string, unknown>): IconMappings {
  return {
    file: typeof raw.file === 'string' ? raw.file : undefined,
    folder: typeof raw.folder === 'string' ? raw.folder : undefined,
    folderExpanded:
      typeof raw.folderExpanded === 'string' ? raw.folderExpanded : undefined,
    fileNames: toStringMap(raw.fileNames),
    fileExtensions: toStringMap(raw.fileExtensions),
    languageIds: toStringMap(raw.languageIds),
    folderNames: toStringMap(raw.folderNames),
    folderNamesExpanded: toStringMap(raw.folderNamesExpanded)
  };
}

function parsePartialMappings(raw: Record<string, unknown>): Partial<IconMappings> {
  const mappings: Partial<IconMappings> = {};
  if (typeof raw.file === 'string') {
    mappings.file = raw.file;
  }
  if (typeof raw.folder === 'string') {
    mappings.folder = raw.folder;
  }
  if (typeof raw.folderExpanded === 'string') {
    mappings.folderExpanded = raw.folderExpanded;
  }
  if (raw.fileNames && typeof raw.fileNames === 'object') {
    mappings.fileNames = toStringMap(raw.fileNames);
  }
  if (raw.fileExtensions && typeof raw.fileExtensions === 'object') {
    mappings.fileExtensions = toStringMap(raw.fileExtensions);
  }
  if (raw.languageIds && typeof raw.languageIds === 'object') {
    mappings.languageIds = toStringMap(raw.languageIds);
  }
  if (raw.folderNames && typeof raw.folderNames === 'object') {
    mappings.folderNames = toStringMap(raw.folderNames);
  }
  if (raw.folderNamesExpanded && typeof raw.folderNamesExpanded === 'object') {
    mappings.folderNamesExpanded = toStringMap(raw.folderNamesExpanded);
  }
  return mappings;
}

function toStringMap(raw: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!raw || typeof raw !== 'object') {
    return map;
  }
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') {
      map.set(key.toLowerCase(), value);
    }
  }
  return map;
}

function lookupName(
  theme: ParsedTheme,
  key: 'fileNames' | 'fileExtensions' | 'languageIds' | 'folderNames' | 'folderNamesExpanded',
  name: string,
  light: boolean
): string | undefined {
  const lower = name.toLowerCase();
  const lightMap = light ? theme.light?.[key] : undefined;
  return lightMap?.get(lower) ?? theme.base[key].get(lower);
}

function findExtension(theme: ParsedTheme, name: string, light: boolean): string | undefined {
  const lower = name.toLowerCase();
  for (let index = lower.indexOf('.'); index !== -1; index = lower.indexOf('.', index + 1)) {
    const suffix = lower.slice(index + 1);
    const definition = lookupName(theme, 'fileExtensions', suffix, light);
    if (definition) {
      return definition;
    }
  }
  return undefined;
}

function glyphChar(value: string): string | undefined {
  const hex = value.replace(/^\\+/, '');
  if (/^[0-9a-fA-F]{1,6}$/.test(hex)) {
    const codePoint = parseInt(hex, 16);
    if (codePoint > 0 && codePoint <= 0x10ffff) {
      return String.fromCodePoint(codePoint);
    }
  }
  return value || undefined;
}

const FALLBACK_EXTENSION_LANGUAGES: Record<string, string> = {
  py: 'python',
  pyi: 'python',
  pyw: 'python',
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'markdown',
  js: 'javascript',
  jsx: 'javascriptreact',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescriptreact',
  mts: 'typescript',
  cts: 'typescript',
  json: 'json',
  jsonc: 'jsonc',
  json5: 'json',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  go: 'go',
  rs: 'rust',
  rb: 'ruby',
  php: 'php',
  sh: 'shellscript',
  bash: 'shellscript',
  zsh: 'shellscript',
  yml: 'yaml',
  yaml: 'yaml',
  xml: 'xml',
  sql: 'sql',
  r: 'r',
  lua: 'lua',
  swift: 'swift',
  kt: 'kotlin',
  kts: 'kotlin',
  scala: 'scala',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  cmake: 'cmake',
  ipynb: 'jupyter',
  gitignore: 'ignore',
  gitattributes: 'ignore',
  txt: 'plaintext',
  log: 'log',
  ini: 'ini',
  toml: 'toml',
  cfg: 'ini'
};

function sanitizeSvg(svg: string): string {
  const match = svg.match(/<svg[\s\S]*<\/svg>/i);
  return (match ? match[0] : svg)
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '');
}
