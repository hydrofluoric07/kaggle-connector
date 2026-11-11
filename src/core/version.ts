/**
 * Minimal version comparison for extension versions ("2025.9.1",
 * "2025.0.0-insider", ...). The repository deliberately avoids a semver
 * dependency; only major/minor ordering matters here.
 */
export function versionAtLeast(version: string, major: number, minor: number): boolean {
  const match = /^\s*v?(\d+)\.(\d+)/.exec(version ?? '');
  if (!match) {
    return false;
  }
  const actualMajor = Number(match[1]);
  const actualMinor = Number(match[2]);
  if (actualMajor !== major) {
    return actualMajor > major;
  }
  return actualMinor >= minor;
}
