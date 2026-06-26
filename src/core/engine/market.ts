import type { MarketTrack } from '../model/state.ts';

/**
 * Market mechanics.
 *
 * Spaces are ordered cheapest → priciest. Empty spaces are always the cheapest,
 * filled spaces the priciest, so for `cubes` cubes in a market of capacity `C`:
 *   - cheapest FILLED space (BUY price) is index `C - cubes`,
 *   - cheapest EMPTY space (SELL price) is index `C - cubes - 1`.
 */

/** Price to buy the next cube (without mutating). */
export function nextBuyPrice(m: MarketTrack): number {
  if (m.cubes <= 0) return m.emptyPrice;
  return m.priceLadder[m.capacity - m.cubes] ?? m.emptyPrice;
}

/** Total cost to buy `n` cubes from the market (without mutating). */
export function buyCost(m: MarketTrack, n: number): number {
  let cost = 0;
  let cubes = m.cubes;
  for (let i = 0; i < n; i += 1) {
    cost += cubes > 0 ? (m.priceLadder[m.capacity - cubes] ?? m.emptyPrice) : m.emptyPrice;
    if (cubes > 0) cubes -= 1;
  }
  return cost;
}

/** Buy `n` cubes, mutating the market; returns the total cost paid. */
export function buyFromMarket(m: MarketTrack, n: number): number {
  let cost = 0;
  for (let i = 0; i < n; i += 1) {
    cost += nextBuyPrice(m);
    if (m.cubes > 0) m.cubes -= 1;
  }
  return cost;
}

/** Revenue from selling the next cube into the market (without mutating). */
export function nextSellPrice(m: MarketTrack): number {
  if (m.cubes >= m.capacity) return 0; // market full → no money
  return m.priceLadder[m.capacity - m.cubes - 1] ?? 0;
}

/**
 * Sell up to `n` cubes into the market (mutating). Stops early if the market
 * fills. Returns the total revenue and how many cubes were actually accepted.
 */
export function sellToMarket(m: MarketTrack, n: number): { revenue: number; sold: number } {
  let revenue = 0;
  let sold = 0;
  for (let i = 0; i < n; i += 1) {
    if (m.cubes >= m.capacity) break;
    revenue += nextSellPrice(m);
    m.cubes += 1;
    sold += 1;
  }
  return { revenue, sold };
}
