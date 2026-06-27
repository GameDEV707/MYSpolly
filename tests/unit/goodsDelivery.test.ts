import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildInitialState } from '../../src/core/engine/setup.ts';
import { reduce } from '../../src/core/engine/reduce.ts';
import { legalActions } from '../../src/core/selectors/legalActions.ts';
import { shortestPath } from '../../src/core/selectors/connectivity.ts';
import type { GameState } from '../../src/core/model/state.ts';
import type { PlayerColor } from '../../src/core/model/types.ts';

function seats(n: number): { color: PlayerColor; name: string; isAI: boolean }[] {
  return (['red', 'blue', 'green', 'yellow'] as PlayerColor[])
    .slice(0, n)
    .map((c) => ({ color: c, name: c, isAI: true }));
}

/** Play random legal actions until a SELL happens, capturing its events. */
function playUntilSell(
  seed: number,
): { state: GameState; events: ReturnType<typeof reduce>['events'] } | null {
  let s = buildInitialState({ seats: seats(3), seed });
  let rng = seed * 2654435761;
  const rand = (): number => {
    rng = (rng ^ (rng << 13)) >>> 0;
    rng = (rng ^ (rng >> 17)) >>> 0;
    rng = (rng ^ (rng << 5)) >>> 0;
    return rng / 0xffffffff;
  };
  let guard = 0;
  while (s.phase === 'playing' && guard < 20000) {
    guard += 1;
    const acts = legalActions(s);
    if (acts.length === 0) break;
    const sells = acts.filter((a) => a.type === 'SELL');
    const chosen = sells.length > 0 ? sells[0]! : acts[Math.floor(rand() * acts.length)]!;
    const res = reduce(s, chosen);
    if (chosen.type === 'SELL') return { state: res.state, events: res.events };
    s = res.state;
  }
  return null;
}

describe('GOODS_SOLD event (Phase 8G)', () => {
  test('a Sell emits GOODS_SOLD with origin, merchant, and industry before the flip', () => {
    let found = false;
    for (let seed = 1; seed <= 40 && !found; seed += 1) {
      const r = playUntilSell(seed);
      if (!r) continue;
      const goods = r.events.find((e) => e.t === 'GOODS_SOLD');
      if (!goods || goods.t !== 'GOODS_SOLD') continue;
      found = true;
      assert.ok(goods.from, 'has origin location');
      assert.ok(goods.merchantId, 'has merchant id');
      assert.ok(goods.merchantLocationId, 'has merchant location');
      assert.ok(['cotton', 'manufacturer', 'pottery'].includes(goods.industry));
      // GOODS_SOLD must come before the matching TILE_FLIPPED in the stream.
      const gIdx = r.events.findIndex((e) => e.t === 'GOODS_SOLD');
      const fIdx = r.events.findIndex((e) => e.t === 'TILE_FLIPPED');
      assert.ok(gIdx >= 0 && fIdx >= 0 && gIdx < fIdx, 'GOODS_SOLD precedes TILE_FLIPPED');
    }
    assert.ok(found, 'a Sell with GOODS_SOLD occurred in the sampled games');
  });
});

describe('shortestPath for delivery routing', () => {
  test('returns the actual link path (not a straight line)', () => {
    const s = buildInitialState({ seats: seats(2), seed: 3 });
    // Place a chain of links red: dudley-birmingham-walsall.
    s.links = [
      { id: 'l1', owner: 'red', lineId: 'dudley__birmingham', type: 'canal' },
      { id: 'l2', owner: 'red', lineId: 'birmingham__walsall', type: 'canal' },
    ];
    const path = shortestPath(s, 'dudley', 'walsall');
    assert.deepEqual(path, ['dudley', 'birmingham', 'walsall']);
  });

  test('returns null when unconnected, and the single node when a===b', () => {
    const s = buildInitialState({ seats: seats(2), seed: 3 });
    assert.equal(shortestPath(s, 'dudley', 'oxford'), null);
    assert.deepEqual(shortestPath(s, 'dudley', 'dudley'), ['dudley']);
  });
});
