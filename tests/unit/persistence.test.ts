import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildInitialState } from '../../src/core/engine/setup.ts';
import { reduce } from '../../src/core/engine/reduce.ts';
import { legalActions } from '../../src/core/selectors/legalActions.ts';
import {
  serializeState,
  deserializeState,
  makeSaveMeta,
  SaveVersionError,
} from '../../src/persistence/serialize.ts';

describe('save serialization', () => {
  test('round-trips a game state exactly', () => {
    let s = buildInitialState({
      seats: [
        { color: 'red', name: 'R', isAI: false },
        { color: 'blue', name: 'B', isAI: true },
      ],
      seed: 9,
    });
    // Play a few actions to make the state non-trivial.
    for (let i = 0; i < 5 && s.phase === 'playing'; i += 1) {
      const acts = legalActions(s);
      s = reduce(s, acts[0]!).state;
    }
    const restored = deserializeState(serializeState(s));
    assert.deepEqual(restored, s);
  });

  test('rejects a newer save version', () => {
    const s = buildInitialState({
      seats: [
        { color: 'red', name: 'R', isAI: false },
        { color: 'blue', name: 'B', isAI: true },
      ],
      seed: 1,
    });
    const tampered = JSON.stringify({ ...s, version: 999 });
    assert.throws(() => deserializeState(tampered), SaveVersionError);
  });

  test('rejects data with no version', () => {
    assert.throws(() => deserializeState('{"foo":1}'), SaveVersionError);
  });

  test('meta summarises era, round and standings', () => {
    const s = buildInitialState({
      seats: [
        { color: 'red', name: 'R', isAI: false },
        { color: 'blue', name: 'B', isAI: true },
        { color: 'green', name: 'G', isAI: true },
      ],
      seed: 4,
    });
    const meta = makeSaveMeta(s);
    assert.equal(meta.players, 3);
    assert.equal(meta.era, 'canal');
    assert.equal(meta.colors.length, 3);
    assert.equal(Object.keys(meta.standings).length, 3);
  });
});
