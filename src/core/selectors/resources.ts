import type { GameState, PlacedTile } from '../model/state.ts';
import type { PlayerColor } from '../model/types.ts';
import { MERCHANT_LOCATIONS } from '../data/board.ts';
import { connected, distance, reachableFrom } from './connectivity.ts';

const MERCHANT_IDS = new Set(MERCHANT_LOCATIONS.map((m) => m.id));

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
  const reachable = reachableFrom(state, loc);
  for (const id of reachable) {
    if (MERCHANT_IDS.has(id)) return true;
  }
  return false;
}

/**
 * Breweries whose beer `player` may consume from `loc`:
 *   - the player's own breweries (no connection required),
 *   - opponents' breweries that are connected to `loc`.
 * Only breweries with beer remaining are returned.
 */
export function breweryBeerOptions(
  state: GameState,
  player: PlayerColor,
  loc: string,
): PlacedTile[] {
  const reachable = reachableFrom(state, loc);
  return state.tiles.filter((t) => {
    if (t.industry !== 'brewery' || t.resourcesLeft <= 0) return false;
    if (t.owner === player) return true;
    return reachable.has(t.locationId);
  });
}

/** Merchants (with a beer barrel) connected to `loc`, for Sell beer bonuses. */
export function merchantBeerOptions(state: GameState, loc: string): GameState['merchants'] {
  const reachable = reachableFrom(state, loc);
  return state.merchants.filter((m) => m.hasBeer && reachable.has(m.locationId));
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
