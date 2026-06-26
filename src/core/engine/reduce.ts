import type { GameState } from '../model/state.ts';
import type { GameEvent, ReduceResult } from '../model/events.ts';
import type { Action } from '../model/actions.ts';
import { discardActionCard } from './helpers.ts';
import { endActionAndAdvance } from './phases.ts';
import { validateBuild, applyBuild } from './actions/build.ts';
import { validateNetwork, applyNetwork } from './actions/network.ts';
import { validateDevelop, applyDevelop } from './actions/develop.ts';
import { validateSell, applySell } from './actions/sell.ts';
import {
  validateLoan,
  applyLoan,
  validateScout,
  applyScout,
  validatePass,
  applyPass,
} from './actions/misc.ts';

/** Validate an action for the current active player; returns an error or null. */
export function validate(state: GameState, action: Action): string | null {
  if (state.phase !== 'playing') return 'Game is not in the playing phase';
  const player = state.activePlayer;
  switch (action.type) {
    case 'BUILD':
      return validateBuild(state, player, action);
    case 'NETWORK':
      return validateNetwork(state, player, action);
    case 'DEVELOP':
      return validateDevelop(state, player, action);
    case 'SELL':
      return validateSell(state, player, action);
    case 'LOAN':
      return validateLoan(state, player, action);
    case 'SCOUT':
      return validateScout(state, player, action);
    case 'PASS':
      return validatePass(state, player, action);
    default: {
      const _exhaustive: never = action;
      return `Unknown action ${(_exhaustive as { type: string }).type}`;
    }
  }
}

function apply(state: GameState, action: Action, events: GameEvent[]): void {
  const player = state.activePlayer;
  switch (action.type) {
    case 'BUILD':
      applyBuild(state, player, action, events);
      break;
    case 'NETWORK':
      applyNetwork(state, player, action, events);
      break;
    case 'DEVELOP':
      applyDevelop(state, player, action, events);
      break;
    case 'SELL':
      applySell(state, player, action, events);
      break;
    case 'LOAN':
      applyLoan(state, player, action, events);
      break;
    case 'SCOUT':
      applyScout(state, player, action, events);
      break;
    case 'PASS':
      applyPass(state, player, action, events);
      break;
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unknown action ${(_exhaustive as { type: string }).type}`);
    }
  }
}

/**
 * The single rules authority. Applies `action` to `state` purely (the input is
 * never mutated) and returns the new state plus the events produced. Throws if
 * the action is illegal — callers should use `legalActions`/`validate` first.
 */
export function reduce(state: GameState, action: Action): ReduceResult {
  const error = validate(state, action);
  if (error) throw new Error(`Illegal action ${action.type}: ${error}`);

  const next = structuredClone(state) as GameState;
  const events: GameEvent[] = [];
  const player = next.activePlayer;

  apply(next, action, events);

  // Discard the card used for the action (wilds return to their pile).
  discardActionCard(next, player, action.card.cardId, events);
  events.push({ t: 'ACTION_DONE', player, action: action.type });

  // Advance the turn/round/era machine.
  endActionAndAdvance(next, events);

  return { state: next, events };
}
