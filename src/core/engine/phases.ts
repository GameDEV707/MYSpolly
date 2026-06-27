import type { GameState, Card } from '../model/state.ts';
import type { GameEvent } from '../model/events.ts';
import type { PlayerColor } from '../model/types.ts';
import { ROUNDS_PER_ERA, HAND_SIZE, LINK_TILES_PER_PLAYER } from '../data/index.ts';
import { getMap } from '../maps/registry.ts';
import { eraDefOf } from '../maps/context.ts';
import { shuffle } from '../rng.ts';
import { resortTurnOrder } from './turnOrder.ts';
import { collectIncome } from './income.ts';
import { produceResources } from './production.ts';
import { scoreEra, scoreIntroBonus } from './scoring.ts';
import { refillHand } from './helpers.ts';

/** Actions allowed this turn: 1 during the first Canal round, else 2. */
export function actionsPerTurn(state: GameState): number {
  return state.isFirstCanalRound ? 1 : 2;
}

/**
 * Advance the game after a single action has been applied: decrement the action
 * counter, and when the active player's turn ends (or they run out of cards to
 * discard), refill their hand and move to the next player, triggering
 * round/era transitions as needed.
 */
export function endActionAndAdvance(state: GameState, events: GameEvent[]): void {
  state.actionsLeftThisTurn -= 1;
  const p = state.players[state.activePlayer];
  const hasCards = (p?.hand.length ?? 0) > 0;
  if (state.actionsLeftThisTurn > 0 && hasCards) return; // same player keeps going
  endTurn(state, events);
}

function handEmpty(state: GameState, color: PlayerColor): boolean {
  return (state.players[color]?.hand.length ?? 0) === 0;
}

function endTurn(state: GameState, events: GameEvent[]): void {
  // Refill the active player's hand (no-op once the deck is empty).
  refillHand(state, state.activePlayer, events);
  advanceWithinRound(state, events, state.activeIndex + 1);
}

/**
 * Make the next player who still has cards active. Players with empty hands
 * (deck exhausted) are skipped. If no later player can act, the round ends.
 */
function advanceWithinRound(state: GameState, events: GameEvent[], startIdx: number): void {
  let idx = startIdx;
  while (idx < state.turnOrder.length && handEmpty(state, state.turnOrder[idx] as PlayerColor)) {
    idx += 1;
  }
  if (idx >= state.turnOrder.length) {
    endRound(state, events);
    return;
  }
  state.activeIndex = idx;
  state.activePlayer = state.turnOrder[idx] as PlayerColor;
  state.actionsLeftThisTurn = actionsPerTurn(state);
  events.push({ t: 'TURN_ENDED', next: state.activePlayer });
}

function endRound(state: GameState, events: GameEvent[]): void {
  // Re-sort turn order (least spent first) and reset spent trackers.
  const newOrder = resortTurnOrder(state);
  // Collect income for everyone.
  for (const color of newOrder) {
    collectIncome(state, color, events);
  }
  // Per-round resource production (§7.16.2): each player's owned production
  // buildings add coal/iron/juice to their personal stockpile.
  for (const color of newOrder) {
    produceResources(state, color, events);
  }
  events.push({ t: 'ROUND_ENDED', round: state.round, newOrder: [...newOrder] });

  const maxRounds = ROUNDS_PER_ERA[state.options.players] ?? 8;
  const firstEraId = getMap(state.options.mapId).eras[0]!.id;
  const finishedFirstRound = state.era === firstEraId && state.round === 1;

  if (state.round >= maxRounds) {
    endEra(state, events);
    return;
  }

  state.round += 1;
  if (finishedFirstRound) state.isFirstCanalRound = false;
  // Start the new round at the first player who still has cards. If nobody can
  // act (deck and all hands exhausted) the round ends immediately, advancing
  // toward the era end.
  advanceWithinRound(state, events, 0);
}

function endEra(state: GameState, events: GameEvent[]): void {
  state.phase = 'eraEnd';
  scoreEra(state, state.era, events);
  events.push({ t: 'ERA_ENDED', era: state.era });

  const map = getMap(state.options.mapId);
  const idx = map.eras.findIndex((e) => e.id === state.era);
  const nextEra = map.eras[idx + 1];
  const firstEraId = map.eras[0]!.id;

  // The game ends after the last era, or after the first era in intro mode.
  if (!nextEra || state.options.introMode) {
    if (state.options.introMode && state.era === firstEraId) {
      scoreIntroBonus(state, events);
    }
    finishGame(state, events);
    return;
  }

  // End-of-era maintenance + the animated era-morph transition.
  const fromEra = state.era;
  const routeFrom = eraDefOf(map, fromEra).routeType;
  eraMaintenance(state, events);
  state.era = nextEra.id;
  state.round = 1;
  state.isFirstCanalRound = false;
  state.activeIndex = 0;
  state.activePlayer = state.turnOrder[0] as PlayerColor;
  state.actionsLeftThisTurn = 2;
  state.phase = 'playing';
  events.push({
    t: 'ERA_MORPH',
    from: fromEra,
    to: nextEra.id,
    routeFrom,
    routeTo: nextEra.routeType,
  });
  events.push({ t: 'TURN_ENDED', next: state.activePlayer });
}

/**
 * End-of-era maintenance, applied between eras (Canal→Rail, and Rail→Air on
 * maps with an Air Era): remove level-1 board tiles, restore link tiles, reset
 * merchant juice, and reshuffle all cards into a fresh hand of 8 per player.
 */
function eraMaintenance(state: GameState, events: GameEvent[]): void {
  // 1. Remove all level-1 industry tiles from the board (mats keep theirs).
  state.tiles = state.tiles.filter((t) => t.level >= 2);

  // Links were already removed during scoring; restore players' link tiles.
  for (const color of state.turnOrder) {
    const p = state.players[color];
    if (p) p.linksLeft = LINK_TILES_PER_PLAYER;
  }

  // 2. Reset merchant juice beside non-blank merchants.
  for (const m of state.merchants) {
    if (m.accepts.length > 0) m.hasJuice = true;
  }

  // 3. Reshuffle all discards + remaining deck (+ leftover hands) into a fresh
  //    Draw Deck, then deal each player a new hand of 8.
  const pool: Card[] = [...state.drawDeck];
  for (const color of state.turnOrder) {
    const p = state.players[color];
    if (!p) continue;
    pool.push(...p.discard, ...p.hand);
    p.discard = [];
    p.hand = [];
  }
  const sh = shuffle(pool, state.rngState);
  state.rngState = sh.state;
  state.drawDeck = sh.result;
  for (const color of state.turnOrder) {
    const p = state.players[color];
    if (!p) continue;
    for (let i = 0; i < HAND_SIZE && state.drawDeck.length > 0; i += 1) {
      const card = state.drawDeck.shift();
      if (card) p.hand.push(card);
    }
  }
  events.push({ t: 'CANAL_MAINTENANCE' });
}

/** Compute final ranking with tiebreaks and mark the game over. */
export function finishGame(state: GameState, events: GameEvent[]): void {
  const ranking = computeRanking(state);
  state.ranking = ranking;
  state.phase = 'gameOver';
  events.push({ t: 'GAME_OVER', ranking: [...ranking] });
}

/** Ranking (best first): VP → income level → money → otherwise tied. */
export function computeRanking(state: GameState): PlayerColor[] {
  return [...state.turnOrder].sort((a, b) => {
    const pa = state.players[a];
    const pb = state.players[b];
    if (!pa || !pb) return 0;
    if (pa.vp !== pb.vp) return pb.vp - pa.vp;
    if (pa.incomeLevel !== pb.incomeLevel) return pb.incomeLevel - pa.incomeLevel;
    return pb.money - pa.money;
  });
}
