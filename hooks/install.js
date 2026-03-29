import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');

export function installHooks() {
  let settings = {};
  try {
    settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
  } catch {}

  if (!settings.hooks) settings.hooks = {};

  const permHook = {
    type: 'command',
    command: `node "${join(__dirname, 'permission-notify.cjs')}"`,
    async: true,
  };

  const stopHook = {
    type: 'command',
    command: `node "${join(__dirname, 'session-stop.cjs')}"`,
    async: true,
  };

  // Add Notification hook for permission_prompt
  if (!settings.hooks.Notification) settings.hooks.Notification = [];
  const hasPermHook = settings.hooks.Notification.some(
    entry => entry.hooks?.some(h => h.command?.includes('zellij-claude') && h.command?.includes('permission'))
  );
  if (!hasPermHook) {
    settings.hooks.Notification.push({
      matcher: 'permission_prompt',
      hooks: [permHook],
    });
  }

  // Add Stop hook
  if (!settings.hooks.Stop) settings.hooks.Stop = [];
  const hasStopHook = settings.hooks.Stop.some(
    entry => entry.hooks?.some(h => h.command?.includes('zellij-claude') && h.command?.includes('session-stop'))
  );
  if (!hasStopHook) {
    settings.hooks.Stop.push({
      hooks: [stopHook],
    });
  }

  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
  console.log('Hooks installed into ~/.claude/settings.json');
  console.log('  - Notification(permission_prompt) → permission-notify.js');
  console.log('  - Stop → session-stop.js');
}
