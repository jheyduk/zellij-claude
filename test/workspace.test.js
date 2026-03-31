import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveWorkspace } from '../src/workspace.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

describe('resolveWorkspace', () => {
  it('returns null for a kürzel with no matching directory', () => {
    const result = resolveWorkspace('nonexistent_xyzzy_42');
    assert.equal(result, null);
  });

  it('finds a directory in ~/prj if it exists', () => {
    const candidate = join(homedir(), 'prj', 'zellij-claude');
    if (existsSync(candidate)) {
      const result = resolveWorkspace('zellij-claude');
      assert.equal(result, candidate);
    }
  });
});
