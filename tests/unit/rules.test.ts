import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildInitialState } from '../../src/core/engine/setup.ts';
import { reduce, validate } from '../../src/core/engine/reduce.ts';
import { collectIncome } from '../../src/core/engine/income.ts';
import { buyCost, sellToMarket, nextBuyPrice } from '../../src/core/engine/market.ts';
import { scoreEra } from '../../src/core/engine/scoring.ts';
import { TOWN_BY_ID } from '../../src/core/data/board.ts';
import type { GameState, PlacedTile, Card } from '../../src/core/model/state.ts';
import type { PlayerColor } from '../../src/core/model/types.ts';

/** The real slot id at dudley that allows building a coal mine. */
function slotForCoal(): string {
  const dudley = TOWN_BY_ID.dudley!;
  const slot = dudley.slots.find((s) => s.allowed.includes('coal'));
  if (!slot) throw new Error('dudley has no coal slot');
  return slot.id;
}

function newGame(seed = 1): GameState {
  return buildInitialState({
    seats: [
      { color: 'red', name: 'R', isAI: true },
      { color: 'blue', name: 'B', isAI: true },
    ],
    seed,
  });
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
    flipped: t.flipped ?? false,
    resourcesLeft: t.resourcesLeft ?? 0,
  };
  s.tiles.push(tile);
  return tile;
}

describe('market mechanics', () => {
  test('buy price rises as the coal market empties', () => {
    const s = newGame();
    const m = s.coalMarket;
    assert.equal(nextBuyPrice(m), 1); // 13 cubes, cheapest filled = £1
    // Buying 3 cubes: £1 + £2 + £2 (ladder [_,1,2,2,3,...]).
    assert.equal(buyCost(m, 3), 1 + 2 + 2);
  });

  test('selling into a full market yields nothing; into a depleted one pays', () => {
    const s = newGame();
    s.coalMarket.cubes = s.coalMarket.capacity; // full
    assert.deepEqual(sellToMarket({ ...s.coalMarket }, 1), { revenue: 0, sold: 0 });
    const depleted = { ...s.coalMarket, cubes: 0 };
    const r = sellToMarket(depleted, 2);
    assert.ok(r.revenue > 0 && r.sold === 2);
  });
});

describe('Build action', () => {
  test('builds a Coal Mine: comes online (flipped + income), no consumable cubes', () => {
    const s = newGame();
    const actor = s.activePlayer;
    injectCard(s, actor, { id: 'L-dudley', kind: 'location', locationId: 'dudley', name: 'x' });
    const incomeBefore = s.players[actor]!.incomeLevel;
    const action = {
      type: 'BUILD' as const,
      card: { cardId: 'L-dudley' },
      industry: 'coal' as const,
      locationId: 'dudley',
      slotId: slotForCoal(),
      coalSources: [],
      ironSources: [],
    };
    assert.equal(validate(s, action), null);
    const { state } = reduce(s, action);
    const tile = state.tiles.find((t) => t.owner === actor && t.industry === 'coal');
    assert.ok(tile, 'coal mine placed');
    assert.equal(tile!.locationId, 'dudley');
    // §7.16: production buildings carry no consumable cubes and come online
    // immediately (flipped), advancing income.
    assert.equal(tile!.resourcesLeft, 0, 'no consumable cubes on production tiles');
    assert.equal(tile!.flipped, true, 'coal mine comes online (flipped)');
    assert.equal(state.players[actor]!.money, 12, '£17 − £5 build cost');
    assert.ok(state.players[actor]!.incomeLevel > incomeBefore, 'income advanced on build');
  });

  test('overbuild your own tile with a higher level', () => {
    const s = newGame();
    const actor = s.activePlayer;
    // Existing level-1 coal at dudley owned by the actor.
    const existing = placeTile(s, {
      owner: actor,
      industry: 'coal',
      level: 1,
      locationId: 'dudley',
      slotId: slotForCoal(),
    });
    // Remove the level-1 coal tile from the mat so the lowest is level 2.
    s.players[actor]!.matStacks.coal.shift();
    injectCard(s, actor, { id: 'L-dud2', kind: 'location', locationId: 'dudley', name: 'x' });
    const action = {
      type: 'BUILD' as const,
      card: { cardId: 'L-dud2' },
      industry: 'coal' as const,
      locationId: 'dudley',
      slotId: slotForCoal(),
      coalSources: [],
      ironSources: [],
      overbuildTileId: existing.id,
    };
    assert.equal(validate(s, action), null);
    const { state } = reduce(s, action);
    assert.ok(!state.tiles.some((t) => t.id === existing.id), 'old tile removed');
    const nw = state.tiles.find((t) => t.locationId === 'dudley' && t.industry === 'coal');
    assert.equal(nw!.level, 2, 'replaced with a level-2 coal mine');
  });
});

describe('Develop action', () => {
  test('cannot develop a lightbulb pottery (lowest pottery tile)', () => {
    const s = newGame();
    const actor = s.activePlayer;
    injectCard(s, actor, { id: 'any', kind: 'location', locationId: 'dudley', name: 'x' });
    const action = {
      type: 'DEVELOP' as const,
      card: { cardId: 'any' },
      removals: ['pottery' as const],
      ironSources: [],
    };
    assert.notEqual(validate(s, action), null);
  });

  test('can develop a non-lightbulb industry (coal)', () => {
    const s = newGame();
    const actor = s.activePlayer;
    // Give the actor a free iron source on the board.
    placeTile(s, {
      owner: actor,
      industry: 'iron',
      level: 1,
      resourcesLeft: 4,
      locationId: 'coalbrookdale',
      slotId: 's-i',
    });
    injectCard(s, actor, { id: 'd1', kind: 'location', locationId: 'dudley', name: 'x' });
    const action = {
      type: 'DEVELOP' as const,
      card: { cardId: 'd1' },
      removals: ['coal' as const],
      ironSources: [],
    };
    assert.equal(validate(s, action), null);
    const { state } = reduce(s, action);
    // The lowest coal tile (level 1) is gone from the mat.
    assert.ok(
      !state.players[actor]!.matStacks.coal.includes(1) ||
        state.players[actor]!.matStacks.coal.length < s.players[actor]!.matStacks.coal.length,
    );
  });
});

describe('Loan & Scout', () => {
  test('Loan respects the −10 income floor', () => {
    const s = newGame();
    const actor = s.activePlayer;
    s.players[actor]!.incomeLevel = -9;
    const card = s.players[actor]!.hand[0]!;
    const { state } = reduce(s, { type: 'LOAN', card: { cardId: card.id } });
    assert.equal(state.players[actor]!.incomeLevel, -10);
  });

  test('Scout is forbidden while holding a wild card', () => {
    const s = newGame();
    const actor = s.activePlayer;
    s.players[actor]!.hand = [
      { id: 'w', kind: 'wildIndustry', name: 'w' },
      { id: 'a', kind: 'location', locationId: 'dudley', name: 'a' },
      { id: 'b', kind: 'location', locationId: 'stone', name: 'b' },
      { id: 'c', kind: 'location', locationId: 'leek', name: 'c' },
    ];
    const action = {
      type: 'SCOUT' as const,
      card: { cardId: 'a' },
      extraDiscards: [{ cardId: 'b' }, { cardId: 'c' }] as [{ cardId: string }, { cardId: string }],
    };
    assert.notEqual(validate(s, action), null);
  });

  test('Scout gives a Wild Location + Wild Industry and consumes 3 cards', () => {
    const s = newGame();
    const actor = s.activePlayer;
    s.players[actor]!.hand = [
      { id: 'a', kind: 'location', locationId: 'dudley', name: 'a' },
      { id: 'b', kind: 'location', locationId: 'stone', name: 'b' },
      { id: 'c', kind: 'location', locationId: 'leek', name: 'c' },
    ];
    // Empty the deck so no refill masks the hand change.
    s.drawDeck = [];
    const action = {
      type: 'SCOUT' as const,
      card: { cardId: 'a' },
      extraDiscards: [{ cardId: 'b' }, { cardId: 'c' }] as [{ cardId: string }, { cardId: string }],
    };
    assert.equal(validate(s, action), null);
    const { state } = reduce(s, action);
    const hand = state.players[actor]!.hand;
    assert.ok(hand.some((c) => c.kind === 'wildLocation'));
    assert.ok(hand.some((c) => c.kind === 'wildIndustry'));
    assert.equal(state.wildLocationPile, 3);
    assert.equal(state.wildIndustryPile, 3);
  });
});

describe('Income collection', () => {
  test('negative income sells a tile then loses VP for the remainder', () => {
    const s = newGame();
    const actor = s.activePlayer;
    const p = s.players[actor]!;
    p.incomeLevel = -5;
    p.money = 0;
    p.vp = 10;
    placeTile(s, { owner: actor, industry: 'coal', level: 2 }); // build cost 7 → half 3
    const events: import('../../src/core/model/events.ts').GameEvent[] = [];
    collectIncome(s, actor, events);
    // due 5; sell tile (+3) pay 3 → due 2; lose 2 VP.
    assert.equal(s.tiles.length, 0, 'tile sold to cover shortfall');
    assert.equal(p.vp, 8);
    assert.equal(p.money, 0);
  });

  test('positive income adds money', () => {
    const s = newGame();
    const actor = s.activePlayer;
    s.players[actor]!.incomeLevel = 10;
    s.players[actor]!.money = 0;
    collectIncome(s, actor, []);
    assert.equal(s.players[actor]!.money, 10);
  });
});

describe('End-of-era scoring', () => {
  test('only flipped tiles score VP; links score and are removed', () => {
    const s = newGame();
    const actor = s.activePlayer;
    s.players[actor]!.vp = 0;
    // A flipped cotton level-1 tile (vp 5) and an unflipped one (no score).
    placeTile(s, {
      owner: actor,
      industry: 'cotton',
      level: 1,
      flipped: true,
      locationId: 'birmingham',
      slotId: 's-c1',
    });
    placeTile(s, {
      owner: actor,
      industry: 'cotton',
      level: 1,
      flipped: false,
      locationId: 'worcester',
      slotId: 's-c2',
    });
    const events: import('../../src/core/model/events.ts').GameEvent[] = [];
    scoreEra(s, 'canal', events);
    assert.equal(s.players[actor]!.vp, 5, 'only the flipped tile scored its 5 VP');
    assert.equal(s.links.length, 0);
  });
});

// --- helpers ---
