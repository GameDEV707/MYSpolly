import type { GameState, Card } from '../../model/state.ts';
import type { GameEvent } from '../../model/events.ts';
import type { LoanAction, ScoutAction, PassAction } from '../../model/actions.ts';
import type { PlayerColor } from '../../model/types.ts';
import { LOAN_MONEY, LOAN_INCOME_LEVELS } from '../../data/setup.ts';
import { getPlayer, changeMoney, reduceIncome, removeCardFromHand } from '../helpers.ts';
import { mintId } from '../setup.ts';

// ---------------------------------------------------------------- Loan -------
export function validateLoan(state: GameState, player: PlayerColor, a: LoanAction): string | null {
  const p = getPlayer(state, player);
  if (!p.hand.find((c) => c.id === a.card.cardId)) return 'Card not in hand';
  // Loan is always legal (income may already be at the floor; it simply won't move).
  return null;
}

export function applyLoan(
  state: GameState,
  player: PlayerColor,
  _a: LoanAction,
  events: GameEvent[],
): void {
  changeMoney(state, player, LOAN_MONEY, events);
  reduceIncome(state, player, LOAN_INCOME_LEVELS, events);
  events.push({ t: 'LOAN_TAKEN', player });
}

// --------------------------------------------------------------- Scout -------
export function validateScout(
  state: GameState,
  player: PlayerColor,
  a: ScoutAction,
): string | null {
  const p = getPlayer(state, player);
  if (!p.hand.find((c) => c.id === a.card.cardId)) return 'Card not in hand';
  const ids = [a.card.cardId, a.extraDiscards[0].cardId, a.extraDiscards[1].cardId];
  if (new Set(ids).size !== 3) return 'Scout needs 3 distinct cards';
  for (const ref of a.extraDiscards) {
    if (!p.hand.find((c) => c.id === ref.cardId)) return 'Extra discard not in hand';
  }
  // Forbidden if you already hold any wild card.
  if (p.hand.some((c) => c.kind === 'wildLocation' || c.kind === 'wildIndustry')) {
    return 'Cannot Scout while holding a wild card';
  }
  if (state.wildLocationPile <= 0 || state.wildIndustryPile <= 0) return 'No wild cards available';
  return null;
}

export function applyScout(
  state: GameState,
  player: PlayerColor,
  a: ScoutAction,
  events: GameEvent[],
): void {
  const p = getPlayer(state, player);
  // Discard the two extra cards (the action card is discarded by the dispatcher).
  for (const ref of a.extraDiscards) {
    const card = removeCardFromHand(p, ref.cardId);
    p.discard.push(card);
    events.push({ t: 'CARD_DISCARDED', player, card });
  }
  const wildLoc: Card = { id: mintId(state, 'c'), kind: 'wildLocation', name: 'card.wildLocation' };
  const wildInd: Card = { id: mintId(state, 'c'), kind: 'wildIndustry', name: 'card.wildIndustry' };
  p.hand.push(wildLoc, wildInd);
  state.wildLocationPile -= 1;
  state.wildIndustryPile -= 1;
  events.push({ t: 'SCOUT', player });
}

// ---------------------------------------------------------------- Pass -------
export function validatePass(state: GameState, player: PlayerColor, a: PassAction): string | null {
  const p = getPlayer(state, player);
  if (!p.hand.find((c) => c.id === a.card.cardId)) return 'Card not in hand';
  return null;
}

export function applyPass(
  _state: GameState,
  player: PlayerColor,
  _a: PassAction,
  events: GameEvent[],
): void {
  events.push({ t: 'ACTION_DONE', player, action: 'PASS' });
}
