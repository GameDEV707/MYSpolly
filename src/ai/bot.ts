import type { GameState } from '../core/model/state.ts';
import type { Action } from '../core/model/actions.ts';
import type { PlayerColor } from '../core/model/types.ts';
import { legalActions } from '../core/selectors/legalActions.ts';
import { reduce } from '../core/engine/reduce.ts';
import { defaultDecider, type BankruptcyDecider } from '../core/engine/bankruptcy.ts';
import { scoreAction, type HeuristicWeights, DEFAULT_WEIGHTS } from './heuristic.ts';
import { nextInt } from '../core/rng.ts';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Bot {
  readonly difficulty: Difficulty;
  /** Choose an action for `color` (assumed to be the active player). */
  chooseAction(state: GameState, color: PlayerColor): Action;
}

/**
 * Heuristic, rules-aware bot. It only uses the public engine API
 * (`legalActions` + `reduce`), so it is exactly as constrained as a human.
 *
 *  - Easy   : greedy — pick the highest immediate-heuristic action (with a
 *             little randomness so games vary).
 *  - Normal : 1-ply look-ahead — evaluate the resulting state after each action.
 *  - Hard   : 1-ply look-ahead over a wider candidate set with sharper weights.
 */
export class HeuristicBot implements Bot {
  readonly difficulty: Difficulty;
  private readonly weights: HeuristicWeights;
  private rng: number;

  constructor(difficulty: Difficulty = 'normal', seed = 1, weights?: Partial<HeuristicWeights>) {
    this.difficulty = difficulty;
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
    this.rng = seed | 0 || 1;
  }

  private rand(max: number): number {
    const step = nextInt(this.rng, max);
    this.rng = step.state;
    return step.value;
  }

  chooseAction(state: GameState, color: PlayerColor): Action {
    const actions = legalActions(state);
    if (actions.length === 0) {
      throw new Error('Bot asked to act with no legal actions');
    }
    if (actions.length === 1) return actions[0]!;

    const candidates = this.candidateSet(actions);
    let best: { action: Action; score: number } | null = null;

    for (const action of candidates) {
      let score: number;
      if (this.difficulty === 'easy') {
        score = scoreAction(state, color, action, this.weights);
      } else {
        // Look ahead one step and evaluate the resulting position.
        try {
          const { state: next } = reduce(state, action);
          score =
            scoreAction(state, color, action, this.weights) +
            this.weights.lookahead * positionValue(next, color, this.weights);
        } catch {
          continue; // skip any action that unexpectedly fails
        }
      }
      // Small deterministic jitter to break ties and vary play.
      score += this.rand(100) / 1000;
      if (!best || score > best.score) best = { action, score };
    }
    return best?.action ?? actions[0]!;
  }

  /** Limit how many candidates we deeply evaluate (perf), keeping variety. */
  private candidateSet(actions: Action[]): Action[] {
    if (this.difficulty === 'easy') return actions;
    const cap = this.difficulty === 'hard' ? 220 : 120;
    if (actions.length <= cap) return actions;
    // Keep a representative slice: prioritise non-pass actions.
    const nonPass = actions.filter((a) => a.type !== 'PASS');
    const pass = actions.filter((a) => a.type === 'PASS');
    return [...nonPass.slice(0, cap - 1), ...(pass[0] ? [pass[0]] : [])];
  }
}

/** Aggregate board value for a player (used by look-ahead). */
function positionValue(state: GameState, color: PlayerColor, w: HeuristicWeights): number {
  const p = state.players[color];
  if (!p) return 0;
  const flippedCount = state.tiles.filter((t) => t.owner === color && t.flipped).length;
  return (
    p.vp * w.vp +
    p.incomeLevel * w.income +
    p.money * w.money +
    state.tiles.filter((t) => t.owner === color).length * w.boardPresence +
    flippedCount * w.flipped
  );
}

/** Convenience factory. */
export function makeBot(difficulty: Difficulty, seed: number): Bot {
  return new HeuristicBot(difficulty, seed);
}

/**
 * The AI's bankruptcy/auction policy (§7.17.6). Because the end-of-round income
 * step resolves any shortfall inside the pure reducer, every player — human or
 * bot — is governed by the engine's deterministic `defaultDecider` during
 * headless/automated play: it sells low-value tiles to the bank, auctions
 * high-value tiles when an opponent can afford the opening bid, and has every
 * opponent bid up to a fraction of a tile's worth (capped by their cash). The
 * bot therefore never attempts an unaffordable action (affordability is enforced
 * by `legalActions`), buys resource shortfalls via the engine's
 * stockpile→market→player resolution, makes sensible liquidation choices, and
 * bids in opponents' auctions. An interactive UI can inject a decider driven by
 * a human's modal choices in place of this one.
 */
export const aiBankruptcyDecider: BankruptcyDecider = defaultDecider;
