#!/usr/bin/env node
const { execFileSync } = require('child_process');
const { send, getKürzel } = require('./telegram-helper.cjs');

const NOISE_BLOCK = /^(✻\s+)?(Brewed|Worked) for\b/;

function getLastResponse(kürzel) {
  try {
    // Try last 1 block first
    let raw = execFileSync('npx', ['zellij-claude', 'last', `@${kürzel}`, '1'], {
      encoding: 'utf8',
      timeout: 10000,
    }).trim();
    // If the block is just noise (Brewed/Worked for), get the one before it
    if (raw && NOISE_BLOCK.test(raw)) {
      const raw2 = execFileSync('npx', ['zellij-claude', 'last', `@${kürzel}`, '2'], {
        encoding: 'utf8',
        timeout: 10000,
      }).trim();
      // Split on the --- separator between blocks, take the first one
      const blocks = raw2.split(/\n---\n/);
      raw = (blocks.length > 1 ? blocks[0] : raw2).trim();
    }
    return raw || null;
  } catch { return null; }
}

const MAX_TG_LENGTH = 4000; // Telegram limit is 4096, leave some margin

function truncate(text, max) {
  if (text.length <= max) return text;
  return text.slice(0, max) + '\n…(truncated)';
}

const MAIN_SESSION = process.env.ZELLIJ_CLAUDE_MAIN || 'main';

function notify(kürzel) {
  if (!kürzel) return; // Not a zellij-claude session, skip
  if (kürzel === MAIN_SESSION) return; // @main talks via Telegram directly, skip
  const response = getLastResponse(kürzel);
  if (response) {
    const header = `✅ @${kürzel}\n\n`;
    send(header + truncate(response, MAX_TG_LENGTH - header.length));
  } else {
    send(`✅ @${kürzel} finished!`);
  }
}

let input = '';
const timeout = setTimeout(() => {
  notify(getKürzel(null));
  process.exit(0);
}, 3000);

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => (input += chunk));
process.stdin.on('end', () => {
  clearTimeout(timeout);
  try {
    const data = JSON.parse(input || '{}');
    notify(getKürzel(data.session_id));
  } catch {
    send('✅ Session finished!');
  }
  process.exit(0);
});
