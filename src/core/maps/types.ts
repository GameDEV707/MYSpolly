import type {
  EraId,
  IndustryType,
  LinkType,
  LinkLineDef,
  LocationDef,
  MerchantLocationDef,
} from '../model/types.ts';

/**
 * Multi-map / era-morphing data model (§7.15).
 *
 * A {@link MapDefinition} turns the single fixed board into a self-contained,
 * data-driven map: it declares an ordered list of eras (each with its own route
 * type + visual style + rule params) and **per-era topology** — the locations,
 * link network, merchants and islands for that era. The engine reads the active
 * era's topology via the board context, so the same rules run on every map and
 * the world visibly morphs as the eras advance.
 *
 * Invariant: the set of location ids is identical across a map's eras (so tiles
 * placed in an earlier era remain valid after a morph). Only names, positions,
 * islands and the link network may differ between eras.
 */

export type RouteType = 'canal' | 'rail' | 'air';

/** Visual styling hints for a route type (consumed by the board renderer). */
export interface RouteStyle {
  /** CSS colour for owned/era links. */
  color: string;
  /** Dashed stroke (used for air flight-paths). */
  dashed: boolean;
  /** Stroke width multiplier. */
  width: number;
  /** i18n key for the route name (e.g. `route.canal`). */
  labelKey: string;
  /** Emoji/icon hint for the era's transport vehicle (boat/train/plane). */
  vehicle: 'boat' | 'train' | 'plane';
}

/** Per-era economy rules for the Network action (defaults mirror canal/rail). */
export interface EraRuleParams {
  /** Engine link tag stored on placed links. */
  linkType: LinkType;
  /** Cost of a single link. */
  singleLinkCost: number;
  /** Cost of building two links at once, or null when not allowed (canal). */
  doubleLinkCost: number | null;
  /** Max links placeable in one Network action. */
  maxLinksPerAction: number;
  /** Coal consumed per link built (0 in the Canal Era). */
  coalPerLink: number;
  /** Juice consumed when building two links at once. */
  juicePerDoubleLink: number;
}

export interface EraDef {
  id: EraId;
  routeType: RouteType;
  routeStyle: RouteStyle;
  params: EraRuleParams;
}

/** A named sub-region/landmass; its set & name can differ per era. */
export interface IslandDef {
  id: string;
  /** i18n key for the island name. */
  nameKey: string;
  /** Location ids belonging to this island in the era. */
  locationIds: string[];
}

/** A merchant tile (which goods it buys) + the min player count that uses it. */
export interface MapMerchantTileDef {
  accepts: ('cotton' | 'manufacturer' | 'pottery')[];
  minPlayers: 2 | 3 | 4;
}

/** Per-player-count rules for a map (which cards/merchants are removed). */
export interface PlayerCountRules {
  /** Banner colours excluded from the location-card deck, per player count. */
  excludedBands: Record<number, string[]>;
  /** Merchant location ids left empty (no tile), per player count. */
  emptyMerchants: Record<number, string[]>;
}

/** Board pixel coordinates for a location, used by the renderer (per era). */
export interface LocationLayout {
  x: number;
  y: number;
}

export interface MapDefinition {
  id: string;
  /** i18n key for the map name. */
  nameKey: string;
  /** i18n key for the description shown in the picker. */
  descriptionKey: string;
  size: 'small' | 'medium' | 'large';
  /** True for the 5 fast-play maps. */
  fastPlay: boolean;
  /** Thumbnail asset path. */
  thumbnail: string;
  /** Theme/skin key (drives board palette). */
  skin: string;
  /** Recommended player counts. */
  recommendedPlayers: number[];
  /** Estimated play time in minutes (for the picker). */
  estPlayMinutes: number;

  /** Ordered eras. `['canal','rail']` or `['canal','rail','air']`. */
  eras: EraDef[];

  // Per-era topology (positions/names/islands/links may change between eras).
  locations: Record<EraId, LocationDef[]>;
  links: Record<EraId, LinkLineDef[]>;
  merchantLocations: Record<EraId, MerchantLocationDef[]>;
  /** Link-scoring VP each merchant contributes, per era. */
  merchantLinkVp: Record<EraId, Record<string, number>>;
  islands: Record<EraId, IslandDef[]>;
  /** Per-era board layout coordinates for the renderer. */
  layout: Record<EraId, Record<string, LocationLayout>>;

  /** The 9-ish merchant tiles (goods + min player count). */
  merchantTiles: MapMerchantTileDef[];
  playerCountRules: PlayerCountRules;

  /** Map-specific draw-deck (location + industry cards), full 4P set. */
  deck: MapDeckCard[];
}

/** A draw-deck card definition for a specific map. */
export interface MapDeckCard {
  kind: 'location' | 'industry';
  locationId?: string;
  industries?: IndustryType[];
  /** i18n display key. */
  name: string;
  /** Minimum player count at which this card is included (its icon). */
  minPlayers: 1 | 2 | 3 | 4;
  /** Location-card banner colour (for the colour-exclusion rule). */
  colorBand?: string;
  /** Unique id within the deck definition. */
  uid: string;
}
