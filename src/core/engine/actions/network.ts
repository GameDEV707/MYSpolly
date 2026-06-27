import type { GameState, PlacedLink } from '../../model/state.ts';
import type { GameEvent } from '../../model/events.ts';
import type { NetworkAction } from '../../model/actions.ts';
import type { PlayerColor } from '../../model/types.ts';
import { boardContext } from '../../maps/context.ts';
import { buyCost } from '../market.ts';
import { getPlayer, spend } from '../helpers.ts';
import { mintId } from '../setup.ts';
import { consumeResource } from '../consume.ts';
import { hasNoPresence, playerNetwork } from '../../selectors/connectivity.ts';

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

/**
 * Will any endpoint of the action's links be connected to a merchant once the
 * links are placed? (Used to decide whether a coal-market shortfall is legal.)
 * Considers existing links PLUS the pending lines of this action.
 */
function merchantReachableAfter(state: GameState, lineIds: string[]): boolean {
  const ctx = boardContext(state);
  const adj = new Map<string, Set<string>>();
  const add = (a: string, b: string): void => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (const link of state.links) {
    const line = ctx.lineById[link.lineId];
    if (line) {
      add(line.a, line.b);
      add(line.b, line.a);
    }
  }
  for (const id of lineIds) {
    const line = ctx.lineById[id];
    if (line) {
      add(line.a, line.b);
      add(line.b, line.a);
    }
  }
  const seen = new Set<string>(endpointsOf(state, lineIds));
  const queue = [...seen];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (ctx.merchantIds.has(cur)) return true;
    for (const n of adj.get(cur) ?? []) {
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return false;
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

  // Money cost.
  let money =
    a.links.length === 1 ? params.singleLinkCost : (params.doubleLinkCost ?? params.singleLinkCost);

  // Per-link coal (rail / air): drawn from the player's stockpile, else bought
  // from the coal market — which requires a connection to a merchant once the
  // links are placed (§7.16.4). Coal is NEVER taken from other players' mines.
  const coalNeeded = params.coalPerLink * a.links.length;
  if (coalNeeded > 0) {
    const fromStock = Math.min(p.resources.coal, coalNeeded);
    const shortfall = coalNeeded - fromStock;
    if (shortfall > 0) {
      if (!merchantReachableAfter(state, lineIds)) {
        return 'Not enough coal (no market connection for the new link)';
      }
      money += buyCost(state.coalMarket, shortfall);
    }
  }

  // A multi-link build consumes juice — only from the player's own stockpile.
  if (a.links.length === 2 && params.juicePerDoubleLink > 0) {
    if (p.resources.juice < params.juicePerDoubleLink) {
      return 'Building two links requires juice in your stockpile';
    }
  }

  if (p.money < money) return 'Not enough money';
  return null;
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

  // Place links first, so coal-market connectivity reflects the new network.
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

  // Consume coal for the links (stockpile, then connected market shortfall).
  const coalNeeded = params.coalPerLink * a.links.length;
  if (coalNeeded > 0) {
    const loc = coalConsumeLoc(
      state,
      a.links.map((l) => l.lineId),
    );
    consumeResource(state, player, 'coal', coalNeeded, loc, events);
  }

  // Consume juice for a multi-link build (from the player's own stockpile).
  if (a.links.length === 2 && params.juicePerDoubleLink > 0) {
    consumeResource(state, player, 'juice', params.juicePerDoubleLink, undefined, events);
  }
}

/** An endpoint connected to a merchant (post-placement), for coal-market buys. */
function coalConsumeLoc(state: GameState, lineIds: string[]): string {
  const ctx = boardContext(state);
  const endpoints = [...endpointsOf(state, lineIds)];
  for (const loc of endpoints) {
    const seen = new Set<string>([loc]);
    const queue = [loc];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (ctx.merchantIds.has(cur)) return loc;
      for (const link of state.links) {
        const line = ctx.lineById[link.lineId];
        if (!line) continue;
        const next = line.a === cur ? line.b : line.b === cur ? line.a : null;
        if (next && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
  }
  return endpoints[0] ?? '';
}
