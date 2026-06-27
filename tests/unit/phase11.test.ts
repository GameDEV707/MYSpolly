import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildInitialState, type PlayerSeat } from '../../src/core/engine/setup.ts';
import { reduce, validate } from '../../src/core/engine/reduce.ts';
import { legalActions } from '../../src/core/selectors/legalActions.ts';
import { planResource, consumeResource } from '../../src/core/engine/consume.ts';
import { spend, payPlayer } from '../../src/core/engine/helpers.ts';
import {
  resolveBankruptcy,
  payOrBankrupt,
  tileHalfCost,
  type BankruptcyDecider,
} from '../../src/core/engine/bankruptcy.ts';
import { collectIncome } from '../../src/core/engine/income.ts';
import {
  FIXED_RESOURCE_PRICE,
  isMarketResource,
  halfCost,
} from '../../src/core/data/economy.ts';
import { nextBuyPrice, buyFromMarket, sellToMarket } from '../../src/core/engine/market.ts';
import { resourceSellerOptions } from '../../src/core/selectors/resources.ts';
import { bankruptcyEpisodes } from '../../src/app/components/hud/bankruptcyView.ts';
import { getLevelDef } from '../../src/core/data/industries.ts';
import { TOWN_BY_ID } from '../../src/core/data/board.ts';
import { boardContext } from '../../src/core/maps/context.ts';
import { nextInt } from '../../src/core/rng.ts';
import type { GameState, PlacedTile, Card } from '../../src/core/model/state.ts';
import type { GameEvent } from '../../src/core/model/events.ts';
import type { PlayerColor, IndustryType } from '../../src/core/model/types.ts';

function seats(n: number): PlayerSeat[] {
  const colors = ['red', 'blue', 'green', 'yellow'] as const;
  return colors.slice(0, n).map((c) => ({ color: c, name: c, isAI: true }));
}

function newGame(seed = 1, n = 2): GameState {
  return buildInitialState({ seats: seats(n), seed });
}

function injectCard(s: GameState, color: PlayerColor, card: Card): void {
  s.players[color]!.hand.unshift(card);
}

function placeTile(s: GameState, t: Partial<PlacedTile> & { owner: PlayerColor }): PlacedTile {
  const tile: PlacedTile = {
    id: t.id ?? `tt${s.idSeq++}`,
    owner: t.owner,
    industry: t.industry ?? 'cotton',
    level: t.level ?? 1,
    locationId: t.locationId ?? 'dudley',
    slotId: t.slotId ?? 's-x',
    flipped: t.flipped ?? false,
    resourcesLeft: 0,
  };
  s.tiles.push(tile);
  return tile;
}

/** Find a location id with a slot that allows `industry`. */
function locWithSlot(industry: IndustryType): { locationId: string; slotId: string } {
  for (const loc of Object.values(TOWN_BY_ID)) {
    const slot = loc.slots.find((sl) => sl.allowed.includes(industry));
    if (slot) return { locationId: loc.id, slotId: slot.id };
  }
  throw new Error(`no location with a ${industry} slot`);
}

// ===========================================================================
// 11.1 — spend() never drives money below £0
// ===========================================================================

describe('§11.1 — strict money gating', () => {
  test('spend() throws rather than going negative', () => {
    const s = newGame();
    const me = s.activePlayer;
    s.players[me]!.money = 3;
    assert.throws(() => spend(s, me, 5, []), /below £0|≥ 0/);
    assert.equal(s.players[me]!.money, 3, 'money unchanged after the rejected spend');
  });

  test('spend() rejects negative amounts', () => {
    const s = newGame();
    assert.throws(() => spend(s, s.activePlayer, -1, []));
  });

  test('payPlayer moves money buyer→owner and never goes negative', () => {
    const s = newGame();
    const [buyer, owner] = s.turnOrder;
    s.players[buyer!]!.money = 10;
    s.players[owner!]!.money = 10;
    const events: GameEvent[] = [];
    payPlayer(s, buyer!, owner!, 4, events);
    assert.equal(s.players[buyer!]!.money, 6);
    assert.equal(s.players[owner!]!.money, 14);
    assert.throws(() => payPlayer(s, buyer!, owner!, 999, []));
  });
});

// ===========================================================================
// 11.2 / 11.3 — full total-cost affordability + the £0-tile loophole
// ===========================================================================

describe('§11.2/§11.3 — full total cost & the £0-tile loophole', () => {
  /** Set the pottery mat so its lowest buildable tile is the £0 level 2. */
  function potteryL2Game(): { s: GameState; me: PlayerColor; loc: string; slot: string } {
    const s = newGame();
    const me = s.activePlayer;
    const { locationId, slotId } = locWithSlot('pottery');
    s.players[me]!.matStacks.pottery = [2, 3, 4, 5]; // lowest is the £0 L2 (needs 1 coal)
    injectCard(s, me, { id: 'L-pot', kind: 'location', locationId, name: 'x' });
    return { s, me, loc: locationId, slot: slotId };
  }

  test('Pottery L2 costs £0 but is BLOCKED when the coal it needs is unaffordable', () => {
    const { s, me, loc, slot } = potteryL2Game();
    const def = getLevelDef('pottery', 2);
    assert.equal(def.costMoney, 0, 'precondition: this tile is a £0 build');
    assert.equal(def.costCoal, 1, 'precondition: it still needs coal');
    s.players[me]!.money = 0;
    s.players[me]!.resources.coal = 0;
    for (const c of s.turnOrder) if (c !== me) s.players[c]!.resources.coal = 0; // nobody to buy from
    const action = {
      type: 'BUILD' as const,
      card: { cardId: 'L-pot' },
      industry: 'pottery' as const,
      locationId: loc,
      slotId: slot,
      coalSources: [],
      ironSources: [],
    };
    assert.notEqual(validate(s, action), null, 'a broke player cannot build the £0 tile it cannot fuel');
  });

  test('Pottery L2 builds for £0 when the player already holds the coal', () => {
    const { s, me, loc, slot } = potteryL2Game();
    s.players[me]!.money = 0;
    s.players[me]!.resources.coal = 1; // has the resource → genuinely free
    const action = {
      type: 'BUILD' as const,
      card: { cardId: 'L-pot' },
      industry: 'pottery' as const,
      locationId: loc,
      slotId: slot,
      coalSources: [],
      ironSources: [],
    };
    assert.equal(validate(s, action), null);
    const { state } = reduce(s, action);
    assert.equal(state.players[me]!.money, 0, 'still £0 — the build was free');
    assert.equal(state.players[me]!.resources.coal, 0, 'consumed the coal it held');
  });

  test('legalActions never includes an action the player cannot fully pay for', () => {
    const s = newGame();
    const me = s.activePlayer;
    s.players[me]!.money = 0;
    s.players[me]!.resources = { coal: 0, iron: 0, juice: 0 };
    for (const c of s.turnOrder) if (c !== me) s.players[c]!.resources = { coal: 0, iron: 0, juice: 0 };
    for (const a of legalActions(s)) {
      assert.equal(validate(s, a), null, `enumerated action ${a.type} must be legal`);
    }
  });
});

// ===========================================================================
// 11.4 — exact Network resource + money accounting
// ===========================================================================

describe('§11.4 — exact Network accounting', () => {
  function railGame(seed = 4): GameState {
    const s = newGame(seed);
    s.era = 'rail';
    s.isFirstCanalRound = false;
    s.actionsLeftThisTurn = 2;
    return s;
  }

  test('a double rail link consumes exactly coalPerLink×links + double-link juice from stock', () => {
    const s = railGame();
    const me = s.activePlayer;
    const lines = boardContext(s).links;
    const [l1, l2] = [lines[0]!, lines[1]!];
    const card = s.players[me]!.hand[0]!;
    s.players[me]!.resources = { coal: 2, iron: 0, juice: 1 };
    s.players[me]!.money = 30;
    const action = {
      type: 'NETWORK' as const,
      card: { cardId: card.id },
      links: [{ lineId: l1.id }, { lineId: l2.id }],
    };
    assert.equal(validate(s, action), null);
    const { state, events } = reduce(s, action);
    const coal = events.filter((e) => e.t === 'RESOURCE_CONSUMED' && e.resource === 'coal');
    const juice = events.filter((e) => e.t === 'RESOURCE_CONSUMED' && e.resource === 'juice');
    assert.equal(coal.length, 2, 'exactly 2 coal consumed (1 per link)');
    assert.equal(juice.length, 1, 'exactly 1 juice consumed for the double link');
    assert.equal(state.players[me]!.resources.coal, 0);
    assert.equal(state.players[me]!.resources.juice, 0);
    assert.equal(state.players[me]!.money, 30 - 15, 'only the £15 double-link cost (all resources from stock)');
  });

  test('a rail link buys its coal from another player when not market-connected', () => {
    const s = railGame(7);
    const [me, them] = s.turnOrder;
    s.activeIndex = s.turnOrder.indexOf(me!);
    s.activePlayer = me!;
    const line = boardContext(s).links[0]!;
    const card = s.players[me!]!.hand[0]!;
    s.players[me!]!.resources = { coal: 0, iron: 0, juice: 0 };
    s.players[me!]!.money = 30;
    s.players[them!]!.resources.coal = 3;
    const themMoneyBefore = s.players[them!]!.money;
    const price = nextBuyPrice(s.coalMarket);
    const action = {
      type: 'NETWORK' as const,
      card: { cardId: card.id },
      links: [{ lineId: line.id }],
    };
    assert.equal(validate(s, action), null);
    const { state, events } = reduce(s, action);
    const bought = events.find(
      (e) => e.t === 'RESOURCE_CONSUMED' && e.resource === 'coal' && String(e.from).startsWith('player:'),
    );
    assert.ok(bought, 'coal sourced from the other player');
    assert.equal(state.players[them!]!.resources.coal, 2, "seller's coal decreased by 1");
    assert.equal(state.players[them!]!.money, themMoneyBefore + price, 'seller was paid the market price');
    assert.equal(state.players[me!]!.money, 30 - 5 - price, 'buyer paid link cost + the coal');
    assert.equal(state.coalMarket.cubes, s.coalMarket.cubes, 'market untouched (bought from a player)');
  });
});

// ===========================================================================
// 11.6 — buy a shortfall from another player (units move, owner paid)
// ===========================================================================

describe('§11.6 — buy from another player', () => {
  test('consumeResource pays the owner and moves their stock for a peer purchase', () => {
    const s = newGame();
    const [me, them] = s.turnOrder;
    s.players[me!]!.resources.iron = 0;
    s.players[me!]!.money = 20;
    // No iron anywhere except the other player; iron market is connection-free,
    // so force the player path by emptying the iron market to the seller's price
    // being irrelevant — instead test peer purchase directly with no market.
    // Easiest: zero the market so the only cheaper source is the player.
    s.players[them!]!.resources.iron = 5;
    // Drain the iron market entirely so a market buy would cost emptyPrice; the
    // peer price equals the (now-empty) market buy price too — assert the units
    // and payment regardless. We instead route through a non-market resource to
    // guarantee the player path:
    s.players[me!]!.resources.juice = 0;
    s.players[them!]!.resources.juice = 2;
    const themMoneyBefore = s.players[them!]!.money;
    const events: GameEvent[] = [];
    consumeResource(s, me!, 'juice', 2, undefined, events, [them!]);
    assert.equal(s.players[me!]!.resources.juice, 0);
    assert.equal(s.players[them!]!.resources.juice, 0, "seller's juice was consumed");
    const paid = FIXED_RESOURCE_PRICE.juice! * 2;
    assert.equal(s.players[them!]!.money, themMoneyBefore + paid, 'seller paid the fixed price ×2');
    assert.equal(s.players[me!]!.money, 20 - paid, 'buyer paid for both units');
    const consumed = events.filter((e) => e.t === 'RESOURCE_CONSUMED');
    assert.equal(consumed.length, 2);
  });

  test('preferred seller is honoured when several players have the resource', () => {
    const s = newGame(2, 3);
    const [me, a, b] = s.turnOrder;
    s.players[me!]!.resources.juice = 0;
    s.players[a!]!.resources.juice = 5;
    s.players[b!]!.resources.juice = 5;
    const plan = planResource(s, me!, 'juice', 1, undefined, [b!]);
    assert.equal(plan.fromPlayers[b!], 1, 'bought from the preferred player');
    assert.equal(plan.fromPlayers[a!] ?? 0, 0);
  });

  test('resourceSellerOptions lists other holders + the unit price (picker data)', () => {
    const s = newGame(3, 3);
    const [me, a, b] = s.turnOrder;
    s.players[me!]!.resources.juice = 0;
    s.players[a!]!.resources.juice = 2;
    s.players[b!]!.resources.juice = 5;
    const opts = resourceSellerOptions(s, me!, 'juice');
    assert.equal(opts.length, 2);
    assert.equal(opts[0]!.color, b!, 'sorted most-available first');
    assert.equal(opts[0]!.available, 5);
    assert.equal(opts[0]!.unitPrice, FIXED_RESOURCE_PRICE.juice);
  });
});

// ===========================================================================
// 11.8 — market trades only coal & iron, with Brass ladder movement
// ===========================================================================

describe('§11.8 — market = coal/iron only, Brass ladder movement', () => {
  test('only coal and iron are market resources', () => {
    assert.equal(isMarketResource('coal'), true);
    assert.equal(isMarketResource('iron'), true);
    assert.equal(isMarketResource('juice'), false);
  });

  test('buying raises the price (cheapest filled cube first); empty market uses emptyPrice', () => {
    const m = { cubes: 3, capacity: 4, priceLadder: [1, 2, 3, 4], emptyPrice: 8 };
    // 3 cubes occupy indices 1..3 (prices 2,3,4); cheapest filled = index 1 = £2.
    assert.equal(nextBuyPrice(m), 2);
    assert.equal(buyFromMarket(m, 1), 2);
    assert.equal(m.cubes, 2);
    assert.equal(nextBuyPrice(m), 3, 'price rose to the next cheapest filled cube');
    // Drain to empty, then buy at the fixed empty price without going below 0.
    buyFromMarket(m, 2);
    assert.equal(m.cubes, 0);
    assert.equal(nextBuyPrice(m), 8);
    assert.equal(buyFromMarket(m, 1), 8, 'empty market sells at emptyPrice');
    assert.equal(m.cubes, 0, 'empty market is an unlimited supply');
  });

  test('selling lowers the price (cheapest empty space first)', () => {
    const m = { cubes: 1, capacity: 4, priceLadder: [1, 2, 3, 4], emptyPrice: 8 };
    // 1 cube at index 3 (£4); cheapest empty = index 2 = £3.
    const { revenue, sold } = sellToMarket(m, 1);
    assert.equal(sold, 1);
    assert.equal(revenue, 3, 'sold into the cheapest empty space');
    assert.equal(m.cubes, 2);
  });
});

// ===========================================================================
// 11.9 — fixed juice price
// ===========================================================================

describe('§11.9 — fixed price for non-market resources', () => {
  test('juice has a configured fixed price and no market', () => {
    assert.equal(typeof FIXED_RESOURCE_PRICE.juice, 'number');
    assert.equal(FIXED_RESOURCE_PRICE.coal, null);
    assert.equal(FIXED_RESOURCE_PRICE.iron, null);
  });

  test('a juice shortfall is bought at the fixed price from the supply', () => {
    const s = newGame();
    const me = s.activePlayer;
    s.players[me]!.resources.juice = 0;
    s.players[me]!.money = 20;
    for (const c of s.turnOrder) if (c !== me) s.players[c]!.resources.juice = 0;
    const events: GameEvent[] = [];
    consumeResource(s, me, 'juice', 2, undefined, events);
    assert.equal(s.players[me]!.money, 20 - FIXED_RESOURCE_PRICE.juice! * 2);
    const supply = events.filter(
      (e) => e.t === 'RESOURCE_CONSUMED' && e.from === 'supply' && e.cost === FIXED_RESOURCE_PRICE.juice,
    );
    assert.equal(supply.length, 2);
  });
});

// ===========================================================================
// 11.10–11.12 — bankruptcy: sell to bank, auction, VP fallback, never negative
// ===========================================================================

describe('§11.10–11.12 — bankruptcy resolution', () => {
  test('sell-to-bank at half covers the debt and removes the tile (with event)', () => {
    const s = newGame();
    const me = s.activePlayer;
    s.players[me]!.money = 0;
    s.players[me]!.vp = 10;
    placeTile(s, { owner: me, industry: 'cotton', level: 1 }); // build 12 → half 6
    const events: GameEvent[] = [];
    const res = resolveBankruptcy(s, me, 5, events); // default decider → bank (worth 12 < 16)
    assert.equal(s.tiles.length, 0, 'tile sold to the bank and removed');
    assert.equal(res.raised, 6);
    assert.equal(s.players[me]!.money, 1, 'kept the £1 surplus');
    assert.equal(s.players[me]!.vp, 10, 'no VP lost — the sale covered it');
    assert.ok(events.some((e) => e.t === 'TILE_SOLD_TO_BANK'), 'per-tile removal event emitted');
    assert.ok(events.some((e) => e.t === 'BANKRUPTCY_RESOLVED'));
  });

  test('auction: highest bidder pays the seller and TAKES OWNERSHIP (tile stays)', () => {
    const s = newGame(1, 3);
    const [debtor, a, b] = s.turnOrder;
    s.players[debtor!]!.money = 0;
    for (const c of [a!, b!]) s.players[c]!.money = 50;
    const tile = placeTile(s, { owner: debtor!, industry: 'pottery', level: 1 }); // build 17 → opening 8
    const opening = tileHalfCost(tile);
    // Decider: auction this tile; the FIRST opponent raises once to opening+10.
    const decider: BankruptcyDecider = {
      chooseLiquidation: (st, d) => {
        const t = st.tiles.find((x) => x.owner === d);
        return t ? { tileId: t.id, method: 'auction' } : null;
      },
      bid: (_st, _bidder, _t, current) => (current === opening ? opening + 10 : null),
    };
    const events: GameEvent[] = [];
    resolveBankruptcy(s, debtor!, 5, events, decider);
    const winner = a!; // first opponent in turn order
    const survivor = s.tiles.find((t) => t.id === tile.id);
    assert.ok(survivor, 'auctioned tile stays on the board');
    assert.equal(survivor!.owner, winner, 'ownership transferred to the winner');
    assert.equal(s.players[winner]!.money, 50 - (opening + 10), 'winner paid their bid');
    const result = events.find((e) => e.t === 'AUCTION_RESULT');
    assert.ok(result && result.t === 'AUCTION_RESULT' && result.winner === winner && !result.toBank);
    assert.ok(events.some((e) => e.t === 'AUCTION_OPENED'));
    assert.ok(events.some((e) => e.t === 'AUCTION_BID'));
  });

  test('auction with no bids falls back to the bank buying at the opening price', () => {
    const s = newGame(1, 3);
    const [debtor] = s.turnOrder;
    s.players[debtor!]!.money = 0;
    const tile = placeTile(s, { owner: debtor!, industry: 'pottery', level: 1 });
    const opening = tileHalfCost(tile);
    const decider: BankruptcyDecider = {
      chooseLiquidation: (st, d) => {
        const t = st.tiles.find((x) => x.owner === d);
        return t ? { tileId: t.id, method: 'auction' } : null;
      },
      bid: () => null, // nobody bids
    };
    const events: GameEvent[] = [];
    resolveBankruptcy(s, debtor!, 5, events, decider);
    assert.equal(s.tiles.length, 0, 'no bids → bank buys it and it leaves the board');
    const result = events.find((e) => e.t === 'AUCTION_RESULT');
    assert.ok(result && result.t === 'AUCTION_RESULT' && result.winner === null && result.toBank);
    assert.equal(result.t === 'AUCTION_RESULT' ? result.price : -1, opening);
  });

  test('with no tiles left, the remainder costs 1 VP per £1 (floored at 0)', () => {
    const s = newGame();
    const me = s.activePlayer;
    s.players[me]!.money = 0;
    s.players[me]!.vp = 4;
    const events: GameEvent[] = [];
    const res = resolveBankruptcy(s, me, 10, events);
    assert.equal(s.players[me]!.vp, 0, 'VP floored at 0, never negative');
    assert.equal(res.vpLost, 4);
    assert.equal(res.stillOwed, 6, 'the rest is written off — money never goes negative');
    assert.equal(s.players[me]!.money, 0);
  });

  test('collectIncome routes a negative-income shortfall through bankruptcy', () => {
    const s = newGame();
    const me = s.activePlayer;
    s.players[me]!.incomeLevel = -5;
    s.players[me]!.money = 0;
    s.players[me]!.vp = 10;
    placeTile(s, { owner: me, industry: 'coal', level: 2 }); // build 7 → half 3
    const events: GameEvent[] = [];
    collectIncome(s, me, events);
    // due 5; sell coal (+3) pay 3 → due 2; lose 2 VP.
    assert.equal(s.tiles.length, 0, 'tile sold to cover the shortfall');
    assert.equal(s.players[me]!.vp, 8);
    assert.equal(s.players[me]!.money, 0);
    assert.ok(events.some((e) => e.t === 'BANKRUPTCY_STARTED'));
  });

  test('payOrBankrupt pays from cash first then liquidates the remainder', () => {
    const s = newGame();
    const me = s.activePlayer;
    s.players[me]!.money = 4;
    s.players[me]!.vp = 10;
    placeTile(s, { owner: me, industry: 'cotton', level: 1 }); // half 6
    const events: GameEvent[] = [];
    payOrBankrupt(s, me, 9, events); // pay 4 cash, owe 5 → sell cotton (+6) pay 5, keep £1
    assert.equal(s.players[me]!.money, 1);
    assert.equal(s.tiles.length, 0);
    assert.equal(s.players[me]!.vp, 10);
  });

  test('halfCost rounds down', () => {
    assert.equal(halfCost(7), 3);
    assert.equal(halfCost(17), 8);
    assert.equal(halfCost(0), 0);
  });
});

// ===========================================================================
// 11.13 — bankruptcy modal view model (pure extractor)
// ===========================================================================

describe('§11.13 — bankruptcyEpisodes view model', () => {
  test('groups the event trail into a displayable episode', () => {
    const s = newGame(1, 3);
    const [debtor, a, b] = s.turnOrder;
    s.players[debtor!]!.money = 0;
    for (const c of [a!, b!]) s.players[c]!.money = 50;
    const tile = placeTile(s, { owner: debtor!, industry: 'pottery', level: 1 });
    const opening = tileHalfCost(tile);
    const decider: BankruptcyDecider = {
      chooseLiquidation: (st, d) => {
        const t = st.tiles.find((x) => x.owner === d);
        return t ? { tileId: t.id, method: 'auction' } : null;
      },
      bid: (_st, _bidder, _t, current) => (current === opening ? opening + 6 : null),
    };
    const events: GameEvent[] = [];
    resolveBankruptcy(s, debtor!, 5, events, decider);
    const episodes = bankruptcyEpisodes(events);
    assert.equal(episodes.length, 1);
    const ep = episodes[0]!;
    assert.equal(ep.debtor, debtor);
    assert.equal(ep.due, 5);
    assert.ok(ep.steps.some((x) => x.kind === 'auctionOpened'));
    assert.ok(ep.steps.some((x) => x.kind === 'auctionBid'));
    assert.ok(ep.steps.some((x) => x.kind === 'auctionWon'));
    assert.equal(ep.raised, opening + 6);
  });
});

// ===========================================================================
// 11.16 — property: random legal play never produces negative money or VP
// ===========================================================================

describe('§11.16 — property: money/VP never negative under random legal play', () => {
  for (const n of [2, 3, 4]) {
    test(`${n}-player random game keeps money & VP ≥ 0 throughout`, () => {
      let s = newGame(900 + n, n);
      let rng = (900 + n) * 2654435761;
      let guard = 0;
      while (s.phase !== 'gameOver' && guard < 20000) {
        const acts = legalActions(s);
        assert.ok(acts.length > 0, 'there is always at least PASS');
        const nonPass = acts.filter((a) => a.type !== 'PASS');
        const step = nextInt(rng, 100);
        rng = step.state;
        const pool = nonPass.length > 0 && step.value < 80 ? nonPass : acts;
        const pick = nextInt(rng, pool.length);
        rng = pick.state;
        const { state, events } = reduce(s, pool[pick.value]!);
        s = state;
        // No event ever reports a negative running money/VP total.
        for (const e of events) {
          if (e.t === 'MONEY_CHANGED') assert.ok(e.total >= 0, `money total ${e.total} < 0`);
          if (e.t === 'VP_CHANGED') assert.ok(e.total >= 0, `VP total ${e.total} < 0`);
        }
        for (const color of s.turnOrder) {
          assert.ok(s.players[color]!.money >= 0, `${color} money ${s.players[color]!.money} < 0`);
          assert.ok(s.players[color]!.vp >= 0, `${color} VP < 0`);
        }
        guard += 1;
      }
      assert.equal(s.phase, 'gameOver');
    });
  }
});
