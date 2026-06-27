import type { GameState } from '../core/model/state.ts';
import { getSave, putSave, listSaves, deleteSave, getSetting, setSetting } from './db.ts';
import { SaveManager, type SaveStore } from './saveManager.ts';
import { AUTOSAVE_ID, type SaveMeta, type SaveSlot } from './types.ts';

/**
 * Production save API. All Continue / save / load / delete consistency lives in
 * the storage-agnostic {@link SaveManager}; this module simply binds it to the
 * IndexedDB (web) / filesystem (desktop) backend. The same manager is unit
 * tested offline with an in-memory store (see tests/unit/saveManager.test.ts).
 */

/** Settings key holding the single current-game pointer (a slot id). */
const POINTER_KEY = 'currentGameId';

/** IndexedDB-backed {@link SaveStore}. */
const dbStore: SaveStore = {
  getSave,
  putSave,
  deleteSave,
  listSaves,
  async getPointer() {
    return (await getSetting<string>(POINTER_KEY)) ?? null;
  },
  async setPointer(id) {
    await setSetting(POINTER_KEY, id);
  },
};

/** The application's single SaveManager instance. */
export const saves = new SaveManager(dbStore);

// ---------------------------------------------------------------------------
// Thin wrappers (kept for call-site readability and backwards compatibility).
// ---------------------------------------------------------------------------

/** Persist the current game after each turn / transition. */
export async function autosave(state: GameState): Promise<void> {
  await saves.autosaveCurrent(state);
}

/** Begin tracking a newly started game as the current (resumable) game. */
export async function startCurrentGame(state: GameState): Promise<void> {
  await saves.startNewCurrentGame(state);
}

/** Load the current game's state (Continue), or null if none is valid. */
export async function continueState(): Promise<GameState | null> {
  return saves.continueState();
}

/** Whether Continue should be enabled (pointer set AND save still exists). */
export async function hasValidCurrentGame(): Promise<boolean> {
  return saves.hasValidCurrentGame();
}

/** Metadata of the current game for the Continue summary, or null. */
export async function currentGameMeta(): Promise<SaveMeta | null> {
  return saves.currentGameMeta();
}

/** Clear the current-game pointer (finish / abandon). */
export async function clearCurrentGame(): Promise<void> {
  await saves.clearCurrentGame();
}

/** Save the in-progress game to a named slot (becomes the current game). */
export async function saveNamed(name: string, state: GameState): Promise<SaveSlot> {
  return saves.saveNamed(name, state);
}

/** Adopt an existing slot as the current game and return its restored state. */
export async function loadSlot(id: string): Promise<GameState | null> {
  return saves.adoptAsCurrent(id);
}

/** List all named slots (excludes the autosave), newest first. */
export async function listNamedSaves(): Promise<SaveSlot[]> {
  return saves.listNamedSaves();
}

export async function renameSlot(id: string, name: string): Promise<void> {
  await saves.renameSlot(id, name);
}

/** Delete a save; clears the Continue pointer if it was the current game. */
export async function removeSlot(id: string): Promise<void> {
  await saves.deleteSlot(id);
}

export { AUTOSAVE_ID };
