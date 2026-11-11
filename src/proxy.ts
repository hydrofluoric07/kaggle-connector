import * as vscode from 'vscode';
import { getProxySetting } from './config';

/**
 * Resolve the proxy for a target URL:
 * 1. kaggleConnector.proxy
 * 2. VS Code http.proxy (honoring http.noProxy)
 * 3. HTTPS_PROXY / HTTP_PROXY environment variables
 */
export function resolveProxy(target: URL): string | undefined {
  const explicit = getProxySetting().trim();
  if (explicit && explicit.toLowerCase() !== 'off') {
    return explicit;
  }

  const httpConfig = vscode.workspace.getConfiguration('http');
  const configured = (httpConfig.get<string>('proxy', '') ?? '').trim();
  const noProxy = httpConfig.get<string>('noProxy', '') ?? '';
  if (
    configured &&
    configured.toLowerCase() !== 'off' &&
    !isNoProxy(target.hostname, noProxy)
  ) {
    return configured;
  }

  const environment =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    '';
  const environmentNoProxy = process.env.NO_PROXY || process.env.no_proxy || '';
  if (environment.trim() && !isNoProxy(target.hostname, environmentNoProxy)) {
    return environment.trim();
  }

  return undefined;
}

function isNoProxy(hostname: string, noProxy: string): boolean {
  if (!noProxy.trim()) {
    return false;
  }

  const host = hostname.toLowerCase().replace(/:\d+$/, '');
  for (const rawEntry of noProxy.split(',')) {
    const entry = rawEntry.trim().toLowerCase();
    if (!entry) {
      continue;
    }
    if (entry === '*') {
      return true;
    }
    const suffix = entry.replace(/:\d+$/, '').replace(/^\./, '');
    if (host === suffix || host.endsWith(`.${suffix}`)) {
      return true;
    }
  }
  return false;
}
