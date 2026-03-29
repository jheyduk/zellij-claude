import { parseTabs, findTab, deriveKürzel, resolveKürzel } from './registry.js';
import { sanitize } from './sanitize.js';
import { extractResponses } from './screen-parse.js';

export async function execute(cmd, { zellij }) {
  const tabs = zellij.listTabs();
  const sessions = parseTabs(tabs);

  switch (cmd.type) {
    case 'ls': {
      if (sessions.length === 0) return 'No sessions found.';
      return sessions
        .map(s => `@${s.kürzel}${s.active ? ' (active)' : ''}`)
        .join('\n');
    }

    case 'open': {
      let kürzel;
      if (cmd.kürzel) {
        if (findTab(cmd.kürzel, sessions)) {
          return `Session @${cmd.kürzel} already running. Use \`goto @${cmd.kürzel}\` to switch.`;
        }
        kürzel = cmd.kürzel;
      } else {
        kürzel = resolveKürzel(deriveKürzel(cmd.path), sessions);
      }
      const name = `@${kürzel}`;
      const claudeCmd = ['claude', '--dangerously-skip-permissions', cmd.claudeFlags].filter(Boolean).join(' ');
      const tabId = zellij.newTab(name, cmd.path, claudeCmd);
      return `Session ${name} created (Tab ${tabId}).`;
    }

    case 'last': {
      const tab = findTab(cmd.kürzel, sessions);
      if (!tab) return `Session @${cmd.kürzel} not found. Available: ${sessions.map(s => '@' + s.kürzel).join(', ')}`;
      const raw = zellij.dumpScreen(tab.name, Math.max(50, cmd.lines * 50));
      const parsed = extractResponses(raw, cmd.lines);
      const result = parsed ?? (raw ? raw.split('\n').slice(-cmd.lines).join('\n') : null);
      return result ? sanitize(result) : 'No output available.';
    }

    case 'goto': {
      const tab = findTab(cmd.kürzel, sessions);
      if (!tab) return `Session @${cmd.kürzel} not found. Available: ${sessions.map(s => '@' + s.kürzel).join(', ')}`;
      zellij.goToTab(tab.name);
      return `Switched to ${tab.name}.`;
    }

    case 'rename': {
      const tab = findTab(cmd.fromKürzel, sessions);
      if (!tab) return `Session @${cmd.fromKürzel} not found. Available: ${sessions.map(s => '@' + s.kürzel).join(', ')}`;
      zellij.renameTab(tab.tabId, `@${cmd.toKürzel}`);
      return `@${cmd.fromKürzel} renamed to @${cmd.toKürzel}.`;
    }

    case 'send': {
      const tab = findTab(cmd.kürzel, sessions);
      if (!tab) return `Session @${cmd.kürzel} not found. Available: ${sessions.map(s => '@' + s.kürzel).join(', ')}`;
      zellij.writeChars(tab.name, cmd.message);
      return `Message sent to @${cmd.kürzel}.`;
    }

    default:
      return `Unknown command: ${cmd.raw || cmd.type}`;
  }
}

export function parseCommand(input) {
  const trimmed = input.trim();

  if (trimmed === '/ls') {
    return { type: 'ls' };
  }

  const newMatch = trimmed.match(/^\/open\s+(?:@(\S+)\s+)?(\S+)(?:\s+--\s+(.+))?$/);
  if (newMatch) {
    return {
      type: 'open',
      kürzel: newMatch[1] || null,
      path: newMatch[2],
      claudeFlags: (newMatch[3] || '').trim(),
    };
  }

  const lastMatch = trimmed.match(/^\/last\s+@(\S+)(?:\s+(\d+))?$/);
  if (lastMatch) {
    return {
      type: 'last',
      kürzel: lastMatch[1],
      lines: lastMatch[2] ? parseInt(lastMatch[2], 10) : 1,
    };
  }

  const gotoMatch = trimmed.match(/^\/goto\s+@(\S+)$/);
  if (gotoMatch) {
    return { type: 'goto', kürzel: gotoMatch[1] };
  }

  const renameMatch = trimmed.match(/^\/rename\s+@(\S+)\s+@(\S+)$/);
  if (renameMatch) {
    return { type: 'rename', fromKürzel: renameMatch[1], toKürzel: renameMatch[2] };
  }

  const sendMatch = trimmed.match(/^@(\S+)\s+(.+)$/s);
  if (sendMatch) {
    return { type: 'send', kürzel: sendMatch[1], message: sendMatch[2] };
  }

  return { type: 'unknown', raw: trimmed };
}
