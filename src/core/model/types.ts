/**
 * Shared identifiers, enums and STATIC data interfaces for the game core.
 *
 * Dynamic (per-game) state types live in `state.ts`; action input types in
 * `actions.ts`; event output types in `events.ts`. This file is imported by the
 * static data modules in `src/core/data/` and by the rest of the engine.
 */

// ---------------------------------------------------------------------------
// Identifiers & enums
// ---------------------------------------------------------------------------

export const PLAYER_COLORS = ['red', 'blue', 'green', 'yellow'] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

/**
 * Eras. Standard maps use `['canal','rail']`; large maps may add a third
 * `'air'` era (§7.15). `EraId` is an alias used by the map system.
 */
export type Era = 'canal' | 'rail' | 'air';
export type EraId = Era;

export const INDUSTRY_TYPES = [
  'cotton',
  'coal',
  'iron',
  'manufacturer',
  'pottery',
  'juice',
] as const;
export type IndustryType = (typeof INDUSTRY_TYPES)[number];

/** Route/link type. `'air'` is used only by maps that declare an Air Era. */
export type LinkType = 'canal' | 'rail' | 'air';

export type CardKind = 'location' | 'industry' | 'wildLocation' | 'wildIndustry';

/** The five colour bands of location banners on the board (drive card decks). */
export type ColorBand = 'blue' | 'teal' | 'red' | 'yellow' | 'green' | 'farm' | 'merchant';

/** Juice bonus a merchant grants when its juice is consumed during a Sell. */
export type MerchantBonusType = 'develop' | 'income' | 'vp' | 'money';

// ---------------------------------------------------------------------------
// Static board data
// ---------------------------------------------------------------------------

/** A single build space within a location; lists the industries it permits. */
export interface IndustrySlot {
  id: string;
  allowed: IndustryType[];
}

export interface LocationDef {
  id: string;
  /** i18n display key (e.g. `loc.birmingham`). */
  name: string;
  colorBand: ColorBand;
  slots: IndustrySlot[];
  /** True for the five external merchant locations and the 2 farm-juice spots. */
  isMerchant?: boolean;
  isFarmJuice?: boolean;
}

/** A merchant trading post (Shrewsbury, Warrington, Gloucester, Oxford, Nottingham). */
export interface MerchantLocationDef {
  id: string;
  name: string;
  /** Juice bonus type granted when this merchant's juice is consumed on a Sell. */
  bonus: MerchantBonusType;
  /** VP awarded if `bonus === 'vp'` (Nottingham / Shrewsbury). */
  bonusVp?: number;
  /** Income spaces if `bonus === 'income'` (Oxford = 2). */
  bonusIncome?: number;
  /** Money if `bonus === 'money'` (Warrington = 5). */
  bonusMoney?: number;
  /** Number of merchant-tile spaces at this location (sum across all = 9). */
  tileSpaces: number;
}

/** A physical edge of the network: which two locations, and which link types. */
export interface LinkLineDef {
  id: string;
  a: string;
  b: string;
  /** Which era(s) this connection can be built in. */
  types: LinkType[];
}

// ---------------------------------------------------------------------------
// Per-industry, per-level static stats (the player-mat printouts)
// ---------------------------------------------------------------------------

export interface IndustryLevelDef {
  industry: IndustryType;
  level: number;
  /** How many physical tiles of this level exist on the player mat. */
  count: number;
  /** Build cost in money. */
  costMoney: number;
  /** Coal cubes consumed to build. */
  costCoal: number;
  /** Iron cubes consumed to build. */
  costIron: number;
  /** Juice consumed to sell (cotton / manufacturer / pottery only). */
  juiceToSell: number;
  /** VP scored when the tile is flipped and on the board at era end. */
  vp: number;
  /** Income spaces advanced when the tile flips. */
  incomeSpaces: number;
  /** VP each adjacent link earns for this location when scored. */
  linkVp: number;
  /** Cubes produced on build (coal mine = coal, iron works = iron). */
  resourceCount: number;
  buildableInCanal: boolean;
  buildableInRail: boolean;
  /** False for "lightbulb" potteries that may never be developed. */
  developable: boolean;
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export interface CardDef {
  kind: CardKind;
  /** For location cards: the location id. For industry cards: undefined. */
  locationId?: string;
  /** For industry cards: which industries the card permits (some allow two). */
  industries?: IndustryType[];
  /** i18n display key. */
  name: string;
}

// ---------------------------------------------------------------------------
// Markets
// ---------------------------------------------------------------------------

export interface MarketDef {
  /** Price of each space, ascending (cheapest first). Length === capacity. */
  priceLadder: number[];
  /** Price paid per cube when the market is completely empty. */
  emptyPrice: number;
  /** Cubes present at game start. */
  initialCubes: number;
}
