import type { GameState, PlacedLink } from '../../model/state.ts';
import type { GameEvent } from '../../model/events.ts';
import type { NetworkAction, ResourceSource } from '../../model/actions.ts';
import type { PlayerColor } from '../../model/types.ts';
import { boardContext } from '../../maps/context.ts';
import { getPlayer, spend } from '../helpers.ts';
import { mintId } from '../setup.ts';
import { consumeCoal, consumeJuice, resolveCoal } from '../consume.ts';
import { hasNoPresence, playerNetwork } from '../../selectors/connectivity.ts';
import { juiceTileOptions } from '../../selectors/resources.ts';

function lineEndpoints(state: GameState, lineId: string): [string, string] | null {
  const line = boardContext(state).lineById[lineId];
  return line ? [line.a, line.b] : null;
}

function lineOccupied(state: GameState, lineId: string): boolean {
  return state.links.some((l) => l.lineId === lineId);
}

/**
 * Can the chosen lines be placed, each adjacent to the player's (growing)
 * network? Handles the "no presence → any legal line" case and the multi-link
 * case where a later link may attach to an earlier one.
 */
function adjacencyOk(state: GameState, player: PlayerColor, lineIds: string[]): boolean {
  if (hasNoPresence(state, player)) return true;
  const net = playerNetwork(state, player);
  const remaining = [...lineIds];
  let progress = true;
  while (remaining.length > 0 && progress) {
    progress = false;
    for (let i = 0; i < remaining.length; i += 1) {
      const ep = lineEndpoints(state, remaining[i] as string);
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

  const ctx = boardContext(state);
  const params = ctx.eraDef.params;
  const linkType = params.linkType;

  if (params.maxLinksPerAction === 1 && a.links.length !== 1) {
    return 'This era allows exactly 1 link per Network action';
  }
  if (a.links.length < 1 || a.links.length > params.maxLinksPerAction) {
    return `This era allows 1–${params.maxLinksPerAction} links per Network action`;
  }
  if (a.links.length === 2 && params.doubleLinkCost === null) {
    return 'Two-link builds are not allowed this era';
  }
  if (a.links.length > p.linksLeft) return 'Not enough link tiles on your mat';

  const lineIds = a.links.map((l) => l.lineId);
  if (new Set(lineIds).size !== lineIds.length) return 'Duplicate link in action';

  for (const spec of a.links) {
    const line = ctx.lineById[spec.lineId];
    if (!line) return `That connection has no ${linkType} route`;
    if (lineOccupied(state, spec.lineId)) return 'That connection already has a link';
  }

  if (!adjacencyOk(state, player, lineIds)) return 'Link must connect to your network';

  // Costs.
  let money =
    a.links.length === 1 ? params.singleLinkCost : (params.doubleLinkCost ?? params.singleLinkCost);

  // Per-link coal (rail / air); a multi-link build consumes juice.
  if (params.coalPerLink > 0) {
    for (const spec of a.links) {
      const ep = lineEndpoints(state, spec.lineId);
      if (!ep) return 'Unknown link line';
      const fromA = resolveCoal(state, ep[0], params.coalPerLink);
      const fromB = resolveCoal(state, ep[1], params.coalPerLink);
      const best = pickCheaper(fromA, fromB);
      if (!best) return 'Cannot obtain coal for that link';
      money += best.marketCost;
    }
  }
  if (a.links.length === 2 && params.juicePerDoubleLink > 0) {
    const juiceOk = a.juiceSource
      ? validateJuiceSource(state, player, lineIds, a.juiceSource)
      : autoJuiceSource(state, player, lineIds) !== null;
    if (!juiceOk) return 'Building two links requires 1 juice from a JuiceWorks';
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

function endpointsOf(state: GameState, lineIds: string[]): Set<string> {
  const s = new Set<string>();
  for (const id of lineIds) {
    const ep = lineEndpoints(state, id);
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
  for (const loc of endpointsOf(state, lineIds)) {
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
  if (src.from !== 'tile') return false; // network juice must come from a JuiceWorks
  for (const loc of endpointsOf(state, lineIds)) {
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
  const params = boardContext(state).eraDef.params;
  const linkType = params.linkType;

  const baseMoney =
    a.links.length === 1 ? params.singleLinkCost : (params.doubleLinkCost ?? params.singleLinkCost);
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

  // Consume coal per link and juice for a multi-link build (after placement).
  if (params.coalPerLink > 0) {
    for (const spec of a.links) {
      const ep = lineEndpoints(state, spec.lineId);
      if (!ep) continue;
      const provided = spec.coalSource ? [spec.coalSource] : undefined;
      const resolved = provided ?? pickCoalEndpoint(state, ep, params.coalPerLink)?.sources ?? [];
      const loc = coalLocFor(state, ep, params.coalPerLink);
      consumeCoal(state, player, loc, resolved.slice(0, params.coalPerLink), events);
    }
  }
  if (a.links.length === 2 && params.juicePerDoubleLink > 0) {
    const lineIds = a.links.map((l) => l.lineId);
    const juice = a.juiceSource ?? autoJuiceSource(state, player, lineIds);
    if (juice) {
      const loc = [...endpointsOf(state, lineIds)][0] as string;
      consumeJuice(state, player, loc, [juice], events);
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
