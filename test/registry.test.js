import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTabs,
  findTab,
  deriveKürzel,
  resolveKürzel,
} from '../src/registry.js';

test('parseTabs', async t => {
  await t.test('filters tabs starting with @', () => {
    const tabs = [
      { name: '@foo', active: true, tabId: '1' },
      { name: '@bar', active: false, tabId: '2' },
      { name: 'baz', active: false, tabId: '3' },
    ];
    const result = parseTabs(tabs);
    assert.equal(result.length, 2);
    assert.deepEqual(result[0], {
      kürzel: 'foo',
      name: '@foo',
      active: true,
      tabId: '1',
    });
    assert.deepEqual(result[1], {
      kürzel: 'bar',
      name: '@bar',
      active: false,
      tabId: '2',
    });
  });

  await t.test('ignores tabs without @ prefix', () => {
    const tabs = [
      { name: 'foo', active: true, tabId: '1' },
      { name: 'bar', active: false, tabId: '2' },
    ];
    const result = parseTabs(tabs);
    assert.equal(result.length, 0);
  });

  await t.test('handles empty tab list', () => {
    const result = parseTabs([]);
    assert.deepEqual(result, []);
  });

  await t.test('extracts kürzel from @ prefix', () => {
    const tabs = [
      { name: '@myproject', active: false, tabId: '1' },
    ];
    const result = parseTabs(tabs);
    assert.equal(result[0].kürzel, 'myproject');
  });
});

test('findTab', async t => {
  await t.test('finds tab by kürzel', () => {
    const sessions = [
      { kürzel: 'foo', name: '@foo' },
      { kürzel: 'bar', name: '@bar' },
      { kürzel: 'baz', name: '@baz' },
    ];
    const result = findTab('bar', sessions);
    assert.deepEqual(result, { kürzel: 'bar', name: '@bar' });
  });

  await t.test('returns undefined if kürzel not found', () => {
    const sessions = [
      { kürzel: 'foo', name: '@foo' },
    ];
    const result = findTab('nonexistent', sessions);
    assert.equal(result, undefined);
  });

  await t.test('handles empty sessions array', () => {
    const result = findTab('foo', []);
    assert.equal(result, undefined);
  });

  await t.test('finds first matching tab', () => {
    const sessions = [
      { kürzel: 'foo', name: '@foo', value: 1 },
      { kürzel: 'foo', name: '@foo-duplicate', value: 2 },
    ];
    const result = findTab('foo', sessions);
    assert.equal(result.value, 1);
  });
});

test('deriveKürzel', async t => {
  await t.test('extracts basename from path', () => {
    const result = deriveKürzel('/home/user/myproject');
    assert.equal(result, 'myproject');
  });

  await t.test('removes trailing slashes', () => {
    const result = deriveKürzel('/home/user/myproject/');
    assert.equal(result, 'myproject');
  });

  await t.test('handles multiple trailing slashes', () => {
    const result = deriveKürzel('/home/user/myproject///');
    assert.equal(result, 'myproject');
  });

  await t.test('handles relative paths', () => {
    const result = deriveKürzel('myproject');
    assert.equal(result, 'myproject');
  });

  await t.test('handles single directory', () => {
    const result = deriveKürzel('myproject/');
    assert.equal(result, 'myproject');
  });

  await t.test('handles dot paths', () => {
    const result = deriveKürzel('/home/user/my.project');
    assert.equal(result, 'my.project');
  });

  await t.test('handles hyphenated names', () => {
    const result = deriveKürzel('/home/user/my-project');
    assert.equal(result, 'my-project');
  });
});

test('resolveKürzel', async t => {
  await t.test('returns kürzel if no collision', () => {
    const sessions = [
      { kürzel: 'foo' },
      { kürzel: 'bar' },
    ];
    const result = resolveKürzel('baz', sessions);
    assert.equal(result, 'baz');
  });

  await t.test('appends -2 on first collision', () => {
    const sessions = [
      { kürzel: 'foo' },
      { kürzel: 'bar' },
    ];
    const result = resolveKürzel('foo', sessions);
    assert.equal(result, 'foo-2');
  });

  await t.test('appends -3 when -2 is taken', () => {
    const sessions = [
      { kürzel: 'foo' },
      { kürzel: 'foo-2' },
    ];
    const result = resolveKürzel('foo', sessions);
    assert.equal(result, 'foo-3');
  });

  await t.test('handles multiple collisions', () => {
    const sessions = [
      { kürzel: 'foo' },
      { kürzel: 'foo-2' },
      { kürzel: 'foo-3' },
      { kürzel: 'foo-4' },
    ];
    const result = resolveKürzel('foo', sessions);
    assert.equal(result, 'foo-5');
  });

  await t.test('handles empty sessions', () => {
    const result = resolveKürzel('foo', []);
    assert.equal(result, 'foo');
  });

  await t.test('handles kürzel with hyphen in original name', () => {
    const sessions = [
      { kürzel: 'my-project' },
      { kürzel: 'my-project-2' },
    ];
    const result = resolveKürzel('my-project', sessions);
    assert.equal(result, 'my-project-3');
  });

  await t.test('does not collide with unrelated hyphens', () => {
    const sessions = [
      { kürzel: 'foo-bar' },
      { kürzel: 'foo-bar-2' },
    ];
    const result = resolveKürzel('foo', sessions);
    assert.equal(result, 'foo');
  });

  await t.test('handles large collision numbers', () => {
    const sessions = [
      { kürzel: 'test' },
      { kürzel: 'test-2' },
      { kürzel: 'test-3' },
      { kürzel: 'test-4' },
      { kürzel: 'test-5' },
      { kürzel: 'test-6' },
      { kürzel: 'test-7' },
      { kürzel: 'test-8' },
      { kürzel: 'test-9' },
      { kürzel: 'test-10' },
    ];
    const result = resolveKürzel('test', sessions);
    assert.equal(result, 'test-11');
  });
});
