import { execFileSync } from 'node:child_process';

function getSession() {
  const s = process.env.ZELLIJ_SESSION_NAME;
  if (!s) throw new Error('ZELLIJ_SESSION_NAME not set — are you running inside Zellij?');
  return s;
}

export const _exec = {
  run: (args) => execFileSync('zellij', ['--session', getSession(), 'action', ...args], { encoding: 'utf8' }),
};

export function listTabs() {
  const raw = _exec.run(['list-tabs', '--json', '--state']);
  const tabs = JSON.parse(raw);
  return tabs.map(t => ({
    name: t.name,
    active: t.active,
    tabId: t.tab_id,
  }));
}

export function newTab(name, cwd, command) {
  const result = _exec.run(['new-tab', '--name', name, '--cwd', cwd, '--', ...command.split(/\s+/)]);
  return parseInt(result.trim(), 10);
}

export function goToTab(name) {
  _exec.run(['go-to-tab-name', name]);
}

export function renameTab(tabId, newName) {
  _exec.run(['rename-tab', '--tab-id', String(tabId), newName]);
}

export function writeChars(tabName, text) {
  _exec.run(['go-to-tab-name', tabName]);
  _exec.run(['write-chars', text]);
  _exec.run(['write', '13']);
}

export function dumpScreen(tabName, lines = 5) {
  _exec.run(['go-to-tab-name', tabName]);
  const raw = _exec.run(['dump-screen']);
  const allLines = raw.split('\n');
  if (allLines.length <= lines) return raw;
  return allLines.slice(-lines).join('\n');
}
