import type { GameState } from '../core/model/state.ts';
import { serializeState, deserializeState, makeSaveMeta } from './serialize.ts';
import { putSave, getSave, listSaves, deleteSave } from './db.ts';
import { AUTOSAVE_ID, type SaveSlot } from './types.ts';

/** Write the autosave ("current game") slot. Called after each turn/transition. */
export async function autosave(state: GameState): Promise<void> {
  await putSave({
    id: AUTOSAVE_ID,
    name: 'Autosave',
    meta: makeSaveMeta(state),
    data: serializeState(state),
  });
}

/** Load the autosave, or null if none exists. */
export async function loadAutosave(): Promise<GameState | null> {
  const slot = await getSave(AUTOSAVE_ID);
  if (!slot) return null;
  try {
    return deserializeState(slot.data);
  } catch {
    return null;
  }
}

export async function hasAutosave(): Promise<boolean> {
  return (await getSave(AUTOSAVE_ID)) !== null;
}

/** Save the game to a named slot. */
export async function saveNamed(name: string, state: GameState): Promise<SaveSlot> {
  const slot: SaveSlot = {
    id: `slot-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    name,
    meta: makeSaveMeta(state),
    data: serializeState(state),
  };
  await putSave(slot);
  return slot;
}

export async function loadSlot(id: string): Promise<GameState | null> {
  const slot = await getSave(id);
  if (!slot) return null;
  return deserializeState(slot.data);
}

/** List all named slots (excludes the autosave), newest first. */
export async function listNamedSaves(): Promise<SaveSlot[]> {
  const all = await listSaves();
  return all
    .filter((s) => s.id !== AUTOSAVE_ID)
    .sort((a, b) => b.meta.timestamp - a.meta.timestamp);
}

export async function renameSlot(id: string, name: string): Promise<void> {
  const slot = await getSave(id);
  if (slot) await putSave({ ...slot, name });
}

export async function removeSlot(id: string): Promise<void> {
  await deleteSave(id);
}

export { AUTOSAVE_ID };
