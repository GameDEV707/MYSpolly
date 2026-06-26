import type { GameState } from '../model/state.ts';
import type { GameEvent } from '../model/events.ts';
import type { PlayerColor } from '../model/types.ts';
import { getLevelDef } from '../data/industries.ts';
import { getPlayer, changeMoney, changeVp } from './helpers.ts';

/**
 * Collect income for one player at end of round.
 *  - Positive income level → gain that much money.
 *  - Negative income level → must pay that much. If short, sell your own
 *    industry tiles for half their build cost (rounded down) each (removed from
 *    the game) until covered. If still short, lose 1 VP per £1 still owed.
 */
export function collectIncome(state: GameState, color: PlayerColor, events: GameEvent[]): void {
  const p = getPlayer(state, color);
  const income = p.incomeLevel;

  if (income >= 0) {
    if (income > 0) changeMoney(state, color, income, events);
    events.push({ t: 'INCOME_COLLECTED', player: color, amount: income });
    return;
  }

  // Negative income: owe `due`.
  let due = -income;
  // Pay from cash first.
  const fromCash = Math.min(p.money, due);
  if (fromCash > 0) changeMoney(state, color, -fromCash, events);
  due -= fromCash;

  let tilesSold = 0;
  // Sell own tiles for half (rounded down) of their build cost.
  while (due > 0) {
    const candidates = state.tiles.filter((t) => t.owner === color);
    if (candidates.length === 0) break;
    // Sell the cheapest-value tile first to minimise loss of board presence.
    candidates.sort((a, b) => buildHalf(a) - buildHalf(b));
    const tile = candidates[0]!;
    const refund = buildHalf(tile);
    state.tiles = state.tiles.filter((t) => t.id !== tile.id);
    tilesSold += 1;
    if (refund > 0) changeMoney(state, color, refund, events);
    const pay = Math.min(p.money, due);
    if (pay > 0) changeMoney(state, color, -pay, events);
    due -= pay;
  }

  // Still short → lose 1 VP per £1 owed.
  let vpLost = 0;
  if (due > 0) {
    vpLost = Math.min(p.vp, due);
    if (vpLost > 0) changeVp(state, color, -vpLost, events);
    due -= vpLost;
  }

  events.push({ t: 'INCOME_COLLECTED', player: color, amount: income });
  events.push({ t: 'SHORTFALL', player: color, tilesSold, vpLost });
}

function buildHalf(tile: {
  industry: GameState['tiles'][number]['industry'];
  level: number;
}): number {
  return Math.floor(getLevelDef(tile.industry, tile.level).costMoney / 2);
}
