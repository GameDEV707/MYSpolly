import type { IndustryLevelDef, IndustryType } from '../model/types.ts';

/**
 * Per-industry, per-level statistics (the player-mat printouts).
 *
 * Per-industry TOTAL tile counts are taken directly from the rulebook and are
 * enforced by the data-validation test (Cotton 11, Manufacturer 11, Brewery 7,
 * Pottery 5, Iron Works 4, Coal Mine 7 — 45 tiles per colour):
 *
 *   "11 Cotton Mills · 11 Manufacturers · 7 Breweries · 5 Potteries ·
 *    4 Iron Works · 7 Coal Mines"  — Brass: Birmingham rulebook.
 *
 * VERIFY: the individual per-level numeric stats (cost / coal / iron / VP /
 * income / link-VP / produced cubes) and the per-level tile counts are encoded
 * from published Brass: Birmingham references; they live on the player-mat
 * image (not extractable from the rulebook text) and should be confirmed
 * against a physical mat before release. The engine consumes every value
 * generically, so any correction is a pure data edit with no code change.
 *
 * Era buildability follows the rulebook's locked-icon (×) mechanic: the
 * lowest-level tile of each industry is Canal-only and the highest-level tile is
 * Rail-only; intermediate levels are buildable in both eras. Lightbulb potteries
 * carry `developable: false`.
 */

interface RawLevel {
  level: number;
  count: number;
  costMoney: number;
  costCoal: number;
  costIron: number;
  beerToSell: number;
  vp: number;
  incomeSpaces: number;
  linkVp: number;
  resourceCount: number;
  developable?: boolean;
}

function expand(industry: IndustryType, rows: RawLevel[]): IndustryLevelDef[] {
  const maxLevel = Math.max(...rows.map((r) => r.level));
  const minLevel = Math.min(...rows.map((r) => r.level));
  return rows.map((r) => ({
    industry,
    level: r.level,
    count: r.count,
    costMoney: r.costMoney,
    costCoal: r.costCoal,
    costIron: r.costIron,
    beerToSell: r.beerToSell,
    vp: r.vp,
    incomeSpaces: r.incomeSpaces,
    linkVp: r.linkVp,
    resourceCount: r.resourceCount,
    // Lowest level: Canal-only. Highest level: Rail-only. Middle: both.
    buildableInCanal: r.level < maxLevel,
    buildableInRail: r.level > minLevel,
    developable: r.developable ?? true,
  }));
}

export const COAL_MINE_LEVELS = expand('coal', [
  {
    level: 1,
    count: 1,
    costMoney: 5,
    costCoal: 0,
    costIron: 0,
    beerToSell: 0,
    vp: 1,
    incomeSpaces: 4,
    linkVp: 2,
    resourceCount: 2,
  },
  {
    level: 2,
    count: 2,
    costMoney: 7,
    costCoal: 0,
    costIron: 0,
    beerToSell: 0,
    vp: 2,
    incomeSpaces: 7,
    linkVp: 1,
    resourceCount: 3,
  },
  {
    level: 3,
    count: 2,
    costMoney: 8,
    costCoal: 0,
    costIron: 1,
    beerToSell: 0,
    vp: 3,
    incomeSpaces: 6,
    linkVp: 1,
    resourceCount: 4,
  },
  {
    level: 4,
    count: 2,
    costMoney: 10,
    costCoal: 0,
    costIron: 1,
    beerToSell: 0,
    vp: 4,
    incomeSpaces: 5,
    linkVp: 1,
    resourceCount: 5,
  },
]);

export const IRON_WORKS_LEVELS = expand('iron', [
  {
    level: 1,
    count: 1,
    costMoney: 5,
    costCoal: 1,
    costIron: 0,
    beerToSell: 0,
    vp: 3,
    incomeSpaces: 3,
    linkVp: 1,
    resourceCount: 4,
  },
  {
    level: 2,
    count: 1,
    costMoney: 7,
    costCoal: 1,
    costIron: 0,
    beerToSell: 0,
    vp: 5,
    incomeSpaces: 3,
    linkVp: 1,
    resourceCount: 4,
  },
  {
    level: 3,
    count: 1,
    costMoney: 9,
    costCoal: 1,
    costIron: 0,
    beerToSell: 0,
    vp: 7,
    incomeSpaces: 2,
    linkVp: 1,
    resourceCount: 5,
  },
  {
    level: 4,
    count: 1,
    costMoney: 12,
    costCoal: 1,
    costIron: 0,
    beerToSell: 0,
    vp: 9,
    incomeSpaces: 1,
    linkVp: 1,
    resourceCount: 6,
  },
]);

// Breweries produce beer on build: 1 barrel in the Canal Era, 2 in the Rail Era
// (handled in the engine). `resourceCount` here is the Canal-Era amount.
export const BREWERY_LEVELS = expand('brewery', [
  {
    level: 1,
    count: 2,
    costMoney: 5,
    costCoal: 0,
    costIron: 1,
    beerToSell: 0,
    vp: 4,
    incomeSpaces: 4,
    linkVp: 2,
    resourceCount: 1,
  },
  {
    level: 2,
    count: 2,
    costMoney: 7,
    costCoal: 0,
    costIron: 1,
    beerToSell: 0,
    vp: 5,
    incomeSpaces: 5,
    linkVp: 2,
    resourceCount: 1,
  },
  {
    level: 3,
    count: 2,
    costMoney: 9,
    costCoal: 0,
    costIron: 1,
    beerToSell: 0,
    vp: 7,
    incomeSpaces: 5,
    linkVp: 2,
    resourceCount: 1,
  },
  {
    level: 4,
    count: 1,
    costMoney: 9,
    costCoal: 0,
    costIron: 1,
    beerToSell: 0,
    vp: 10,
    incomeSpaces: 5,
    linkVp: 2,
    resourceCount: 1,
  },
]);

export const COTTON_MILL_LEVELS = expand('cotton', [
  {
    level: 1,
    count: 2,
    costMoney: 12,
    costCoal: 0,
    costIron: 0,
    beerToSell: 1,
    vp: 5,
    incomeSpaces: 5,
    linkVp: 1,
    resourceCount: 0,
  },
  {
    level: 2,
    count: 3,
    costMoney: 14,
    costCoal: 1,
    costIron: 0,
    beerToSell: 1,
    vp: 5,
    incomeSpaces: 4,
    linkVp: 2,
    resourceCount: 0,
  },
  {
    level: 3,
    count: 3,
    costMoney: 16,
    costCoal: 1,
    costIron: 0,
    beerToSell: 1,
    vp: 9,
    incomeSpaces: 3,
    linkVp: 1,
    resourceCount: 0,
  },
  {
    level: 4,
    count: 3,
    costMoney: 18,
    costCoal: 1,
    costIron: 0,
    beerToSell: 2,
    vp: 12,
    incomeSpaces: 2,
    linkVp: 1,
    resourceCount: 0,
  },
]);

// Manufacturer (Goods) has the most levels (1–8).
export const MANUFACTURER_LEVELS = expand('manufacturer', [
  {
    level: 1,
    count: 1,
    costMoney: 8,
    costCoal: 1,
    costIron: 0,
    beerToSell: 1,
    vp: 3,
    incomeSpaces: 5,
    linkVp: 1,
    resourceCount: 0,
  },
  {
    level: 2,
    count: 1,
    costMoney: 10,
    costCoal: 0,
    costIron: 1,
    beerToSell: 1,
    vp: 5,
    incomeSpaces: 1,
    linkVp: 1,
    resourceCount: 0,
  },
  {
    level: 3,
    count: 1,
    costMoney: 12,
    costCoal: 2,
    costIron: 0,
    beerToSell: 1,
    vp: 4,
    incomeSpaces: 4,
    linkVp: 1,
    resourceCount: 0,
  },
  {
    level: 4,
    count: 1,
    costMoney: 8,
    costCoal: 0,
    costIron: 1,
    beerToSell: 1,
    vp: 3,
    incomeSpaces: 6,
    linkVp: 1,
    resourceCount: 0,
  },
  {
    level: 5,
    count: 2,
    costMoney: 16,
    costCoal: 1,
    costIron: 0,
    beerToSell: 2,
    vp: 8,
    incomeSpaces: 2,
    linkVp: 1,
    resourceCount: 0,
  },
  {
    level: 6,
    count: 1,
    costMoney: 20,
    costCoal: 0,
    costIron: 1,
    beerToSell: 1,
    vp: 7,
    incomeSpaces: 6,
    linkVp: 1,
    resourceCount: 0,
  },
  {
    level: 7,
    count: 2,
    costMoney: 16,
    costCoal: 1,
    costIron: 0,
    beerToSell: 0,
    vp: 9,
    incomeSpaces: 4,
    linkVp: 1,
    resourceCount: 0,
  },
  {
    level: 8,
    count: 2,
    costMoney: 20,
    costCoal: 0,
    costIron: 2,
    beerToSell: 1,
    vp: 11,
    incomeSpaces: 1,
    linkVp: 1,
    resourceCount: 0,
  },
]);

// Potteries: levels 1 and 2 show the lightbulb icon → cannot be developed.
export const POTTERY_LEVELS = expand('pottery', [
  {
    level: 1,
    count: 1,
    costMoney: 17,
    costCoal: 0,
    costIron: 1,
    beerToSell: 1,
    vp: 10,
    incomeSpaces: 5,
    linkVp: 1,
    resourceCount: 0,
    developable: false,
  },
  {
    level: 2,
    count: 1,
    costMoney: 0,
    costCoal: 1,
    costIron: 0,
    beerToSell: 1,
    vp: 1,
    incomeSpaces: 1,
    linkVp: 1,
    resourceCount: 0,
    developable: false,
  },
  {
    level: 3,
    count: 1,
    costMoney: 22,
    costCoal: 2,
    costIron: 0,
    beerToSell: 2,
    vp: 11,
    incomeSpaces: 5,
    linkVp: 1,
    resourceCount: 0,
  },
  {
    level: 4,
    count: 1,
    costMoney: 0,
    costCoal: 1,
    costIron: 0,
    beerToSell: 1,
    vp: 1,
    incomeSpaces: 1,
    linkVp: 1,
    resourceCount: 0,
  },
  {
    level: 5,
    count: 1,
    costMoney: 20,
    costCoal: 2,
    costIron: 0,
    beerToSell: 2,
    vp: 20,
    incomeSpaces: 5,
    linkVp: 2,
    resourceCount: 0,
  },
]);

/** All industry levels, keyed by industry type. */
export const INDUSTRY_LEVELS: Record<IndustryType, IndustryLevelDef[]> = {
  coal: COAL_MINE_LEVELS,
  iron: IRON_WORKS_LEVELS,
  brewery: BREWERY_LEVELS,
  cotton: COTTON_MILL_LEVELS,
  manufacturer: MANUFACTURER_LEVELS,
  pottery: POTTERY_LEVELS,
};

/** Flat list of every industry level definition. */
export const ALL_INDUSTRY_LEVELS: IndustryLevelDef[] = Object.values(INDUSTRY_LEVELS).flat();

/** Total physical tiles per industry (must match the rulebook). */
export const INDUSTRY_TILE_TOTALS: Record<IndustryType, number> = {
  cotton: 11,
  manufacturer: 11,
  brewery: 7,
  pottery: 5,
  iron: 4,
  coal: 7,
};

/** Beer produced by a brewery on build, by era. */
export const BREWERY_BEER_BY_ERA = { canal: 1, rail: 2 } as const;

/** Look up a single industry level definition. */
export function getLevelDef(industry: IndustryType, level: number): IndustryLevelDef {
  const def = INDUSTRY_LEVELS[industry].find((l) => l.level === level);
  if (!def) {
    throw new Error(`No level ${level} for industry ${industry}`);
  }
  return def;
}
