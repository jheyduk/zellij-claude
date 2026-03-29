import { basename } from 'node:path';

export function parseTabs(tabs) {
  return tabs
    .filter(t => t.name.startsWith('@'))
    .map(t => ({
      kürzel: t.name.slice(1),
      name: t.name,
      active: t.active,
      tabId: t.tabId,
    }));
}

export function findTab(kürzel, sessions) {
  return sessions.find(s => s.kürzel === kürzel);
}

export function deriveKürzel(projectPath) {
  const cleaned = projectPath.replace(/\/+$/, '');
  return basename(cleaned);
}

export function resolveKürzel(kürzel, existingSessions) {
  const taken = new Set(existingSessions.map(s => s.kürzel));
  if (!taken.has(kürzel)) return kürzel;
  let i = 2;
  while (taken.has(`${kürzel}-${i}`)) i++;
  return `${kürzel}-${i}`;
}
