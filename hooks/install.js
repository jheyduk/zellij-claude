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

  const startHook = {
    type: 'command',
    command: `node "${join(__dirname, 'session-start.cjs')}"`,
  };

  const askHook = {
    type: 'command',
    command: `node "${join(__dirname, 'ask-notify.cjs')}"`,
    async: true,
  };

  const cacheHook = {
    type: 'command',
    command: `node "${join(__dirname, 'pretool-cache.cjs')}"`,
    async: true,
  };

  // Add SessionStart hook
  if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];
  const hasStartHook = settings.hooks.SessionStart.some(
    entry => entry.hooks?.some(h => h.command?.includes('zellij-claude') && h.command?.includes('session-start'))
  );
  if (!hasStartHook) {
    settings.hooks.SessionStart.push({
      hooks: [startHook],
    });
  }

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

  // Add PreToolUse hook for AskUserQuestion
  if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];
  const hasAskHook = settings.hooks.PreToolUse.some(
    entry => entry.hooks?.some(h => h.command?.includes('zellij-claude') && h.command?.includes('ask-notify'))
  );
  if (!hasAskHook) {
    settings.hooks.PreToolUse.push({
      matcher: 'AskUserQuestion',
      hooks: [askHook],
    });
  }

  // Add PreToolUse hook for tool cache
  const hasCacheHook = settings.hooks.PreToolUse.some(
    entry => entry.hooks?.some(h => h.command?.includes('zellij-claude') && h.command?.includes('pretool-cache'))
  );
  if (!hasCacheHook) {
    settings.hooks.PreToolUse.push({
      hooks: [cacheHook],
    });
  }

  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
  console.log('Hooks installed into ~/.claude/settings.json');
  console.log('  - SessionStart → session-start.cjs');
  console.log('  - Notification(permission_prompt) → permission-notify.cjs');
  console.log('  - Stop → session-stop.cjs');
  console.log('  - PreToolUse(AskUserQuestion) → ask-notify.cjs');
  console.log('  - PreToolUse → pretool-cache.cjs');
}
