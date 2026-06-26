import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildInitialState, type PlayerSeat } from '../../src/core/engine/setup.ts';
import { reduce, validate } from '../../src/core/engine/reduce.ts';
import { HeuristicBot, makeBot, type Difficulty } from '../../src/ai/bot.ts';
import type { GameState } from '../../src/core/model/state.ts';

function seats(n: number): PlayerSeat[] {
  const colors = ['red', 'blue', 'green', 'yellow'] as const;
  return colors.slice(0, n).map((c) => ({ color: c, name: c, isAI: true }));
}

function playBotGame(n: number, difficulty: Difficulty, seed: number): GameState {
  let s = buildInitialState({ seats: seats(n), seed });
  const bots = new Map(seats(n).map((seat, i) => [seat.color, makeBot(difficulty, seed + i + 1)]));
  let guard = 0;
  while (s.phase !== 'gameOver' && guard < 30000) {
    const bot = bots.get(s.activePlayer)!;
    const action = bot.chooseAction(s, s.activePlayer);
    assert.equal(validate(s, action), null, `bot chose a legal ${action.type}`);
    s = reduce(s, action).state;
    guard += 1;
  }
  return s;
}

describe('AI bot', () => {
  for (const difficulty of ['easy', 'normal', 'hard'] as Difficulty[]) {
    test(`${difficulty} bot plays a full 3-player game to completion`, () => {
      const s = playBotGame(3, difficulty, 100);
      assert.equal(s.phase, 'gameOver');
      assert.equal(s.ranking!.length, 3);
    });
  }

  test('bots only ever pick legal actions (2P, normal)', () => {
    const s = playBotGame(2, 'normal', 7);
    assert.equal(s.phase, 'gameOver');
  });

  test('a heuristic bot prefers a productive action over passing when possible', () => {
    const s = buildInitialState({ seats: seats(2), seed: 3 });
    const bot = new HeuristicBot('normal', 1);
    const action = bot.chooseAction(s, s.activePlayer);
    // With a fresh hand there is almost always something better than PASS.
    assert.notEqual(action.type, 'PASS');
  });

  test('bots produce a sensible final spread of VP', () => {
    const s = playBotGame(4, 'normal', 555);
    const vps = s.turnOrder.map((c) => s.players[c]!.vp);
    assert.ok(vps.every((v) => v >= 0));
    assert.ok(Math.max(...vps) > 0, 'someone scored points');
  });
});
