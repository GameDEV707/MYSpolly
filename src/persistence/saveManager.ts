import type { GameState } from '../core/model/state.ts';
import { serializeState, deserializeState, makeSaveMeta } from './serialize.ts';
import { AUTOSAVE_ID, type SaveSlot } from './types.ts';

/**
 * Save / Continue / Delete consistency (§7.10.6, Phase 8B).
 *
 * The historical bug was that **Continue** loaded a stale autosave *copy* that
 * was decoupled from the Load-Game slot list: saving a game to a named slot,
 * deleting that slot, then pressing Continue still resurrected the deleted
 * game. The fix below gives the app **one** explicit "current game" pointer (a
 * slot-id reference, never a duplicate copy):
 *
 *  - Continue is valid only when the pointer references a save that STILL
 *    exists (validated on launch and whenever the Main Menu is shown).
 *  - Deleting the current game's slot clears the pointer in the same operation
 *    (no dangling pointer → Continue immediately disabled).
 *  - Finishing / abandoning a game clears the pointer.
 *  - Saving the in-progress game and continuing it resolve to the SAME slot, so
 *    Continue and the Load slot can never fork.
 *
 * The class is storage-agnostic (it talks to a {@link SaveStore}) so the exact
 * semantics can be exhaustively unit-tested offline with an in-memory store,
 * while production wires it to IndexedDB / the desktop filesystem.
 */

/** Persistence backend the manager operates against (saves + the pointer). */
export interface SaveStore {
  getSave(id: string): Promise<SaveSlot | null>;
  putSave(slot: SaveSlot): Promise<void>;
  deleteSave(id: string): Promise<void>;
  listSaves(): Promise<SaveSlot[]>;
  /** The current-game pointer (a slot id), or null when no game is resumable. */
  getPointer(): Promise<string | null>;
  setPointer(id: string | null): Promise<void>;
}

/** A simple in-memory {@link SaveStore} for tests and headless use. */
export class InMemorySaveStore implements SaveStore {
  private saves = new Map<string, SaveSlot>();
  private pointer: string | null = null;

  async getSave(id: string): Promise<SaveSlot | null> {
    return this.saves.get(id) ?? null;
  }
  async putSave(slot: SaveSlot): Promise<void> {
    // Store a structural copy so callers can't mutate persisted data in place.
    this.saves.set(slot.id, JSON.parse(JSON.stringify(slot)) as SaveSlot);
  }
  async deleteSave(id: string): Promise<void> {
    this.saves.delete(id);
  }
  async listSaves(): Promise<SaveSlot[]> {
    return [...this.saves.values()];
  }
  async getPointer(): Promise<string | null> {
    return this.pointer;
  }
  async setPointer(id: string | null): Promise<void> {
    this.pointer = id;
  }
}

function newSlotId(): string {
  return `slot-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export class SaveManager {
  private readonly store: SaveStore;

  constructor(store: SaveStore) {
    this.store = store;
  }

  // -- current-game pointer -------------------------------------------------

  /** The slot id the Continue button resumes, or null. */
  async currentGameId(): Promise<string | null> {
    return this.store.getPointer();
  }

  /**
   * Whether Continue should be enabled: the pointer is set AND the referenced
   * save still exists. Self-heals a dangling pointer (clears it) so the Main
   * Menu never offers a Continue that would fail.
   */
  async hasValidCurrentGame(): Promise<boolean> {
    const id = await this.store.getPointer();
    if (!id) return false;
    const slot = await this.store.getSave(id);
    if (!slot) {
      await this.store.setPointer(null);
      return false;
    }
    return true;
  }

  /** Metadata of the current game (for the Continue summary), or null. */
  async currentGameMeta(): Promise<SaveSlot['meta'] | null> {
    const id = await this.store.getPointer();
    if (!id) return null;
    const slot = await this.store.getSave(id);
    return slot?.meta ?? null;
  }

  // -- starting / resuming --------------------------------------------------

  /**
   * Begin tracking a freshly started game as the current game. Writes it to the
   * dedicated autosave slot and points Continue at that slot.
   */
  async startNewCurrentGame(state: GameState): Promise<void> {
    await this.writeSlot(AUTOSAVE_ID, 'Autosave', state);
    await this.store.setPointer(AUTOSAVE_ID);
  }

  /**
   * Persist progress of the current game. Writes to whichever slot the pointer
   * references (defaulting to the autosave slot and adopting it as current if
   * no pointer is set yet). This guarantees Continue and the active game never
   * diverge.
   */
  async autosaveCurrent(state: GameState): Promise<void> {
    let id = await this.store.getPointer();
    if (!id) {
      id = AUTOSAVE_ID;
      await this.store.setPointer(id);
    }
    // Preserve the existing slot's display name (e.g. a manual save's name).
    const existing = await this.store.getSave(id);
    await this.writeSlot(id, existing?.name ?? 'Autosave', state);
  }

  /** Load the current game's state, or null if there isn't a valid one. */
  async continueState(): Promise<GameState | null> {
    const id = await this.store.getPointer();
    if (!id) return null;
    const slot = await this.store.getSave(id);
    if (!slot) {
      await this.store.setPointer(null);
      return null;
    }
    try {
      return deserializeState(slot.data);
    } catch {
      return null;
    }
  }

  /**
   * Adopt an existing slot (e.g. one chosen in Load Game) as the current game,
   * so subsequent autosaves and Continue resolve to that same slot.
   */
  async adoptAsCurrent(id: string): Promise<GameState | null> {
    const slot = await this.store.getSave(id);
    if (!slot) return null;
    let state: GameState;
    try {
      state = deserializeState(slot.data);
    } catch {
      return null;
    }
    await this.store.setPointer(id);
    return state;
  }

  // -- manual saves ---------------------------------------------------------

  /**
   * Save the (current) in-progress game to a named slot. The new slot becomes
   * the current game, so Continue and this Load slot point at the SAME record —
   * deleting it later correctly disables Continue (no fork, no resurrection).
   */
  async saveNamed(name: string, state: GameState): Promise<SaveSlot> {
    const id = newSlotId();
    const slot = await this.writeSlot(id, name, state);
    await this.store.setPointer(id);
    return slot;
  }

  // -- deleting / clearing --------------------------------------------------

  /**
   * Delete a save slot. If it was the current game, the pointer is cleared in
   * the same operation so Continue immediately becomes disabled and never
   * dangles at removed data.
   */
  async deleteSlot(id: string): Promise<void> {
    await this.store.deleteSave(id);
    if ((await this.store.getPointer()) === id) {
      await this.store.setPointer(null);
    }
  }

  /**
   * Clear the current-game pointer (a game finished or was abandoned). The
   * autosave slot is also removed so it can't be loaded out of band; named
   * slots are left intact in the Load list.
   */
  async clearCurrentGame(): Promise<void> {
    const id = await this.store.getPointer();
    await this.store.setPointer(null);
    if (id === AUTOSAVE_ID) {
      await this.store.deleteSave(AUTOSAVE_ID);
    }
  }

  /** List named (non-autosave) slots, newest first. */
  async listNamedSaves(): Promise<SaveSlot[]> {
    const all = await this.store.listSaves();
    return all
      .filter((s) => s.id !== AUTOSAVE_ID)
      .sort((a, b) => b.meta.timestamp - a.meta.timestamp);
  }

  async renameSlot(id: string, name: string): Promise<void> {
    const slot = await this.store.getSave(id);
    if (slot) await this.store.putSave({ ...slot, name });
  }

  // -- internals ------------------------------------------------------------

  private async writeSlot(id: string, name: string, state: GameState): Promise<SaveSlot> {
    const slot: SaveSlot = {
      id,
      name,
      meta: makeSaveMeta(state),
      data: serializeState(state),
    };
    await this.store.putSave(slot);
    return slot;
  }
}
