import type {
  ColorBand,
  EraId,
  IndustryType,
  LinkLineDef,
  LocationDef,
  MerchantBonusType,
  MerchantLocationDef,
} from '../model/types.ts';
import type {
  EraDef,
  EraRuleParams,
  IslandDef,
  LocationLayout,
  MapDeckCard,
  MapDefinition,
  MapMerchantTileDef,
  PlayerCountRules,
  RouteStyle,
  RouteType,
} from './types.ts';

/**
 * Helpers for authoring {@link MapDefinition}s from a compact spec, plus the
 * per-era default route styles / rule params and the map-aware deck builder.
 */

// ---------------------------------------------------------------------------
// Default per-era route styling & economy params (keyed by route type).
// Air-Era defaults mirror the Rail-link pattern (§7.15.4) but cost a little
// more and fly along dashed arcs.
// ---------------------------------------------------------------------------

export const ROUTE_STYLES: Record<RouteType, RouteStyle> = {
  canal: { color: '#3b82c4', dashed: false, width: 1, labelKey: 'route.canal', vehicle: 'boat' },
  rail: { color: '#a9682e', dashed: false, width: 1.25, labelKey: 'route.rail', vehicle: 'train' },
  air: { color: '#9333ea', dashed: true, width: 1, labelKey: 'route.air', vehicle: 'plane' },
};

export const ERA_PARAMS: Record<RouteType, EraRuleParams> = {
  canal: {
    linkType: 'canal',
    singleLinkCost: 3,
    doubleLinkCost: null,
    maxLinksPerAction: 1,
    coalPerLink: 0,
    juicePerDoubleLink: 0,
  },
  rail: {
    linkType: 'rail',
    singleLinkCost: 5,
    doubleLinkCost: 15,
    maxLinksPerAction: 2,
    coalPerLink: 1,
    juicePerDoubleLink: 1,
  },
  air: {
    linkType: 'air',
    singleLinkCost: 6,
    doubleLinkCost: 18,
    maxLinksPerAction: 2,
    coalPerLink: 1,
    juicePerDoubleLink: 1,
  },
};

/** Build an {@link EraDef} for a route type, with optional param overrides. */
export function eraDef(routeType: RouteType, overrides?: Partial<EraRuleParams>): EraDef {
  return {
    id: routeType as EraId,
    routeType,
    routeStyle: ROUTE_STYLES[routeType],
    params: { ...ERA_PARAMS[routeType], ...(overrides ?? {}) },
  };
}

// ---------------------------------------------------------------------------
// Compact authoring spec.
// ---------------------------------------------------------------------------

export interface TownSpec {
  id: string;
  /** i18n key for the town's name (default era; overridable per era). */
  nameKey: string;
  colorBand: ColorBand;
  /** Each entry is one build slot's allowed industries. */
  slots: IndustryType[][];
  pos: LocationLayout;
  isFarmJuice?: boolean;
  /** Per-era name-key overrides (the world renames between eras). */
  eraNames?: Partial<Record<EraId, string>>;
  /** Per-era position overrides (locations reposition between eras). */
  eraPos?: Partial<Record<EraId, LocationLayout>>;
}

export interface MerchantSpec {
  id: string;
  nameKey: string;
  bonus: MerchantBonusType;
  bonusVp?: number;
  bonusIncome?: number;
  bonusMoney?: number;
  tileSpaces: number;
  pos: LocationLayout;
  linkVp?: number;
  /** Per-era name-key overrides. */
  eraNames?: Partial<Record<EraId, string>>;
  eraPos?: Partial<Record<EraId, LocationLayout>>;
}

export interface IslandSpec {
  id: string;
  nameKey: string;
  locationIds: string[];
}

export interface DeckSpec {
  /** Location cards per town (default 2). */
  locationCardsPerTown?: number;
  /** Override the player-count icon of a given town's location cards. */
  gate?: Record<string, 1 | 2 | 3 | 4>;
  /** Industry-card spread: per industry, the min-player icon of each card. */
  industrySpread: Partial<Record<IndustryType, (1 | 2 | 3 | 4)[]>>;
}

export interface MapSpec {
  id: string;
  nameKey: string;
  descriptionKey: string;
  size: 'small' | 'medium' | 'large';
  fastPlay: boolean;
  thumbnail: string;
  skin: string;
  recommendedPlayers: number[];
  estPlayMinutes: number;
  /** Ordered eras (route types). e.g. ['canal','rail'] or ['canal','rail','air']. */
  eraOrder: RouteType[];
  towns: TownSpec[];
  merchants: MerchantSpec[];
  /** Undirected link pairs per era (location id ↔ location id). */
  linksByEra: Partial<Record<EraId, [string, string][]>>;
  islandsByEra?: Partial<Record<EraId, IslandSpec[]>>;
  merchantTiles: MapMerchantTileDef[];
  playerCountRules: PlayerCountRules;
  deck: DeckSpec;
}

let deckSeq = 0;
function uid(prefix: string): string {
  deckSeq += 1;
  return `${prefix}-${deckSeq}`;
}

function townToLocation(t: TownSpec, era: EraId): LocationDef {
  let slotN = 0;
  return {
    id: t.id,
    name: t.eraNames?.[era] ?? t.nameKey,
    colorBand: t.colorBand,
    slots: t.slots.map((allowed) => {
      slotN += 1;
      return { id: `${t.id}-s${slotN}`, allowed: [...allowed] };
    }),
    ...(t.isFarmJuice ? { isFarmJuice: true } : {}),
  };
}

function merchantToLocation(m: MerchantSpec, era: EraId): MerchantLocationDef {
  return {
    id: m.id,
    name: m.eraNames?.[era] ?? m.nameKey,
    bonus: m.bonus,
    ...(m.bonusVp !== undefined ? { bonusVp: m.bonusVp } : {}),
    ...(m.bonusIncome !== undefined ? { bonusIncome: m.bonusIncome } : {}),
    ...(m.bonusMoney !== undefined ? { bonusMoney: m.bonusMoney } : {}),
    tileSpaces: m.tileSpaces,
  };
}

function buildDeck(spec: MapSpec): MapDeckCard[] {
  const out: MapDeckCard[] = [];
  const perTown = spec.deck.locationCardsPerTown ?? 2;
  for (const t of spec.towns) {
    if (t.isFarmJuice) continue; // farm spaces are not drawable location cards
    const gate = spec.deck.gate?.[t.id] ?? 1;
    for (let i = 0; i < perTown; i += 1) {
      out.push({
        kind: 'location',
        locationId: t.id,
        name: t.nameKey,
        colorBand: t.colorBand,
        minPlayers: i === 0 ? gate : 1,
        uid: uid('loc'),
      });
    }
  }
  for (const [industry, specs] of Object.entries(spec.deck.industrySpread)) {
    for (const minPlayers of specs ?? []) {
      out.push({
        kind: 'industry',
        industries: [industry as IndustryType],
        name: `industry.${industry}`,
        minPlayers,
        uid: uid('ind'),
      });
    }
  }
  return out;
}

/** Build a full {@link MapDefinition} from a compact {@link MapSpec}. */
export function buildMap(spec: MapSpec): MapDefinition {
  const eras: EraDef[] = spec.eraOrder.map((rt) => eraDef(rt));
  const eraIds = spec.eraOrder as EraId[];

  const locations = {} as Record<EraId, LocationDef[]>;
  const links = {} as Record<EraId, LinkLineDef[]>;
  const merchantLocations = {} as Record<EraId, MerchantLocationDef[]>;
  const merchantLinkVp = {} as Record<EraId, Record<string, number>>;
  const islands = {} as Record<EraId, IslandDef[]>;
  const layout = {} as Record<EraId, Record<string, LocationLayout>>;

  for (const era of eraIds) {
    locations[era] = spec.towns.map((t) => townToLocation(t, era));
    merchantLocations[era] = spec.merchants.map((m) => merchantToLocation(m, era));
    merchantLinkVp[era] = Object.fromEntries(spec.merchants.map((m) => [m.id, m.linkVp ?? 2]));
    const routeType = eras.find((e) => e.id === era)!.routeType;
    const pairs = spec.linksByEra[era] ?? [];
    links[era] = pairs.map(([a, b]) => ({
      id: `${a}__${b}`,
      a,
      b,
      types: [routeType],
    }));
    islands[era] = (spec.islandsByEra?.[era] ?? []).map((is) => ({
      id: is.id,
      nameKey: is.nameKey,
      locationIds: [...is.locationIds],
    }));
    const lay: Record<string, LocationLayout> = {};
    for (const t of spec.towns) lay[t.id] = t.eraPos?.[era] ?? t.pos;
    for (const m of spec.merchants) lay[m.id] = m.eraPos?.[era] ?? m.pos;
    layout[era] = lay;
  }

  return {
    id: spec.id,
    nameKey: spec.nameKey,
    descriptionKey: spec.descriptionKey,
    size: spec.size,
    fastPlay: spec.fastPlay,
    thumbnail: spec.thumbnail,
    skin: spec.skin,
    recommendedPlayers: [...spec.recommendedPlayers],
    estPlayMinutes: spec.estPlayMinutes,
    eras,
    locations,
    links,
    merchantLocations,
    merchantLinkVp,
    islands,
    layout,
    merchantTiles: spec.merchantTiles.map((t) => ({
      accepts: [...t.accepts],
      minPlayers: t.minPlayers,
    })),
    playerCountRules: spec.playerCountRules,
    deck: buildDeck(spec),
  };
}

/**
 * Build the draw-deck card list for a map at a given player count (before
 * shuffling). Applies the per-map player-count icon rule and colour exclusions.
 */
export function buildMapDeck(map: MapDefinition, players: number): MapDeckCard[] {
  const excluded = map.playerCountRules.excludedBands[players] ?? [];
  return map.deck.filter((c) => {
    if (c.minPlayers > players) return false;
    if (c.kind === 'location' && c.colorBand && excluded.includes(c.colorBand)) return false;
    return true;
  });
}

/** A reusable standard merchant-tile set (covers all 3 goods at every count). */
export const STANDARD_MERCHANT_TILES: MapMerchantTileDef[] = [
  { accepts: ['cotton', 'manufacturer', 'pottery'], minPlayers: 2 },
  { accepts: ['cotton', 'manufacturer', 'pottery'], minPlayers: 2 },
  { accepts: ['cotton'], minPlayers: 2 },
  { accepts: ['manufacturer'], minPlayers: 2 },
  { accepts: ['pottery'], minPlayers: 2 },
  { accepts: ['cotton', 'manufacturer'], minPlayers: 3 },
  { accepts: ['manufacturer', 'pottery'], minPlayers: 3 },
  { accepts: ['cotton', 'pottery'], minPlayers: 4 },
  { accepts: [], minPlayers: 4 },
];

/** A smaller merchant-tile set for fast-play maps (still covers all goods @2P). */
export const FAST_MERCHANT_TILES: MapMerchantTileDef[] = [
  { accepts: ['cotton', 'manufacturer', 'pottery'], minPlayers: 2 },
  { accepts: ['cotton', 'manufacturer', 'pottery'], minPlayers: 2 },
  { accepts: ['cotton', 'pottery'], minPlayers: 3 },
  { accepts: ['manufacturer'], minPlayers: 4 },
];
