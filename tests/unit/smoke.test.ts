import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATE_VERSION, ENGINE_NAME } from '../../src/core/index.ts';

test('core exposes version + name', () => {
  assert.equal(STATE_VERSION, 3);
  assert.equal(ENGINE_NAME, 'myspolly-core');
});
