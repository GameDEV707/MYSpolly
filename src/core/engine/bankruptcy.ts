import type { GameState, PlacedTile } from '../model/state.ts';
import type { GameEvent } from '../model/events.ts';
import { PLAYER_COLORS, type PlayerColor } from '../model/types.ts';
import { getLevelDef } from '../data/industries.ts';
import { isProductionIndustry, halfCost, BANKRUPTCY } from '../data/economy.ts';
import { getPlayer, changeMoney, changeVp } from './helpers.ts';

/**
 * Bankruptcy resolution (§7.17.5).
 *
 * When a player must pay money they do not have (primarily the end-of-round
 * negative-income collection), they raise the shortfall by repeatedly choosing
 * to either:
 *   1. sell one of their tiles to the bank at **half** its build cost (rounded
 *      down) — the tile is removed from the board, or
 *   2. auction one of their tiles to the other players with an **opening bid =
 *      half** the build cost — the highest bidder pays the bankrupt player and
 *      takes ownership (the tile stays on the board); if nobody bids above the
 *      opening, the bank buys it at the opening (half) price.
 *
 * They keep selling until the debt is covered (keeping any surplus). If no tiles
 * remain, the remaining debt costs **1 VP per £1** (VP floored at 0). Money and
 * VP never go negative.
 *
 * The choice of which tile and which method, and how opponents bid, is made by a
 * pluggable `BankruptcyDecider`. The engine ships a deterministic default (used
 * for AI and for headless/automated play); the UI can inject a decider driven by
 * a human's modal choices and by smarter AI without changing this resolver.
 */

/** A single liquidation decision: which tile, sold to the bank or auctioned. */
export interface LiquidationChoice {
  tileId: string;
  method: 'bank' | 'auction';
}

export interface BankruptcyDecider {
  /**
   * Choose the next tile to liquidate (and how) to help cover `due`, or `null`
   * if the player has no tiles left to sell.
   */
  chooseLiquidation(state: GameState, debtor: PlayerColor, due: number): LiquidationChoice | null;
  /**
   * A bidder's response in an auction for `tile`: a bid strictly greater than
   * `currentBid` (and affordable), or `null` to pass. `opening` is the starting
   * (half) price.
   */
  bid(
    state: GameState,
    bidder: PlayerColor,
    tile: PlacedTile,
    currentBid: number,
    opening: number,
  ): number | null;
}

/** Half (rounded down) of a tile's build cost — its bank/opening price. */
export function tileHalfCost(tile: PlacedTile): number {
  return halfCost(getLevelDef(tile.industry, tile.level).costMoney);
}

/** A rough "worth" of a tile to a player — its build cost is a fair proxy. */
function tileWorth(tile: PlacedTile): number {
  return getLevelDef(tile.industry, tile.level).costMoney;
}

/**
 * The default, deterministic decider. It protects production/income tiles where
 * it can, sells low-value tiles to the bank, and auctions high-value tiles when
 * an opponent could plausibly afford the opening bid (§7.17.5/§7.17.6). Bidders
 * raise toward a fraction of the tile's build cost, capped by their cash.
 */
export const defaultDecider: BankruptcyDecider = {
  chooseLiquidation(state, debtor, _due) {
    const owned = state.tiles.filter((t) => t.owner === debtor);
    if (owned.length === 0) return null;
    // Prefer parting with non-production tiles first (keep resource income),
    // cheapest build cost first (minimise loss); break ties by tile id.
    const ranked = [...owned].sort((a, b) => {
      const pa = isProductionIndustry(a.industry) ? 1 : 0;
      const pb = isProductionIndustry(b.industry) ? 1 : 0;
      if (pa !== pb) return pa - pb;
      const wa = tileWorth(a);
      const wb = tileWorth(b);
      if (wa !== wb) return wa - wb;
      return a.id < b.id ? -1 : 1;
    });
    const tile = ranked[0]!;
    const opening = tileHalfCost(tile);
    // Auction valuable tiles when an opponent can afford the opening bid; this
    // can raise more than the bank's flat half price.
    const canAuction =
      tileWorth(tile) >= BANKRUPTCY.auctionMinBuildCost &&
      PLAYER_COLORS.some(
        (c) => c !== debtor && (state.players[c]?.money ?? 0) > opening,
      );
    return { tileId: tile.id, method: canAuction ? 'auction' : 'bank' };
  },

  bid(state, bidder, tile, currentBid, _opening) {
    const cash = state.players[bidder]?.money ?? 0;
    const maxWilling = Math.floor(tileWorth(tile) * BANKRUPTCY.bidFraction);
    const next = currentBid + BANKRUPTCY.auctionIncrement;
    if (next <= maxWilling && next <= cash) return next;
    return null;
  },
};

/** Remove a tile from the board (helper). */
function removeTile(state: GameState, tileId: string): void {
  state.tiles = state.tiles.filter((t) => t.id !== tileId);
}

/**
 * Run an ascending auction for `tile` among players other than `seller`. Returns
 * the winner (or null) and the final price. Bidders raise in turn order until no
 * one will raise. Pure-ish: emits `AUCTION_BID` events; does not move money (the
 * caller settles the winning payment).
 */
export function runAuction(
  state: GameState,
  seller: PlayerColor,
  tile: PlacedTile,
  decider: BankruptcyDecider,
  events: GameEvent[],
): { winner: PlayerColor | null; price: number } {
  const opening = tileHalfCost(tile);
  events.push({ t: 'AUCTION_OPENED', seller, tileId: tile.id, opening });
  let high = opening;
  let winner: PlayerColor | null = null;
  const bidders = PLAYER_COLORS.filter((c) => c !== seller && state.players[c] !== undefined);
  let active = true;
  let guard = 0;
  while (active && guard < 1000) {
    active = false;
    guard += 1;
    for (const bidder of bidders) {
      const bid = decider.bid(state, bidder, tile, high, opening);
      if (bid !== null && bid > high && bid <= (state.players[bidder]?.money ?? 0)) {
        high = bid;
        winner = bidder;
        events.push({ t: 'AUCTION_BID', bidder, tileId: tile.id, amount: bid });
        active = true;
      }
    }
  }
  return { winner, price: winner ? high : opening };
}

/**
 * Resolve a player's debt (`due` > 0) by liquidating tiles, then losing VP.
 * Returns how much money was raised, VP lost, and any debt still unpaid (which
 * is written off — money/VP never go negative).
 */
export function resolveBankruptcy(
  state: GameState,
  debtor: PlayerColor,
  due: number,
  events: GameEvent[],
  decider: BankruptcyDecider = defaultDecider,
): { raised: number; vpLost: number; stillOwed: number } {
  const p = getPlayer(state, debtor);
  events.push({ t: 'BANKRUPTCY_STARTED', player: debtor, due });

  let raised = 0;
  let owed = due;
  let guard = 0;
  while (owed > 0 && guard < 1000) {
    guard += 1;
    const choice = decider.chooseLiquidation(state, debtor, owed);
    if (!choice) break;
    const tile = state.tiles.find((t) => t.id === choice.tileId && t.owner === debtor);
    if (!tile) break; // decider named an invalid tile — stop to stay safe
    const opening = tileHalfCost(tile);

    let proceeds: number;
    if (choice.method === 'auction') {
      const { winner, price } = runAuction(state, debtor, tile, decider, events);
      if (winner) {
        // Winner pays the bankrupt player and takes ownership (tile stays).
        changeMoney(state, winner, -price, events);
        changeMoney(state, debtor, price, events);
        tile.owner = winner;
        events.push({
          t: 'AUCTION_RESULT',
          seller: debtor,
          tileId: tile.id,
          price,
          winner,
          toBank: false,
        });
      } else {
        // No bid above the opening → the bank buys it at the opening (half).
        removeTile(state, tile.id);
        changeMoney(state, debtor, opening, events);
        events.push({
          t: 'AUCTION_RESULT',
          seller: debtor,
          tileId: tile.id,
          price: opening,
          winner: null,
          toBank: true,
        });
      }
      proceeds = price;
    } else {
      // Sell to the bank at half build cost; the tile leaves the board.
      removeTile(state, tile.id);
      changeMoney(state, debtor, opening, events);
      events.push({ t: 'TILE_SOLD_TO_BANK', player: debtor, tileId: tile.id, refund: opening });
      proceeds = opening;
    }

    raised += proceeds;
    // Apply the proceeds to the debt (surplus stays as the player's money).
    const pay = Math.min(p.money, owed);
    if (pay > 0) changeMoney(state, debtor, -pay, events);
    owed -= pay;
  }

  // Still short with no tiles left → lose 1 VP per £1 owed (floored at 0).
  let vpLost = 0;
  if (owed > 0) {
    const applied = changeVp(state, debtor, -Math.min(p.vp, owed), events);
    vpLost = -applied;
    owed -= vpLost;
  }

  events.push({
    t: 'BANKRUPTCY_RESOLVED',
    player: debtor,
    raised,
    vpLost,
    stillOwed: Math.max(0, owed),
  });
  return { raised, vpLost, stillOwed: Math.max(0, owed) };
}

/**
 * Pay a mandatory amount, entering bankruptcy resolution for any shortfall
 * (§7.17.1/§7.17.5). The only path allowed to reduce money when the player
 * cannot otherwise pay. Returns the unpaid (written-off) remainder.
 */
export function payOrBankrupt(
  state: GameState,
  color: PlayerColor,
  amount: number,
  events: GameEvent[],
  decider: BankruptcyDecider = defaultDecider,
): { tilesBefore: number; vpLost: number; stillOwed: number } {
  const p = getPlayer(state, color);
  const tilesBefore = state.tiles.filter((t) => t.owner === color).length;
  const fromCash = Math.min(p.money, amount);
  if (fromCash > 0) changeMoney(state, color, -fromCash, events);
  let due = amount - fromCash;
  if (due <= 0) return { tilesBefore, vpLost: 0, stillOwed: 0 };
  const res = resolveBankruptcy(state, color, due, events, decider);
  return { tilesBefore, vpLost: res.vpLost, stillOwed: res.stillOwed };
}
