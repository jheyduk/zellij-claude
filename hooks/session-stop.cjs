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

function notify(kürzel) {
  if (!kürzel) return; // Not a zellij-claude session, skip
  const response = getLastResponse(kürzel);
  if (response) {
    send(`✅ @${kürzel}\n\n${response}`);
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
