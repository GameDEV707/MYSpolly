import type { ColorBand, IndustryType, MerchantBonusType } from '../model/types.ts';
import type { MapDefinition, MapMerchantTileDef, PlayerCountRules, RouteType } from './types.ts';
import {
  buildMap,
  type MapSpec,
  type MerchantSpec,
  type TownSpec,
  STANDARD_MERCHANT_TILES,
  FAST_MERCHANT_TILES,
} from './builder.ts';

/**
 * The authored maps (§7.15.2): 4 additional Full maps (one with an Air Era) and
 * 5 Fast-play maps. The classic Birmingham map (the 5th Full map) lives in
 * `birmingham.ts`. Each map declares a distinct, original geography — invented
 * place names (so no publisher artwork/board is reproduced) — with its own link
 * network, merchants and bespoke deck. Names are registered as i18n keys
 * (EN/RU/UZ) via {@link MAP_I18N}.
 */

// ---------------------------------------------------------------------------
// i18n: store English names per key; derive RU (Cyrillic) and UZ (Latin).
// ---------------------------------------------------------------------------

const namesEn: Record<string, string> = {};

/** Very small Latin→Cyrillic transliterator for consistent RU place names. */
function toCyrillic(s: string): string {
  const digraphs: [RegExp, string][] = [
    [/sh/gi, 'ш'],
    [/ch/gi, 'ч'],
    [/kh/gi, 'х'],
    [/ph/gi, 'ф'],
    [/th/gi, 'т'],
    [/ya/gi, 'я'],
    [/yu/gi, 'ю'],
  ];
  const single: Record<string, string> = {
    a: 'а',
    b: 'б',
    c: 'к',
    d: 'д',
    e: 'е',
    f: 'ф',
    g: 'г',
    h: 'х',
    i: 'и',
    j: 'дж',
    k: 'к',
    l: 'л',
    m: 'м',
    n: 'н',
    o: 'о',
    p: 'п',
    q: 'к',
    r: 'р',
    s: 'с',
    t: 'т',
    u: 'у',
    v: 'в',
    w: 'в',
    x: 'кс',
    y: 'й',
    z: 'з',
  };
  let out = s;
  for (const [re, rep] of digraphs) out = out.replace(re, rep);
  let res = '';
  for (const ch of out) {
    const lower = ch.toLowerCase();
    const mapped = single[lower];
    if (mapped) res += ch === ch.toUpperCase() ? mapped.toUpperCase() : mapped;
    else res += ch;
  }
  return res;
}

/** Register an English display name for an i18n key (RU/UZ derived). */
function name(key: string, en: string): string {
  namesEn[key] = en;
  return key;
}

export interface MapI18nBundle {
  en: Record<string, string>;
  ru: Record<string, string>;
  uz: Record<string, string>;
}

/** All authored-map i18n keys, in three languages. */
export function buildMapI18n(): MapI18nBundle {
  const en = { ...namesEn };
  const ru: Record<string, string> = {};
  const uz: Record<string, string> = {};
  for (const [k, v] of Object.entries(en)) {
    ru[k] = toCyrillic(v);
    uz[k] = v; // Uzbek uses Latin script; invented names kept as-is.
  }
  return { en, ru, uz };
}

// ---------------------------------------------------------------------------
// Authoring helpers.
// ---------------------------------------------------------------------------

interface TownInput {
  id: string;
  band: ColorBand;
  slots: IndustryType[][];
  x: number;
  y: number;
  display: string;
  farm?: boolean;
}

interface MerchInput {
  id: string;
  bonus: MerchantBonusType;
  vp?: number;
  income?: number;
  money?: number;
  spaces: number;
  x: number;
  y: number;
  display: string;
}

function townSpec(mapId: string, t: TownInput): TownSpec {
  return {
    id: t.id,
    nameKey: name(`map.${mapId}.loc.${t.id}`, t.display),
    colorBand: t.band,
    slots: t.slots,
    pos: { x: t.x, y: t.y },
    ...(t.farm ? { isFarmJuice: true } : {}),
  };
}

function merchSpec(mapId: string, m: MerchInput): MerchantSpec {
  return {
    id: m.id,
    nameKey: name(`map.${mapId}.merch.${m.id}`, m.display),
    bonus: m.bonus,
    ...(m.vp !== undefined ? { bonusVp: m.vp } : {}),
    ...(m.income !== undefined ? { bonusIncome: m.income } : {}),
    ...(m.money !== undefined ? { bonusMoney: m.money } : {}),
    tileSpaces: m.spaces,
    pos: { x: m.x, y: m.y },
  };
}

const STD_RULES: PlayerCountRules = {
  excludedBands: { 2: ['blue', 'teal'], 3: ['teal'], 4: [] },
  emptyMerchants: {},
};

/** Standard industry-card spread for full maps (~24 cards). */
const FULL_SPREAD: Partial<Record<IndustryType, (1 | 2 | 3 | 4)[]>> = {
  coal: [1, 1, 2],
  iron: [1, 1, 2, 4],
  cotton: [1, 1, 2, 3],
  manufacturer: [1, 1, 2, 3],
  pottery: [1, 2, 4],
  juice: [1, 1, 2, 4],
};

/** Smaller industry-card spread for fast maps (20 cards @4P; still shorter). */
const FAST_SPREAD: Partial<Record<IndustryType, (1 | 2 | 3 | 4)[]>> = {
  coal: [1, 1, 3],
  iron: [1, 2, 4],
  cotton: [1, 1, 2, 3],
  manufacturer: [1, 1, 2, 3],
  pottery: [1, 2, 4],
  juice: [1, 1, 4],
};

interface AuthoredMapInput {
  id: string;
  display: string;
  desc: string;
  size: 'small' | 'medium' | 'large';
  fastPlay: boolean;
  skin: string;
  recommendedPlayers: number[];
  estPlayMinutes: number;
  eraOrder: RouteType[];
  towns: TownInput[];
  merchants: MerchInput[];
  /** Canal-era link pairs (the base topology). */
  canalLinks: [string, string][];
  /** Rail-era link pairs (defaults to canalLinks if omitted). */
  railLinks?: [string, string][];
  /** Air-era link pairs (hub flight arcs), required if eraOrder has 'air'. */
  airLinks?: [string, string][];
  /** Per-era island groupings (optional, for the morph). */
  islands?: { canal?: IslandGroup[]; rail?: IslandGroup[]; air?: IslandGroup[] };
  merchantTiles: MapMerchantTileDef[];
  emptyMerchants: Record<number, string[]>;
  spread: Partial<Record<IndustryType, (1 | 2 | 3 | 4)[]>>;
  /** Location cards per town (default 2). */
  locationCardsPerTown?: number;
}

interface IslandGroup {
  id: string;
  display: string;
  locationIds: string[];
}

function islandSpecs(
  mapId: string,
  groups: IslandGroup[] | undefined,
): { id: string; nameKey: string; locationIds: string[] }[] {
  return (groups ?? []).map((g) => ({
    id: g.id,
    nameKey: name(`map.${mapId}.island.${g.id}`, g.display),
    locationIds: g.locationIds,
  }));
}

function authorMap(input: AuthoredMapInput): MapDefinition {
  const spec: MapSpec = {
    id: input.id,
    nameKey: name(`map.${input.id}.name`, input.display),
    descriptionKey: name(`map.${input.id}.desc`, input.desc),
    size: input.size,
    fastPlay: input.fastPlay,
    thumbnail: `assets/board/thumbnails/${input.id}.svg`,
    skin: input.skin,
    recommendedPlayers: input.recommendedPlayers,
    estPlayMinutes: input.estPlayMinutes,
    eraOrder: input.eraOrder,
    towns: input.towns.map((t) => townSpec(input.id, t)),
    merchants: input.merchants.map((m) => merchSpec(input.id, m)),
    linksByEra: {
      canal: input.canalLinks,
      rail: input.railLinks ?? input.canalLinks,
      ...(input.airLinks ? { air: input.airLinks } : {}),
    },
    islandsByEra: {
      ...(input.islands?.canal ? { canal: islandSpecs(input.id, input.islands.canal) } : {}),
      ...(input.islands?.rail ? { rail: islandSpecs(input.id, input.islands.rail) } : {}),
      ...(input.islands?.air ? { air: islandSpecs(input.id, input.islands.air) } : {}),
    },
    merchantTiles: input.merchantTiles,
    playerCountRules: {
      excludedBands: STD_RULES.excludedBands,
      emptyMerchants: input.emptyMerchants,
    },
    deck: {
      industrySpread: input.spread,
      ...(input.locationCardsPerTown ? { locationCardsPerTown: input.locationCardsPerTown } : {}),
    },
  };
  return buildMap(spec);
}

// Common slot templates (each ensures coverage of all six industries map-wide).
const C_M: IndustryType[][] = [['cotton', 'manufacturer'], ['manufacturer']];
const COAL: IndustryType[][] = [['coal'], ['coal', 'iron']];
const IRON: IndustryType[][] = [
  ['iron', 'coal'],
  ['iron', 'manufacturer'],
];
const POT: IndustryType[][] = [['pottery'], ['cotton', 'pottery']];
const JUICE: IndustryType[][] = [['juice'], ['cotton', 'juice']];
const MANU: IndustryType[][] = [['manufacturer', 'coal'], ['manufacturer']];
const COT: IndustryType[][] = [['cotton'], ['cotton', 'juice']];

// ===========================================================================
// FULL MAP 2 — "Severn Vale" (2 eras: canal → rail)
// ===========================================================================
const SEVERN_VALE = authorMap({
  id: 'severnvale',
  display: 'Severn Vale',
  desc: 'A river-valley network of mill towns and clay pits across two eras.',
  size: 'large',
  fastPlay: false,
  skin: 'vale',
  recommendedPlayers: [2, 3, 4],
  estPlayMinutes: 85,
  eraOrder: ['canal', 'rail'],
  towns: [
    { id: 'ashford', band: 'green', slots: C_M, x: 500, y: 120, display: 'Ashford' },
    { id: 'brookhaven', band: 'green', slots: MANU, x: 360, y: 200, display: 'Brookhaven' },
    { id: 'clayton', band: 'green', slots: POT, x: 640, y: 200, display: 'Clayton' },
    { id: 'dunmere', band: 'red', slots: COAL, x: 250, y: 320, display: 'Dunmere' },
    { id: 'elmsworth', band: 'red', slots: IRON, x: 500, y: 320, display: 'Elmsworth' },
    { id: 'fenwick', band: 'red', slots: COT, x: 740, y: 320, display: 'Fenwick' },
    { id: 'glenby', band: 'yellow', slots: JUICE, x: 360, y: 440, display: 'Glenby' },
    { id: 'harlow', band: 'yellow', slots: C_M, x: 620, y: 440, display: 'Harlow' },
    { id: 'ironmoor', band: 'blue', slots: IRON, x: 180, y: 520, display: 'Ironmoor' },
    { id: 'kelby', band: 'blue', slots: POT, x: 500, y: 540, display: 'Kelby' },
    { id: 'lowford', band: 'teal', slots: MANU, x: 760, y: 540, display: 'Lowford' },
    { id: 'marsden', band: 'green', slots: COT, x: 360, y: 640, display: 'Marsden' },
    {
      id: 'farmA',
      band: 'farm',
      slots: [['juice']],
      x: 180,
      y: 400,
      display: 'Vale Juice Works',
      farm: true,
    },
    {
      id: 'farmB',
      band: 'farm',
      slots: [['juice']],
      x: 620,
      y: 660,
      display: 'River Juice Works',
      farm: true,
    },
  ],
  merchants: [
    { id: 'northgate', bonus: 'vp', vp: 4, spaces: 2, x: 500, y: 30, display: 'Northgate' },
    { id: 'eastport', bonus: 'money', money: 5, spaces: 2, x: 860, y: 380, display: 'Eastport' },
    { id: 'southmoor', bonus: 'develop', spaces: 2, x: 360, y: 740, display: 'Southmoor' },
    { id: 'westhaven', bonus: 'income', income: 2, spaces: 2, x: 60, y: 460, display: 'Westhaven' },
    { id: 'rivermouth', bonus: 'vp', vp: 3, spaces: 1, x: 760, y: 660, display: 'Rivermouth' },
  ],
  canalLinks: [
    ['ashford', 'brookhaven'],
    ['ashford', 'clayton'],
    ['ashford', 'northgate'],
    ['brookhaven', 'dunmere'],
    ['brookhaven', 'elmsworth'],
    ['clayton', 'fenwick'],
    ['clayton', 'elmsworth'],
    ['dunmere', 'glenby'],
    ['dunmere', 'westhaven'],
    ['elmsworth', 'glenby'],
    ['elmsworth', 'harlow'],
    ['fenwick', 'harlow'],
    ['fenwick', 'eastport'],
    ['glenby', 'ironmoor'],
    ['glenby', 'kelby'],
    ['harlow', 'lowford'],
    ['kelby', 'marsden'],
    ['kelby', 'lowford'],
    ['marsden', 'southmoor'],
    ['lowford', 'rivermouth'],
    ['ironmoor', 'westhaven'],
    ['farmA', 'glenby'],
    ['farmB', 'lowford'],
  ],
  railLinks: [
    ['ashford', 'brookhaven'],
    ['ashford', 'clayton'],
    ['ashford', 'northgate'],
    ['ashford', 'elmsworth'],
    ['brookhaven', 'dunmere'],
    ['brookhaven', 'elmsworth'],
    ['clayton', 'fenwick'],
    ['clayton', 'elmsworth'],
    ['dunmere', 'glenby'],
    ['dunmere', 'westhaven'],
    ['elmsworth', 'glenby'],
    ['elmsworth', 'harlow'],
    ['fenwick', 'harlow'],
    ['fenwick', 'eastport'],
    ['glenby', 'ironmoor'],
    ['glenby', 'kelby'],
    ['harlow', 'lowford'],
    ['kelby', 'marsden'],
    ['kelby', 'lowford'],
    ['marsden', 'southmoor'],
    ['lowford', 'rivermouth'],
    ['ironmoor', 'westhaven'],
    ['harlow', 'kelby'],
    ['farmA', 'glenby'],
    ['farmB', 'lowford'],
  ],
  islands: {
    canal: [
      { id: 'uplands', display: 'The Uplands', locationIds: ['ashford', 'brookhaven', 'clayton'] },
      { id: 'lowlands', display: 'The Lowlands', locationIds: ['kelby', 'lowford', 'marsden'] },
    ],
    rail: [
      {
        id: 'uplands',
        display: 'Northern Reach',
        locationIds: ['ashford', 'brookhaven', 'clayton'],
      },
      { id: 'lowlands', display: 'Southern Reach', locationIds: ['kelby', 'lowford', 'marsden'] },
    ],
  },
  merchantTiles: STANDARD_MERCHANT_TILES,
  emptyMerchants: { 2: ['eastport', 'rivermouth'], 3: ['rivermouth'], 4: [] },
  spread: FULL_SPREAD,
});

// ===========================================================================
// FULL MAP 3 — "Highland Reach" (2 eras: canal → rail)
// ===========================================================================
const HIGHLAND_REACH = authorMap({
  id: 'highland',
  display: 'Highland Reach',
  desc: 'Rugged glens and lochs connected by canals then highland railways.',
  size: 'large',
  fastPlay: false,
  skin: 'highland',
  recommendedPlayers: [2, 3, 4],
  estPlayMinutes: 90,
  eraOrder: ['canal', 'rail'],
  towns: [
    { id: 'aberloch', band: 'green', slots: C_M, x: 480, y: 110, display: 'Aberloch' },
    { id: 'braemore', band: 'green', slots: COAL, x: 300, y: 190, display: 'Braemore' },
    { id: 'craigholm', band: 'green', slots: IRON, x: 660, y: 190, display: 'Craigholm' },
    { id: 'dornie', band: 'red', slots: POT, x: 200, y: 310, display: 'Dornie' },
    { id: 'einich', band: 'red', slots: MANU, x: 480, y: 300, display: 'Einich' },
    { id: 'fettar', band: 'red', slots: COT, x: 720, y: 320, display: 'Fettar' },
    { id: 'glencairn', band: 'yellow', slots: JUICE, x: 320, y: 430, display: 'Glencairn' },
    { id: 'haldane', band: 'yellow', slots: C_M, x: 600, y: 440, display: 'Haldane' },
    { id: 'invermay', band: 'blue', slots: COAL, x: 160, y: 520, display: 'Invermay' },
    { id: 'kintail', band: 'blue', slots: IRON, x: 460, y: 540, display: 'Kintail' },
    { id: 'lorne', band: 'teal', slots: POT, x: 740, y: 540, display: 'Lorne' },
    { id: 'morven', band: 'green', slots: MANU, x: 320, y: 640, display: 'Morven' },
    {
      id: 'farmA',
      band: 'farm',
      slots: [['juice']],
      x: 180,
      y: 410,
      display: 'Glen Juice Works',
      farm: true,
    },
    {
      id: 'farmB',
      band: 'farm',
      slots: [['juice']],
      x: 600,
      y: 660,
      display: 'Loch Juice Works',
      farm: true,
    },
  ],
  merchants: [
    { id: 'kirkwall', bonus: 'vp', vp: 4, spaces: 2, x: 480, y: 30, display: 'Kirkwall' },
    { id: 'stromha', bonus: 'money', money: 5, spaces: 2, x: 860, y: 260, display: 'Stromha' },
    { id: 'tarbert', bonus: 'develop', spaces: 2, x: 320, y: 740, display: 'Tarbert' },
    { id: 'ullan', bonus: 'income', income: 2, spaces: 2, x: 60, y: 470, display: 'Ullan' },
    { id: 'wickaby', bonus: 'vp', vp: 3, spaces: 1, x: 760, y: 660, display: 'Wickaby' },
  ],
  canalLinks: [
    ['aberloch', 'braemore'],
    ['aberloch', 'craigholm'],
    ['aberloch', 'kirkwall'],
    ['braemore', 'dornie'],
    ['braemore', 'einich'],
    ['craigholm', 'fettar'],
    ['craigholm', 'einich'],
    ['craigholm', 'stromha'],
    ['dornie', 'glencairn'],
    ['einich', 'glencairn'],
    ['einich', 'haldane'],
    ['fettar', 'haldane'],
    ['glencairn', 'invermay'],
    ['glencairn', 'kintail'],
    ['haldane', 'lorne'],
    ['kintail', 'morven'],
    ['kintail', 'lorne'],
    ['morven', 'tarbert'],
    ['lorne', 'wickaby'],
    ['invermay', 'ullan'],
    ['dornie', 'ullan'],
    ['farmA', 'glencairn'],
    ['farmB', 'lorne'],
  ],
  islands: {
    canal: [
      { id: 'glens', display: 'The Glens', locationIds: ['braemore', 'dornie', 'glencairn'] },
      { id: 'isles', display: 'The Isles', locationIds: ['lorne', 'wickaby'] },
    ],
    rail: [
      { id: 'glens', display: 'Iron Glens', locationIds: ['braemore', 'dornie', 'glencairn'] },
      { id: 'isles', display: 'Far Isles', locationIds: ['lorne', 'wickaby'] },
    ],
  },
  merchantTiles: STANDARD_MERCHANT_TILES,
  emptyMerchants: { 2: ['stromha', 'wickaby'], 3: ['wickaby'], 4: [] },
  spread: FULL_SPREAD,
});

// ===========================================================================
// FULL MAP 4 — "Iron Coast" (2 eras: canal → rail), coastal industrial belt
// ===========================================================================
const IRON_COAST = authorMap({
  id: 'ironcoast',
  display: 'Iron Coast',
  desc: 'A dense coastal belt of foundries and mills — high competition for iron.',
  size: 'large',
  fastPlay: false,
  skin: 'coast',
  recommendedPlayers: [2, 3, 4],
  estPlayMinutes: 85,
  eraOrder: ['canal', 'rail'],
  towns: [
    { id: 'portwick', band: 'green', slots: C_M, x: 460, y: 120, display: 'Portwick' },
    { id: 'quarrend', band: 'green', slots: IRON, x: 300, y: 210, display: 'Quarrend' },
    { id: 'redhythe', band: 'green', slots: COAL, x: 640, y: 210, display: 'Redhythe' },
    { id: 'saltmere', band: 'red', slots: COT, x: 220, y: 330, display: 'Saltmere' },
    { id: 'thornbay', band: 'red', slots: MANU, x: 480, y: 320, display: 'Thornbay' },
    { id: 'ulverston', band: 'red', slots: POT, x: 720, y: 330, display: 'Ulverston' },
    { id: 'vellmar', band: 'yellow', slots: IRON, x: 320, y: 450, display: 'Vellmar' },
    { id: 'wyreham', band: 'yellow', slots: JUICE, x: 600, y: 450, display: 'Wyreham' },
    { id: 'yarcliff', band: 'blue', slots: C_M, x: 200, y: 560, display: 'Yarcliff' },
    { id: 'zelby', band: 'blue', slots: COAL, x: 480, y: 560, display: 'Zelby' },
    { id: 'amberton', band: 'teal', slots: MANU, x: 740, y: 560, display: 'Amberton' },
    { id: 'brindle', band: 'green', slots: POT, x: 360, y: 660, display: 'Brindle' },
    {
      id: 'farmA',
      band: 'farm',
      slots: [['juice']],
      x: 180,
      y: 430,
      display: 'Coast Juice Works',
      farm: true,
    },
    {
      id: 'farmB',
      band: 'farm',
      slots: [['juice']],
      x: 620,
      y: 670,
      display: 'Bay Juice Works',
      farm: true,
    },
  ],
  merchants: [
    { id: 'harbour', bonus: 'vp', vp: 4, spaces: 2, x: 460, y: 30, display: 'North Harbour' },
    { id: 'tradeport', bonus: 'money', money: 5, spaces: 2, x: 860, y: 270, display: 'Tradeport' },
    { id: 'fishgate', bonus: 'develop', spaces: 2, x: 360, y: 760, display: 'Fishgate' },
    { id: 'oldquay', bonus: 'income', income: 2, spaces: 2, x: 60, y: 490, display: 'Old Quay' },
    { id: 'capemark', bonus: 'vp', vp: 3, spaces: 1, x: 760, y: 670, display: 'Capemark' },
  ],
  canalLinks: [
    ['portwick', 'quarrend'],
    ['portwick', 'redhythe'],
    ['portwick', 'harbour'],
    ['quarrend', 'saltmere'],
    ['quarrend', 'thornbay'],
    ['redhythe', 'ulverston'],
    ['redhythe', 'thornbay'],
    ['redhythe', 'tradeport'],
    ['saltmere', 'vellmar'],
    ['thornbay', 'vellmar'],
    ['thornbay', 'wyreham'],
    ['ulverston', 'wyreham'],
    ['vellmar', 'yarcliff'],
    ['vellmar', 'zelby'],
    ['wyreham', 'amberton'],
    ['zelby', 'brindle'],
    ['zelby', 'amberton'],
    ['brindle', 'fishgate'],
    ['amberton', 'capemark'],
    ['yarcliff', 'oldquay'],
    ['saltmere', 'oldquay'],
    ['farmA', 'vellmar'],
    ['farmB', 'amberton'],
  ],
  merchantTiles: STANDARD_MERCHANT_TILES,
  emptyMerchants: { 2: ['tradeport', 'capemark'], 3: ['capemark'], 4: [] },
  spread: FULL_SPREAD,
});

// ===========================================================================
// FULL MAP 5 — "Skyward Dominion" (3 eras: canal → rail → AIR)
// ===========================================================================
const SKYWARD = authorMap({
  id: 'skyward',
  display: 'Skyward Dominion',
  desc: 'A grand three-era land: canals, then railways, then a network of airships.',
  size: 'large',
  fastPlay: false,
  skin: 'skyward',
  recommendedPlayers: [2, 3, 4],
  estPlayMinutes: 110,
  eraOrder: ['canal', 'rail', 'air'],
  towns: [
    { id: 'aurelia', band: 'green', slots: C_M, x: 480, y: 110, display: 'Aurelia' },
    { id: 'borealis', band: 'green', slots: COAL, x: 300, y: 190, display: 'Borealis' },
    { id: 'cirrus', band: 'green', slots: IRON, x: 660, y: 190, display: 'Cirrus' },
    { id: 'delphi', band: 'red', slots: POT, x: 200, y: 310, display: 'Delphi' },
    { id: 'evermist', band: 'red', slots: MANU, x: 480, y: 300, display: 'Evermist' },
    { id: 'fjordane', band: 'red', slots: COT, x: 720, y: 310, display: 'Fjordane' },
    { id: 'gallowin', band: 'yellow', slots: JUICE, x: 320, y: 430, display: 'Gallowin' },
    { id: 'highspire', band: 'yellow', slots: C_M, x: 600, y: 440, display: 'Highspire' },
    { id: 'icarion', band: 'blue', slots: COAL, x: 160, y: 520, display: 'Icarion' },
    { id: 'jovica', band: 'blue', slots: IRON, x: 460, y: 540, display: 'Jovica' },
    { id: 'kestrel', band: 'teal', slots: POT, x: 740, y: 540, display: 'Kestrel' },
    { id: 'lumeria', band: 'green', slots: MANU, x: 320, y: 640, display: 'Lumeria' },
    {
      id: 'farmA',
      band: 'farm',
      slots: [['juice']],
      x: 180,
      y: 410,
      display: 'Sky Juice Works',
      farm: true,
    },
    {
      id: 'farmB',
      band: 'farm',
      slots: [['juice']],
      x: 600,
      y: 660,
      display: 'Cloud Juice Works',
      farm: true,
    },
  ],
  merchants: [
    { id: 'zenith', bonus: 'vp', vp: 4, spaces: 2, x: 480, y: 30, display: 'Zenith' },
    { id: 'meridian', bonus: 'money', money: 5, spaces: 2, x: 860, y: 260, display: 'Meridian' },
    { id: 'nadir', bonus: 'develop', spaces: 2, x: 320, y: 740, display: 'Nadir' },
    { id: 'aether', bonus: 'income', income: 2, spaces: 2, x: 60, y: 470, display: 'Aether' },
    { id: 'solstice', bonus: 'vp', vp: 3, spaces: 1, x: 760, y: 660, display: 'Solstice' },
  ],
  canalLinks: [
    ['aurelia', 'borealis'],
    ['aurelia', 'cirrus'],
    ['aurelia', 'zenith'],
    ['borealis', 'delphi'],
    ['borealis', 'evermist'],
    ['cirrus', 'fjordane'],
    ['cirrus', 'evermist'],
    ['cirrus', 'meridian'],
    ['delphi', 'gallowin'],
    ['evermist', 'gallowin'],
    ['evermist', 'highspire'],
    ['fjordane', 'highspire'],
    ['gallowin', 'icarion'],
    ['gallowin', 'jovica'],
    ['highspire', 'kestrel'],
    ['jovica', 'lumeria'],
    ['jovica', 'kestrel'],
    ['lumeria', 'nadir'],
    ['kestrel', 'solstice'],
    ['icarion', 'aether'],
    ['delphi', 'aether'],
    ['farmA', 'gallowin'],
    ['farmB', 'kestrel'],
  ],
  // Air era: long flight arcs between hub cities (sparser, ignores terrain).
  airLinks: [
    ['aurelia', 'evermist'],
    ['aurelia', 'highspire'],
    ['aurelia', 'zenith'],
    ['evermist', 'lumeria'],
    ['evermist', 'kestrel'],
    ['highspire', 'cirrus'],
    ['highspire', 'meridian'],
    ['cirrus', 'fjordane'],
    ['lumeria', 'nadir'],
    ['lumeria', 'icarion'],
    ['kestrel', 'solstice'],
    ['jovica', 'evermist'],
    ['borealis', 'aurelia'],
    ['delphi', 'aether'],
    ['gallowin', 'evermist'],
    ['farmA', 'gallowin'],
    ['farmB', 'kestrel'],
  ],
  islands: {
    canal: [
      { id: 'heights', display: 'The Heights', locationIds: ['aurelia', 'borealis', 'cirrus'] },
      { id: 'depths', display: 'The Depths', locationIds: ['icarion', 'jovica', 'lumeria'] },
    ],
    rail: [
      { id: 'heights', display: 'Upper Dominion', locationIds: ['aurelia', 'borealis', 'cirrus'] },
      { id: 'depths', display: 'Lower Dominion', locationIds: ['icarion', 'jovica', 'lumeria'] },
    ],
    air: [
      {
        id: 'heights',
        display: 'Sky Sovereignty',
        locationIds: ['aurelia', 'highspire', 'cirrus'],
      },
      { id: 'depths', display: 'Cloud Reaches', locationIds: ['lumeria', 'kestrel', 'evermist'] },
    ],
  },
  merchantTiles: STANDARD_MERCHANT_TILES,
  emptyMerchants: { 2: ['meridian', 'solstice'], 3: ['solstice'], 4: [] },
  spread: FULL_SPREAD,
});

export const FULL_MAPS_AUTHORED: MapDefinition[] = [
  SEVERN_VALE,
  HIGHLAND_REACH,
  IRON_COAST,
  SKYWARD,
];

// ===========================================================================
// FAST-PLAY MAPS (5) — small, fewer locations/links, shorter decks.
// ===========================================================================

function fastMap(
  id: string,
  display: string,
  desc: string,
  skin: string,
  towns: TownInput[],
  merchants: MerchInput[],
  canalLinks: [string, string][],
  emptyMerchants: Record<number, string[]>,
): MapDefinition {
  return authorMap({
    id,
    display,
    desc,
    size: 'small',
    fastPlay: true,
    skin,
    recommendedPlayers: [2, 3],
    estPlayMinutes: 35,
    eraOrder: ['canal', 'rail'],
    towns,
    merchants,
    canalLinks,
    merchantTiles: FAST_MERCHANT_TILES,
    emptyMerchants,
    spread: FAST_SPREAD,
    locationCardsPerTown: 3,
  });
}

// FAST 1 — "Quill Hollow"
const QUILL = fastMap(
  'quill',
  'Quill Hollow',
  'A compact hollow for a quick game — six towns, two merchants.',
  'hollow',
  [
    {
      id: 'q1',
      band: 'green',
      slots: [['cotton', 'manufacturer'], ['coal']],
      x: 360,
      y: 160,
      display: 'Quillford',
    },
    {
      id: 'q2',
      band: 'green',
      slots: [['iron', 'coal'], ['manufacturer']],
      x: 620,
      y: 160,
      display: 'Hollowby',
    },
    {
      id: 'q3',
      band: 'red',
      slots: [['pottery'], ['cotton', 'juice']],
      x: 240,
      y: 340,
      display: 'Mossvale',
    },
    {
      id: 'q4',
      band: 'red',
      slots: [['manufacturer', 'coal'], ['juice']],
      x: 500,
      y: 340,
      display: 'Penn',
    },
    { id: 'q5', band: 'yellow', slots: [['cotton'], ['iron']], x: 740, y: 340, display: 'Rookley' },
    {
      id: 'q6',
      band: 'green',
      slots: [['pottery'], ['manufacturer']],
      x: 500,
      y: 520,
      display: 'Sedgely',
    },
    {
      id: 'qf',
      band: 'farm',
      slots: [['juice']],
      x: 240,
      y: 520,
      display: 'Hollow Juice Works',
      farm: true,
    },
  ],
  [
    { id: 'qm1', bonus: 'income', income: 2, spaces: 2, x: 500, y: 40, display: 'Greenmarket' },
    { id: 'qm2', bonus: 'vp', vp: 4, spaces: 2, x: 500, y: 620, display: 'Southmarket' },
  ],
  [
    ['q1', 'q2'],
    ['q1', 'q3'],
    ['q1', 'qm1'],
    ['q2', 'q5'],
    ['q2', 'qm1'],
    ['q3', 'q4'],
    ['q4', 'q5'],
    ['q4', 'q6'],
    ['q3', 'qf'],
    ['q6', 'qm2'],
    ['q4', 'qm2'],
    ['q5', 'q6'],
  ],
  { 2: [], 3: [], 4: [] },
);

// FAST 2 — "Tin Brook"
const TIN = fastMap(
  'tin',
  'Tin Brook',
  'A streamside cluster of foundries — fast and iron-hungry.',
  'brook',
  [
    {
      id: 't1',
      band: 'green',
      slots: [['cotton', 'manufacturer'], ['iron']],
      x: 380,
      y: 150,
      display: 'Tinbrook',
    },
    {
      id: 't2',
      band: 'green',
      slots: [['coal'], ['manufacturer']],
      x: 640,
      y: 160,
      display: 'Smeltby',
    },
    {
      id: 't3',
      band: 'red',
      slots: [['pottery'], ['cotton']],
      x: 250,
      y: 320,
      display: 'Claymoor',
    },
    {
      id: 't4',
      band: 'red',
      slots: [['iron', 'coal'], ['juice']],
      x: 510,
      y: 330,
      display: 'Forgeham',
    },
    {
      id: 't5',
      band: 'yellow',
      slots: [['manufacturer', 'coal'], ['pottery']],
      x: 760,
      y: 330,
      display: 'Kilnwick',
    },
    {
      id: 't6',
      band: 'green',
      slots: [['cotton', 'juice'], ['manufacturer']],
      x: 500,
      y: 520,
      display: 'Weldon',
    },
    {
      id: 'tf',
      band: 'farm',
      slots: [['juice']],
      x: 250,
      y: 500,
      display: 'Brook Juice Works',
      farm: true,
    },
  ],
  [
    { id: 'tm1', bonus: 'money', money: 5, spaces: 2, x: 500, y: 40, display: 'Brookgate' },
    { id: 'tm2', bonus: 'develop', spaces: 2, x: 500, y: 620, display: 'Millgate' },
  ],
  [
    ['t1', 't2'],
    ['t1', 't3'],
    ['t1', 'tm1'],
    ['t2', 't5'],
    ['t2', 'tm1'],
    ['t3', 't4'],
    ['t4', 't5'],
    ['t4', 't6'],
    ['t3', 'tf'],
    ['t6', 'tm2'],
    ['t4', 'tm2'],
    ['t5', 't6'],
  ],
  { 2: [], 3: [], 4: [] },
);

// FAST 3 — "Maple Cross"
const MAPLE = fastMap(
  'maple',
  'Maple Cross',
  'A crossroads market town — balanced and beginner-friendly.',
  'maple',
  [
    {
      id: 'm1',
      band: 'green',
      slots: [['cotton', 'manufacturer'], ['pottery']],
      x: 500,
      y: 140,
      display: 'Maple Cross',
    },
    { id: 'm2', band: 'green', slots: [['coal'], ['iron']], x: 280, y: 250, display: 'Oakdale' },
    {
      id: 'm3',
      band: 'red',
      slots: [['manufacturer'], ['cotton', 'juice']],
      x: 720,
      y: 250,
      display: 'Birchwood',
    },
    {
      id: 'm4',
      band: 'red',
      slots: [['iron', 'coal'], ['manufacturer']],
      x: 360,
      y: 430,
      display: 'Elmgrove',
    },
    {
      id: 'm5',
      band: 'yellow',
      slots: [['pottery'], ['cotton']],
      x: 640,
      y: 430,
      display: 'Aspenford',
    },
    {
      id: 'm6',
      band: 'green',
      slots: [['manufacturer', 'coal'], ['juice']],
      x: 500,
      y: 560,
      display: 'Willowby',
    },
    {
      id: 'mf',
      band: 'farm',
      slots: [['juice']],
      x: 280,
      y: 500,
      display: 'Maple Juice Works',
      farm: true,
    },
  ],
  [
    { id: 'mm1', bonus: 'vp', vp: 3, spaces: 2, x: 500, y: 40, display: 'Crossmarket' },
    { id: 'mm2', bonus: 'income', income: 2, spaces: 2, x: 500, y: 660, display: 'Greenway' },
  ],
  [
    ['m1', 'm2'],
    ['m1', 'm3'],
    ['m1', 'mm1'],
    ['m2', 'm4'],
    ['m3', 'm5'],
    ['m4', 'm5'],
    ['m4', 'm6'],
    ['m5', 'm6'],
    ['m2', 'mf'],
    ['m6', 'mm2'],
    ['m4', 'mm2'],
    ['m3', 'mm1'],
  ],
  { 2: [], 3: [], 4: [] },
);

// FAST 4 — "Slate Pike"
const SLATE = fastMap(
  'slate',
  'Slate Pike',
  'A mountain mining outpost — sharp and resource-tight.',
  'slate',
  [
    {
      id: 's1',
      band: 'green',
      slots: [['cotton', 'manufacturer'], ['coal']],
      x: 480,
      y: 150,
      display: 'Slatepike',
    },
    {
      id: 's2',
      band: 'green',
      slots: [['iron', 'coal'], ['pottery']],
      x: 250,
      y: 270,
      display: 'Greyfell',
    },
    {
      id: 's3',
      band: 'red',
      slots: [['manufacturer'], ['cotton']],
      x: 720,
      y: 270,
      display: 'Shalecombe',
    },
    { id: 's4', band: 'red', slots: [['coal'], ['iron']], x: 370, y: 440, display: 'Flintmoor' },
    {
      id: 's5',
      band: 'yellow',
      slots: [['cotton', 'juice'], ['manufacturer']],
      x: 650,
      y: 440,
      display: 'Cragend',
    },
    {
      id: 's6',
      band: 'green',
      slots: [['pottery'], ['manufacturer', 'coal']],
      x: 500,
      y: 570,
      display: 'Talgarth',
    },
    {
      id: 'sf',
      band: 'farm',
      slots: [['juice']],
      x: 250,
      y: 510,
      display: 'Pike Juice Works',
      farm: true,
    },
  ],
  [
    { id: 'sm1', bonus: 'develop', spaces: 2, x: 500, y: 40, display: 'Pikegate' },
    { id: 'sm2', bonus: 'money', money: 5, spaces: 2, x: 500, y: 670, display: 'Valgate' },
  ],
  [
    ['s1', 's2'],
    ['s1', 's3'],
    ['s1', 'sm1'],
    ['s2', 's4'],
    ['s3', 's5'],
    ['s4', 's5'],
    ['s4', 's6'],
    ['s5', 's6'],
    ['s2', 'sf'],
    ['s6', 'sm2'],
    ['s4', 'sm2'],
    ['s3', 'sm1'],
  ],
  { 2: [], 3: [], 4: [] },
);

// FAST 5 — "Amber Fen"
const AMBER = fastMap(
  'amber',
  'Amber Fen',
  'A low marshland of weavers and potters — quick and breezy.',
  'fen',
  [
    {
      id: 'a1',
      band: 'green',
      slots: [['cotton', 'manufacturer'], ['juice']],
      x: 500,
      y: 140,
      display: 'Amberfen',
    },
    { id: 'a2', band: 'green', slots: [['coal'], ['iron']], x: 280, y: 250, display: 'Reedham' },
    {
      id: 'a3',
      band: 'red',
      slots: [['pottery'], ['cotton']],
      x: 720,
      y: 250,
      display: 'Sedgemoor',
    },
    {
      id: 'a4',
      band: 'red',
      slots: [['iron', 'coal'], ['manufacturer']],
      x: 360,
      y: 430,
      display: 'Mirewick',
    },
    {
      id: 'a5',
      band: 'yellow',
      slots: [['manufacturer', 'coal'], ['pottery']],
      x: 640,
      y: 430,
      display: 'Fenwell',
    },
    {
      id: 'a6',
      band: 'green',
      slots: [['cotton'], ['manufacturer']],
      x: 500,
      y: 560,
      display: 'Boglea',
    },
    {
      id: 'af',
      band: 'farm',
      slots: [['juice']],
      x: 280,
      y: 500,
      display: 'Fen Juice Works',
      farm: true,
    },
  ],
  [
    { id: 'am1', bonus: 'income', income: 2, spaces: 2, x: 500, y: 40, display: 'Fengate' },
    { id: 'am2', bonus: 'vp', vp: 4, spaces: 2, x: 500, y: 660, display: 'Marshgate' },
  ],
  [
    ['a1', 'a2'],
    ['a1', 'a3'],
    ['a1', 'am1'],
    ['a2', 'a4'],
    ['a3', 'a5'],
    ['a4', 'a5'],
    ['a4', 'a6'],
    ['a5', 'a6'],
    ['a2', 'af'],
    ['a6', 'am2'],
    ['a4', 'am2'],
    ['a3', 'am1'],
  ],
  { 2: [], 3: [], 4: [] },
);

export const FAST_MAPS_AUTHORED: MapDefinition[] = [QUILL, TIN, MAPLE, SLATE, AMBER];
