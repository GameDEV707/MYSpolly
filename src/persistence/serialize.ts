import type { GameState } from '../core/model/state.ts';
import { STATE_VERSION } from '../core/index.ts';
import type { SaveMeta } from './types.ts';

/**
 * Pure (browser-independent) save serialization. GameState is plain JSON, so
 * saving is `JSON.stringify` and loading is `JSON.parse` plus a version check
 * and migration hook. This module is unit-tested in isolation.
 */

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

export class SaveVersionError extends Error {}

/** Migrate an older save shape forward. */
function migrate(raw: unknown): GameState {
  const obj = raw as { version?: number; options?: Record<string, unknown> };
  if (typeof obj?.version !== 'number') {
    throw new SaveVersionError('Save has no version field');
  }
  if (obj.version > STATE_VERSION) {
    throw new SaveVersionError(
      `Save version ${obj.version} is newer than this build (${STATE_VERSION})`,
    );
  }
  // v1 → v2: single-map saves gain an explicit mapId (the classic board).
  if (obj.version < 2) {
    if (obj.options && typeof obj.options === 'object' && obj.options.mapId === undefined) {
      obj.options.mapId = 'birmingham';
    }
    obj.version = STATE_VERSION;
  }
  return raw as GameState;
}

export function deserializeState(data: string): GameState {
  const parsed: unknown = JSON.parse(data);
  return migrate(parsed);
}

/** Build a compact metadata summary from a game state. */
export function makeSaveMeta(state: GameState): SaveMeta {
  const standings: Record<string, number> = {};
  for (const color of state.turnOrder) {
    const p = state.players[color];
    if (p) standings[color] = p.vp;
  }
  return {
    era: state.era,
    round: state.round,
    players: state.options.players,
    colors: [...state.turnOrder],
    standings,
    timestamp: Date.now(),
    version: state.version,
  };
}
