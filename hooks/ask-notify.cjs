#!/usr/bin/env node
// PreToolUse(AskUserQuestion) hook: sends Telegram notification with kürzel and question.

const { send, getKürzel } = require('./telegram-helper.cjs');

let input = '';
const timeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => (input += chunk));
process.stdin.on('end', () => {
  clearTimeout(timeout);
  try {
    const data = JSON.parse(input || '{}');
    const kürzel = getKürzel(data.session_id);
    if (!kürzel) { process.exit(0); } // Not a zellij-claude session
    const question = data.tool_input?.question || 'Needs your input!';
    send(`🤖 @${kürzel} asks: ${question}`);
  } catch { /* silent */ }
  process.exit(0);
});
