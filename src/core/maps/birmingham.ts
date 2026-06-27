import type { EraId, LinkLineDef, LocationDef } from '../model/types.ts';
import {
  LOCATIONS,
  LINK_LINES,
  MERCHANT_LOCATIONS,
  MERCHANT_LINK_VP,
  MERCHANT_TILE_DEFS,
} from '../data/board.ts';
import { FULL_DECK, EXCLUDED_BANDS } from '../data/cards.ts';
import { EMPTY_MERCHANTS_BY_PLAYERS } from '../data/setup.ts';
import { eraDef } from './builder.ts';
import type { LocationLayout, MapDeckCard, MapDefinition } from './types.ts';

/**
 * The classic West-Midlands map ("Birmingham"), the default map. It wraps the
 * existing static board/card data unchanged so the engine's behaviour — and
 * every existing deterministic test — is byte-for-byte identical to before the
 * multi-map refactor. Canal and Rail share the same locations; only the route
 * network differs per era (canal lines vs rail lines).
 */

const LAYOUT: Record<string, LocationLayout> = {
  stoke: { x: 300, y: 70 },
  leek: { x: 430, y: 80 },
  belper: { x: 660, y: 95 },
  derby: { x: 710, y: 180 },
  uttoxeter: { x: 545, y: 185 },
  stone: { x: 360, y: 185 },
  stafford: { x: 320, y: 285 },
  cannock: { x: 390, y: 365 },
  burton: { x: 605, y: 260 },
  tamworth: { x: 565, y: 365 },
  nuneaton: { x: 735, y: 435 },
  coventry: { x: 775, y: 530 },
  walsall: { x: 450, y: 425 },
  wolverhampton: { x: 330, y: 450 },
  coalbrookdale: { x: 180, y: 480 },
  dudley: { x: 365, y: 510 },
  birmingham: { x: 530, y: 480 },
  kidderminster: { x: 300, y: 575 },
  redditch: { x: 565, y: 595 },
  worcester: { x: 360, y: 675 },
  farm1: { x: 245, y: 365 },
  farm2: { x: 295, y: 715 },
  warrington: { x: 250, y: 20 },
  nottingham: { x: 840, y: 120 },
  shrewsbury: { x: 55, y: 430 },
  gloucester: { x: 360, y: 775 },
  oxford: { x: 715, y: 715 },
};

function eraLinks(routeType: 'canal' | 'rail'): LinkLineDef[] {
  return LINK_LINES.filter((l) => l.types.includes(routeType)).map((l) => ({
    id: l.id,
    a: l.a,
    b: l.b,
    types: [routeType],
  }));
}

const ERA_IDS: EraId[] = ['canal', 'rail'];

function perEra<T>(make: (era: EraId) => T): Record<EraId, T> {
  const out = {} as Record<EraId, T>;
  for (const era of ERA_IDS) out[era] = make(era);
  return out;
}

// Preserve FULL_DECK order/fields exactly so setup's RNG consumption is identical.
const DECK: MapDeckCard[] = FULL_DECK.map((c) => ({
  kind: c.kind === 'location' ? 'location' : 'industry',
  ...(c.locationId !== undefined ? { locationId: c.locationId } : {}),
  ...(c.industries !== undefined ? { industries: [...c.industries] } : {}),
  name: c.name,
  minPlayers: c.minPlayers,
  ...(c.colorBand !== undefined ? { colorBand: c.colorBand } : {}),
  uid: c.uid,
}));

export const BIRMINGHAM_MAP: MapDefinition = {
  id: 'birmingham',
  nameKey: 'map.birmingham.name',
  descriptionKey: 'map.birmingham.desc',
  size: 'large',
  fastPlay: false,
  thumbnail: 'assets/board/thumbnails/birmingham.svg',
  skin: 'birmingham',
  recommendedPlayers: [2, 3, 4],
  estPlayMinutes: 90,
  eras: [eraDef('canal'), eraDef('rail')],
  locations: perEra<LocationDef[]>(() => LOCATIONS),
  links: perEra<LinkLineDef[]>((era) => eraLinks(era as 'canal' | 'rail')),
  merchantLocations: perEra(() => MERCHANT_LOCATIONS),
  merchantLinkVp: perEra(() => ({ ...MERCHANT_LINK_VP })),
  islands: perEra(() => []),
  layout: perEra(() => LAYOUT),
  merchantTiles: MERCHANT_TILE_DEFS.map((t) => ({
    accepts: [...t.accepts],
    minPlayers: t.minPlayers,
  })),
  playerCountRules: {
    excludedBands: EXCLUDED_BANDS,
    emptyMerchants: EMPTY_MERCHANTS_BY_PLAYERS,
  },
  deck: DECK,
};
