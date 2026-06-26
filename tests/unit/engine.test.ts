import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildInitialState, type PlayerSeat } from '../../src/core/engine/setup.ts';
import { reduce, validate } from '../../src/core/engine/reduce.ts';
import { legalActions } from '../../src/core/selectors/legalActions.ts';
import { computeRanking } from '../../src/core/engine/phases.ts';
import type { GameState } from '../../src/core/model/state.ts';
import type { Action } from '../../src/core/model/actions.ts';
import { nextInt } from '../../src/core/rng.ts';
import { HAND_SIZE, STARTING_MONEY, ROUNDS_PER_ERA } from '../../src/core/data/setup.ts';

function seats(n: number): PlayerSeat[] {
  const colors = ['red', 'blue', 'green', 'yellow'] as const;
  return colors.slice(0, n).map((c) => ({ color: c, name: c, isAI: true }));
}

describe('buildInitialState', () => {
  for (const n of [2, 3, 4]) {
    test(`${n}-player setup invariants`, () => {
      const s = buildInitialState({ seats: seats(n), seed: 42 });
      assert.equal(s.options.players, n);
      assert.equal(s.era, 'canal');
      assert.equal(s.round, 1);
      assert.equal(s.isFirstCanalRound, true);
      assert.equal(s.actionsLeftThisTurn, 1, 'first Canal round = 1 action');
      assert.equal(s.turnOrder.length, n);
      assert.equal(s.coalMarket.cubes, 13);
      assert.equal(s.ironMarket.cubes, 8);
      const merchantCount = n === 2 ? 5 : n === 3 ? 7 : 9;
      assert.equal(s.merchants.length, merchantCount);
      for (const color of s.turnOrder) {
        const p = s.players[color]!;
        assert.equal(p.hand.length, HAND_SIZE);
        assert.equal(p.discard.length, 1);
        assert.equal(p.money, STARTING_MONEY);
        assert.equal(p.incomeLevel, 10);
        assert.equal(p.vp, 0);
        assert.equal(p.linksLeft, 14);
        const tiles = Object.values(p.matStacks).reduce((a, arr) => a + arr.length, 0);
        assert.equal(tiles, 45);
      }
    });
  }

  test('is deterministic for a fixed seed', () => {
    const a = buildInitialState({ seats: seats(3), seed: 7 });
    const b = buildInitialState({ seats: seats(3), seed: 7 });
    assert.deepEqual(a, b);
  });

  test('different seeds give different deals', () => {
    const a = buildInitialState({ seats: seats(3), seed: 1 });
    const b = buildInitialState({ seats: seats(3), seed: 2 });
    const handA = a.players.red!.hand.map((c) => c.id).join(',');
    const handB = b.players.red!.hand.map((c) => c.id).join(',');
    assert.notEqual(handA + a.turnOrder.join(), handB + b.turnOrder.join());
  });

  test('rejects bad player counts', () => {
    assert.throws(() => buildInitialState({ seats: seats(1), seed: 1 }));
    assert.throws(() =>
      buildInitialState({
        seats: [
          { color: 'red', name: 'a', isAI: true },
          { color: 'red', name: 'b', isAI: true },
        ],
        seed: 1,
      }),
    );
  });
});

describe('reduce: purity & basic flow', () => {
  test('does not mutate the input state', () => {
    const s = buildInitialState({ seats: seats(2), seed: 5 });
    const before = structuredClone(s);
    const actions = legalActions(s);
    const loan = actions.find((a) => a.type === 'LOAN')!;
    reduce(s, loan);
    assert.deepEqual(s, before, 'input state unchanged');
  });

  test('LOAN gives £30 and drops income 3 levels', () => {
    const s = buildInitialState({ seats: seats(2), seed: 5 });
    const first = s.activePlayer;
    const loan = legalActions(s).find((a) => a.type === 'LOAN')!;
    const { state } = reduce(s, loan);
    assert.equal(state.players[first]!.money, STARTING_MONEY + 30);
    assert.equal(state.players[first]!.incomeLevel, 7);
  });

  test('first Canal round: each player gets exactly 1 action', () => {
    let s = buildInitialState({ seats: seats(2), seed: 9 });
    const p0 = s.activePlayer;
    const pass0 = legalActions(s).find((a) => a.type === 'PASS')!;
    s = reduce(s, pass0).state;
    // After one action the turn passes to the next player.
    assert.notEqual(s.activePlayer, p0);
    assert.equal(s.actionsLeftThisTurn, 1);
  });

  test('throws on illegal action', () => {
    const s = buildInitialState({ seats: seats(2), seed: 5 });
    const bad: Action = {
      type: 'BUILD',
      card: { cardId: 'nope' },
      industry: 'coal',
      locationId: 'birmingham',
      slotId: 's1',
      coalSources: [],
      ironSources: [],
    };
    assert.throws(() => reduce(s, bad));
  });
});

/** Deterministic random-bot playthrough used for golden + property testing. */
function playRandomGame(n: number, seed: number): { state: GameState; actions: number } {
  let s = buildInitialState({ seats: seats(n), seed });
  let rng = seed * 2654435761;
  let count = 0;
  const MAX = 20000;
  while (s.phase !== 'gameOver' && count < MAX) {
    const actions = legalActions(s);
    assert.ok(actions.length > 0, 'there is always at least one legal action (PASS)');
    // Prefer a non-pass action ~70% of the time to actually develop the board.
    const nonPass = actions.filter((a) => a.type !== 'PASS');
    const step = nextInt(rng, 100);
    rng = step.state;
    const pool = nonPass.length > 0 && step.value < 70 ? nonPass : actions;
    const pick = nextInt(rng, pool.length);
    rng = pick.state;
    const action = pool[pick.value]!;
    // Every enumerated action must be valid.
    assert.equal(validate(s, action), null, `action ${action.type} must validate`);
    s = reduce(s, action).state;
    count += 1;
  }
  return { state: s, actions: count };
}

describe('full headless games (property + golden)', () => {
  for (const n of [2, 3, 4]) {
    test(`${n}-player random game completes with valid final state`, () => {
      const { state } = playRandomGame(n, 1000 + n);
      assert.equal(state.phase, 'gameOver');
      assert.equal(state.era, 'rail', 'game ends after the Rail Era');
      assert.ok(state.ranking, 'ranking is set');
      assert.equal(state.ranking!.length, n);
      // No links remain (all scored & removed at end of era).
      assert.equal(state.links.length, 0);
      // VP and money are finite, non-NaN.
      for (const color of state.turnOrder) {
        const p = state.players[color]!;
        assert.ok(Number.isFinite(p.vp));
        assert.ok(Number.isFinite(p.money));
        assert.ok(p.vp >= 0);
      }
    });
  }

  test('golden: fixed seed produces a reproducible final ranking', () => {
    const a = playRandomGame(3, 12345);
    const b = playRandomGame(3, 12345);
    assert.deepEqual(a.state.ranking, b.state.ranking);
    assert.deepEqual(
      a.state.turnOrder.map((c) => a.state.players[c]!.vp),
      b.state.turnOrder.map((c) => b.state.players[c]!.vp),
    );
  });

  test('computeRanking orders by VP then income then money', () => {
    const s = buildInitialState({ seats: seats(3), seed: 3 });
    s.players.red!.vp = 50;
    s.players.blue!.vp = 50;
    s.players.green!.vp = 30;
    s.players.red!.incomeLevel = 5;
    s.players.blue!.incomeLevel = 9;
    const ranking = computeRanking(s);
    assert.equal(ranking[0], 'blue'); // tie on VP, higher income
    assert.equal(ranking[1], 'red');
    assert.equal(ranking[2], 'green');
  });

  test('intro variant: game ends after the Canal Era with bonus scoring', () => {
    let s = buildInitialState({ seats: seats(2), seed: 77, introMode: true });
    let rng = 4242;
    let guard = 0;
    while (s.phase !== 'gameOver' && guard < 20000) {
      const acts = legalActions(s);
      const pick = nextInt(rng, acts.length);
      rng = pick.state;
      s = reduce(s, acts[pick.value]!).state;
      guard += 1;
    }
    assert.equal(s.phase, 'gameOver');
    assert.equal(s.era, 'canal', 'intro variant never enters the Rail Era');
    assert.ok(s.ranking && s.ranking.length === 2);
  });

  test('era advances through Canal then Rail with correct round counts', () => {
    // Drive a 2-player game and watch era/round transitions stay in range.
    let s = buildInitialState({ seats: seats(2), seed: 55 });
    let rng = 999;
    let sawRail = false;
    const maxCanal = ROUNDS_PER_ERA[2]!;
    let guard = 0;
    while (s.phase !== 'gameOver' && guard < 20000) {
      if (s.era === 'rail') sawRail = true;
      assert.ok(s.round >= 1 && s.round <= maxCanal, `round ${s.round} in range`);
      const acts = legalActions(s);
      const pick = nextInt(rng, acts.length);
      rng = pick.state;
      s = reduce(s, acts[pick.value]!).state;
      guard += 1;
    }
    assert.ok(sawRail, 'the Rail Era was reached');
    assert.equal(s.phase, 'gameOver');
  });
});
