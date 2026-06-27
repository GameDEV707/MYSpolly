import type { GameState, PlacedTile, PlayerState, Card } from '../model/state.ts';
import type { GameEvent } from '../model/events.ts';
import type { PlayerColor } from '../model/types.ts';
import { getLevelDef } from '../data/industries.ts';
import { HAND_SIZE, INCOME_LEVEL_MAX, INCOME_LEVEL_MIN } from '../data/setup.ts';

/**
 * Income model (documented decision):
 *
 * The physical board uses a non-linear income track where marker *spaces* and
 * income *levels* differ at high incomes (e.g. 2–3 spaces per level). MYSpolly.md
 * §3 specifies "income level caps at 30", a floor of −10, advancing by the
 * "spaces" printed on tiles, and collecting money equal to the income *level*.
 *
 * For a first correct, self-consistent implementation we model income linearly:
 * `incomeLevel` is the level, money collected each round equals it, tile
 * `incomeSpaces` add directly to it, and Loan subtracts 3. Because Loan is
 * defined in levels and the only place spaces≠levels is the non-linear track,
 * the rules stay consistent. VERIFY: replace with the exact non-linear track
 * (a pure data table) for pixel-faithful high-income behaviour — no logic change
 * is needed beyond a position→level lookup.
 */

export function getPlayer(state: GameState, color: PlayerColor): PlayerState {
  const p = state.players[color];
  if (!p) throw new Error(`Unknown player ${color}`);
  return p;
}

export function changeMoney(
  state: GameState,
  color: PlayerColor,
  delta: number,
  events: GameEvent[],
): void {
  const p = getPlayer(state, color);
  p.money += delta;
  events.push({ t: 'MONEY_CHANGED', player: color, delta, total: p.money });
}

/**
 * Spend money on an action: leaves the pool and is recorded on the character
 * tile. Per §7.17.1 this must **never** silently drive money below £0 — the
 * action validators guarantee affordability (`totalCost <= money`) before any
 * `spend()`. An attempt to overspend is an engine error (a validation bug), not
 * a silent debt; mandatory payments a player cannot afford go through
 * `payOrBankrupt()` (see `engine/bankruptcy.ts`) instead.
 */
export function spend(
  state: GameState,
  color: PlayerColor,
  amount: number,
  events: GameEvent[],
): void {
  if (amount < 0) throw new Error(`spend() amount must be ≥ 0, got ${amount}`);
  const p = getPlayer(state, color);
  if (amount > p.money) {
    throw new Error(
      `spend() would drive ${color} below £0 (have ${p.money}, need ${amount}) — affordability must be validated first`,
    );
  }
  p.money -= amount;
  p.spentThisTurn += amount;
  events.push({ t: 'MONEY_CHANGED', player: color, delta: -amount, total: p.money });
}

/**
 * A buyer pays another player for a peer-to-peer resource trade (§7.17.3):
 * money moves buyer → owner. The buyer's payment counts as money spent this
 * turn (so it influences next round's turn order, like any other purchase); the
 * owner simply receives it. The buyer must be able to afford it (validated up
 * front) — this never drives the buyer below £0.
 */
export function payPlayer(
  state: GameState,
  buyer: PlayerColor,
  owner: PlayerColor,
  amount: number,
  events: GameEvent[],
): void {
  if (amount <= 0) return;
  spend(state, buyer, amount, events);
  changeMoney(state, owner, amount, events);
}

/**
 * Change a player's VP, clamping at 0 (VP can never go negative). The emitted
 * `VP_CHANGED` event reports the **actual applied** delta — not the requested
 * one — so any consumer that reconstructs VP by summing deltas (e.g. the action
 * preview HUD, the Results breakdown) stays perfectly in sync with the engine's
 * authoritative `p.vp`. Returns the applied delta.
 */
export function changeVp(
  state: GameState,
  color: PlayerColor,
  delta: number,
  events: GameEvent[],
): number {
  if (delta === 0) return 0;
  const p = getPlayer(state, color);
  const before = p.vp;
  p.vp = Math.max(0, p.vp + delta);
  const applied = p.vp - before;
  if (applied === 0) return 0;
  events.push({ t: 'VP_CHANGED', player: color, delta: applied, total: p.vp });
  return applied;
}

/** Advance the income marker by `spaces` (capped at the maximum income level). */
export function advanceIncome(
  state: GameState,
  color: PlayerColor,
  spaces: number,
  events: GameEvent[],
): void {
  if (spaces === 0) return;
  const p = getPlayer(state, color);
  const before = p.incomeLevel;
  p.incomeLevel = Math.min(INCOME_LEVEL_MAX, p.incomeLevel + spaces);
  const delta = p.incomeLevel - before;
  if (delta !== 0) {
    events.push({ t: 'INCOME_CHANGED', player: color, delta, level: p.incomeLevel });
  }
}

/** Move the income marker down by `levels` (floored at the minimum). */
export function reduceIncome(
  state: GameState,
  color: PlayerColor,
  levels: number,
  events: GameEvent[],
): void {
  const p = getPlayer(state, color);
  const before = p.incomeLevel;
  p.incomeLevel = Math.max(INCOME_LEVEL_MIN, p.incomeLevel - levels);
  const delta = p.incomeLevel - before;
  if (delta !== 0) {
    events.push({ t: 'INCOME_CHANGED', player: color, delta, level: p.incomeLevel });
  }
}

/** Remove a card from a player's hand by id (throws if absent). */
export function removeCardFromHand(p: PlayerState, cardId: string): Card {
  const idx = p.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) throw new Error(`Card ${cardId} not in hand`);
  return p.hand.splice(idx, 1)[0] as Card;
}

/**
 * Discard the card used for an action. Wild cards return to their supply pile;
 * all other cards go to the player's discard pile.
 */
export function discardActionCard(
  state: GameState,
  color: PlayerColor,
  cardId: string,
  events: GameEvent[],
): void {
  const p = getPlayer(state, color);
  const card = removeCardFromHand(p, cardId);
  if (card.kind === 'wildLocation') {
    state.wildLocationPile += 1;
    events.push({ t: 'CARD_RETURNED_WILD', player: color, card });
  } else if (card.kind === 'wildIndustry') {
    state.wildIndustryPile += 1;
    events.push({ t: 'CARD_RETURNED_WILD', player: color, card });
  } else {
    p.discard.push(card);
    events.push({ t: 'CARD_DISCARDED', player: color, card });
  }
}

/** Refill a player's hand up to HAND_SIZE from the draw deck (deck may empty). */
export function refillHand(state: GameState, color: PlayerColor, events: GameEvent[]): void {
  const p = getPlayer(state, color);
  let drawn = 0;
  while (p.hand.length < HAND_SIZE && state.drawDeck.length > 0) {
    const card = state.drawDeck.shift();
    if (!card) break;
    p.hand.push(card);
    drawn += 1;
  }
  if (drawn > 0) events.push({ t: 'HAND_REFILLED', player: color, count: drawn });
}

/** Flip a (cotton/manufacturer/pottery) tile on Sell, advancing income. */
export function flipTile(state: GameState, tile: PlacedTile, events: GameEvent[]): void {
  if (tile.flipped) return;
  tile.flipped = true;
  const def = getLevelDef(tile.industry, tile.level);
  events.push({
    t: 'TILE_FLIPPED',
    tileId: tile.id,
    incomeGain: def.incomeSpaces,
    player: tile.owner,
  });
  advanceIncome(state, tile.owner, def.incomeSpaces, events);
}

/**
 * Consume one resource cube/barrel from a coal mine / iron works / juice.
 * If this empties the tile, it flips and advances its owner's income.
 */
export function consumeFromTile(
  state: GameState,
  tile: PlacedTile,
  resource: 'coal' | 'iron' | 'juice',
  consumer: PlayerColor,
  events: GameEvent[],
): void {
  if (tile.resourcesLeft <= 0) throw new Error(`Tile ${tile.id} has no ${resource} left`);
  tile.resourcesLeft -= 1;
  events.push({ t: 'RESOURCE_CONSUMED', resource, from: tile.id, player: consumer });
  if (tile.resourcesLeft === 0 && !tile.flipped) {
    tile.flipped = true;
    const def = getLevelDef(tile.industry, tile.level);
    events.push({
      t: 'TILE_FLIPPED',
      tileId: tile.id,
      incomeGain: def.incomeSpaces,
      player: tile.owner,
    });
    advanceIncome(state, tile.owner, def.incomeSpaces, events);
  }
}

export function findTile(state: GameState, tileId: string): PlacedTile {
  const t = state.tiles.find((x) => x.id === tileId);
  if (!t) throw new Error(`No tile ${tileId}`);
  return t;
}
