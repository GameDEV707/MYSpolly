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


// ===========================================================================
// §7.17 Money, resource trading & bankruptcy — tunable balance values.
// All numbers below are intentionally exposed here so the money/economy can be
// re-balanced without touching engine logic.
// ===========================================================================

/**
 * Which resources are traded in a moving-price **market** (§7.17.4). Only coal
 * and iron are bought/sold on a Brass price ladder; every other resource uses a
 * fixed, unchanging price (see `FIXED_RESOURCE_PRICE`).
 */
export const MARKET_RESOURCES: readonly StockResource[] = ['coal', 'iron'] as const;

/** True if `resource` is bought/sold on a moving-price market (coal & iron). */
export function isMarketResource(resource: StockResource): boolean {
  return resource === 'coal' || resource === 'iron';
}

/**
 * Fixed unit price for **non-market** resources (§7.17.4). Market resources
 * (coal/iron) are priced by their ladder and so carry `null` here. Juice has a
 * single configured price at which a shortfall can always be bought — from a
 * general supply (pay the bank) or from another player (pay that player). This
 * is the change that makes a juice shortfall buyable rather than illegal.
 * Tunable.
 */
export const FIXED_RESOURCE_PRICE: Record<StockResource, number | null> = {
  coal: null, // market-priced
  iron: null, // market-priced
  juice: 4, // fixed price per barrel
};

/**
 * The fixed unit price for a non-market resource, or `null` if it is a
 * market-traded good (coal/iron) and therefore has no fixed price.
 */
export function fixedUnitPrice(resource: StockResource): number | null {
  return FIXED_RESOURCE_PRICE[resource];
}

/**
 * Player-to-player trading (§7.17.3). When a short player buys the remaining
 * shortfall from another player, the unit price is the relevant market buy
 * price for coal/iron, or the fixed price for non-market resources. An optional
 * markup (default 0) can be configured to make peer-to-peer trades cost a little
 * more than the bank/market; tunable.
 */
export const PLAYER_TRADE_MARKUP = 0;

/**
 * Bankruptcy & auction tuning (§7.17.5). When a player must pay money they do
 * not have, they liquidate factories: sell to the bank at half build cost, or
 * auction to the other players starting at half.
 */
export const BANKRUPTCY = {
  /** A tile's bank/opening price = floor(build cost × this fraction). */
  sellFraction: 0.5,
  /** Minimum raise between successive auction bids. */
  auctionIncrement: 2,
  /**
   * AI auction behaviour: a bidder will bid up to `bidFraction × buildCost`
   * (capped by its cash) for a tile it wants. Higher = more aggressive.
   */
  bidFraction: 0.6,
  /**
   * The default (engine) decider auctions a tile instead of selling it to the
   * bank when its build cost is at least this much AND an opponent can afford
   * the opening bid; otherwise it sells low-value tiles to the bank.
   */
  auctionMinBuildCost: 16,
} as const;

/** Half (rounded down) of a build cost — the bank/opening price for a tile. */
export function halfCost(buildCostMoney: number): number {
  return Math.floor(buildCostMoney * BANKRUPTCY.sellFraction);
}
