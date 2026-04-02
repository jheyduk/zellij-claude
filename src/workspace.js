import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_PATH = join(homedir(), '.config', 'zellij-claude', 'workspaces.json');

const DEFAULT_SEARCH_PATHS = [
  join(homedir(), 'prj'),
  join(homedir(), 'projects'),
  join(homedir(), 'src'),
  join(homedir(), 'work'),
];

function loadSearchPaths() {
  try {
    if (existsSync(CONFIG_PATH)) {
      const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
      if (Array.isArray(cfg.searchPaths) && cfg.searchPaths.length > 0) {
        return cfg.searchPaths.map(p => p.replace(/^~/, homedir()));
      }
    }
  } catch { /* fall through to defaults */ }
  return DEFAULT_SEARCH_PATHS;
}

/**
 * Try to find a workspace directory matching the given kürzel.
 * Searches configured paths for a directory with a matching name.
 * Also tries prefix-derived subdirectories: "fischer-argocd" checks
 * searchPath/fischer/fischer-argocd (split on first hyphen).
 * Returns the absolute path or null.
 */
export function resolveWorkspace(kürzel) {
  const searchPaths = loadSearchPaths();
  const prefix = kürzel.includes('-') ? kürzel.split('-')[0] : null;

  for (const base of searchPaths) {
    // Direct match: searchPath/kürzel
    const direct = join(base, kürzel);
    if (existsSync(direct)) return direct;

    // Prefix-derived: searchPath/prefix/kürzel
    if (prefix) {
      const nested = join(base, prefix, kürzel);
      if (existsSync(nested)) return nested;
    }
  }
  return null;
}
