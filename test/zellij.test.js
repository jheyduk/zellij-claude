import test from 'node:test';
import assert from 'node:assert/strict';
import * as zellij from '../src/zellij.js';

test('getSession throws when ZELLIJ_SESSION_NAME is not set', () => {
  const orig = process.env.ZELLIJ_SESSION_NAME;
  delete process.env.ZELLIJ_SESSION_NAME;
  try {
    assert.throws(
      () => zellij._exec.run(['dummy']),
      /ZELLIJ_SESSION_NAME not set/
    );
  } finally {
    if (orig) process.env.ZELLIJ_SESSION_NAME = orig;
  }
});

test('listTabs parses JSON and maps tab properties', () => {
  process.env.ZELLIJ_SESSION_NAME = 'test-session';

  const mockTabs = JSON.stringify([
    { name: 'tab1', active: true, tab_id: 1 },
    { name: 'tab2', active: false, tab_id: 2 },
  ]);

  zellij._exec.run = () => mockTabs;

  const result = zellij.listTabs();
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], { name: 'tab1', active: true, tabId: 1 });
  assert.deepEqual(result[1], { name: 'tab2', active: false, tabId: 2 });
});

test('listTabs handles empty tab list', () => {
  process.env.ZELLIJ_SESSION_NAME = 'test-session';

  zellij._exec.run = () => JSON.stringify([]);

  const result = zellij.listTabs();
  assert.equal(result.length, 0);
  assert.deepEqual(result, []);
});

test('newTab executes correct zellij action and returns parsed tab ID', () => {
  process.env.ZELLIJ_SESSION_NAME = 'test-session';

  let capturedArgs = null;
  zellij._exec.run = (args) => {
    capturedArgs = args;
    return '42\n';
  };

  const result = zellij.newTab('myTab', '/home/user', 'node app.js');

  assert.deepEqual(capturedArgs, ['new-tab', '--name', 'myTab', '--cwd', '/home/user', '--', 'node', 'app.js']);
  assert.equal(result, 42);
});

test('newTab splits command by whitespace', () => {
  process.env.ZELLIJ_SESSION_NAME = 'test-session';

  let capturedArgs = null;
  zellij._exec.run = (args) => {
    capturedArgs = args;
    return '10\n';
  };

  zellij.newTab('tab', '/tmp', 'npm run dev -- --port 3000');

  assert.deepEqual(capturedArgs, ['new-tab', '--name', 'tab', '--cwd', '/tmp', '--', 'npm', 'run', 'dev', '--', '--port', '3000']);
});

test('goToTab executes go-to-tab-name action', () => {
  process.env.ZELLIJ_SESSION_NAME = 'test-session';

  let capturedArgs = null;
  zellij._exec.run = (args) => {
    capturedArgs = args;
    return '';
  };

  zellij.goToTab('mytab');

  assert.deepEqual(capturedArgs, ['go-to-tab-name', 'mytab']);
});

test('renameTab converts tabId to string and executes action', () => {
  process.env.ZELLIJ_SESSION_NAME = 'test-session';

  let capturedArgs = null;
  zellij._exec.run = (args) => {
    capturedArgs = args;
    return '';
  };

  zellij.renameTab(5, 'newTabName');

  assert.deepEqual(capturedArgs, ['rename-tab', '--tab-id', '5', 'newTabName']);
});

test('writeChars navigates to tab and writes text with newline', () => {
  process.env.ZELLIJ_SESSION_NAME = 'test-session';

  const calls = [];
  zellij._exec.run = (args) => {
    calls.push(args);
    return '';
  };

  zellij.writeChars('myTab', 'hello world');

  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0], ['go-to-tab-name', 'myTab']);
  assert.deepEqual(calls[1], ['write-chars', 'hello world']);
  assert.deepEqual(calls[2], ['write', '13']);
});

test('dumpScreen uses pane-id to avoid tab switch', () => {
  process.env.ZELLIJ_SESSION_NAME = 'test-session';

  const screenOutput = 'line1\nline2\nline3';
  const paneJson = JSON.stringify([
    { tab_name: 'tab', id: 42, is_plugin: false, is_suppressed: false },
  ]);
  const calls = [];

  zellij._exec.run = (args) => {
    calls.push(args);
    if (args[0] === 'list-panes' && args[1] === '--json') return paneJson;
    if (args[0] === 'dump-screen') return screenOutput;
    return '';
  };

  const result = zellij.dumpScreen('tab', 5);

  assert.equal(result, screenOutput);
  // Should use --pane-id, NOT go-to-tab-name
  const dumpCall = calls.find(c => c[0] === 'dump-screen');
  assert.deepEqual(dumpCall, ['dump-screen', '--pane-id', '42']);
  assert.equal(calls.some(c => c[0] === 'go-to-tab-name'), false);
});

test('dumpScreen truncates output to last N lines when longer', () => {
  process.env.ZELLIJ_SESSION_NAME = 'test-session';

  const screenOutput = 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8';
  const paneJson = JSON.stringify([
    { tab_name: 'tab', id: 7, is_plugin: false, is_suppressed: false },
  ]);

  zellij._exec.run = (args) => {
    if (args[0] === 'list-panes') return paneJson;
    if (args[0] === 'dump-screen') return screenOutput;
    return '';
  };

  const result = zellij.dumpScreen('tab', 3);

  const expected = 'line6\nline7\nline8';
  assert.equal(result, expected);
});

test('dumpScreen falls back to go-to-tab when pane not found', () => {
  process.env.ZELLIJ_SESSION_NAME = 'test-session';

  const screenOutput = 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10';
  const paneJson = JSON.stringify([
    { tab_name: 'other-tab', id: 1, is_plugin: false, is_suppressed: false },
  ]);
  const calls = [];

  zellij._exec.run = (args) => {
    calls.push(args);
    if (args[0] === 'list-panes') return paneJson;
    if (args[0] === 'dump-screen') return screenOutput;
    return '';
  };

  const result = zellij.dumpScreen('tab');

  const expected = 'line6\nline7\nline8\nline9\nline10';
  assert.equal(result, expected);
  // Should fall back to go-to-tab-name since pane wasn't found
  assert.ok(calls.some(c => c[0] === 'go-to-tab-name'));
});
