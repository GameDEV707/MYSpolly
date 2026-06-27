import type { GameState } from '../model/state.ts';
import type { EraId, LinkLineDef, LocationDef, MerchantLocationDef } from '../model/types.ts';
import type { EraDef, IslandDef, MapDefinition } from './types.ts';
import { getMap } from './registry.ts';

/**
 * The board context: given a game state (which carries `options.mapId` and the
 * current `era`), it resolves the **active era's topology** — the locations,
 * link network, merchants and islands the engine and renderer operate on. This
 * is the single seam through which the whole engine became map/era aware.
 *
 * Topology depends only on (mapId, era) — never on dynamic state — so contexts
 * are memoized.
 */
export interface BoardContext {
  map: MapDefinition;
  era: EraId;
  eraDef: EraDef;
  locations: LocationDef[];
  locationById: Record<string, LocationDef>;
  links: LinkLineDef[];
  lineById: Record<string, LinkLineDef>;
  merchantLocations: MerchantLocationDef[];
  merchantById: Record<string, MerchantLocationDef>;
  merchantLinkVp: Record<string, number>;
  merchantIds: Set<string>;
  islands: IslandDef[];
  /** All location ids that can host links (towns + farm + merchants). */
  allLocationIds: string[];
}

/** Look up an era definition on a map (falls back to the first era). */
export function eraDefOf(map: MapDefinition, era: EraId): EraDef {
  return map.eras.find((e) => e.id === era) ?? map.eras[0]!;
}

const cache = new Map<string, BoardContext>();

function buildContext(map: MapDefinition, era: EraId): BoardContext {
  const locations = map.locations[era] ?? [];
  const links = map.links[era] ?? [];
  const merchantLocations = map.merchantLocations[era] ?? [];
  return {
    map,
    era,
    eraDef: eraDefOf(map, era),
    locations,
    locationById: Object.fromEntries(locations.map((l) => [l.id, l])),
    links,
    lineById: Object.fromEntries(links.map((l) => [l.id, l])),
    merchantLocations,
    merchantById: Object.fromEntries(merchantLocations.map((m) => [m.id, m])),
    merchantLinkVp: map.merchantLinkVp[era] ?? {},
    merchantIds: new Set(merchantLocations.map((m) => m.id)),
    islands: map.islands[era] ?? [],
    allLocationIds: [...locations.map((l) => l.id), ...merchantLocations.map((m) => m.id)],
  };
}

/** Resolve the active board context for a game state. */
export function boardContext(state: GameState): BoardContext {
  return contextFor(state.options.mapId, state.era);
}

/** Resolve the board context for an explicit map id + era. */
export function contextFor(mapId: string | undefined, era: EraId): BoardContext {
  const map = getMap(mapId);
  const key = `${map.id}:${era}`;
  let ctx = cache.get(key);
  if (!ctx) {
    ctx = buildContext(map, era);
    cache.set(key, ctx);
  }
  return ctx;
}
