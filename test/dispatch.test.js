import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, execute } from '../src/dispatch.js';

// ---------------------------------------------------------------------------
// parseCommand tests
// ---------------------------------------------------------------------------

describe('parseCommand', () => {
  it('/ls returns ls type', () => {
    assert.deepEqual(parseCommand('/ls'), { type: 'ls' });
  });

  it('/open with explicit kürzel and path', () => {
    assert.deepEqual(parseCommand('/open @foo /some/path'), {
      type: 'open',
      kürzel: 'foo',
      path: '/some/path',
      claudeFlags: '',
    });
  });

  it('/open with path only (auto-derive)', () => {
    assert.deepEqual(parseCommand('/open /some/path'), {
      type: 'open',
      kürzel: null,
      path: '/some/path',
      claudeFlags: '',
    });
  });

  it('/open with extra claude flags', () => {
    assert.deepEqual(parseCommand('/open /some/path -- --model claude-3-5-haiku'), {
      type: 'open',
      kürzel: null,
      path: '/some/path',
      claudeFlags: '--model claude-3-5-haiku',
    });
  });

  it('/open with explicit kürzel and claude flags', () => {
    assert.deepEqual(parseCommand('/open @bar /my/proj -- --verbose'), {
      type: 'open',
      kürzel: 'bar',
      path: '/my/proj',
      claudeFlags: '--verbose',
    });
  });

  it('/last with default count (should be 1)', () => {
    assert.deepEqual(parseCommand('/last @foo'), {
      type: 'last',
      kürzel: 'foo',
      lines: 1,
    });
  });

  it('/last with custom count', () => {
    assert.deepEqual(parseCommand('/last @foo 5'), {
      type: 'last',
      kürzel: 'foo',
      lines: 5,
    });
  });

  it('/goto', () => {
    assert.deepEqual(parseCommand('/goto @myproj'), {
      type: 'goto',
      kürzel: 'myproj',
    });
  });

  it('/rename', () => {
    assert.deepEqual(parseCommand('/rename @old @new'), {
      type: 'rename',
      fromKürzel: 'old',
      toKürzel: 'new',
    });
  });

  it('@kürzel message (send shorthand)', () => {
    assert.deepEqual(parseCommand('@foo hello there'), {
      type: 'send',
      kürzel: 'foo',
      message: 'hello there',
    });
  });

  it('@kürzel multiline message', () => {
    const result = parseCommand('@foo line one\nline two');
    assert.equal(result.type, 'send');
    assert.equal(result.kürzel, 'foo');
    assert.equal(result.message, 'line one\nline two');
  });

  it('unknown input returns unknown type with raw', () => {
    assert.deepEqual(parseCommand('/bogus stuff'), {
      type: 'unknown',
      raw: '/bogus stuff',
    });
  });

  it('leading/trailing whitespace is trimmed', () => {
    assert.deepEqual(parseCommand('  /ls  '), { type: 'ls' });
  });
});

// ---------------------------------------------------------------------------
// execute tests
// ---------------------------------------------------------------------------

function makeTabs(...specs) {
  // specs: [{ kürzel, active, tabId }]
  return specs.map(({ kürzel, active = false, tabId }) => ({
    name: `@${kürzel}`,
    active,
    tabId,
  }));
}

describe('execute – ls', () => {
  it('returns formatted list with (active) marker', async () => {
    const zellij = {
      listTabs: () => makeTabs(
        { kürzel: 'alpha', active: true, tabId: 0 },
        { kürzel: 'beta', active: false, tabId: 1 },
      ),
    };
    const result = await execute({ type: 'ls' }, { zellij });
    assert.equal(result, '@alpha (active)\n@beta');
  });

  it('returns no-sessions message when list is empty', async () => {
    const zellij = { listTabs: () => [] };
    const result = await execute({ type: 'ls' }, { zellij });
    assert.equal(result, 'No sessions found.');
  });

  it('ignores tabs that do not start with @', async () => {
    const zellij = {
      listTabs: () => [
        { name: 'zsh', active: false, tabId: 0 },
        { name: '@proj', active: true, tabId: 1 },
      ],
    };
    const result = await execute({ type: 'ls' }, { zellij });
    assert.equal(result, '@proj (active)');
  });
});

describe('execute – last', () => {
  it('returns parsed Claude response when screen contains ⏺', async () => {
    const zellij = {
      listTabs: () => makeTabs({ kürzel: 'foo', active: true, tabId: 0 }),
      dumpScreen: () => '⏺ Answer.\n\n❯ ',
    };
    const result = await execute({ type: 'last', kürzel: 'foo', lines: 1 }, { zellij });
    assert.equal(result, 'Answer.');
  });

  it('falls back to raw lines when no ⏺ block found', async () => {
    const zellij = {
      listTabs: () => makeTabs({ kürzel: 'foo', active: true, tabId: 0 }),
      dumpScreen: () => 'line1\nline2\nline3',
    };
    const result = await execute({ type: 'last', kürzel: 'foo', lines: 2 }, { zellij });
    assert.equal(result, 'line2\nline3');
  });

  it('returns no-output message when screen is empty', async () => {
    const zellij = {
      listTabs: () => makeTabs({ kürzel: 'foo', active: true, tabId: 0 }),
      dumpScreen: () => '',
    };
    const result = await execute({ type: 'last', kürzel: 'foo', lines: 1 }, { zellij });
    assert.equal(result, 'No output available.');
  });

  it('returns error for unknown kürzel', async () => {
    const zellij = {
      listTabs: () => makeTabs({ kürzel: 'bar', active: false, tabId: 0 }),
    };
    const result = await execute({ type: 'last', kürzel: 'missing', lines: 1 }, { zellij });
    assert.match(result, /not found/);
    assert.match(result, /@bar/);
  });

  it('passes max(50, lines*50) to dumpScreen', async () => {
    let capturedLines;
    const zellij = {
      listTabs: () => makeTabs({ kürzel: 'foo', active: true, tabId: 0 }),
      dumpScreen: (_name, lines) => { capturedLines = lines; return ''; },
    };
    await execute({ type: 'last', kürzel: 'foo', lines: 3 }, { zellij });
    assert.equal(capturedLines, 150);
  });

  it('uses minimum of 50 lines for dumpScreen', async () => {
    let capturedLines;
    const zellij = {
      listTabs: () => makeTabs({ kürzel: 'foo', active: true, tabId: 0 }),
      dumpScreen: (_name, lines) => { capturedLines = lines; return ''; },
    };
    await execute({ type: 'last', kürzel: 'foo', lines: 1 }, { zellij });
    assert.equal(capturedLines, 50);
  });
});

describe('execute – goto', () => {
  it('calls goToTab and returns switched message', async () => {
    let called = null;
    const zellij = {
      listTabs: () => makeTabs({ kürzel: 'foo', active: false, tabId: 0 }),
      goToTab: name => { called = name; },
    };
    const result = await execute({ type: 'goto', kürzel: 'foo' }, { zellij });
    assert.equal(called, '@foo');
    assert.match(result, /Switched to @foo/);
  });

  it('returns error for unknown kürzel', async () => {
    const zellij = {
      listTabs: () => makeTabs({ kürzel: 'bar', active: false, tabId: 0 }),
    };
    const result = await execute({ type: 'goto', kürzel: 'nope' }, { zellij });
    assert.match(result, /not found/);
  });
});

describe('execute – rename', () => {
  it('calls renameTab with correct args', async () => {
    let renamedId = null, renamedTo = null;
    const zellij = {
      listTabs: () => makeTabs({ kürzel: 'old', active: false, tabId: 7 }),
      renameTab: (id, name) => { renamedId = id; renamedTo = name; },
    };
    const result = await execute({ type: 'rename', fromKürzel: 'old', toKürzel: 'new' }, { zellij });
    assert.equal(renamedId, 7);
    assert.equal(renamedTo, '@new');
    assert.match(result, /@old renamed to @new/);
  });

  it('returns error when source kürzel not found', async () => {
    const zellij = {
      listTabs: () => makeTabs({ kürzel: 'other', active: false, tabId: 0 }),
    };
    const result = await execute({ type: 'rename', fromKürzel: 'missing', toKürzel: 'new' }, { zellij });
    assert.match(result, /not found/);
  });
});

describe('execute – send', () => {
  it('calls writeChars with correct args and returns confirmation', async () => {
    let sentTo = null, sentMsg = null;
    const zellij = {
      listTabs: () => makeTabs({ kürzel: 'foo', active: true, tabId: 0 }),
      writeChars: (name, msg) => { sentTo = name; sentMsg = msg; },
    };
    const result = await execute({ type: 'send', kürzel: 'foo', message: 'hello' }, { zellij });
    assert.equal(sentTo, '@foo');
    assert.equal(sentMsg, 'hello');
    assert.match(result, /Message sent to @foo/);
  });

  it('returns error for unknown kürzel', async () => {
    const zellij = {
      listTabs: () => makeTabs({ kürzel: 'bar', active: false, tabId: 0 }),
    };
    const result = await execute({ type: 'send', kürzel: 'ghost', message: 'hi' }, { zellij });
    assert.match(result, /not found/);
    assert.match(result, /@bar/);
  });
});

describe('execute – open', () => {
  it('with explicit kürzel creates session', async () => {
    let createdName = null;
    const zellij = {
      listTabs: () => [],
      newTab: (name, _path, _cmd) => { createdName = name; return 42; },
    };
    const result = await execute(
      { type: 'open', kürzel: 'myproj', path: '/work/myproj', claudeFlags: '' },
      { zellij },
    );
    assert.equal(createdName, '@myproj');
    assert.match(result, /Session @myproj created \(Tab 42\)/);
  });

  it('rejects duplicate explicit kürzel', async () => {
    const zellij = {
      listTabs: () => makeTabs({ kürzel: 'myproj', active: false, tabId: 0 }),
    };
    const result = await execute(
      { type: 'open', kürzel: 'myproj', path: '/work/myproj', claudeFlags: '' },
      { zellij },
    );
    assert.match(result, /already running/);
    assert.match(result, /goto @myproj/);
  });

  it('with auto-derived kürzel uses basename of path', async () => {
    let createdName = null;
    const zellij = {
      listTabs: () => [],
      newTab: (name, _path, _cmd) => { createdName = name; return 1; },
    };
    const result = await execute(
      { type: 'open', kürzel: null, path: '/work/coolproject', claudeFlags: '' },
      { zellij },
    );
    assert.equal(createdName, '@coolproject');
    assert.match(result, /Session @coolproject created/);
  });

  it('appends numeric suffix for conflicting auto-derived kürzel', async () => {
    let createdName = null;
    const zellij = {
      listTabs: () => makeTabs({ kürzel: 'coolproject', active: false, tabId: 0 }),
      newTab: (name, _path, _cmd) => { createdName = name; return 2; },
    };
    await execute(
      { type: 'open', kürzel: null, path: '/work/coolproject', claudeFlags: '' },
      { zellij },
    );
    assert.equal(createdName, '@coolproject-2');
  });

  it('passes claudeFlags into the command', async () => {
    let capturedCmd = null;
    const zellij = {
      listTabs: () => [],
      newTab: (_name, _path, cmd) => { capturedCmd = cmd; return 1; },
    };
    await execute(
      { type: 'open', kürzel: null, path: '/work/proj', claudeFlags: '--model claude-3-5-haiku' },
      { zellij },
    );
    assert.match(capturedCmd, /--model claude-3-5-haiku/);
  });

  it('omits empty claudeFlags from command', async () => {
    let capturedCmd = null;
    const zellij = {
      listTabs: () => [],
      newTab: (_name, _path, cmd) => { capturedCmd = cmd; return 1; },
    };
    await execute(
      { type: 'open', kürzel: null, path: '/work/proj', claudeFlags: '' },
      { zellij },
    );
    // should not have trailing space or empty segment
    assert.ok(!capturedCmd.endsWith(' '), `Command should not end with space: "${capturedCmd}"`);
  });
});

describe('execute – unknown command', () => {
  it('returns unknown command message with raw text', async () => {
    const zellij = { listTabs: () => [] };
    const result = await execute({ type: 'unknown', raw: '/bogus stuff' }, { zellij });
    assert.match(result, /Unknown command: \/bogus stuff/);
  });

  it('falls back to cmd.type when raw is absent', async () => {
    const zellij = { listTabs: () => [] };
    const result = await execute({ type: 'unknown' }, { zellij });
    assert.match(result, /Unknown command: unknown/);
  });
});
