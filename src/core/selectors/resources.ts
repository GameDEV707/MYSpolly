import type { GameState, PlacedTile } from '../model/state.ts';
import type { PlayerColor } from '../model/types.ts';
import { PLAYER_COLORS } from '../model/types.ts';
import {
  isMarketResource,
  fixedUnitPrice,
  PLAYER_TRADE_MARKUP,
  type StockResource,
} from '../data/economy.ts';
import { nextBuyPrice } from '../engine/market.ts';
import { boardContext } from '../maps/context.ts';
import { connected, distance, reachableFrom } from './connectivity.ts';

/** Coal mines (any owner) connected to `loc`, sorted nearest first, with coal left. */
export function coalMineOptions(state: GameState, loc: string): PlacedTile[] {
  const reachable = reachableFrom(state, loc);
  return state.tiles
    .filter((t) => t.industry === 'coal' && t.resourcesLeft > 0 && reachable.has(t.locationId))
    .sort((a, b) => distance(state, loc, a.locationId) - distance(state, loc, b.locationId));
}

/** Iron works (any owner) anywhere with iron left — no connection needed. */
export function ironWorksOptions(state: GameState): PlacedTile[] {
  return state.tiles.filter((t) => t.industry === 'iron' && t.resourcesLeft > 0);
}

/** Is `loc` connected to any merchant location (so it can use the markets / sell)? */
export function isConnectedToMerchant(state: GameState, loc: string): boolean {
  const merchantIds = boardContext(state).merchantIds;
  const reachable = reachableFrom(state, loc);
  for (const id of reachable) {
    if (merchantIds.has(id)) return true;
  }
  return false;
}

/**
 * JuiceWorks whose juice `player` may consume from `loc`:
 *   - the player's own juiceWorks (no connection required),
 *   - opponents' juiceWorks that are connected to `loc`.
 * Only juiceWorks with juice remaining are returned.
 */
export function juiceTileOptions(state: GameState, player: PlayerColor, loc: string): PlacedTile[] {
  const reachable = reachableFrom(state, loc);
  return state.tiles.filter((t) => {
    if (t.industry !== 'juice' || t.resourcesLeft <= 0) return false;
    if (t.owner === player) return true;
    return reachable.has(t.locationId);
  });
}

/** Merchants (with a juice barrel) connected to `loc`, for Sell juice bonuses. */
export function merchantJuiceOptions(state: GameState, loc: string): GameState['merchants'] {
  const reachable = reachableFrom(state, loc);
  return state.merchants.filter((m) => m.hasJuice && reachable.has(m.locationId));
}

/**
 * Merchants that will buy `industry` and are connected to `loc` (for selling
 * goods). A merchant must show the matching industry icon.
 */
export function sellableMerchants(
  state: GameState,
  loc: string,
  industry: 'cotton' | 'manufacturer' | 'pottery',
): GameState['merchants'] {
  const reachable = reachableFrom(state, loc);
  return state.merchants.filter((m) => m.accepts.includes(industry) && reachable.has(m.locationId));
}

/** Convenience: are two locations connected (re-exported for resource code). */
export function locConnected(state: GameState, a: string, b: string): boolean {
  return connected(state, a, b);
}

/** A candidate seller for a player-to-player resource purchase (§7.17.3). */
export interface ResourceSellerOption {
  color: PlayerColor;
  /** Units of the resource the seller currently holds. */
  available: number;
  /** Money price per unit the buyer would pay this seller. */
  unitPrice: number;
}

/**
 * The other players a `buyer` could buy `resource` from (§7.17.3), with how much
 * each holds and the per-unit price (the current market buy price for coal/iron,
 * or the fixed price for non-market resources). Sorted most-available first —
 * the data behind the UI's "buy from which player?" picker (§11.7). Pure.
 */
export function resourceSellerOptions(
  state: GameState,
  buyer: PlayerColor,
  resource: StockResource,
): ResourceSellerOption[] {
  const market =
    resource === 'coal' ? state.coalMarket : resource === 'iron' ? state.ironMarket : null;
  const unitPrice =
    (isMarketResource(resource) ? nextBuyPrice(market!) : (fixedUnitPrice(resource) ?? 0)) +
    PLAYER_TRADE_MARKUP;
  const out: ResourceSellerOption[] = [];
  for (const color of PLAYER_COLORS) {
    if (color === buyer) continue;
    const available = state.players[color]?.resources[resource] ?? 0;
    if (available > 0) out.push({ color, available, unitPrice });
  }
  return out.sort((a, b) => b.available - a.available);
}
