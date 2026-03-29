#!/usr/bin/env node
// PreToolUse hook: caches latest tool call details per session.
// Read by permission-notify.cjs when a permission prompt fires.

const { writeFileSync } = require('fs');

let input = '';
const timeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => (input += chunk));
process.stdin.on('end', () => {
  clearTimeout(timeout);
  try {
    const data = JSON.parse(input || '{}');
    const sessionId = data.session_id || 'unknown';
    const info = {
      tool_name: data.tool_name || 'unknown',
      tool_input: data.tool_input || {},
      ts: Date.now(),
    };
    writeFileSync(`/tmp/zellij-claude-pending-tool-${sessionId}.json`, JSON.stringify(info));
  } catch { /* silent */ }
  process.exit(0);
});
