#!/usr/bin/env node
const { execFileSync } = require('child_process');
const { send, getKürzel } = require('./telegram-helper.cjs');

function getLastResponse(kürzel) {
  try {
    return execFileSync('npx', ['zellij-claude', 'last', `@${kürzel}`, '1'], {
      encoding: 'utf8',
      timeout: 10000,
    }).trim() || null;
  } catch { return null; }
}

function notify(kürzel) {
  if (!kürzel) return; // Not a zellij-claude session, skip
  const response = getLastResponse(kürzel);
  if (response) {
    send(`✅ @${kürzel} finished!\n\n${response}`);
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
