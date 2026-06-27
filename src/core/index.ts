/**
 * Public entry point for the pure game core.
 *
 * The core is framework-agnostic: it must never import React, the DOM, or any
 * third-party runtime package. Everything here is plain, deterministic,
 * serializable TypeScript so the engine can be unit-tested with Node's native
 * test runner and reused unchanged by the UI, the AI bots, and (future) a
 * server for online play.
 */

/** Save/serialization format version. Bumped when GameState shape changes. */
export const STATE_VERSION = 2;

/** Human-readable engine identifier, surfaced in logs and save metadata. */
export const ENGINE_NAME = 'myspolly-core';

// Public engine API.
export { buildInitialState, type SetupConfig, type PlayerSeat } from './engine/setup.ts';
export { reduce, validate } from './engine/reduce.ts';
export { legalActions, hasNonPassAction } from './selectors/legalActions.ts';
export {
  pointsToWin,
  isLeading,
  fullBreakdown,
  type FullVpBreakdown,
} from './selectors/standings.ts';
export { computeRanking } from './engine/phases.ts';
export * from './model/types.ts';
export type { GameState, PlayerState, PlacedTile, PlacedLink, Card } from './model/state.ts';
export type { Action } from './model/actions.ts';
export type { GameEvent, ReduceResult } from './model/events.ts';
