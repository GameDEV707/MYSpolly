import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildInitialState } from '../../src/core/engine/setup.ts';
import { reduce } from '../../src/core/engine/reduce.ts';
import { legalActions } from '../../src/core/selectors/legalActions.ts';
import { SaveManager, InMemorySaveStore } from '../../src/persistence/saveManager.ts';
import type { GameState } from '../../src/core/model/state.ts';

function freshGame(seed = 7): GameState {
  return buildInitialState({
    seats: [
      { color: 'red', name: 'R', isAI: false },
      { color: 'blue', name: 'B', isAI: true },
    ],
    seed,
  });
}

function playN(state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n && s.phase === 'playing'; i += 1) {
    s = reduce(s, legalActions(s)[0]!).state;
  }
  return s;
}

describe('SaveManager — Continue/Delete consistency (§7.10.6)', () => {
  test('no current game → Continue is disabled and loads nothing', async () => {
    const mgr = new SaveManager(new InMemorySaveStore());
    assert.equal(await mgr.hasValidCurrentGame(), false);
    assert.equal(await mgr.continueState(), null);
  });

  test('starting a game enables Continue and resumes it', async () => {
    const mgr = new SaveManager(new InMemorySaveStore());
    const game = freshGame();
    await mgr.startNewCurrentGame(game);
    assert.equal(await mgr.hasValidCurrentGame(), true);
    const resumed = await mgr.continueState();
    assert.deepEqual(resumed, game);
  });

  test('autosave keeps Continue resolving to the latest state', async () => {
    const mgr = new SaveManager(new InMemorySaveStore());
    let game = freshGame();
    await mgr.startNewCurrentGame(game);
    game = playN(game, 4);
    await mgr.autosaveCurrent(game);
    const resumed = await mgr.continueState();
    assert.deepEqual(resumed, game);
  });

  test('delete-then-Continue: deleting the current game disables Continue', async () => {
    const store = new InMemorySaveStore();
    const mgr = new SaveManager(store);
    const game = freshGame();
    // Save to a named slot — that slot becomes the current game.
    const slot = await mgr.saveNamed('My game', game);
    assert.equal(await mgr.hasValidCurrentGame(), true);
    // Delete that slot.
    await mgr.deleteSlot(slot.id);
    // Continue must now be disabled and must NOT load the deleted game.
    assert.equal(await mgr.hasValidCurrentGame(), false);
    assert.equal(await mgr.continueState(), null);
    assert.equal(await mgr.currentGameId(), null);
  });

  test('save → delete → Continue (the reported bug): no resurrection', async () => {
    const mgr = new SaveManager(new InMemorySaveStore());
    const game = freshGame(11);
    // Game in progress (autosave / current).
    await mgr.startNewCurrentGame(game);
    // Player saves it to a named slot (now the canonical current game).
    const slot = await mgr.saveNamed('Slot A', game);
    // Player deletes that saved game.
    await mgr.deleteSlot(slot.id);
    // Pressing Continue must do nothing.
    assert.equal(await mgr.hasValidCurrentGame(), false);
    assert.equal(await mgr.continueState(), null);
  });

  test('finish-then-Continue: a finished game is not resumable', async () => {
    const mgr = new SaveManager(new InMemorySaveStore());
    const game = freshGame();
    await mgr.startNewCurrentGame(game);
    // Finishing (game over) clears the current-game pointer.
    await mgr.clearCurrentGame();
    assert.equal(await mgr.hasValidCurrentGame(), false);
    assert.equal(await mgr.continueState(), null);
  });

  test('abandon clears the current game and removes the autosave slot', async () => {
    const store = new InMemorySaveStore();
    const mgr = new SaveManager(store);
    await mgr.startNewCurrentGame(freshGame());
    await mgr.clearCurrentGame();
    assert.equal(await mgr.hasValidCurrentGame(), false);
    // The autosave slot is gone, so nothing dangles.
    assert.equal((await mgr.listNamedSaves()).length, 0);
  });

  test('resume-matches-saved-state: Continue equals the saved Load slot', async () => {
    const mgr = new SaveManager(new InMemorySaveStore());
    let game = freshGame(21);
    await mgr.startNewCurrentGame(game);
    game = playN(game, 6);
    await mgr.autosaveCurrent(game);
    // Save to a named slot; it becomes the current game (no fork).
    const slot = await mgr.saveNamed('Checkpoint', game);
    const viaContinue = await mgr.continueState();
    const viaLoad = await mgr.adoptAsCurrent(slot.id);
    assert.deepEqual(viaContinue, game);
    assert.deepEqual(viaLoad, game);
    assert.deepEqual(viaContinue, viaLoad);
  });

  test('deleting a NON-current named slot leaves Continue intact', async () => {
    const mgr = new SaveManager(new InMemorySaveStore());
    const game = freshGame();
    await mgr.startNewCurrentGame(game); // pointer → autosave
    const other = await mgr.saveNamed('Other', freshGame(99)); // pointer → other
    // Re-adopt the autosave as current so 'other' is not the current game.
    await mgr.startNewCurrentGame(game);
    await mgr.deleteSlot(other.id);
    assert.equal(await mgr.hasValidCurrentGame(), true);
    assert.notEqual(await mgr.continueState(), null);
  });

  test('a dangling pointer self-heals (validate on launch)', async () => {
    const store = new InMemorySaveStore();
    const mgr = new SaveManager(store);
    // Simulate a stale pointer to a save that no longer exists.
    await store.setPointer('ghost-slot');
    assert.equal(await mgr.hasValidCurrentGame(), false);
    assert.equal(await store.getPointer(), null);
  });
});
