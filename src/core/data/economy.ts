import type { IndustryType } from '../model/types.ts';

/**
 * MYSpolly Economy Model data (§7.16).
 *
 * This is the **intentional MYSpolly variant** of the Brass: Birmingham resource
 * economy: every player keeps a personal stockpile of `coal`, `iron` and `juice`,
 * fed each round by the production buildings they own. Actions consume resources
 * from the acting player's OWN stockpile (then the market for a connected
 * shortfall) — never freely from other players' mines/works.
 *
 * All numbers here are **tunable balance values** (not from the rulebook). They
 * are intentionally exposed in data so the economy can be re-balanced without
 * touching engine logic.
 */

/** The three personal-stockpile resources. */
export type StockResource = 'coal' | 'iron' | 'juice';
export const STOCK_RESOURCES: readonly StockResource[] = ['coal', 'iron', 'juice'] as const;

/** A personal resource stockpile (mirrors `ResourceStock` in the state model). */
export interface ResourceAmounts {
  coal: number;
  iron: number;
  juice: number;
}

/** Which industries are per-round production buildings, and what they make. */
export const PRODUCTION_INDUSTRIES: Record<StockResource, IndustryType> = {
  coal: 'coal',
  iron: 'iron',
  juice: 'juice',
};

/** True if an industry is a stockpile-feeding production building. */
export function isProductionIndustry(industry: IndustryType): industry is StockResource {
  return industry === 'coal' || industry === 'iron' || industry === 'juice';
}

/**
 * Per-round production by building type + level (§7.16.2). Higher (more
 * valuable / upgraded) buildings produce more. Coal Mine → coal, Iron Works →
 * iron, Juice Works → juice. Tunable.
 *
 *   | Building          | L1 | L2 | L3 | L4 |
 *   | Coal Mine  (coal) |  1 |  2 |  3 |  4 |
 *   | Iron Works (iron) |  1 |  2 |  3 |  3 |
 *   | Juice Works(juice)|  1 |  1 |  2 |  2 |
 */
export const PRODUCTION_TABLE: Record<StockResource, Record<number, number>> = {
  coal: { 1: 1, 2: 2, 3: 3, 4: 4 },
  iron: { 1: 1, 2: 2, 3: 3, 4: 3 },
  juice: { 1: 1, 2: 1, 3: 2, 4: 2 },
};

/** How much one production building of the given type + level makes per round. */
export function productionForLevel(resource: StockResource, level: number): number {
  return PRODUCTION_TABLE[resource][level] ?? 0;
}

/**
 * Optional per-resource stockpile caps (§7.16.7) to prevent runaway hoarding.
 * `null` means uncapped. Tunable.
 */
export const STOCKPILE_CAP: Record<StockResource, number | null> = {
  coal: 24,
  iron: 24,
  juice: 16,
};

/** Clamp a would-be stockpile amount to the configured cap (if any). */
export function applyStockpileCap(resource: StockResource, amount: number): number {
  const cap = STOCKPILE_CAP[resource];
  return cap === null ? amount : Math.min(cap, amount);
}

/**
 * Starting stockpile granted to every player at setup (§7.16.5), so the early
 * game is never blocked. Tunable; can vary per map / player count.
 */
export const DEFAULT_STARTING_RESOURCES: ResourceAmounts = { coal: 2, iron: 1, juice: 1 };

/**
 * The starting stockpile for a given map and player count. Currently uniform,
 * but defined as a function so maps / player counts can override it later
 * without changing call sites.
 */
export function startingResources(_mapId: string, _players: number): ResourceAmounts {
  return { ...DEFAULT_STARTING_RESOURCES };
}
