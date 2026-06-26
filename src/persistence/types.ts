import type { GameState } from '../core/model/state.ts';

/** Lightweight summary stored alongside a save for list/Continue UIs. */
export interface SaveMeta {
  era: GameState['era'];
  round: number;
  players: number;
  colors: string[];
  /** VP standings keyed by colour. */
  standings: Record<string, number>;
  /** Epoch millis when the save was written. */
  timestamp: number;
  version: number;
}

/** A persisted save slot (autosave or a named slot). */
export interface SaveSlot {
  id: string;
  name: string;
  meta: SaveMeta;
  /** Serialized GameState. */
  data: string;
}

/** Id of the dedicated autosave ("current game") slot. */
export const AUTOSAVE_ID = '__autosave__';
