#!/usr/bin/env node
// SessionStart hook: cache the zellij tab name for other hooks.
// Input (stdin): { session_id, ... }

const { execSync } = require('child_process');
const { writeFileSync } = require('fs');

let input = '';
const timeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => (input += chunk));
process.stdin.on('end', () => {
  clearTimeout(timeout);
  try {
    const data = JSON.parse(input || '{}');
    const sessionId = data.session_id ?? 'unknown';
    const zellijSession = process.env.ZELLIJ_SESSION_NAME;
    const paneId = process.env.ZELLIJ_PANE_ID;

    if (zellijSession && paneId !== undefined) {
      const raw = execSync(
        `zellij --session ${zellijSession} action list-tabs --json --state`,
        { encoding: 'utf8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] }
      );
      const tabs = JSON.parse(raw);
      const tab = tabs.find(t => String(t.tab_id) === paneId);
      if (tab && tab.name.startsWith('@')) {
        writeFileSync(`/tmp/zellij-claude-tab-${sessionId}`, tab.name.slice(1));
      }
    }
  } catch {
    // Never crash Claude Code
  }
  process.exit(0);
});
