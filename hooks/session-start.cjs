#!/usr/bin/env node
// SessionStart hook: cache the zellij tab name for other hooks,
// reconcile stale tab files, and enforce Telegram singleton.
// Input (stdin): { session_id, ... }

const { execSync } = require('child_process');
const { writeFileSync, readFileSync, unlinkSync } = require('fs');
const { reconcile } = require('./reconcile-tabs.cjs');

const TELEGRAM_PIDFILE = '/tmp/zellij-claude-telegram.pid';

// Ensure only one Telegram MCP polling process runs at a time.
// Kills older bun server.ts processes, keeps the newest (just spawned).
function enforceTelegramSingleton() {
  try {
    const raw = execSync('pgrep -f "bun.*server.ts"', {
      encoding: 'utf8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const pids = raw.split('\n').map(Number).filter(Boolean);
    if (pids.length <= 1) {
      // 0 or 1 process — nothing to clean up, just record it
      if (pids.length === 1) writeFileSync(TELEGRAM_PIDFILE, String(pids[0]));
      return;
    }
    // Keep the newest (highest PID), kill the rest
    pids.sort((a, b) => a - b);
    const keep = pids.pop();
    for (const pid of pids) {
      try { process.kill(pid); } catch {}
    }
    writeFileSync(TELEGRAM_PIDFILE, String(keep));
  } catch {
    // pgrep found nothing or failed — clean up stale pidfile
    try { unlinkSync(TELEGRAM_PIDFILE); } catch {}
  }
}

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

    // Clean up stale tab files from old/dead sessions
    reconcile();

    // Kill duplicate Telegram MCP processes
    enforceTelegramSingleton();
  } catch {
    // Never crash Claude Code
  }
  process.exit(0);
});
