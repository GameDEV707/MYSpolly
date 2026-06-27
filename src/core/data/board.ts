import type { LinkLineDef, LocationDef, MerchantLocationDef } from '../model/types.ts';

/**
 * Static board data for Brass: Birmingham — the West-Midlands network.
 *
 * VERIFY: the board topology (which towns each link connects, and whether a
 * link is canal/rail/both), each town's banner colour, and the exact industry
 * icons in each building slot are printed on the physical board (an image, not
 * extractable from the rulebook text). They are encoded here from published
 * references and should be confirmed against the board before release. The
 * connectivity/network engine is data-driven, so corrections are pure data
 * edits. Component COUNTS and the player-count card/merchant rules below are
 * taken directly from the rulebook and enforced by the validation test.
 */

const ALL = ['cotton', 'coal', 'iron', 'manufacturer', 'pottery', 'juice'] as const;

// Convenience builders for slots.
let slotSeq = 0;
function slot(allowed: readonly LocationDef['slots'][number]['allowed'][number][]): {
  id: string;
  allowed: LocationDef['slots'][number]['allowed'];
} {
  slotSeq += 1;
  return { id: `s${slotSeq}`, allowed: [...allowed] };
}

// ---------------------------------------------------------------------------
// Merchant locations (external trading posts). Bonuses confirmed from rulebook:
//   Gloucester = Develop, Oxford = +2 Income, Nottingham/Shrewsbury = VP,
//   Warrington = +£5. Total merchant-tile spaces = 9.
// VERIFY: the VP amounts for Nottingham/Shrewsbury juice bonuses.
// ---------------------------------------------------------------------------

export const MERCHANT_LOCATIONS: MerchantLocationDef[] = [
  { id: 'shrewsbury', name: 'loc.shrewsbury', bonus: 'vp', bonusVp: 4, tileSpaces: 1 },
  { id: 'warrington', name: 'loc.warrington', bonus: 'money', bonusMoney: 5, tileSpaces: 2 },
  { id: 'gloucester', name: 'loc.gloucester', bonus: 'develop', tileSpaces: 2 },
  { id: 'oxford', name: 'loc.oxford', bonus: 'income', bonusIncome: 2, tileSpaces: 2 },
  { id: 'nottingham', name: 'loc.nottingham', bonus: 'vp', bonusVp: 3, tileSpaces: 2 },
];

/**
 * Link-scoring VP contributed by each merchant location to an adjacent link at
 * end of era. VERIFY: exact per-merchant icon counts are printed on the tiles;
 * 2 is used as a documented default.
 */
export const MERCHANT_LINK_VP: Record<string, number> = {
  shrewsbury: 2,
  warrington: 2,
  gloucester: 2,
  oxford: 2,
  nottingham: 2,
};

// ---------------------------------------------------------------------------
// Town locations with build slots and banner colours.
// Banner colour drives which Location cards are in the deck:
//   2P: blue + teal excluded; 3P: teal excluded; 4P: all included.
// ---------------------------------------------------------------------------

export const TOWNS: LocationDef[] = [
  // --- Blue band (northern cluster) ---
  {
    id: 'stoke',
    name: 'loc.stoke',
    colorBand: 'blue',
    slots: [slot(['cotton', 'manufacturer']), slot(['manufacturer']), slot(['pottery'])],
  },
  {
    id: 'leek',
    name: 'loc.leek',
    colorBand: 'blue',
    slots: [slot(['cotton', 'manufacturer']), slot(['coal'])],
  },
  {
    id: 'stone',
    name: 'loc.stone',
    colorBand: 'blue',
    slots: [slot(['cotton', 'juice']), slot(['manufacturer', 'coal'])],
  },
  {
    id: 'uttoxeter',
    name: 'loc.uttoxeter',
    colorBand: 'blue',
    slots: [slot(['cotton', 'juice']), slot(['manufacturer', 'juice'])],
  },
  {
    id: 'stafford',
    name: 'loc.stafford',
    colorBand: 'blue',
    slots: [slot(['cotton', 'juice']), slot(['pottery'])],
  },
  {
    id: 'burton',
    name: 'loc.burton',
    colorBand: 'blue',
    slots: [slot(['manufacturer', 'juice']), slot(['juice'])],
  },
  {
    id: 'derby',
    name: 'loc.derby',
    colorBand: 'blue',
    slots: [slot(['cotton', 'manufacturer']), slot(['juice']), slot(['manufacturer', 'pottery'])],
  },
  {
    id: 'belper',
    name: 'loc.belper',
    colorBand: 'blue',
    slots: [slot(['cotton', 'manufacturer']), slot(['coal']), slot(['pottery'])],
  },

  // --- Teal band (mid cluster, excluded in 2P & 3P) ---
  {
    id: 'cannock',
    name: 'loc.cannock',
    colorBand: 'teal',
    slots: [slot(['manufacturer', 'coal']), slot(['coal'])],
  },
  {
    id: 'tamworth',
    name: 'loc.tamworth',
    colorBand: 'teal',
    slots: [slot(['cotton', 'coal']), slot(['cotton', 'coal'])],
  },
  {
    id: 'walsall',
    name: 'loc.walsall',
    colorBand: 'teal',
    slots: [slot(['manufacturer', 'juice']), slot(['iron', 'manufacturer'])],
  },
  {
    id: 'coalbrookdale',
    name: 'loc.coalbrookdale',
    colorBand: 'teal',
    slots: [slot(['iron', 'coal']), slot(['iron', 'juice']), slot(['coal'])],
  },

  // --- Red band ---
  {
    id: 'wolverhampton',
    name: 'loc.wolverhampton',
    colorBand: 'red',
    slots: [slot(['manufacturer']), slot(['manufacturer', 'coal'])],
  },
  {
    id: 'dudley',
    name: 'loc.dudley',
    colorBand: 'red',
    slots: [slot(['coal', 'iron']), slot(['manufacturer'])],
  },

  // --- Yellow band ---
  {
    id: 'kidderminster',
    name: 'loc.kidderminster',
    colorBand: 'yellow',
    slots: [slot(['cotton', 'coal']), slot(['manufacturer'])],
  },
  {
    id: 'worcester',
    name: 'loc.worcester',
    colorBand: 'yellow',
    slots: [slot(['cotton']), slot(['cotton'])],
  },

  // --- Green / central band ---
  {
    id: 'birmingham',
    name: 'loc.birmingham',
    colorBand: 'green',
    slots: [
      slot(['cotton', 'manufacturer']),
      slot(['manufacturer']),
      slot(['iron', 'manufacturer']),
      slot(['manufacturer']),
    ],
  },
  {
    id: 'coventry',
    name: 'loc.coventry',
    colorBand: 'green',
    slots: [
      slot(['manufacturer', 'pottery']),
      slot(['manufacturer', 'coal']),
      slot(['iron', 'manufacturer']),
    ],
  },
  {
    id: 'nuneaton',
    name: 'loc.nuneaton',
    colorBand: 'green',
    slots: [slot(['cotton', 'juice']), slot(['manufacturer', 'coal'])],
  },
  {
    id: 'redditch',
    name: 'loc.redditch',
    colorBand: 'green',
    slots: [slot(['manufacturer', 'coal']), slot(['iron', 'juice'])],
  },
];

// Two unnamed Farm Juice spaces (buildable only with Juice / Wild Industry).
export const FARM_JUICE_WORKS: LocationDef[] = [
  {
    id: 'farm1',
    name: 'loc.farmJuice',
    colorBand: 'farm',
    isFarmJuice: true,
    slots: [slot(['juice'])],
  },
  {
    id: 'farm2',
    name: 'loc.farmJuice',
    colorBand: 'farm',
    isFarmJuice: true,
    slots: [slot(['juice'])],
  },
];

/** All build-capable locations (towns + farm juiceWorks). */
export const LOCATIONS: LocationDef[] = [...TOWNS, ...FARM_JUICE_WORKS];

// ---------------------------------------------------------------------------
// Link lines (the canal/rail network edges).
// `both` = the connection has a canal route AND a rail route.
// ---------------------------------------------------------------------------

function link(a: string, b: string, types: LinkLineDef['types'] = ['canal', 'rail']): LinkLineDef {
  return { id: `${a}__${b}`, a, b, types };
}

export const LINK_LINES: LinkLineDef[] = [
  // Northern cluster
  link('leek', 'stoke'),
  link('stoke', 'stone'),
  link('stone', 'stafford'),
  link('stone', 'uttoxeter'),
  link('uttoxeter', 'derby'),
  link('uttoxeter', 'stoke', ['rail']),
  link('derby', 'belper'),
  link('belper', 'leek', ['rail']),
  link('derby', 'nottingham'),
  link('derby', 'burton'),
  link('burton', 'stone'),
  link('burton', 'tamworth'),
  link('burton', 'derby'),

  // Stafford / Cannock corridor
  link('stafford', 'cannock'),
  link('cannock', 'wolverhampton'),
  link('cannock', 'walsall'),
  link('cannock', 'stafford'),

  // Wolverhampton / Dudley / Coalbrookdale (Black Country)
  link('wolverhampton', 'walsall'),
  link('wolverhampton', 'dudley'),
  link('wolverhampton', 'coalbrookdale'),
  link('dudley', 'birmingham'),
  link('dudley', 'kidderminster'),
  link('coalbrookdale', 'kidderminster'),
  link('coalbrookdale', 'shrewsbury'),

  // Kidderminster / Worcester / Gloucester (south-west)
  link('kidderminster', 'worcester'),
  link('worcester', 'gloucester'),
  link('kidderminster', 'birmingham', ['rail']),

  // Birmingham hub
  link('birmingham', 'walsall'),
  link('birmingham', 'tamworth'),
  link('birmingham', 'coventry'),
  link('birmingham', 'redditch'),
  link('birmingham', 'nuneaton', ['rail']),

  // Eastern cluster
  link('walsall', 'tamworth'),
  link('tamworth', 'nuneaton'),
  link('nuneaton', 'coventry'),
  link('coventry', 'oxford', ['rail']),

  // Southern
  link('redditch', 'oxford'),
  link('redditch', 'gloucester', ['rail']),

  // Farm-juice adjacencies (rulebook): farm1 ↔ Cannock area; farm2 ↔
  // Kidderminster/Worcester area. VERIFY exact adjacency.
  link('farm1', 'cannock'),
  link('farm2', 'worcester'),
];

/** All location ids that can host links (towns + farm juiceWorks + merchants). */
export const ALL_LOCATION_IDS: string[] = [
  ...LOCATIONS.map((l) => l.id),
  ...MERCHANT_LOCATIONS.map((m) => m.id),
];

export const TOWN_BY_ID: Record<string, LocationDef> = Object.fromEntries(
  LOCATIONS.map((l) => [l.id, l]),
);

export const MERCHANT_BY_ID: Record<string, MerchantLocationDef> = Object.fromEntries(
  MERCHANT_LOCATIONS.map((m) => [m.id, m]),
);

/**
 * The 9 merchant tiles (which goods each will buy) and the minimum player count
 * at which each is used, so the eligible tiles exactly fill the available
 * merchant spaces: 2P → 5 spaces, 3P → 7, 4P → 9.
 * A `[]` (blank) tile accepts nothing and receives no juice barrel.
 *
 * VERIFY: the exact goods on each physical merchant tile are printed on the
 * tiles (image data). Encoded here so every good is sellable at each player
 * count; corrections are pure data edits.
 */
export interface MerchantTileDef {
  accepts: ('cotton' | 'manufacturer' | 'pottery')[];
  minPlayers: 2 | 3 | 4;
}

export const MERCHANT_TILE_DEFS: MerchantTileDef[] = [
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

// Re-export to silence unused in case future slots need the full ALL set.
export const ALL_INDUSTRIES = ALL;
