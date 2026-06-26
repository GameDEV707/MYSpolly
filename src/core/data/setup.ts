import type { IndustryType } from '../model/types.ts';
import { INDUSTRY_LEVELS } from './industries.ts';

/**
 * Setup parameters, confirmed from the rulebook:
 *  - Starting money: £17 per player.
 *  - Income marker starts on level 10; VP marker on 0.
 *  - Starting hand: 8 cards; plus 1 card to start the discard pile.
 *  - 14 link tiles and 45 industry tiles per colour.
 *  - Rounds per era: 4P = 8, 3P = 9, 2P = 10.
 *  - Merchant placement: 2P leaves Warrington & Nottingham empty; 3P leaves
 *    Nottingham empty; 4P uses all merchant spaces.
 *  - Coal Market: every space filled except one £1 space (13 cubes).
 *  - Iron Market: every space filled except both £1 spaces (8 cubes).
 *  - Shared cubes: 30 coal, 18 iron, 15 beer.
 */

export const STARTING_MONEY = 17;
export const STARTING_INCOME_LEVEL = 10;
export const STARTING_VP = 0;
export const HAND_SIZE = 8;
export const LINK_TILES_PER_PLAYER = 14;
export const INDUSTRY_TILES_PER_PLAYER = 45;

export const INCOME_LEVEL_MAX = 30;
export const INCOME_LEVEL_MIN = -10;

export const TOTAL_COAL_CUBES = 30;
export const TOTAL_IRON_CUBES = 18;
export const TOTAL_BEER_BARRELS = 15;

/** Number of rounds in each era by player count. */
export const ROUNDS_PER_ERA: Record<number, number> = {
  2: 10,
  3: 9,
  4: 8,
};

/** Canal-Era cost / limit constants. */
export const CANAL_LINK_COST = 3;

/** Rail-Era network costs. */
export const RAIL_SINGLE_LINK_COST = 5;
export const RAIL_DOUBLE_LINK_COST = 15;
export const RAIL_DOUBLE_LINK_BEER = 1; // beer consumed when building 2 rail links
export const RAIL_LINK_COAL = 1; // coal consumed per rail link

/** Loan effect. */
export const LOAN_MONEY = 30;
export const LOAN_INCOME_LEVELS = 3;

/** Scout: discard this many EXTRA cards (in addition to the action card). */
export const SCOUT_EXTRA_DISCARDS = 2;

/** Merchant spaces left empty (no merchant tile) by player count. */
export const EMPTY_MERCHANTS_BY_PLAYERS: Record<number, string[]> = {
  2: ['warrington', 'nottingham'],
  3: ['nottingham'],
  4: [],
};

/**
 * The starting stacks on each player's mat: for every industry, the list of
 * levels still available (lowest first). One entry per physical tile.
 */
export function initialMatStacks(): Record<IndustryType, number[]> {
  const stacks = {} as Record<IndustryType, number[]>;
  for (const [industry, levels] of Object.entries(INDUSTRY_LEVELS)) {
    const arr: number[] = [];
    for (const def of levels) {
      for (let i = 0; i < def.count; i += 1) arr.push(def.level);
    }
    arr.sort((a, b) => a - b);
    stacks[industry as IndustryType] = arr;
  }
  return stacks;
}
