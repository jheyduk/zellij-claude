import { parseTabs, findTab, deriveKürzel, resolveKürzel } from './registry.js';
import { sanitize } from './sanitize.js';
import { extractResponses } from './screen-parse.js';
import { resolveWorkspace } from './workspace.js';

function deriveStatus(pane) {
  if (!pane) return 'unknown';
  const cmd = pane.pane_command || '';
  const termCmd = pane.terminal_command || '';
  const title = pane.title || '';

  // Not a Claude session — show the process name
  if (!cmd.includes('claude') && !termCmd.includes('claude')) {
    const proc = cmd.split('/').pop().split(/\s/)[0] || title.split(/\s/)[0] || 'shell';
    return `shell (${proc})`;
  }

  // Claude session status from title
  if (/⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏|⠐/.test(title)) return 'working';
  if (/\bpermission\b|\bAllow\b|\bDeny\b/i.test(title) || /\?\s*$/.test(title)) return 'waiting';
  return 'ready';
}

export async function execute(cmd, { zellij }) {
  const tabs = zellij.listTabs();
  const sessions = parseTabs(tabs);

  switch (cmd.type) {
    case 'ls': {
      if (sessions.length === 0) return 'No sessions found.';
      const panes = typeof zellij.listPanes === 'function' ? zellij.listPanes() : [];
      return sessions
        .map(s => {
          const pane = panes.find(p => p.tab_name === s.name && !p.is_plugin && !p.is_suppressed);
          const status = deriveStatus(pane);
          const active = s.active ? ' (active)' : '';
          return `@${s.kürzel}  ${status}${active}`;
        })
        .join('\n');
    }

    case 'open': {
      let kürzel;
      let path = cmd.path;

      // /open @kürzel without path — try to find a matching workspace
      if (cmd.kürzel && !path) {
        const resolved = resolveWorkspace(cmd.kürzel);
        if (!resolved) {
          return `No workspace found for @${cmd.kürzel}. Provide a path: open @${cmd.kürzel} <path>`;
        }
        path = resolved;
      }

      // Non-absolute path — resolve via workspace lookup before using as-is
      if (path && !path.startsWith('/')) {
        const resolved = resolveWorkspace(path);
        if (resolved) path = resolved;
      }

      if (cmd.kürzel) {
        if (findTab(cmd.kürzel, sessions)) {
          return `Session @${cmd.kürzel} already running. Use \`goto @${cmd.kürzel}\` to switch.`;
        }
        kürzel = cmd.kürzel;
      } else {
        kürzel = resolveKürzel(deriveKürzel(path), sessions);
      }
      const name = `@${kürzel}`;
      const claudeCmd = ['claude', '--dangerously-skip-permissions', cmd.claudeFlags].filter(Boolean).join(' ');
      const tabId = zellij.newTab(name, path, claudeCmd);
      return `Session ${name} created (Tab ${tabId}).`;
    }

    case 'last': {
      const tab = findTab(cmd.kürzel, sessions);
      if (!tab) return `Session @${cmd.kürzel} not found. Available: ${sessions.map(s => '@' + s.kürzel).join(', ')}`;
      const raw = zellij.dumpScreen(tab.name, { full: true });
      const parsed = extractResponses(raw, cmd.lines);
      const result = parsed ?? (raw ? raw.split('\n').slice(-50).join('\n') : null);
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
      const beforeScreen = zellij.dumpScreen(tab.name, { lines: 10 });
      zellij.writeChars(tab.name, cmd.message);
      // Brief pause to let the TUI process the input
      await new Promise(r => setTimeout(r, 500));
      const afterScreen = zellij.dumpScreen(tab.name, { lines: 10 });
      const accepted = afterScreen !== beforeScreen;
      if (accepted) {
        return `Message sent to @${cmd.kürzel}.`;
      }
      return `Message sent to @${cmd.kürzel}, but session may not have accepted it (screen unchanged). Check with \`last @${cmd.kürzel}\`.`;
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

  // /open @kürzel (without path — workspace lookup)
  const openKürzelOnly = trimmed.match(/^\/open\s+@(\S+)\s*$/);
  if (openKürzelOnly) {
    return {
      type: 'open',
      kürzel: openKürzelOnly[1],
      path: null,
      claudeFlags: '',
    };
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
