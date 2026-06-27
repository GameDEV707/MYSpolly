import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildInitialState, type PlayerSeat } from '../../src/core/engine/setup.ts';
import { reduce } from '../../src/core/engine/reduce.ts';
import { makeBot } from '../../src/ai/bot.ts';
import { scoreEra, scoreIntroBonus } from '../../src/core/engine/scoring.ts';
import { computeRanking } from '../../src/core/engine/phases.ts';
import { changeVp } from '../../src/core/engine/helpers.ts';
import { pointsToWin, isLeading, fullBreakdown } from '../../src/core/selectors/standings.ts';
import type { GameState, PlacedTile, PlacedLink } from '../../src/core/model/state.ts';
import type { GameEvent } from '../../src/core/model/events.ts';
import type { IndustryType, PlayerColor } from '../../src/core/model/types.ts';

function seats(n: number): PlayerSeat[] {
  const colors = ['red', 'blue', 'green', 'yellow'] as const;
  return colors.slice(0, n).map((c) => ({ color: c, name: c, isAI: true }));
}

function tile(
  owner: PlayerColor,
  industry: IndustryType,
  level: number,
  locationId: string,
  flipped: boolean,
): PlacedTile {
  return {
    id: `${owner}-${industry}-${level}-${locationId}`,
    owner,
    industry,
    level,
    locationId,
    slotId: 's1',
    flipped,
    resourcesLeft: 0,
  };
}

function link(owner: PlayerColor, lineId: string): PlacedLink {
  return { id: `${owner}-${lineId}`, owner, lineId, type: 'canal' };
}

describe('scoreEra (§3.11) — controlled scenarios', () => {
  test('links score 1 VP per link-VP icon in BOTH adjacent locations; only flipped tiles score', () => {
    const s = buildInitialState({ seats: seats(2), seed: 1 });
    // Hand-crafted board on the default Birmingham map (Canal Era).
    // Birmingham: red coal L2 (linkVp 1, vp 2, flipped) + red cotton L1 (linkVp 1, vp 5, flipped)
    // Dudley: blue iron L1 (linkVp 1, vp 3, UNFLIPPED → scores no tile VP)
    s.tiles = [
      tile('red', 'coal', 2, 'birmingham', true),
      tile('red', 'cotton', 1, 'birmingham', true),
      tile('blue', 'iron', 1, 'dudley', false),
    ];
    // One red Canal link between Dudley and Birmingham.
    s.links = [link('red', 'dudley__birmingham')];

    const events: GameEvent[] = [];
    const gained = scoreEra(s, 'canal', events);

    // Link VP = locationLinkVp(dudley)=1 + locationLinkVp(birmingham)=2 = 3.
    // Flipped tile VP (red) = coal L2 (2) + cotton L1 (5) = 7. Blue iron unflipped = 0.
    assert.equal(s.vpBreakdown!.red!.links, 3, 'red link VP');
    assert.equal(s.vpBreakdown!.red!.tiles, 7, 'red flipped-tile VP');
    assert.equal(s.vpBreakdown!.blue!.links, 0);
    assert.equal(s.vpBreakdown!.blue!.tiles, 0, 'unflipped tiles score nothing');
    assert.equal(gained.red, 10);
    assert.equal(gained.blue, 0);
    assert.equal(s.players.red!.vp, 10);
    assert.equal(s.players.blue!.vp, 0);

    // Links are removed as they are scored.
    assert.equal(s.links.length, 0, 'links removed after scoring');

    // The ERA_SCORING event splits links vs tiles and reconciles to perPlayer.
    const ev = events.find((e) => e.t === 'ERA_SCORING')!;
    assert.equal(ev.links.red! + ev.tiles.red!, ev.perPlayer.red!);
    assert.equal(ev.perPlayer.red, 10);
  });

  test('a tile present at both era ends is scored once PER era (no double counting in a single pass)', () => {
    const s = buildInitialState({ seats: seats(2), seed: 2 });
    s.tiles = [tile('red', 'cotton', 2, 'birmingham', true)]; // vp 5, survives maintenance
    s.links = [];
    const e1: GameEvent[] = [];
    scoreEra(s, 'canal', e1);
    assert.equal(s.players.red!.vp, 5, 'scored once at Canal end');
    // Same board still present at Rail end → scored again (rulebook behaviour).
    s.era = 'rail';
    const e2: GameEvent[] = [];
    scoreEra(s, 'rail', e2);
    assert.equal(s.players.red!.vp, 10, 'scored again at Rail end, accumulates');
    assert.equal(s.vpBreakdown!.red!.tiles, 10);
  });
});

describe('changeVp — applied delta is accurate (no desync under clamping)', () => {
  test('VP cannot go below 0 and the event reports the ACTUAL applied delta', () => {
    const s = buildInitialState({ seats: seats(2), seed: 3 });
    const events: GameEvent[] = [];
    s.players.red!.vp = 2;
    const applied = changeVp(s, 'red', -5, events);
    assert.equal(s.players.red!.vp, 0, 'clamped at 0');
    assert.equal(applied, -2, 'returns the actual change, not the requested -5');
    const ev = events.find((e) => e.t === 'VP_CHANGED')!;
    assert.equal(ev.delta, -2, 'event delta matches the actual change');
    assert.equal(ev.total, 0);
  });
});

describe('pointsToWin / isLeading (§7.13)', () => {
  test('gap to overtake the leader; sole leader needs 0', () => {
    const s = buildInitialState({ seats: seats(3), seed: 4 });
    s.players.red!.vp = 30;
    s.players.blue!.vp = 24;
    s.players.green!.vp = 32;
    // green leads → 0; red needs 32-30+1=3; blue needs 32-24+1=9.
    assert.equal(pointsToWin(s, 'green'), 0);
    assert.equal(isLeading(s, 'green'), true);
    assert.equal(pointsToWin(s, 'red'), 3);
    assert.equal(pointsToWin(s, 'blue'), 9);
    assert.equal(isLeading(s, 'red'), false);
  });

  test('tied at the top: both read 0 / leading (need +1 only to break ahead)', () => {
    const s = buildInitialState({ seats: seats(2), seed: 5 });
    s.players.red!.vp = 40;
    s.players.blue!.vp = 40;
    // highest other = 40, me = 40 → max(0, 40-40+1)=1.
    assert.equal(pointsToWin(s, 'red'), 1);
    assert.equal(pointsToWin(s, 'blue'), 1);
  });
});

/** Drive a full deterministic AI game, snapshotting VP at the Canal→Rail seam. */
function playSeeded(seed: number): { state: GameState; postCanal: Record<string, number> } {
  let s = buildInitialState({ seats: seats(3), seed });
  const bots = new Map(seats(3).map((seat, i) => [seat.color, makeBot('normal', seed + i + 1)]));
  let guard = 0;
  let postCanal: Record<string, number> | null = null;
  let lastEra = s.era;
  while (s.phase !== 'gameOver' && guard < 30000) {
    const bot = bots.get(s.activePlayer)!;
    s = reduce(s, bot.chooseAction(s, s.activePlayer)).state;
    if (lastEra === 'canal' && s.era === 'rail' && !postCanal) {
      postCanal = {};
      for (const c of s.turnOrder) postCanal[c] = s.players[c]!.vp;
    }
    lastEra = s.era;
    guard += 1;
  }
  return { state: s, postCanal: postCanal ?? {} };
}

describe('VP-scoring trustworthiness (regression, seed 12)', () => {
  // Pins a full deterministic AI game so the running (post-Canal) VP, the final
  // accumulated VP, and the ranking all stay self-consistent and reproducible
  // under the MYSpolly economy. Guards the §3.12a guarantee: the displayed VP is
  // always the engine VP and the Results breakdown reconciles exactly.
  const { state, postCanal } = playSeeded(12);

  test('running (post-Canal) standings are deterministic and trustworthy', () => {
    assert.deepEqual(postCanal, { red: 40, blue: 43, green: 49 });
    const runningLeader = Object.entries(postCanal).sort((a, b) => b[1] - a[1])[0]![0];
    assert.equal(runningLeader, 'green');
  });

  test('final standings accumulate correctly and are deterministic', () => {
    assert.equal(state.phase, 'gameOver');
    assert.equal(state.players.green!.vp, 145);
    assert.equal(state.players.red!.vp, 124);
    assert.equal(state.players.blue!.vp, 73);
    assert.deepEqual(state.ranking, ['green', 'red', 'blue']);
    // Era scoring only accumulates VP — the final never drops below the running.
    for (const c of state.turnOrder) {
      assert.ok(state.players[c]!.vp >= (postCanal[c] ?? 0), `${c} VP only accumulates`);
    }
  });

  test('ranking comes from engine VP with rulebook tie-breaks (matches computeRanking)', () => {
    assert.deepEqual(state.ranking, computeRanking(state));
  });

  test('Results breakdown reconciles EXACTLY: inPlay + links + tiles + intro = final VP', () => {
    for (const c of state.turnOrder) {
      const b = fullBreakdown(state, c);
      assert.equal(b.inPlay + b.links + b.tiles + b.intro, b.total, `${c} reconciles`);
      assert.equal(b.total, state.players[c]!.vp, `${c} total is the engine VP`);
    }
  });

  test('all links are removed once scored', () => {
    assert.equal(state.links.length, 0);
  });
});

describe('VP accounting reconciles across many seeded games', () => {
  for (const seed of [3, 5, 7, 12, 21, 33]) {
    test(`seed ${seed}: every player's breakdown sums to engine VP`, () => {
      const { state } = playSeeded(seed);
      assert.equal(state.phase, 'gameOver');
      for (const c of state.turnOrder) {
        const b = fullBreakdown(state, c);
        assert.equal(b.inPlay + b.links + b.tiles + b.intro, state.players[c]!.vp);
        assert.ok(b.inPlay >= 0 || b.inPlay < 0); // finite
        assert.ok(Number.isFinite(b.total));
      }
      assert.equal(state.links.length, 0, 'no links remain');
    });
  }
});

describe('intro variant scoring (§3.14)', () => {
  test('bonus VP (money + income + level-≥2 re-score) is tracked and reconciles', () => {
    const s = buildInitialState({ seats: seats(2), seed: 6, introMode: true });
    // Controlled board: one flipped L3 cotton (vp 9) for red.
    s.tiles = [tile('red', 'cotton', 3, 'birmingham', true)];
    s.links = [];
    s.players.red!.money = 20; // £20 → 5 VP (max 15)
    s.players.red!.incomeLevel = 8; // +8 VP
    s.players.blue!.money = 3; // 0 VP
    s.players.blue!.incomeLevel = 10; // +10 VP

    const events: GameEvent[] = [];
    scoreEra(s, 'canal', events); // tile L3 cotton vp 9 (flipped)
    const afterEra = s.players.red!.vp;
    assert.equal(afterEra, 9);

    scoreIntroBonus(s, events);
    // red intro: money 5 + income 8 + level≥2 re-score (cotton L3 vp 9) = 22.
    assert.equal(s.vpBreakdown!.red!.intro, 22);
    assert.equal(s.players.red!.vp, 9 + 22);
    // blue intro: money 0 + income 10 + no flipped tile = 10.
    assert.equal(s.vpBreakdown!.blue!.intro, 10);

    for (const c of s.turnOrder) {
      const b = fullBreakdown(s, c);
      assert.equal(b.inPlay + b.links + b.tiles + b.intro, b.total);
      assert.equal(b.total, s.players[c]!.vp);
    }
  });
});
