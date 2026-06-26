import type { MarketDef } from '../model/types.ts';

/**
 * Coal & Iron market price ladders.
 *
 * Model (matches the physical board): spaces are ordered cheapest → priciest.
 * Empty spaces are always the cheapest ones; filled spaces the most expensive.
 * Therefore, for `cubes` cubes present in a market of capacity `C`:
 *   - the cubes occupy the top `cubes` spaces (indices C-cubes … C-1),
 *   - the cheapest FILLED space (what you pay to BUY) is index `C - cubes`,
 *   - the cheapest EMPTY space (what you receive to SELL) is index `C-cubes-1`.
 * Buying from an empty market costs `emptyPrice`; selling into a full market is
 * impossible (no empty space).
 *
 * Values confirmed from the rulebook:
 *  - Coal: spaces £1–£7 (two per price); empty-market purchase price £8.
 *    Setup fills every space except one £1 space → 13 cubes.
 *  - Iron: spaces £1–£5 (two per price); empty-market purchase price £6.
 *    Setup fills every space except both £1 spaces → 8 cubes.
 */

export const COAL_MARKET: MarketDef = {
  priceLadder: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7],
  emptyPrice: 8,
  initialCubes: 13,
};

export const IRON_MARKET: MarketDef = {
  priceLadder: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
  emptyPrice: 6,
  initialCubes: 8,
};

export const COAL_MARKET_CAPACITY = COAL_MARKET.priceLadder.length; // 14
export const IRON_MARKET_CAPACITY = IRON_MARKET.priceLadder.length; // 10
