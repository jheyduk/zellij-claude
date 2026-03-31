import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as zellij from '../src/zellij.js';
import { execute } from '../src/dispatch.js';

const server = new McpServer({
  name: 'zellij-claude',
  version: '0.1.0',
});

async function run(cmd) {
  return { content: [{ type: 'text', text: await execute(cmd, { zellij }) }] };
}

server.tool('zellij_ls', 'List active Claude Code sessions', {}, async () => {
  return run({ type: 'ls' });
});

server.tool('zellij_last', 'Show last response(s) from a session', {
  name: z.string().describe('Session name (e.g. "hub", without @)'),
  count: z.number().optional().default(1).describe('Number of responses to return'),
}, async ({ name, count }) => {
  return run({ type: 'last', kürzel: name, lines: count });
});

server.tool('zellij_send', 'Send a message to a session', {
  name: z.string().describe('Session name (e.g. "hub", without @)'),
  message: z.string().describe('Message text to send'),
}, async ({ name, message }) => {
  return run({ type: 'send', kürzel: name, message });
});

server.tool('zellij_open', 'Open a new Claude Code session in a new tab', {
  path: z.string().optional().describe('Working directory (auto-resolved from name if omitted)'),
  name: z.string().optional().describe('Session name (auto-derived from path if omitted)'),
  flags: z.string().optional().default('').describe('Extra claude CLI flags'),
}, async ({ path, name, flags }) => {
  return run({ type: 'open', kürzel: name || null, path: path || null, claudeFlags: flags });
});

server.tool('zellij_goto', 'Switch to a session tab', {
  name: z.string().describe('Session name (e.g. "hub", without @)'),
}, async ({ name }) => {
  return run({ type: 'goto', kürzel: name });
});

server.tool('zellij_rename', 'Rename a session', {
  from: z.string().describe('Current session name'),
  to: z.string().describe('New session name'),
}, async ({ from, to }) => {
  return run({ type: 'rename', fromKürzel: from, toKürzel: to });
});

const transport = new StdioServerTransport();
await server.connect(transport);
