import type { GameState, VpBreakdown } from '../model/state.ts';
import type { PlayerColor } from '../model/types.ts';

/**
 * Standings / VP-derived selectors (§3.12a, §7.13). All read from the single
 * authoritative engine VP (`p.vp`) so any UI built on them can never drift from
 * the running score the engine actually tracks.
 */

/**
 * Victory points a player still needs to take the lead:
 *   pointsToWin = max(0, (highest VP among the OTHER players) − this VP + 1)
 * The current sole leader (strictly ahead of, or tied at the top with, everyone
 * else) needs 0 — they are already leading. Brass has no fixed VP threshold, so
 * "to win" is the gap required to overtake the current front-runner.
 */
export function pointsToWin(state: GameState, color: PlayerColor): number {
  const me = state.players[color]?.vp ?? 0;
  let highestOther = -Infinity;
  for (const other of state.turnOrder) {
    if (other === color) continue;
    const v = state.players[other]?.vp ?? 0;
    if (v > highestOther) highestOther = v;
  }
  if (!Number.isFinite(highestOther)) return 0; // solo game / no opponents
  return Math.max(0, highestOther - me + 1);
}

/** Whether this player is currently leading (nobody else has more VP). */
export function isLeading(state: GameState, color: PlayerColor): boolean {
  return pointsToWin(state, color) === 0;
}

/** A player's VP breakdown reconciled so the parts sum exactly to `p.vp`. */
export interface FullVpBreakdown extends VpBreakdown {
  /** VP gained during play (merchant bonuses, income shortfalls) = vp − scored. */
  inPlay: number;
  /** The authoritative engine total; equals inPlay + links + tiles + intro. */
  total: number;
}

/**
 * Reconstruct a player's full VP breakdown. `inPlay` is derived as the
 * remainder so the four buckets always add up to the engine's `p.vp` exactly
 * (no rounding / clamping drift).
 */
export function fullBreakdown(state: GameState, color: PlayerColor): FullVpBreakdown {
  const total = state.players[color]?.vp ?? 0;
  const b = state.vpBreakdown?.[color] ?? { links: 0, tiles: 0, intro: 0 };
  const inPlay = total - b.links - b.tiles - b.intro;
  return { links: b.links, tiles: b.tiles, intro: b.intro, inPlay, total };
}
