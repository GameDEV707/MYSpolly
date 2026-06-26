import type { GameState } from '../core/model/state.ts';
import type { Action } from '../core/model/actions.ts';
import type { IndustryType, PlayerColor } from '../core/model/types.ts';
import { getLevelDef } from '../core/data/industries.ts';

/**
 * Heuristic weights. Tuned so the bot pursues income growth and VP, develops the
 * board, sells goods, and avoids unnecessary loans. These power both the
 * immediate action score and the look-ahead position value.
 */
export interface HeuristicWeights {
  vp: number;
  income: number;
  money: number;
  boardPresence: number;
  flipped: number;
  build: number;
  sell: number;
  network: number;
  develop: number;
  loanPenalty: number;
  passPenalty: number;
  lookahead: number;
}

export const DEFAULT_WEIGHTS: HeuristicWeights = {
  vp: 3.0,
  income: 2.0,
  money: 0.15,
  boardPresence: 1.2,
  flipped: 2.5,
  build: 4.0,
  sell: 6.0,
  network: 2.5,
  develop: 1.5,
  loanPenalty: 5.0,
  passPenalty: 8.0,
  lookahead: 1.0,
};

/**
 * Immediate (pre-resolution) score for an action, independent of look-ahead.
 * Rewards productive actions (Build, Sell, Network, Develop) and penalises
 * Loan/Pass, scaled by the tile's value where relevant.
 */
export function scoreAction(
  state: GameState,
  _color: PlayerColor,
  action: Action,
  w: HeuristicWeights,
): number {
  switch (action.type) {
    case 'BUILD': {
      const def = safeLevelDef(state, action.industry);
      const value = def ? def.vp + def.incomeSpaces + def.linkVp : 0;
      return w.build + value * 0.4;
    }
    case 'SELL':
      return w.sell + action.sales.length * 3;
    case 'NETWORK':
      return w.network + action.links.length * 1.5;
    case 'DEVELOP':
      return w.develop + action.removals.length;
    case 'LOAN':
      return -w.loanPenalty + (state.players[state.activePlayer]!.money < 10 ? 6 : 0);
    case 'SCOUT':
      return -1;
    case 'PASS':
      return -w.passPenalty;
    default:
      return 0;
  }
}

function safeLevelDef(
  state: GameState,
  industry: IndustryType,
): ReturnType<typeof getLevelDef> | null {
  const stack = state.players[state.activePlayer]?.matStacks[industry];
  const level = stack?.[0];
  if (level === undefined) return null;
  try {
    return getLevelDef(industry, level);
  } catch {
    return null;
  }
}
