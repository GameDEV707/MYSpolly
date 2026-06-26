import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_INDUSTRY_LEVELS,
  INDUSTRY_LEVELS,
  INDUSTRY_TILE_TOTALS,
  ALL_LOCATION_IDS,
  LINK_LINES,
  LOCATIONS,
  TOWNS,
  MERCHANT_LOCATIONS,
  FULL_DECK,
  FULL_DECK_SIZE,
  buildDeckCards,
  WILD_INDUSTRY_COUNT,
  WILD_LOCATION_COUNT,
  COAL_MARKET,
  IRON_MARKET,
  COAL_MARKET_CAPACITY,
  IRON_MARKET_CAPACITY,
  INDUSTRY_TILES_PER_PLAYER,
  LINK_TILES_PER_PLAYER,
  initialMatStacks,
} from '../../src/core/data/index.ts';
import { INDUSTRY_TYPES } from '../../src/core/model/types.ts';

describe('industry tile data', () => {
  test('per-industry totals match the rulebook', () => {
    for (const industry of INDUSTRY_TYPES) {
      const total = INDUSTRY_LEVELS[industry].reduce((s, l) => s + l.count, 0);
      assert.equal(total, INDUSTRY_TILE_TOTALS[industry], `total for ${industry}`);
    }
  });

  test('45 industry tiles per colour', () => {
    const total = ALL_INDUSTRY_LEVELS.reduce((s, l) => s + l.count, 0);
    assert.equal(total, 45);
    assert.equal(total, INDUSTRY_TILES_PER_PLAYER);
  });

  test('initial mat stacks contain 45 tiles total', () => {
    const stacks = initialMatStacks();
    const total = Object.values(stacks).reduce((s, arr) => s + arr.length, 0);
    assert.equal(total, 45);
  });

  test('every level has sane, non-negative stats', () => {
    for (const l of ALL_INDUSTRY_LEVELS) {
      assert.ok(l.level >= 1, 'level >= 1');
      assert.ok(l.count >= 1, 'count >= 1');
      assert.ok(l.costMoney >= 0);
      assert.ok(l.costCoal >= 0);
      assert.ok(l.costIron >= 0);
      assert.ok(l.vp >= 0);
      assert.ok(l.incomeSpaces >= 0);
      assert.ok(l.buildableInCanal || l.buildableInRail, 'buildable in some era');
    }
  });

  test('only cotton/manufacturer/pottery require beer to sell', () => {
    for (const l of ALL_INDUSTRY_LEVELS) {
      if (l.beerToSell > 0) {
        assert.ok(
          ['cotton', 'manufacturer', 'pottery'].includes(l.industry),
          `${l.industry} should not need sell-beer`,
        );
      }
    }
  });

  test('only coal/iron mines and breweries produce resources', () => {
    for (const l of ALL_INDUSTRY_LEVELS) {
      if (l.resourceCount > 0) {
        assert.ok(['coal', 'iron', 'brewery'].includes(l.industry));
      }
    }
  });

  test('lightbulb potteries are not developable', () => {
    const nonDev = INDUSTRY_LEVELS.pottery.filter((l) => !l.developable);
    assert.ok(nonDev.length >= 1, 'at least one lightbulb pottery');
  });
});

describe('board data', () => {
  test('20 towns + 2 farm breweries', () => {
    assert.equal(TOWNS.length, 20);
    assert.equal(LOCATIONS.length, 22);
  });

  test('5 merchant locations with 9 tile spaces total', () => {
    assert.equal(MERCHANT_LOCATIONS.length, 5);
    const spaces = MERCHANT_LOCATIONS.reduce((s, m) => s + m.tileSpaces, 0);
    assert.equal(spaces, 9);
  });

  test('every link references valid endpoints', () => {
    const ids = new Set(ALL_LOCATION_IDS);
    for (const l of LINK_LINES) {
      assert.ok(ids.has(l.a), `link endpoint ${l.a} exists`);
      assert.ok(ids.has(l.b), `link endpoint ${l.b} exists`);
      assert.notEqual(l.a, l.b, 'no self-loops');
      assert.ok(l.types.length >= 1, 'link has at least one type');
    }
  });

  test('link ids are unique', () => {
    const ids = LINK_LINES.map((l) => l.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('there are no more links than tiles support across the network', () => {
    // 14 link tiles per colour; total physical link capacity comfortably
    // exceeds the number of distinct connections on the board.
    assert.ok(LINK_LINES.length <= LINK_TILES_PER_PLAYER * 4);
  });

  test('every slot allows at least one industry', () => {
    for (const loc of LOCATIONS) {
      assert.ok(loc.slots.length >= 1, `${loc.id} has slots`);
      for (const s of loc.slots) {
        assert.ok(s.allowed.length >= 1, `${loc.id}/${s.id} allows an industry`);
      }
    }
  });

  test('slot ids are unique across the board', () => {
    const ids = LOCATIONS.flatMap((l) => l.slots.map((s) => `${l.id}/${s.id}`));
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('card deck', () => {
  test('full deck is 64 cards', () => {
    assert.equal(FULL_DECK_SIZE, 64);
    assert.equal(FULL_DECK.length, 64);
  });

  test('8 wild cards (4 + 4)', () => {
    assert.equal(WILD_LOCATION_COUNT, 4);
    assert.equal(WILD_INDUSTRY_COUNT, 4);
  });

  test('deck shrinks for fewer players (colour + icon exclusions)', () => {
    const d4 = buildDeckCards(4).length;
    const d3 = buildDeckCards(3).length;
    const d2 = buildDeckCards(2).length;
    assert.equal(d4, 64);
    assert.ok(d3 < d4, '3P deck smaller than 4P');
    assert.ok(d2 < d3, '2P deck smaller than 3P');
  });

  test('2P deck excludes blue and teal location cards', () => {
    const d2 = buildDeckCards(2);
    const banned = d2.filter(
      (c) => c.kind === 'location' && (c.colorBand === 'blue' || c.colorBand === 'teal'),
    );
    assert.equal(banned.length, 0);
  });

  test('3P deck excludes teal but keeps blue location cards', () => {
    const d3 = buildDeckCards(3);
    assert.equal(d3.filter((c) => c.colorBand === 'teal').length, 0);
    assert.ok(d3.some((c) => c.colorBand === 'blue'));
  });
});

describe('markets', () => {
  test('coal market: capacity 14, empty price 8, 13 initial cubes', () => {
    assert.equal(COAL_MARKET_CAPACITY, 14);
    assert.equal(COAL_MARKET.emptyPrice, 8);
    assert.equal(COAL_MARKET.initialCubes, 13);
    assert.equal(Math.max(...COAL_MARKET.priceLadder), 7);
  });

  test('iron market: capacity 10, empty price 6, 8 initial cubes', () => {
    assert.equal(IRON_MARKET_CAPACITY, 10);
    assert.equal(IRON_MARKET.emptyPrice, 6);
    assert.equal(IRON_MARKET.initialCubes, 8);
    assert.equal(Math.max(...IRON_MARKET.priceLadder), 5);
  });

  test('price ladders are ascending', () => {
    for (const ladder of [COAL_MARKET.priceLadder, IRON_MARKET.priceLadder]) {
      for (let i = 1; i < ladder.length; i += 1) {
        assert.ok(ladder[i]! >= ladder[i - 1]!, 'non-decreasing ladder');
      }
    }
  });
});
