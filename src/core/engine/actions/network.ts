import type { GameState, PlacedLink } from '../../model/state.ts';
import type { GameEvent } from '../../model/events.ts';
import type { NetworkAction, ResourceSource } from '../../model/actions.ts';
import type { LinkType, PlayerColor } from '../../model/types.ts';
import { LINK_LINES } from '../../data/board.ts';
import {
  CANAL_LINK_COST,
  RAIL_SINGLE_LINK_COST,
  RAIL_DOUBLE_LINK_COST,
  RAIL_LINK_COAL,
} from '../../data/setup.ts';
import { getPlayer, spend } from '../helpers.ts';
import { mintId } from '../setup.ts';
import { consumeCoal, consumeJuice, resolveCoal } from '../consume.ts';
import { hasNoPresence, playerNetwork } from '../../selectors/connectivity.ts';
import { juiceTileOptions } from '../../selectors/resources.ts';

const LINE_BY_ID = Object.fromEntries(LINK_LINES.map((l) => [l.id, l]));

function lineOccupied(state: GameState, lineId: string): boolean {
  return state.links.some((l) => l.lineId === lineId);
}

function lineEndpoints(lineId: string): [string, string] | null {
  const line = LINE_BY_ID[lineId];
  return line ? [line.a, line.b] : null;
}

/**
 * Can the chosen lines be placed, each adjacent to the player's (growing)
 * network? Handles the "no presence → any legal line" case and the 2-link case
 * where the second link may attach to the first.
 */
function adjacencyOk(state: GameState, player: PlayerColor, lineIds: string[]): boolean {
  if (hasNoPresence(state, player)) return true;
  const net = playerNetwork(state, player);
  const remaining = [...lineIds];
  let progress = true;
  while (remaining.length > 0 && progress) {
    progress = false;
    for (let i = 0; i < remaining.length; i += 1) {
      const ep = lineEndpoints(remaining[i] as string);
      if (!ep) continue;
      if (net.has(ep[0]) || net.has(ep[1])) {
        net.add(ep[0]);
        net.add(ep[1]);
        remaining.splice(i, 1);
        progress = true;
        break;
      }
    }
  }
  return remaining.length === 0;
}

export function validateNetwork(
  state: GameState,
  player: PlayerColor,
  a: NetworkAction,
): string | null {
  const p = getPlayer(state, player);
  if (!p.hand.find((c) => c.id === a.card.cardId)) return 'Card not in hand';
  if (a.links.length === 0) return 'No links specified';

  const era = state.era;
  const linkType: LinkType = era === 'canal' ? 'canal' : 'rail';

  if (era === 'canal' && a.links.length !== 1)
    return 'Canal Era: exactly 1 link per Network action';
  if (era === 'rail' && (a.links.length < 1 || a.links.length > 2)) {
    return 'Rail Era: build 1 or 2 links per Network action';
  }
  if (a.links.length > p.linksLeft) return 'Not enough link tiles on your mat';

  const lineIds = a.links.map((l) => l.lineId);
  if (new Set(lineIds).size !== lineIds.length) return 'Duplicate link in action';

  for (const spec of a.links) {
    const line = LINE_BY_ID[spec.lineId];
    if (!line) return 'Unknown link line';
    if (!line.types.includes(linkType)) return `That connection has no ${linkType} route`;
    if (lineOccupied(state, spec.lineId)) return 'That connection already has a link';
  }

  if (!adjacencyOk(state, player, lineIds)) return 'Link must connect to your network';

  // Costs.
  let money =
    era === 'canal'
      ? CANAL_LINK_COST
      : a.links.length === 1
        ? RAIL_SINGLE_LINK_COST
        : RAIL_DOUBLE_LINK_COST;

  // Rail: each link consumes coal; double-link consumes juice.
  if (era === 'rail') {
    for (const spec of a.links) {
      const ep = lineEndpoints(spec.lineId);
      if (!ep) return 'Unknown link line';
      const fromA = resolveCoal(state, ep[0], RAIL_LINK_COAL);
      const fromB = resolveCoal(state, ep[1], RAIL_LINK_COAL);
      const best = pickCheaper(fromA, fromB);
      if (!best) return 'Cannot obtain coal for a rail link';
      money += best.marketCost;
    }
    if (a.links.length === 2) {
      const juiceOk = a.juiceSource
        ? validateJuiceSource(state, player, lineIds, a.juiceSource)
        : autoJuiceSource(state, player, lineIds) !== null;
      if (!juiceOk) return 'Building 2 rail links requires 1 juice from a juice';
    }
  }

  if (p.money < money) return 'Not enough money';
  return null;
}

function pickCheaper(
  x: { marketCost: number; sources: ResourceSource[] } | null,
  y: { marketCost: number; sources: ResourceSource[] } | null,
): { marketCost: number; sources: ResourceSource[] } | null {
  if (!x) return y;
  if (!y) return x;
  return x.marketCost <= y.marketCost ? x : y;
}

function endpointsOf(lineIds: string[]): Set<string> {
  const s = new Set<string>();
  for (const id of lineIds) {
    const ep = lineEndpoints(id);
    if (ep) {
      s.add(ep[0]);
      s.add(ep[1]);
    }
  }
  return s;
}

function autoJuiceSource(
  state: GameState,
  player: PlayerColor,
  lineIds: string[],
): ResourceSource | null {
  for (const loc of endpointsOf(lineIds)) {
    const opts = juiceTileOptions(state, player, loc);
    if (opts.length > 0) return { from: 'tile', tileId: (opts[0] as { id: string }).id };
  }
  return null;
}

function validateJuiceSource(
  state: GameState,
  player: PlayerColor,
  lineIds: string[],
  src: ResourceSource,
): boolean {
  if (src.from !== 'tile') return false; // network juice must come from a juice, not a merchant
  for (const loc of endpointsOf(lineIds)) {
    if (juiceTileOptions(state, player, loc).some((t) => t.id === src.tileId)) return true;
  }
  return false;
}

export function applyNetwork(
  state: GameState,
  player: PlayerColor,
  a: NetworkAction,
  events: GameEvent[],
): void {
  const p = getPlayer(state, player);
  const era = state.era;
  const linkType: LinkType = era === 'canal' ? 'canal' : 'rail';

  const baseMoney =
    era === 'canal'
      ? CANAL_LINK_COST
      : a.links.length === 1
        ? RAIL_SINGLE_LINK_COST
        : RAIL_DOUBLE_LINK_COST;
  spend(state, player, baseMoney, events);

  // Place links.
  for (const spec of a.links) {
    const link: PlacedLink = {
      id: mintId(state, 'l'),
      owner: player,
      lineId: spec.lineId,
      type: linkType,
    };
    state.links.push(link);
    p.linksLeft -= 1;
    events.push({ t: 'LINK_PLACED', link: { ...link } });
  }

  // Rail: consume coal per link and juice for a double build (after placement).
  if (era === 'rail') {
    for (const spec of a.links) {
      const ep = lineEndpoints(spec.lineId);
      if (!ep) continue;
      const provided = spec.coalSource ? [spec.coalSource] : undefined;
      const resolved = provided ?? pickCoalEndpoint(state, ep, RAIL_LINK_COAL)?.sources ?? [];
      const loc = coalLocFor(state, ep, RAIL_LINK_COAL);
      consumeCoal(state, player, loc, resolved.slice(0, RAIL_LINK_COAL), events);
    }
    if (a.links.length === 2) {
      const lineIds = a.links.map((l) => l.lineId);
      const juice = a.juiceSource ?? autoJuiceSource(state, player, lineIds);
      if (juice) {
        // Use whichever endpoint makes the source valid for connectivity rules.
        const loc = [...endpointsOf(lineIds)][0] as string;
        consumeJuice(state, player, loc, [juice], events);
      }
    }
  }
}

function pickCoalEndpoint(
  state: GameState,
  ep: [string, string],
  count: number,
): { marketCost: number; sources: ResourceSource[] } | null {
  return pickCheaper(resolveCoal(state, ep[0], count), resolveCoal(state, ep[1], count));
}

function coalLocFor(state: GameState, ep: [string, string], count: number): string {
  const a = resolveCoal(state, ep[0], count);
  const b = resolveCoal(state, ep[1], count);
  if (a && b) return a.marketCost <= b.marketCost ? ep[0] : ep[1];
  if (a) return ep[0];
  return ep[1];
}
