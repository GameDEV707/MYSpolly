import { openDB, type IDBPDatabase } from 'idb';
import type { SaveSlot } from './types.ts';

/**
 * IndexedDB access layer (web). The desktop (Tauri) build can swap this for the
 * filesystem via the same async interface (see Phase 6). All methods are async
 * and fail soft (returning null / no-op) so the UI never crashes on quota or
 * private-mode errors.
 */

const DB_NAME = 'myspolly';
const DB_VERSION = 1;
const SAVES = 'saves';
const SETTINGS = 'settings';

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(SAVES)) {
          database.createObjectStore(SAVES, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(SETTINGS)) {
          database.createObjectStore(SETTINGS);
        }
      },
    });
  }
  return dbPromise;
}

export async function putSave(slot: SaveSlot): Promise<void> {
  try {
    await (await db()).put(SAVES, slot);
  } catch {
    /* ignore persistence failures (quota / private mode) */
  }
}

export async function getSave(id: string): Promise<SaveSlot | null> {
  try {
    return (await (await db()).get(SAVES, id)) ?? null;
  } catch {
    return null;
  }
}

export async function listSaves(): Promise<SaveSlot[]> {
  try {
    return (await (await db()).getAll(SAVES)) as SaveSlot[];
  } catch {
    return [];
  }
}

export async function deleteSave(id: string): Promise<void> {
  try {
    await (await db()).delete(SAVES, id);
  } catch {
    /* ignore */
  }
}

export async function getSetting<T>(key: string): Promise<T | null> {
  try {
    return ((await (await db()).get(SETTINGS, key)) as T) ?? null;
  } catch {
    return null;
  }
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  try {
    await (await db()).put(SETTINGS, value, key);
  } catch {
    /* ignore */
  }
}
