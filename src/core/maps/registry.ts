import type { MapDefinition } from './types.ts';
import { BIRMINGHAM_MAP } from './birmingham.ts';
import { FULL_MAPS } from './full.ts';
import { FAST_MAPS } from './fast.ts';

/**
 * The map registry (§7.15.1). Exposes every playable map keyed by id, plus
 * lightweight metadata for the Game-Setup map picker.
 */

export const DEFAULT_MAP_ID = 'birmingham';

const ALL_MAPS: MapDefinition[] = [BIRMINGHAM_MAP, ...FULL_MAPS, ...FAST_MAPS];

const MAP_BY_ID: Record<string, MapDefinition> = Object.fromEntries(
  ALL_MAPS.map((m) => [m.id, m]),
);

/** Resolve a map by id, falling back to the default map for unknown ids. */
export function getMap(mapId: string | undefined): MapDefinition {
  return (mapId && MAP_BY_ID[mapId]) || BIRMINGHAM_MAP;
}

/** All maps, in display order (default first, then full, then fast). */
export function listMaps(): MapDefinition[] {
  return ALL_MAPS;
}

/** Picker metadata for a map. */
export interface MapMeta {
  id: string;
  nameKey: string;
  descriptionKey: string;
  size: MapDefinition['size'];
  fastPlay: boolean;
  thumbnail: string;
  skin: string;
  recommendedPlayers: number[];
  estPlayMinutes: number;
  eraCount: number;
  hasAirEra: boolean;
}

export function mapMeta(m: MapDefinition): MapMeta {
  return {
    id: m.id,
    nameKey: m.nameKey,
    descriptionKey: m.descriptionKey,
    size: m.size,
    fastPlay: m.fastPlay,
    thumbnail: m.thumbnail,
    skin: m.skin,
    recommendedPlayers: m.recommendedPlayers,
    estPlayMinutes: m.estPlayMinutes,
    eraCount: m.eras.length,
    hasAirEra: m.eras.some((e) => e.routeType === 'air'),
  };
}

export function listMapMeta(): MapMeta[] {
  return ALL_MAPS.map(mapMeta);
}
