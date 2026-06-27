import type { GameState } from '../model/state.ts';
import type { GameEvent } from '../model/events.ts';
import type { PlayerColor } from '../model/types.ts';
import { getPlayer, changeMoney } from './helpers.ts';
import { resolveBankruptcy, type BankruptcyDecider } from './bankruptcy.ts';

/**
 * Collect income for one player at end of round (§7.17.5).
 *  - Positive income level → gain that much money.
 *  - Negative income level → must pay that much. Pay from cash first; any
 *    shortfall triggers an explicit **bankruptcy resolution**: the player sells
 *    tiles to the bank at half build cost or auctions them to the other players
 *    (starting at half), keeping any surplus. If no tiles remain, the remaining
 *    debt costs 1 VP per £1 (floored at 0). Money and VP never go negative.
 *
 * The bankruptcy decisions are made by `decider` (defaults to the deterministic
 * engine decider). The UI can inject a decider driven by a human's modal choices
 * and smarter AI bidding without changing this code path.
 */
export function collectIncome(
  state: GameState,
  color: PlayerColor,
  events: GameEvent[],
  decider?: BankruptcyDecider,
): void {
  const p = getPlayer(state, color);
  const income = p.incomeLevel;

  if (income >= 0) {
    if (income > 0) changeMoney(state, color, income, events);
    events.push({ t: 'INCOME_COLLECTED', player: color, amount: income });
    return;
  }

  // Negative income: owe `due`.
  const due = -income;
  events.push({ t: 'INCOME_COLLECTED', player: color, amount: income });

  // Pay from cash first.
  const fromCash = Math.min(p.money, due);
  if (fromCash > 0) changeMoney(state, color, -fromCash, events);
  const shortfall = due - fromCash;

  if (shortfall <= 0) {
    events.push({ t: 'SHORTFALL', player: color, tilesSold: 0, vpLost: 0 });
    return;
  }

  // Resolve the shortfall via bankruptcy (sell to bank / auction, then VP).
  const tilesBefore = state.tiles.filter((t) => t.owner === color).length;
  const res = resolveBankruptcy(state, color, shortfall, events, decider);
  const tilesAfter = state.tiles.filter((t) => t.owner === color).length;
  // SHORTFALL is kept as a compact summary for the log/animation layer; tiles
  // that changed owner via auction are not "sold" in this count (they remain on
  // the board), only tiles that left the board (sold to / bought by the bank).
  events.push({
    t: 'SHORTFALL',
    player: color,
    tilesSold: Math.max(0, tilesBefore - tilesAfter),
    vpLost: res.vpLost,
  });
}
