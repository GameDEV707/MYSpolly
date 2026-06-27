import type { GameState } from '../model/state.ts';
import type { PlayerColor } from '../model/types.ts';
import { boardContext } from '../maps/context.ts';

/** Build an adjacency map from all placed links (any owner). */
export function buildAdjacency(state: GameState): Map<string, Set<string>> {
  const { lineById } = boardContext(state);
  const adj = new Map<string, Set<string>>();
  const add = (a: string, b: string): void => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (const link of state.links) {
    const line = lineById[link.lineId];
    if (!line) continue;
    add(line.a, line.b);
    add(line.b, line.a);
  }
  return adj;
}

/** Locations reachable from `start` over the link network (includes `start`). */
export function reachableFrom(state: GameState, start: string): Set<string> {
  const adj = buildAdjacency(state);
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of adj.get(cur) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

/** Are two locations connected by a path of link tiles (any owner)? */
export function connected(state: GameState, a: string, b: string): boolean {
  if (a === b) return true;
  return reachableFrom(state, a).has(b);
}

/** Shortest path length (edge count) between two locations, or Infinity. */
export function distance(state: GameState, a: string, b: string): number {
  if (a === b) return 0;
  const adj = buildAdjacency(state);
  const seen = new Set<string>([a]);
  let frontier = [a];
  let dist = 0;
  while (frontier.length > 0) {
    dist += 1;
    const next: string[] = [];
    for (const cur of frontier) {
      for (const n of adj.get(cur) ?? []) {
        if (n === b) return dist;
        if (!seen.has(n)) {
          seen.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return Infinity;
}

/**
 * The set of locations in a player's network: any location holding one of the
 * player's industry tiles, plus any location adjacent to one of the player's
 * link tiles.
 */
export function playerNetwork(state: GameState, player: PlayerColor): Set<string> {
  const { lineById } = boardContext(state);
  const net = new Set<string>();
  for (const tile of state.tiles) {
    if (tile.owner === player) net.add(tile.locationId);
  }
  for (const link of state.links) {
    if (link.owner !== player) continue;
    const line = lineById[link.lineId];
    if (!line) continue;
    net.add(line.a);
    net.add(line.b);
  }
  return net;
}

/** True if the player has no tiles and no links anywhere on the board. */
export function hasNoPresence(state: GameState, player: PlayerColor): boolean {
  const anyTile = state.tiles.some((t) => t.owner === player);
  const anyLink = state.links.some((l) => l.owner === player);
  return !anyTile && !anyLink;
}

/**
 * Locations connected (by any links) to ANY location in the given set,
 * including the set itself. Used to find what a network can reach for
 * resource routing and selling.
 */
export function connectedToNetwork(state: GameState, network: Set<string>): Set<string> {
  const result = new Set<string>(network);
  for (const start of network) {
    for (const loc of reachableFrom(state, start)) {
      result.add(loc);
    }
  }
  return result;
}
