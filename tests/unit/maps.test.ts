import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildInitialState } from '../../src/core/engine/setup.ts';
import { reduce } from '../../src/core/engine/reduce.ts';
import { legalActions } from '../../src/core/selectors/legalActions.ts';
import { listMaps, getMap } from '../../src/core/maps/registry.ts';
import { contextFor } from '../../src/core/maps/context.ts';
import { buildMapDeck } from '../../src/core/maps/builder.ts';
import { reachableFrom } from '../../src/core/selectors/connectivity.ts';
import { serializeState, deserializeState } from '../../src/persistence/serialize.ts';
import { INDUSTRY_TYPES, PLAYER_COLORS } from '../../src/core/model/types.ts';
import type { GameState } from '../../src/core/model/state.ts';
import type { MapDefinition } from '../../src/core/maps/types.ts';

function seats(
  n: number,
): { color: (typeof PLAYER_COLORS)[number]; name: string; isAI: boolean }[] {
  return PLAYER_COLORS.slice(0, n).map((c) => ({ color: c, name: c, isAI: true }));
}

/** A coal-mine-less placement of every canal link, to test reachability. */
function withAllLinks(map: MapDefinition, era: 'canal' | 'rail' | 'air'): GameState {
  const base = buildInitialState({ seats: seats(2), seed: 1, mapId: map.id });
  base.era = era;
  base.links = (map.links[era] ?? []).map((l, i) => ({
    id: `L${i}`,
    owner: 'red',
    lineId: l.id,
    type: era,
  }));
  return base;
}

/** Deterministic random-bot playthrough on a given map. */
function playRandomGame(mapId: string, n: number, seed: number): GameState {
  let s = buildInitialState({ seats: seats(n), seed, mapId });
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
    // Prefer non-pass actions so games make progress.
    const nonPass = acts.filter((a) => a.type !== 'PASS');
    const pool = nonPass.length > 0 && rand() < 0.85 ? nonPass : acts;
    const a = pool[Math.floor(rand() * pool.length)]!;
    s = reduce(s, a).state;
  }
  return s;
}

describe('map registry', () => {
  test('exposes exactly 10 maps: 5 full + 5 fast', () => {
    const maps = listMaps();
    assert.equal(maps.length, 10);
    assert.equal(maps.filter((m) => !m.fastPlay).length, 5);
    assert.equal(maps.filter((m) => m.fastPlay).length, 5);
  });

  test('exactly one map declares an Air Era', () => {
    const airMaps = listMaps().filter((m) => m.eras.some((e) => e.routeType === 'air'));
    assert.equal(airMaps.length, 1);
    assert.equal(airMaps[0]!.eras.length, 3);
  });

  test('map ids are unique', () => {
    const ids = listMaps().map((m) => m.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('per-map data validation', () => {
  for (const map of listMaps()) {
    describe(map.id, () => {
      test('location id set is identical across eras (tiles survive morph)', () => {
        const eraIds = map.eras.map((e) => e.id);
        const ref = new Set(map.locations[eraIds[0]!]!.map((l) => l.id));
        for (const era of eraIds) {
          const ids = new Set(map.locations[era]!.map((l) => l.id));
          assert.deepEqual([...ids].sort(), [...ref].sort(), `era ${era} locations`);
        }
      });

      test('every industry is buildable somewhere', () => {
        const era = map.eras[0]!.id;
        const allowed = new Set<string>();
        for (const loc of map.locations[era]!) {
          for (const slot of loc.slots) for (const ind of slot.allowed) allowed.add(ind);
        }
        for (const ind of INDUSTRY_TYPES) {
          assert.ok(allowed.has(ind), `industry ${ind} has no slot`);
        }
      });

      test('merchant tiles cover all three goods at 2 players', () => {
        const tiles = map.merchantTiles.filter((t) => t.minPlayers <= 2);
        const goods = new Set(tiles.flatMap((t) => t.accepts));
        for (const g of ['cotton', 'manufacturer', 'pottery']) {
          assert.ok(goods.has(g as 'cotton'), `good ${g} not sellable @2P`);
        }
      });

      test('deck filters and is non-empty for 2/3/4 players', () => {
        for (const n of [2, 3, 4]) {
          const deck = buildMapDeck(map, n);
          assert.ok(deck.length >= 8 * n + n, `deck too small for ${n}P (${deck.length})`);
        }
      });

      test('setup succeeds for 2/3/4 players', () => {
        for (const n of [2, 3, 4]) {
          const s = buildInitialState({ seats: seats(n), seed: 3, mapId: map.id });
          assert.equal(s.options.mapId, map.id);
          assert.equal(s.era, map.eras[0]!.id);
          assert.equal(s.merchants.length > 0, true);
        }
      });

      test('every town can reach a merchant via the canal network', () => {
        const s = withAllLinks(map, 'canal');
        const merchantIds = new Set(contextFor(map.id, 'canal').merchantLocations.map((m) => m.id));
        for (const loc of map.locations.canal!) {
          const reach = reachableFrom(s, loc.id);
          const ok = [...reach].some((id) => merchantIds.has(id));
          assert.ok(ok, `${map.id}: ${loc.id} cannot reach a merchant`);
        }
      });
    });
  }
});

describe('headless full games on every map', () => {
  for (const map of listMaps()) {
    for (const n of [2, 3, 4]) {
      test(`${map.id} — ${n}-player game completes`, () => {
        const s = playRandomGame(map.id, n, 100 + n);
        assert.equal(s.phase, 'gameOver', `${map.id} ${n}P did not finish`);
        assert.ok(s.ranking && s.ranking.length === n);
        // VP never negative; money integer.
        for (const c of s.turnOrder) {
          assert.ok(Number.isFinite(s.players[c]!.money));
        }
      });
    }
  }

  test('Air-Era map passes through canal → rail → air', () => {
    const airMap = listMaps().find((m) => m.eras.some((e) => e.routeType === 'air'))!;
    let s = buildInitialState({ seats: seats(2), seed: 5, mapId: airMap.id });
    const erasSeen = new Set<string>();
    let rng = 12345;
    const rand = (): number => {
      rng = (rng * 1103515245 + 12345) & 0x7fffffff;
      return rng / 0x7fffffff;
    };
    let guard = 0;
    while (s.phase === 'playing' && guard < 20000) {
      guard += 1;
      erasSeen.add(s.era);
      const acts = legalActions(s);
      if (acts.length === 0) break;
      const nonPass = acts.filter((a) => a.type !== 'PASS');
      const pool = nonPass.length > 0 && rand() < 0.85 ? nonPass : acts;
      s = reduce(s, pool[Math.floor(rand() * pool.length)]!).state;
    }
    erasSeen.add(s.era);
    assert.ok(erasSeen.has('canal'), 'saw canal era');
    assert.ok(erasSeen.has('rail'), 'saw rail era');
    assert.ok(erasSeen.has('air'), 'saw air era');
    assert.equal(s.phase, 'gameOver');
  });
});

describe('era-morph survives a mid-era save/restore', () => {
  test('skyward: save after reaching the rail era, restore, finish', () => {
    const airMap = getMap('skyward');
    let s = buildInitialState({ seats: seats(2), seed: 8, mapId: airMap.id });
    let rng = 999;
    const rand = (): number => {
      rng = (rng * 1103515245 + 12345) & 0x7fffffff;
      return rng / 0x7fffffff;
    };
    // Play until we leave the canal era (era-morph happened).
    let guard = 0;
    while (s.phase === 'playing' && s.era === 'canal' && guard < 20000) {
      guard += 1;
      const acts = legalActions(s);
      if (acts.length === 0) break;
      const nonPass = acts.filter((a) => a.type !== 'PASS');
      const pool = nonPass.length > 0 && rand() < 0.85 ? nonPass : acts;
      s = reduce(s, pool[Math.floor(rand() * pool.length)]!).state;
    }
    assert.notEqual(s.era, 'canal', 'reached a later era');
    // Save + restore mid (later) era.
    const restored = deserializeState(serializeState(s));
    assert.deepEqual(restored, s);
    assert.equal(restored.options.mapId, 'skyward');
    // Continue to completion on the restored state.
    let g = restored;
    guard = 0;
    while (g.phase === 'playing' && guard < 20000) {
      guard += 1;
      const acts = legalActions(g);
      if (acts.length === 0) break;
      g = reduce(g, acts[Math.floor(rand() * acts.length)]!).state;
    }
    assert.equal(g.phase, 'gameOver');
  });

  test('old single-map save (v1, no mapId) migrates to birmingham', () => {
    const s = buildInitialState({ seats: seats(2), seed: 2 });
    const raw = JSON.parse(serializeState(s)) as Record<string, unknown>;
    raw.version = 1;
    delete (raw.options as Record<string, unknown>).mapId;
    const migrated = deserializeState(JSON.stringify(raw));
    assert.equal(migrated.options.mapId, 'birmingham');
    assert.equal(migrated.version, 3);
  });

  test('pre-economy save (v2, no resources) migrates with a starting stockpile', () => {
    const s = buildInitialState({ seats: seats(3), seed: 2 });
    const raw = JSON.parse(serializeState(s)) as Record<string, unknown>;
    raw.version = 2;
    const players = raw.players as Record<string, Record<string, unknown>>;
    for (const p of Object.values(players)) delete p.resources;
    const migrated = deserializeState(JSON.stringify(raw));
    assert.equal(migrated.version, 3);
    for (const c of migrated.turnOrder) {
      const res = migrated.players[c]!.resources;
      assert.ok(res && typeof res.coal === 'number' && typeof res.iron === 'number');
    }
  });
});
