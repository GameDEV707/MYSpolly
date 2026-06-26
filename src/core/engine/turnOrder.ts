import type { GameState } from '../model/state.ts';
import type { PlayerColor } from '../model/types.ts';

/**
 * Re-sort the turn order at end of round: the player who spent the least money
 * this round goes first; the most goes last; ties keep their previous relative
 * order (stable). Spent-money trackers are then reset for the next round.
 */
export function resortTurnOrder(state: GameState): PlayerColor[] {
  const prevIndex = new Map<PlayerColor, number>();
  state.turnOrder.forEach((c, i) => prevIndex.set(c, i));

  const newOrder = [...state.turnOrder].sort((a, b) => {
    const sa = state.players[a]?.spentThisTurn ?? 0;
    const sb = state.players[b]?.spentThisTurn ?? 0;
    if (sa !== sb) return sa - sb;
    return (prevIndex.get(a) ?? 0) - (prevIndex.get(b) ?? 0);
  });

  state.turnOrder = newOrder;
  for (const c of newOrder) {
    const p = state.players[c];
    if (p) p.spentThisTurn = 0;
  }
  return newOrder;
}
