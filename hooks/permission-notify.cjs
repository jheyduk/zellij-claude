#!/usr/bin/env node
const { send, sendWithButtons, getKürzel } = require('./telegram-helper.cjs');
const { readFileSync } = require('fs');

const MAIN_SESSION = process.env.ZELLIJ_CLAUDE_MAIN || 'main';

let input = '';
const timeout = setTimeout(() => {
  const kürzel = getKürzel(null);
  const label = kürzel ? `@${kürzel}` : 'Claude';
  sendNotification(label, 'Permission required', null);
  process.exit(0);
}, 3000);

function loadToolDetails(sessionId) {
  if (!sessionId) return null;
  try {
    const raw = readFileSync(`/tmp/zellij-claude-pending-tool-${sessionId}.json`, 'utf8');
    const info = JSON.parse(raw);
    if (Date.now() - info.ts > 10000) return null;
    return info;
  } catch { return null; }
}

function formatToolDetail(toolInfo) {
  if (!toolInfo) return '';
  const name = toolInfo.tool_name;
  const inp = toolInfo.tool_input || {};
  if (name === 'Bash' && inp.command) {
    const cmd = inp.command.length > 200 ? inp.command.slice(0, 200) + '…' : inp.command;
    return `\n\n$ ${cmd}`;
  }
  if (name === 'Edit' && inp.file_path) return `\n\n📝 ${inp.file_path}`;
  if (name === 'Write' && inp.file_path) return `\n\n📄 ${inp.file_path}`;
  if (inp.command || inp.file_path) return `\n\n${inp.command || inp.file_path}`;
  return '';
}

function sendNotification(label, message, toolInfo) {
  const kürzelMatch = label.match(/^@(.+)$/);
  if (kürzelMatch && kürzelMatch[1] === MAIN_SESSION) return;

  const detail = formatToolDetail(toolInfo);
  const text = `🔐 ${label}: ${message}${detail}`;
  if (kürzelMatch) {
    const k = kürzelMatch[1];
    sendWithButtons(text, [
      { text: '✅ Allow', callback_data: `allow:${k}` },
      { text: '❌ Deny', callback_data: `deny:${k}` },
    ]);
  } else {
    send(text);
  }
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => (input += chunk));
process.stdin.on('end', () => {
  clearTimeout(timeout);
  try {
    const data = JSON.parse(input || '{}');
    const kürzel = getKürzel(data.session_id);
    const label = kürzel ? `@${kürzel}` : 'Claude';
    const message = data.message || 'Permission required';
    const toolInfo = loadToolDetails(data.session_id);
    sendNotification(label, message, toolInfo);
  } catch {
    send('🔐 Claude is waiting for permission!');
  }
  process.exit(0);
});
