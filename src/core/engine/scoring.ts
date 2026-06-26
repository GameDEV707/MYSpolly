import type { GameState } from '../model/state.ts';
import type { GameEvent } from '../model/events.ts';
import type { Era, PlayerColor } from '../model/types.ts';
import { LINK_LINES, MERCHANT_LINK_VP } from '../data/board.ts';
import { getLevelDef } from '../data/industries.ts';
import { changeVp } from './helpers.ts';

const LINE_BY_ID = Object.fromEntries(LINK_LINES.map((l) => [l.id, l]));

/** Sum of link-VP icons present in a single location (built tiles + merchant). */
function locationLinkVp(state: GameState, locId: string): number {
  let sum = 0;
  for (const tile of state.tiles) {
    if (tile.locationId === locId) sum += getLevelDef(tile.industry, tile.level).linkVp;
  }
  sum += MERCHANT_LINK_VP[locId] ?? 0;
  return sum;
}

/**
 * End-of-era scoring:
 *  1. Score each player's links (1 VP per VP-icon in the two adjacent
 *     locations), then remove all links from the board.
 *  2. Score the VP of every flipped industry tile on the board.
 * Returns the VP gained per player and pushes events.
 */
export function scoreEra(state: GameState, era: Era, events: GameEvent[]): Record<string, number> {
  const gained: Record<string, number> = {};
  const add = (c: PlayerColor, n: number): void => {
    gained[c] = (gained[c] ?? 0) + n;
  };

  // 1. Links.
  for (const link of state.links) {
    const line = LINE_BY_ID[link.lineId];
    if (!line) continue;
    const vp = locationLinkVp(state, line.a) + locationLinkVp(state, line.b);
    if (vp > 0) {
      changeVp(state, link.owner, vp, events);
      add(link.owner, vp);
    }
  }
  // Remove all links from the board as they are scored.
  state.links = [];

  // 2. Flipped industry tiles.
  for (const tile of state.tiles) {
    if (!tile.flipped) continue;
    const vp = getLevelDef(tile.industry, tile.level).vp;
    if (vp > 0) {
      changeVp(state, tile.owner, vp, events);
      add(tile.owner, vp);
    }
  }

  events.push({ t: 'ERA_SCORING', era, perPlayer: { ...gained } });
  return gained;
}

/**
 * Introductory-variant bonus scoring (Canal-Era-only game):
 *  +1 VP per £4 remaining (max 15), + income-level VP (negative subtracts),
 *  and level ≥2 industry tiles score their VP a second time.
 */
export function scoreIntroBonus(state: GameState, events: GameEvent[]): void {
  for (const color of state.turnOrder) {
    const p = state.players[color];
    if (!p) continue;
    const moneyVp = Math.min(15, Math.floor(p.money / 4));
    changeVp(state, color, moneyVp, events);
    if (p.incomeLevel >= 0) changeVp(state, color, p.incomeLevel, events);
    else changeVp(state, color, -Math.min(p.vp, -p.incomeLevel), events);
  }
  for (const tile of state.tiles) {
    if (tile.flipped && tile.level >= 2) {
      changeVp(state, tile.owner, getLevelDef(tile.industry, tile.level).vp, events);
    }
  }
}
