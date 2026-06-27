import type { GameState, VpBreakdown } from '../model/state.ts';
import type { GameEvent } from '../model/events.ts';
import type { Era, PlayerColor } from '../model/types.ts';
import { getLevelDef } from '../data/industries.ts';
import { boardContext } from '../maps/context.ts';
import { changeVp } from './helpers.ts';

/** Sum of link-VP icons present in a single location (built tiles + merchant). */
function locationLinkVp(state: GameState, locId: string): number {
  let sum = 0;
  for (const tile of state.tiles) {
    if (tile.locationId === locId) sum += getLevelDef(tile.industry, tile.level).linkVp;
  }
  sum += boardContext(state).merchantLinkVp[locId] ?? 0;
  return sum;
}

/** Lazily create the per-player VP breakdown accumulator on the state. */
function breakdownFor(state: GameState, color: PlayerColor): VpBreakdown {
  if (!state.vpBreakdown) state.vpBreakdown = {} as Record<PlayerColor, VpBreakdown>;
  let b = state.vpBreakdown[color];
  if (!b) {
    b = { links: 0, tiles: 0, intro: 0 };
    state.vpBreakdown[color] = b;
  }
  return b;
}

/**
 * End-of-era scoring (§3.11). Runs once at the end of EACH era (Canal, Rail,
 * and Air on maps that have it):
 *  1. Score each player's links: 1 VP per link-VP icon in the two locations the
 *     link touches (every built tile + the adjacent merchant), then remove all
 *     links from the board.
 *  2. Score every FLIPPED industry tile on the board for its bottom-left VP.
 *     Unflipped tiles score nothing.
 *
 * Tiles that survive era maintenance (level ≥2) are still on the board at the
 * next era end and are scored again then — this is the rulebook behaviour and
 * is NOT double counting: each scoring pass scores the board exactly once.
 *
 * Records a per-player breakdown (links vs tiles) on the state and returns the
 * VP gained per player.
 */
export function scoreEra(state: GameState, era: Era, events: GameEvent[]): Record<string, number> {
  const links: Record<string, number> = {};
  const tiles: Record<string, number> = {};
  const total: Record<string, number> = {};
  for (const color of state.turnOrder) {
    links[color] = 0;
    tiles[color] = 0;
    total[color] = 0;
  }

  // 1. Links — score the link-VP icons in both adjacent locations, using the
  //    *applied* VP delta so the breakdown reconciles exactly with `p.vp`.
  const lineById = boardContext(state).lineById;
  for (const link of state.links) {
    const line = lineById[link.lineId];
    if (!line) continue;
    const vp = locationLinkVp(state, line.a) + locationLinkVp(state, line.b);
    if (vp > 0) {
      const applied = changeVp(state, link.owner, vp, events);
      links[link.owner] = (links[link.owner] ?? 0) + applied;
      total[link.owner] = (total[link.owner] ?? 0) + applied;
    }
  }
  // Remove all links from the board as they are scored.
  state.links = [];

  // 2. Flipped industry tiles.
  for (const tile of state.tiles) {
    if (!tile.flipped) continue;
    const vp = getLevelDef(tile.industry, tile.level).vp;
    if (vp > 0) {
      const applied = changeVp(state, tile.owner, vp, events);
      tiles[tile.owner] = (tiles[tile.owner] ?? 0) + applied;
      total[tile.owner] = (total[tile.owner] ?? 0) + applied;
    }
  }

  // Accumulate into the persistent breakdown.
  for (const color of state.turnOrder) {
    const b = breakdownFor(state, color);
    b.links += links[color] ?? 0;
    b.tiles += tiles[color] ?? 0;
  }

  events.push({ t: 'ERA_SCORING', era, perPlayer: { ...total }, links: { ...links }, tiles: { ...tiles } });
  return total;
}

/**
 * Introductory-variant bonus scoring (§3.14, Canal-Era-only game):
 *  +1 VP per £4 remaining (max 15), + income-level VP (negative subtracts),
 *  and level ≥2 flipped industry tiles score their VP a second time.
 * All of this is recorded in the `intro` breakdown bucket.
 */
export function scoreIntroBonus(state: GameState, events: GameEvent[]): void {
  for (const color of state.turnOrder) {
    const p = state.players[color];
    if (!p) continue;
    const b = breakdownFor(state, color);
    const moneyVp = Math.min(15, Math.floor(p.money / 4));
    b.intro += changeVp(state, color, moneyVp, events);
    if (p.incomeLevel >= 0) b.intro += changeVp(state, color, p.incomeLevel, events);
    else b.intro += changeVp(state, color, -Math.min(p.vp, -p.incomeLevel), events);
  }
  for (const tile of state.tiles) {
    if (tile.flipped && tile.level >= 2) {
      const b = breakdownFor(state, tile.owner);
      b.intro += changeVp(state, tile.owner, getLevelDef(tile.industry, tile.level).vp, events);
    }
  }
}
