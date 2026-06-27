import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildInitialState, type PlayerSeat } from '../../src/core/engine/setup.ts';
import { reduce, validate } from '../../src/core/engine/reduce.ts';
import { legalActions } from '../../src/core/selectors/legalActions.ts';
import { planResource, consumeResource } from '../../src/core/engine/consume.ts';
import { playerProduction, produceResources } from '../../src/core/engine/production.ts';
import {
  DEFAULT_STARTING_RESOURCES,
  PRODUCTION_TABLE,
  STOCKPILE_CAP,
  productionForLevel,
} from '../../src/core/data/economy.ts';
import { TOWN_BY_ID } from '../../src/core/data/board.ts';
import { nextInt } from '../../src/core/rng.ts';
import type { GameState, PlacedTile, Card } from '../../src/core/model/state.ts';
import type { GameEvent } from '../../src/core/model/events.ts';
import type { BuildAction } from '../../src/core/model/actions.ts';
import type { PlayerColor } from '../../src/core/model/types.ts';

function seats(n: number): PlayerSeat[] {
  const colors = ['red', 'blue', 'green', 'yellow'] as const;
  return colors.slice(0, n).map((c) => ({ color: c, name: c, isAI: true }));
}

function newGame(seed = 1, n = 2): GameState {
  return buildInitialState({ seats: seats(n), seed });
}

/** Find the slot id at a location that allows `industry`. */
function slotFor(locationId: string, industry: PlacedTile['industry']): string {
  const loc = TOWN_BY_ID[locationId];
  const slot = loc?.slots.find((s) => s.allowed.includes(industry));
  if (!slot) throw new Error(`${locationId} has no ${industry} slot`);
  return slot.id;
}

function injectCard(s: GameState, color: PlayerColor, card: Card): void {
  s.players[color]!.hand.unshift(card);
}

function placeTile(s: GameState, t: Partial<PlacedTile> & { owner: PlayerColor }): PlacedTile {
  const tile: PlacedTile = {
    id: t.id ?? `tt${s.idSeq++}`,
    owner: t.owner,
    industry: t.industry ?? 'coal',
    level: t.level ?? 1,
    locationId: t.locationId ?? 'dudley',
    slotId: t.slotId ?? 's-x',
    flipped: t.flipped ?? true,
    resourcesLeft: 0,
  };
  s.tiles.push(tile);
  return tile;
}

function placeLink(s: GameState, owner: PlayerColor, lineId: string): void {
  s.links.push({ id: `l${s.idSeq++}`, owner, lineId, type: 'canal' });
}

// ---------------------------------------------------------------------------
// 9.1 / 9.3 — stockpiles & starting resources
// ---------------------------------------------------------------------------

describe('§9.1/9.3 — per-player stockpile & starting resources', () => {
  for (const n of [2, 3, 4]) {
    test(`every player starts with the seed stockpile (${n}P)`, () => {
      const s = newGame(5, n);
      for (const color of s.turnOrder) {
        const r = s.players[color]!.resources;
        assert.deepEqual(r, DEFAULT_STARTING_RESOURCES, 'starting stockpile granted');
        assert.equal(r.coal, 2);
        assert.equal(r.iron, 1);
        assert.equal(r.juice, 1);
      }
    });
  }

  test('the stockpile survives serialization (it is part of GameState)', () => {
    const s = newGame(9);
    const clone = JSON.parse(JSON.stringify(s)) as GameState;
    assert.deepEqual(clone.players[s.activePlayer]!.resources, { coal: 2, iron: 1, juice: 1 });
  });
});

// ---------------------------------------------------------------------------
// 9.4 / 9.5 / 9.7 — per-round production, upgrades, caps
// ---------------------------------------------------------------------------

describe('§9.4 — per-round production by building type + level', () => {
  test('production table matches §7.16.2 (tunable)', () => {
    assert.deepEqual(PRODUCTION_TABLE.coal, { 1: 1, 2: 2, 3: 3, 4: 4 });
    assert.deepEqual(PRODUCTION_TABLE.iron, { 1: 1, 2: 2, 3: 3, 4: 3 });
    assert.deepEqual(PRODUCTION_TABLE.juice, { 1: 1, 2: 1, 3: 2, 4: 2 });
  });

  test('playerProduction sums owned production buildings by level', () => {
    const s = newGame();
    const me = s.activePlayer;
    placeTile(s, { owner: me, industry: 'coal', level: 1 });
    placeTile(s, { owner: me, industry: 'coal', level: 3, locationId: 'stone', slotId: 's-c' });
    placeTile(s, { owner: me, industry: 'iron', level: 2, locationId: 'leek', slotId: 's-i' });
    placeTile(s, { owner: me, industry: 'juice', level: 1, locationId: 'stoke', slotId: 's-j' });
    // A non-production tile contributes nothing.
    placeTile(s, { owner: me, industry: 'cotton', level: 1, locationId: 'derby', slotId: 's-x2' });
    const prod = playerProduction(s, me);
    assert.equal(prod.coal, 1 + 3);
    assert.equal(prod.iron, 2);
    assert.equal(prod.juice, 1);
    assert.equal(prod.buildings.length, 4);
  });

  test("a player's production never counts another player's buildings", () => {
    const s = newGame();
    const [me, them] = s.turnOrder;
    placeTile(s, { owner: them!, industry: 'coal', level: 4 });
    assert.equal(playerProduction(s, me!).coal, 0, 'no freeloading on production either');
  });

  test('produceResources adds to the stockpile and emits RESOURCE_PRODUCED', () => {
    const s = newGame();
    const me = s.activePlayer;
    s.players[me]!.resources = { coal: 0, iron: 0, juice: 0 };
    placeTile(s, { owner: me, industry: 'coal', level: 2 }); // +2 coal
    placeTile(s, { owner: me, industry: 'iron', level: 1, locationId: 'leek', slotId: 's-i' }); // +1 iron
    const events: GameEvent[] = [];
    produceResources(s, me, events);
    assert.equal(s.players[me]!.resources.coal, 2);
    assert.equal(s.players[me]!.resources.iron, 1);
    const ev = events.find((e) => e.t === 'RESOURCE_PRODUCED');
    assert.ok(ev && ev.t === 'RESOURCE_PRODUCED');
    assert.equal(ev.coal, 2);
    assert.equal(ev.iron, 1);
    assert.deepEqual(ev.totals, { coal: 2, iron: 1, juice: 0 });
  });

  test('no production buildings → no production event', () => {
    const s = newGame();
    const me = s.activePlayer;
    const events: GameEvent[] = [];
    produceResources(s, me, events);
    assert.ok(!events.some((e) => e.t === 'RESOURCE_PRODUCED'));
  });
});

describe('§9.5 — develop/upgrade raises production from the next round', () => {
  test('upgrading a coal mine increases its per-round output', () => {
    const s = newGame();
    const me = s.activePlayer;
    const tile = placeTile(s, { owner: me, industry: 'coal', level: 1 });
    assert.equal(playerProduction(s, me).coal, productionForLevel('coal', 1));
    // Simulate the building being upgraded to level 3 (e.g. via overbuild).
    tile.level = 3;
    assert.equal(playerProduction(s, me).coal, productionForLevel('coal', 3));
    assert.ok(productionForLevel('coal', 3) > productionForLevel('coal', 1));
  });
});

describe('§9.7 — optional stockpile caps', () => {
  test('production is clamped to the configured cap', () => {
    const s = newGame();
    const me = s.activePlayer;
    const cap = STOCKPILE_CAP.coal!;
    s.players[me]!.resources = { coal: cap - 1, iron: 0, juice: 0 };
    placeTile(s, { owner: me, industry: 'coal', level: 4 }); // would add 4
    const events: GameEvent[] = [];
    produceResources(s, me, events);
    assert.equal(s.players[me]!.resources.coal, cap, 'clamped at the cap');
    const ev = events.find((e) => e.t === 'RESOURCE_PRODUCED');
    assert.ok(ev && ev.t === 'RESOURCE_PRODUCED' && ev.coal === 1, 'only the un-capped amount added');
  });
});

// ---------------------------------------------------------------------------
// 9.2 / 9.8 / 9.9 — consumption from own stockpile + market shortfall
// ---------------------------------------------------------------------------

describe('§9.8 — planResource (stockpile first, then market shortfall)', () => {
  test('covered entirely from the stockpile → no market spend', () => {
    const s = newGame();
    const me = s.activePlayer;
    s.players[me]!.resources.iron = 3;
    const plan = planResource(s, me, 'iron', 2);
    assert.deepEqual(plan, { ok: true, fromStock: 2, fromMarket: 0, marketCost: 0 });
  });

  test('iron shortfall is always buyable (no connection needed) and priced out', () => {
    const s = newGame();
    const me = s.activePlayer;
    s.players[me]!.resources.iron = 0;
    const plan = planResource(s, me, 'iron', 2);
    assert.equal(plan.ok, true);
    assert.equal(plan.fromStock, 0);
    assert.equal(plan.fromMarket, 2);
    assert.ok(plan.marketCost > 0, 'market cost computed');
  });

  test('coal shortfall is illegal when NOT connected to a merchant (§9.9)', () => {
    const s = newGame();
    const me = s.activePlayer;
    s.players[me]!.resources.coal = 0;
    const plan = planResource(s, me, 'coal', 1, 'dudley'); // no links → not connected
    assert.equal(plan.ok, false);
    assert.equal(plan.reasonKey, 'flow.why.noMarket');
  });

  test('coal shortfall is buyable once connected to a merchant', () => {
    const s = newGame();
    const me = s.activePlayer;
    s.players[me]!.resources.coal = 0;
    placeLink(s, me, 'coalbrookdale__shrewsbury'); // coalbrookdale ↔ merchant
    const plan = planResource(s, me, 'coal', 1, 'coalbrookdale');
    assert.equal(plan.ok, true);
    assert.equal(plan.fromMarket, 1);
    assert.ok(plan.marketCost > 0);
  });

  test('juice has no market → a shortfall is always illegal', () => {
    const s = newGame();
    const me = s.activePlayer;
    s.players[me]!.resources.juice = 0;
    const plan = planResource(s, me, 'juice', 1, 'dudley');
    assert.equal(plan.ok, false);
    assert.equal(plan.reasonKey, 'flow.why.noJuice');
  });
});

describe('§9.8 — consumeResource moves market prices & spends money', () => {
  test('buying an iron shortfall depletes the market and charges the player', () => {
    const s = newGame();
    const me = s.activePlayer;
    s.players[me]!.resources.iron = 0;
    s.players[me]!.money = 50;
    const cubesBefore = s.ironMarket.cubes;
    const moneyBefore = s.players[me]!.money;
    const events: GameEvent[] = [];
    consumeResource(s, me, 'iron', 2, undefined, events);
    assert.equal(s.ironMarket.cubes, cubesBefore - 2, 'market depleted cheapest-first');
    assert.ok(s.players[me]!.money < moneyBefore, 'money paid for the shortfall');
    // One RESOURCE_CONSUMED per unit (so previews count exactly).
    const consumed = events.filter((e) => e.t === 'RESOURCE_CONSUMED' && e.resource === 'iron');
    assert.equal(consumed.length, 2);
  });

  test('stockpile is drawn before the market', () => {
    const s = newGame();
    const me = s.activePlayer;
    s.players[me]!.resources.coal = 1;
    s.players[me]!.money = 50;
    placeLink(s, me, 'coalbrookdale__shrewsbury');
    const cubesBefore = s.coalMarket.cubes;
    const events: GameEvent[] = [];
    consumeResource(s, me, 'coal', 2, 'coalbrookdale', events);
    assert.equal(s.players[me]!.resources.coal, 0, 'stock spent first');
    assert.equal(s.coalMarket.cubes, cubesBefore - 1, 'only the 1-cube shortfall bought');
  });
});

// ---------------------------------------------------------------------------
// 9.2 / 9.9 — no freeloading at the action level
// ---------------------------------------------------------------------------

describe('§9.2/9.9 — no freeloading via legal actions', () => {
  function buildIronWorks(locationId: string): BuildAction {
    return {
      type: 'BUILD',
      card: { cardId: 'L-bw' },
      industry: 'iron',
      locationId,
      slotId: slotFor(locationId, 'iron'),
      coalSources: [],
      ironSources: [],
    };
  }

  test("an opponent's coal mine does NOT let you build a coal-needing tile", () => {
    const s = newGame();
    const [me, them] = s.turnOrder;
    // Make `me` active and give them a location card for coalbrookdale.
    s.activeIndex = s.turnOrder.indexOf(me!);
    s.activePlayer = me!;
    // Opponent owns a (producing) coal mine — irrelevant under §7.16.
    placeTile(s, { owner: them!, industry: 'coal', level: 4, locationId: 'dudley', slotId: 's-cz' });
    // `me` has no coal and is not connected to a merchant.
    s.players[me!]!.resources.coal = 0;
    injectCard(s, me!, { id: 'L-bw', kind: 'location', locationId: 'coalbrookdale', name: 'x' });
    // Iron Works needs 1 coal → must come from my own stockpile or a connected
    // market. I have neither → illegal.
    const action = buildIronWorks('coalbrookdale');
    assert.notEqual(validate(s, action), null, 'cannot freeload coal from the opponent');
  });

  test('with your own stockpile coal, the same build is legal and consumes YOUR coal', () => {
    const s = newGame();
    const me = s.activePlayer;
    s.players[me]!.resources.coal = 1;
    injectCard(s, me, { id: 'L-bw', kind: 'location', locationId: 'coalbrookdale', name: 'x' });
    const action = buildIronWorks('coalbrookdale');
    assert.equal(validate(s, action), null);
    const { state } = reduce(s, action);
    assert.equal(state.players[me]!.resources.coal, 0, 'consumed from own stockpile');
  });

  test('connected to a merchant, a coal shortfall becomes a market purchase', () => {
    const s = newGame();
    const me = s.activePlayer;
    s.players[me]!.resources.coal = 0;
    s.players[me]!.money = 50;
    placeLink(s, me, 'coalbrookdale__shrewsbury');
    injectCard(s, me, { id: 'L-bw', kind: 'location', locationId: 'coalbrookdale', name: 'x' });
    const action = buildIronWorks('coalbrookdale');
    assert.equal(validate(s, action), null, 'buyable from the connected coal market');
    const before = s.coalMarket.cubes;
    const { state } = reduce(s, action);
    assert.equal(state.coalMarket.cubes, before - 1, 'bought the coal shortfall from the market');
  });
});

// ---------------------------------------------------------------------------
// 9.11 — production buildings keep producing under a stable logical id
// ---------------------------------------------------------------------------

describe('§9.11 — stable logical id keeps production across eras', () => {
  test('a level-2 producer keeps the same id and output when the era advances', () => {
    const s = newGame();
    const me = s.activePlayer;
    const tile = placeTile(s, { owner: me, industry: 'coal', level: 2, locationId: 'birmingham' });
    const canalProd = playerProduction(s, me).coal;
    // Advance the era (logical ids are stable across eras by map invariant).
    s.era = 'rail';
    const railProd = playerProduction(s, me).coal;
    assert.equal(railProd, canalProd, 'same building, same output after the morph');
    assert.equal(s.tiles.find((t) => t.id === tile.id)?.level, 2, 'tile id stable across eras');
  });
});

// ---------------------------------------------------------------------------
// property: random play never corrupts the economy
// ---------------------------------------------------------------------------

describe('property — random play keeps the economy consistent', () => {
  for (const n of [2, 3, 4]) {
    test(`${n}-player random game: stockpiles stay non-negative & finite`, () => {
      let s = newGame(700 + n, n);
      let rng = (700 + n) * 2654435761;
      let guard = 0;
      while (s.phase !== 'gameOver' && guard < 20000) {
        const acts = legalActions(s);
        assert.ok(acts.length > 0);
        const nonPass = acts.filter((a) => a.type !== 'PASS');
        const step = nextInt(rng, 100);
        rng = step.state;
        const pool = nonPass.length > 0 && step.value < 75 ? nonPass : acts;
        const pick = nextInt(rng, pool.length);
        rng = pick.state;
        s = reduce(s, pool[pick.value]!).state;
        for (const color of s.turnOrder) {
          const r = s.players[color]!.resources;
          for (const res of ['coal', 'iron', 'juice'] as const) {
            assert.ok(r[res] >= 0, `${color} ${res} non-negative`);
            assert.ok(Number.isFinite(r[res]), `${color} ${res} finite`);
            const cap = STOCKPILE_CAP[res];
            if (cap !== null) assert.ok(r[res] <= cap, `${color} ${res} within cap`);
          }
        }
        guard += 1;
      }
      assert.equal(s.phase, 'gameOver');
    });
  }
});
