import type { ColorBand, EraId, IndustryType, MerchantBonusType } from '../model/types.ts';
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
 * The authored maps (§7.15.2 / Phase 10): 4 additional Full maps (one with an
 * Air Era) and 5 Fast-play maps. The classic Birmingham map (the 5th Full map)
 * lives in `birmingham.ts`.
 *
 * Each map declares a **distinct, original geography** — its own town count and
 * placement (no shared coordinate grid), its own link-network *shape*, its own
 * merchant placement and a different industry/slot distribution (iron-scarce vs
 * coal-rich vs cotton/juice-heavy) — so every board plays differently. Invented
 * place names mean no publisher artwork is reproduced.
 *
 * The world also **genuinely morphs between eras** (§7.15.3 / §7.16.7): each map
 * defines a different link network per era (`canalLinks` ≠ `railLinks`, plus
 * `airLinks` where present), per-era node **positions** (`eraPos`) and **names**
 * (`eraName`) so locations reposition and can be renamed, and per-era **islands**
 * whose membership and names change. Every location keeps a stable logical `id`
 * across eras so persistent level-2+ tiles still map to the right (repositioned)
 * place. Names are registered as i18n keys (EN/RU/UZ) via {@link buildMapI18n}.
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

/** Per-era position overrides (locations reposition when the era advances). */
type PosByEra = Partial<Record<RouteType, { x: number; y: number }>>;
/** Per-era display-name overrides (locations can be renamed per era). */
type NameByEra = Partial<Record<RouteType, string>>;

interface TownInput {
  id: string;
  band: ColorBand;
  slots: IndustryType[][];
  x: number;
  y: number;
  display: string;
  farm?: boolean;
  eraPos?: PosByEra;
  eraName?: NameByEra;
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
  eraPos?: PosByEra;
  eraName?: NameByEra;
}

function eraPosOf(input: PosByEra | undefined): Partial<Record<EraId, { x: number; y: number }>> {
  const out: Partial<Record<EraId, { x: number; y: number }>> = {};
  for (const era of ['rail', 'air'] as RouteType[]) {
    const p = input?.[era];
    if (p) out[era] = p;
  }
  return out;
}

function eraNamesOf(
  mapId: string,
  id: string,
  kind: 'loc' | 'merch',
  input: NameByEra | undefined,
): Partial<Record<EraId, string>> {
  const out: Partial<Record<EraId, string>> = {};
  for (const era of ['rail', 'air'] as RouteType[]) {
    const v = input?.[era];
    if (v) out[era] = name(`map.${mapId}.${kind}.${id}.${era}`, v);
  }
  return out;
}

function townSpec(mapId: string, t: TownInput): TownSpec {
  const eraPos = eraPosOf(t.eraPos);
  const eraNames = eraNamesOf(mapId, t.id, 'loc', t.eraName);
  return {
    id: t.id,
    nameKey: name(`map.${mapId}.loc.${t.id}`, t.display),
    colorBand: t.band,
    slots: t.slots,
    pos: { x: t.x, y: t.y },
    ...(Object.keys(eraPos).length ? { eraPos } : {}),
    ...(Object.keys(eraNames).length ? { eraNames } : {}),
    ...(t.farm ? { isFarmJuice: true } : {}),
  };
}

function merchSpec(mapId: string, m: MerchInput): MerchantSpec {
  const eraPos = eraPosOf(m.eraPos);
  const eraNames = eraNamesOf(mapId, m.id, 'merch', m.eraName);
  return {
    id: m.id,
    nameKey: name(`map.${mapId}.merch.${m.id}`, m.display),
    bonus: m.bonus,
    ...(m.vp !== undefined ? { bonusVp: m.vp } : {}),
    ...(m.income !== undefined ? { bonusIncome: m.income } : {}),
    ...(m.money !== undefined ? { bonusMoney: m.money } : {}),
    tileSpaces: m.spaces,
    pos: { x: m.x, y: m.y },
    ...(Object.keys(eraPos).length ? { eraPos } : {}),
    ...(Object.keys(eraNames).length ? { eraNames } : {}),
  };
}

const STD_RULES: PlayerCountRules = {
  excludedBands: { 2: ['blue', 'teal'], 3: ['teal'], 4: [] },
  emptyMerchants: {},
};

interface IslandGroup {
  id: string;
  display: string;
  locationIds: string[];
}

function islandSpecs(mapId: string, era: RouteType, groups: IslandGroup[] | undefined) {
  return (groups ?? []).map((g) => ({
    id: g.id,
    // Island names can differ per era, so the key is namespaced by era.
    nameKey: name(`map.${mapId}.island.${era}.${g.id}`, g.display),
    locationIds: g.locationIds,
  }));
}

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
  /** Rail-era link pairs (a genuinely different network shape). */
  railLinks: [string, string][];
  /** Air-era link pairs (hub flight arcs), required if eraOrder has 'air'. */
  airLinks?: [string, string][];
  /** Per-era island groupings (membership & names change for the morph). */
  islands?: { canal?: IslandGroup[]; rail?: IslandGroup[]; air?: IslandGroup[] };
  merchantTiles: MapMerchantTileDef[];
  emptyMerchants: Record<number, string[]>;
  spread: Partial<Record<IndustryType, (1 | 2 | 3 | 4)[]>>;
  /** Location cards per town (default 2). */
  locationCardsPerTown?: number;
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
      rail: input.railLinks,
      ...(input.airLinks ? { air: input.airLinks } : {}),
    },
    islandsByEra: {
      ...(input.islands?.canal
        ? { canal: islandSpecs(input.id, 'canal', input.islands.canal) }
        : {}),
      ...(input.islands?.rail ? { rail: islandSpecs(input.id, 'rail', input.islands.rail) } : {}),
      ...(input.islands?.air ? { air: islandSpecs(input.id, 'air', input.islands.air) } : {}),
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

// ===========================================================================
// FULL MAP 2 — "Severn Vale" (canal → rail)
// A winding river valley of weaving & cider towns: cotton/juice-HEAVY, iron
// scarce. Branching river-spine topology. 12 towns + 2 farms, 5 merchants.
// ===========================================================================
const SEVERN_VALE = authorMap({
  id: 'severnvale',
  display: 'Severn Vale',
  desc: 'A winding river valley of weavers and cider mills — cotton- and juice-rich, iron-scarce.',
  size: 'large',
  fastPlay: false,
  skin: 'vale',
  recommendedPlayers: [2, 3, 4],
  estPlayMinutes: 85,
  eraOrder: ['canal', 'rail'],
  towns: [
    {
      id: 'ashford',
      band: 'green',
      slots: [['cotton', 'manufacturer'], ['cotton']],
      x: 500,
      y: 100,
      display: 'Ashford',
      eraName: { rail: 'Ashford Junction' },
      eraPos: { rail: { x: 500, y: 120 } },
    },
    {
      id: 'brookhaven',
      band: 'green',
      slots: [['cotton'], ['juice']],
      x: 330,
      y: 170,
      display: 'Brookhaven',
      eraPos: { rail: { x: 360, y: 180 } },
    },
    {
      id: 'clayton',
      band: 'red',
      slots: [['pottery'], ['cotton', 'pottery']],
      x: 660,
      y: 170,
      display: 'Clayton',
      eraPos: { rail: { x: 640, y: 180 } },
    },
    {
      id: 'dunmere',
      band: 'red',
      slots: [['coal'], ['coal', 'iron']],
      x: 230,
      y: 300,
      display: 'Dunmere',
    },
    {
      id: 'elmsworth',
      band: 'green',
      slots: [['iron', 'coal'], ['manufacturer']],
      x: 500,
      y: 300,
      display: 'Elmsworth',
      eraName: { rail: 'Elmsworth Works' },
    },
    {
      id: 'fenwick',
      band: 'red',
      slots: [['cotton', 'juice'], ['cotton']],
      x: 740,
      y: 300,
      display: 'Fenwick',
    },
    {
      id: 'glenby',
      band: 'yellow',
      slots: [['juice'], ['cotton', 'juice']],
      x: 330,
      y: 430,
      display: 'Glenby',
      eraPos: { rail: { x: 360, y: 440 } },
    },
    {
      id: 'harlow',
      band: 'yellow',
      slots: [['cotton', 'manufacturer'], ['juice']],
      x: 620,
      y: 440,
      display: 'Harlow',
      eraPos: { rail: { x: 600, y: 440 } },
    },
    {
      id: 'ironmoor',
      band: 'blue',
      slots: [['iron', 'manufacturer'], ['coal']],
      x: 180,
      y: 540,
      display: 'Ironmoor',
    },
    {
      id: 'kelby',
      band: 'blue',
      slots: [['pottery'], ['cotton']],
      x: 480,
      y: 540,
      display: 'Kelby',
    },
    {
      id: 'lowford',
      band: 'teal',
      slots: [['manufacturer'], ['manufacturer', 'juice']],
      x: 740,
      y: 540,
      display: 'Lowford',
      eraName: { rail: 'Lowford Mills' },
    },
    {
      id: 'marsden',
      band: 'green',
      slots: [['cotton'], ['cotton', 'juice']],
      x: 360,
      y: 650,
      display: 'Marsden',
    },
    {
      id: 'farmA',
      band: 'farm',
      slots: [['juice']],
      x: 170,
      y: 410,
      display: 'Vale Cider Works',
      farm: true,
    },
    {
      id: 'farmB',
      band: 'farm',
      slots: [['juice']],
      x: 600,
      y: 660,
      display: 'River Cider Works',
      farm: true,
    },
  ],
  merchants: [
    { id: 'northgate', bonus: 'vp', vp: 4, spaces: 2, x: 500, y: 24, display: 'Northgate' },
    {
      id: 'eastport',
      bonus: 'money',
      money: 5,
      spaces: 2,
      x: 880,
      y: 360,
      display: 'Eastport',
      eraPos: { rail: { x: 880, y: 320 } },
    },
    { id: 'southmoor', bonus: 'develop', spaces: 2, x: 360, y: 760, display: 'Southmoor' },
    { id: 'westhaven', bonus: 'income', income: 2, spaces: 2, x: 40, y: 470, display: 'Westhaven' },
    { id: 'rivermouth', bonus: 'vp', vp: 3, spaces: 1, x: 760, y: 670, display: 'Rivermouth' },
  ],
  canalLinks: [
    ['ashford', 'northgate'],
    ['ashford', 'brookhaven'],
    ['ashford', 'clayton'],
    ['brookhaven', 'dunmere'],
    ['brookhaven', 'elmsworth'],
    ['clayton', 'fenwick'],
    ['clayton', 'elmsworth'],
    ['fenwick', 'eastport'],
    ['dunmere', 'westhaven'],
    ['dunmere', 'glenby'],
    ['elmsworth', 'glenby'],
    ['elmsworth', 'harlow'],
    ['fenwick', 'harlow'],
    ['glenby', 'ironmoor'],
    ['glenby', 'kelby'],
    ['farmA', 'glenby'],
    ['harlow', 'lowford'],
    ['ironmoor', 'westhaven'],
    ['kelby', 'marsden'],
    ['kelby', 'lowford'],
    ['marsden', 'southmoor'],
    ['lowford', 'rivermouth'],
    ['farmB', 'lowford'],
  ],
  // Rail era: the valley's branches knit together — new cross-vale lines open
  // (Ashford→Elmsworth spine, Harlow↔Kelby, Clayton↔Harlow) and the lazy
  // canal loop via Dunmere→Westhaven is replaced by a faster Ironmoor spur.
  railLinks: [
    ['ashford', 'northgate'],
    ['ashford', 'brookhaven'],
    ['ashford', 'clayton'],
    ['ashford', 'elmsworth'],
    ['brookhaven', 'dunmere'],
    ['clayton', 'fenwick'],
    ['clayton', 'harlow'],
    ['fenwick', 'eastport'],
    ['dunmere', 'glenby'],
    ['elmsworth', 'harlow'],
    ['elmsworth', 'glenby'],
    ['glenby', 'ironmoor'],
    ['glenby', 'kelby'],
    ['farmA', 'glenby'],
    ['harlow', 'kelby'],
    ['harlow', 'lowford'],
    ['ironmoor', 'westhaven'],
    ['kelby', 'marsden'],
    ['kelby', 'lowford'],
    ['marsden', 'southmoor'],
    ['lowford', 'rivermouth'],
    ['farmB', 'lowford'],
    ['dunmere', 'ironmoor'],
  ],
  islands: {
    canal: [
      {
        id: 'uplands',
        display: 'The Vale Uplands',
        locationIds: ['ashford', 'brookhaven', 'clayton'],
      },
      {
        id: 'lowlands',
        display: 'The Water Meadows',
        locationIds: ['kelby', 'lowford', 'marsden'],
      },
    ],
    rail: [
      { id: 'uplands', display: 'Northern Reach', locationIds: ['ashford', 'clayton', 'fenwick'] },
      { id: 'lowlands', display: 'Southern Reach', locationIds: ['ironmoor', 'kelby', 'marsden'] },
    ],
  },
  merchantTiles: STANDARD_MERCHANT_TILES,
  emptyMerchants: { 2: ['eastport', 'rivermouth'], 3: ['rivermouth'], 4: [] },
  spread: {
    coal: [1, 2, 4],
    iron: [1, 4],
    cotton: [1, 1, 2, 3],
    manufacturer: [1, 2, 3],
    pottery: [1, 2, 4],
    juice: [1, 1, 2, 3],
  },
});

// ===========================================================================
// FULL MAP 3 — "Highland Reach" (canal → rail)
// Two rugged glens separated by a loch, joined only by a narrow central pass in
// the Canal Era; the railways drive straight across the watershed. COAL-RICH,
// IRON-SCARCE. 10 towns + 2 farms, 4 merchants — sparser & tighter than Severn.
// ===========================================================================
const HIGHLAND_REACH = authorMap({
  id: 'highland',
  display: 'Highland Reach',
  desc: 'Two coal-rich glens split by a loch — bridged by a single canal pass, then welded by rail. Iron is scarce.',
  size: 'large',
  fastPlay: false,
  skin: 'highland',
  recommendedPlayers: [2, 3, 4],
  estPlayMinutes: 80,
  eraOrder: ['canal', 'rail'],
  towns: [
    // West glen.
    {
      id: 'aberloch',
      band: 'green',
      slots: [['cotton', 'manufacturer'], ['coal']],
      x: 200,
      y: 120,
      display: 'Aberloch',
    },
    {
      id: 'braemore',
      band: 'red',
      slots: [['coal'], ['coal', 'iron']],
      x: 110,
      y: 270,
      display: 'Braemore',
    },
    {
      id: 'dornie',
      band: 'green',
      slots: [['pottery'], ['cotton']],
      x: 270,
      y: 300,
      display: 'Dornie',
      eraPos: { rail: { x: 300, y: 320 } },
    },
    {
      id: 'glencairn',
      band: 'yellow',
      slots: [['juice'], ['cotton', 'juice']],
      x: 160,
      y: 440,
      display: 'Glencairn',
    },
    {
      id: 'invermay',
      band: 'blue',
      slots: [['coal'], ['manufacturer', 'coal']],
      x: 290,
      y: 540,
      display: 'Invermay',
      eraName: { rail: 'Invermay Halt' },
    },
    // East glen.
    {
      id: 'craigholm',
      band: 'green',
      slots: [['manufacturer'], ['coal']],
      x: 640,
      y: 120,
      display: 'Craigholm',
      eraName: { rail: 'Craigholm Yard' },
    },
    {
      id: 'fettar',
      band: 'red',
      slots: [['cotton'], ['pottery']],
      x: 740,
      y: 270,
      display: 'Fettar',
    },
    {
      id: 'haldane',
      band: 'yellow',
      slots: [['manufacturer', 'coal'], ['juice']],
      x: 610,
      y: 320,
      display: 'Haldane',
      eraPos: { rail: { x: 580, y: 320 } },
    },
    {
      id: 'kintail',
      band: 'blue',
      slots: [['coal', 'iron'], ['manufacturer']],
      x: 760,
      y: 470,
      display: 'Kintail',
    },
    {
      id: 'lorne',
      band: 'teal',
      slots: [['pottery'], ['cotton', 'manufacturer']],
      x: 660,
      y: 540,
      display: 'Lorne',
    },
    {
      id: 'farmA',
      band: 'farm',
      slots: [['juice']],
      x: 380,
      y: 430,
      display: 'Glen Cider Works',
      farm: true,
    },
    {
      id: 'farmB',
      band: 'farm',
      slots: [['juice']],
      x: 520,
      y: 560,
      display: 'Loch Cider Works',
      farm: true,
    },
  ],
  merchants: [
    { id: 'kirkwall', bonus: 'vp', vp: 4, spaces: 2, x: 420, y: 30, display: 'Kirkwall' },
    {
      id: 'stromha',
      bonus: 'money',
      money: 5,
      spaces: 3,
      x: 900,
      y: 300,
      display: 'Stromha',
      eraPos: { rail: { x: 900, y: 360 } },
    },
    { id: 'tarbert', bonus: 'develop', spaces: 2, x: 440, y: 760, display: 'Tarbert' },
    { id: 'ullan', bonus: 'income', income: 2, spaces: 2, x: 40, y: 360, display: 'Ullan' },
  ],
  // Canal era: each glen is internally connected; the ONLY crossing is the
  // narrow central pass farmA↔farmB (a portage between the two lochs).
  canalLinks: [
    // West glen.
    ['aberloch', 'braemore'],
    ['aberloch', 'dornie'],
    ['aberloch', 'kirkwall'],
    ['braemore', 'glencairn'],
    ['braemore', 'ullan'],
    ['dornie', 'glencairn'],
    ['glencairn', 'invermay'],
    ['dornie', 'farmA'],
    ['glencairn', 'farmA'],
    ['invermay', 'tarbert'],
    ['invermay', 'ullan'],
    // East glen.
    ['craigholm', 'fettar'],
    ['craigholm', 'haldane'],
    ['craigholm', 'kirkwall'],
    ['fettar', 'haldane'],
    ['fettar', 'stromha'],
    ['haldane', 'kintail'],
    ['haldane', 'farmB'],
    ['kintail', 'lorne'],
    ['lorne', 'stromha'],
    ['lorne', 'tarbert'],
    // The single canal pass between the glens.
    ['farmA', 'farmB'],
  ],
  // Rail era: the watershed is breached — direct cross-glen lines (Glencairn↔
  // Haldane, Invermay↔Kintail, Dornie↔farmB) replace the lone portage, so the
  // network is a single welded mass instead of two near-islands.
  railLinks: [
    ['aberloch', 'braemore'],
    ['aberloch', 'dornie'],
    ['aberloch', 'kirkwall'],
    ['braemore', 'glencairn'],
    ['braemore', 'ullan'],
    ['dornie', 'glencairn'],
    ['glencairn', 'invermay'],
    ['dornie', 'farmA'],
    ['invermay', 'tarbert'],
    ['craigholm', 'fettar'],
    ['craigholm', 'haldane'],
    ['craigholm', 'kirkwall'],
    ['fettar', 'stromha'],
    ['haldane', 'kintail'],
    ['haldane', 'farmB'],
    ['kintail', 'lorne'],
    ['lorne', 'stromha'],
    ['lorne', 'tarbert'],
    // Cross-watershed rail.
    ['glencairn', 'haldane'],
    ['invermay', 'kintail'],
    ['dornie', 'farmB'],
    ['farmA', 'haldane'],
  ],
  islands: {
    canal: [
      {
        id: 'west',
        display: 'West Glen',
        locationIds: ['aberloch', 'braemore', 'dornie', 'glencairn', 'invermay'],
      },
      {
        id: 'east',
        display: 'East Glen',
        locationIds: ['craigholm', 'fettar', 'haldane', 'kintail', 'lorne'],
      },
    ],
    rail: [
      {
        id: 'north',
        display: 'Highland Main Line (North)',
        locationIds: ['aberloch', 'braemore', 'craigholm', 'fettar'],
      },
      {
        id: 'south',
        display: 'Highland Main Line (South)',
        locationIds: ['invermay', 'glencairn', 'kintail', 'lorne'],
      },
    ],
  },
  merchantTiles: STANDARD_MERCHANT_TILES,
  emptyMerchants: { 2: ['stromha'], 3: [], 4: [] },
  spread: {
    coal: [1, 1, 2, 3],
    iron: [1, 4],
    cotton: [1, 2, 3],
    manufacturer: [1, 1, 2, 4],
    pottery: [1, 2, 4],
    juice: [1, 2, 4],
  },
});

// ===========================================================================
// FULL MAP 4 — "Iron Coast" (canal → rail)
// A dense industrial CRESCENT hugging the shoreline: foundries & forges packed
// along a single long arc studded with SIX ports. IRON-HEAVY (fierce iron
// competition). 14 towns + 1 farm, 6 merchants — the biggest, busiest board.
// ===========================================================================
const IRON_COAST = authorMap({
  id: 'ironcoast',
  display: 'Iron Coast',
  desc: 'A crowded shoreline crescent of foundries and forges with six rival ports — iron is king and contested.',
  size: 'large',
  fastPlay: false,
  skin: 'coast',
  recommendedPlayers: [2, 3, 4],
  estPlayMinutes: 100,
  eraOrder: ['canal', 'rail'],
  towns: [
    {
      id: 'portwick',
      band: 'green',
      slots: [['iron', 'coal'], ['manufacturer']],
      x: 130,
      y: 130,
      display: 'Portwick',
    },
    {
      id: 'quarrend',
      band: 'green',
      slots: [['iron'], ['coal']],
      x: 250,
      y: 100,
      display: 'Quarrend',
      eraName: { rail: 'Quarrend Forge' },
    },
    {
      id: 'redhythe',
      band: 'red',
      slots: [['coal', 'iron'], ['cotton']],
      x: 380,
      y: 120,
      display: 'Redhythe',
    },
    {
      id: 'saltmere',
      band: 'yellow',
      slots: [['cotton'], ['manufacturer', 'juice']],
      x: 520,
      y: 150,
      display: 'Saltmere',
    },
    {
      id: 'thornbay',
      band: 'green',
      slots: [['iron', 'manufacturer'], ['pottery']],
      x: 650,
      y: 200,
      display: 'Thornbay',
      eraPos: { rail: { x: 660, y: 220 } },
    },
    {
      id: 'ulverston',
      band: 'red',
      slots: [['iron', 'coal'], ['manufacturer']],
      x: 760,
      y: 290,
      display: 'Ulverston',
      eraName: { rail: 'Ulverston Steelworks' },
    },
    {
      id: 'vellmar',
      band: 'blue',
      slots: [['iron'], ['coal', 'iron']],
      x: 840,
      y: 400,
      display: 'Vellmar',
    },
    {
      id: 'wyreham',
      band: 'yellow',
      slots: [['cotton', 'juice'], ['manufacturer']],
      x: 850,
      y: 510,
      display: 'Wyreham',
    },
    {
      id: 'yarcliff',
      band: 'green',
      slots: [['manufacturer'], ['iron', 'manufacturer']],
      x: 790,
      y: 610,
      display: 'Yarcliff',
      eraPos: { rail: { x: 770, y: 600 } },
    },
    {
      id: 'zelby',
      band: 'red',
      slots: [['coal'], ['iron', 'coal']],
      x: 680,
      y: 680,
      display: 'Zelby',
    },
    {
      id: 'amberton',
      band: 'teal',
      slots: [['cotton', 'manufacturer'], ['pottery']],
      x: 550,
      y: 720,
      display: 'Amberton',
    },
    {
      id: 'brindle',
      band: 'blue',
      slots: [['pottery'], ['cotton']],
      x: 410,
      y: 720,
      display: 'Brindle',
    },
    {
      id: 'calder',
      band: 'green',
      slots: [['manufacturer', 'coal'], ['iron']],
      x: 280,
      y: 660,
      display: 'Calder',
    },
    {
      id: 'denmoor',
      band: 'yellow',
      slots: [['juice'], ['cotton', 'juice']],
      x: 170,
      y: 550,
      display: 'Denmoor',
    },
    {
      id: 'farmA',
      band: 'farm',
      slots: [['juice']],
      x: 470,
      y: 430,
      display: 'Coast Cider Works',
      farm: true,
    },
  ],
  merchants: [
    { id: 'harbour', bonus: 'vp', vp: 4, spaces: 2, x: 60, y: 60, display: 'North Harbour' },
    { id: 'eastdock', bonus: 'money', money: 5, spaces: 2, x: 380, y: 30, display: 'East Dock' },
    {
      id: 'tradeport',
      bonus: 'income',
      income: 2,
      spaces: 2,
      x: 950,
      y: 320,
      display: 'Tradeport',
      eraPos: { rail: { x: 950, y: 380 } },
    },
    { id: 'capemark', bonus: 'vp', vp: 3, spaces: 1, x: 900, y: 640, display: 'Capemark' },
    { id: 'fishgate', bonus: 'develop', spaces: 1, x: 560, y: 800, display: 'Fishgate' },
    { id: 'oldquay', bonus: 'money', money: 4, spaces: 1, x: 60, y: 470, display: 'Old Quay' },
  ],
  // Canal era: a long coastal chain of shipping lanes hugging the crescent,
  // each town also reaching its nearest port.
  canalLinks: [
    ['portwick', 'harbour'],
    ['portwick', 'quarrend'],
    ['quarrend', 'eastdock'],
    ['quarrend', 'redhythe'],
    ['redhythe', 'saltmere'],
    ['saltmere', 'thornbay'],
    ['thornbay', 'ulverston'],
    ['ulverston', 'vellmar'],
    ['ulverston', 'tradeport'],
    ['vellmar', 'wyreham'],
    ['wyreham', 'yarcliff'],
    ['wyreham', 'capemark'],
    ['yarcliff', 'zelby'],
    ['zelby', 'amberton'],
    ['amberton', 'fishgate'],
    ['amberton', 'brindle'],
    ['brindle', 'calder'],
    ['calder', 'denmoor'],
    ['denmoor', 'portwick'],
    ['denmoor', 'oldquay'],
    ['farmA', 'saltmere'],
    ['farmA', 'amberton'],
  ],
  // Rail era: railways cut ACROSS the crescent's mouth — interior chords link
  // the two arms (Redhythe↔Calder, Thornbay↔Amberton, farmA hub spokes) so the
  // long shoreline chain becomes a braced web; a couple of coastal lanes close.
  railLinks: [
    ['portwick', 'harbour'],
    ['portwick', 'quarrend'],
    ['quarrend', 'eastdock'],
    ['quarrend', 'redhythe'],
    ['redhythe', 'saltmere'],
    ['saltmere', 'thornbay'],
    ['thornbay', 'ulverston'],
    ['ulverston', 'vellmar'],
    ['ulverston', 'tradeport'],
    ['vellmar', 'wyreham'],
    ['wyreham', 'yarcliff'],
    ['wyreham', 'capemark'],
    ['yarcliff', 'zelby'],
    ['zelby', 'amberton'],
    ['amberton', 'fishgate'],
    ['brindle', 'calder'],
    ['calder', 'denmoor'],
    ['denmoor', 'oldquay'],
    // Interior cross-crescent chords.
    ['redhythe', 'calder'],
    ['thornbay', 'farmA'],
    ['farmA', 'amberton'],
    ['farmA', 'saltmere'],
    ['farmA', 'brindle'],
    ['portwick', 'calder'],
  ],
  islands: {
    canal: [
      {
        id: 'northarm',
        display: 'The Northern Arm',
        locationIds: ['portwick', 'quarrend', 'redhythe', 'saltmere'],
      },
      {
        id: 'southarm',
        display: 'The Southern Arm',
        locationIds: ['amberton', 'brindle', 'calder', 'denmoor'],
      },
      { id: 'cape', display: 'The Cape', locationIds: ['vellmar', 'wyreham', 'yarcliff'] },
    ],
    rail: [
      {
        id: 'innerbelt',
        display: 'The Inner Belt',
        locationIds: ['redhythe', 'saltmere', 'thornbay', 'calder', 'farmA'],
      },
      {
        id: 'outercape',
        display: 'The Outer Cape',
        locationIds: ['ulverston', 'vellmar', 'wyreham', 'yarcliff', 'zelby'],
      },
    ],
  },
  merchantTiles: STANDARD_MERCHANT_TILES,
  emptyMerchants: { 2: ['capemark', 'fishgate', 'oldquay'], 3: ['fishgate'], 4: [] },
  spread: {
    coal: [1, 1, 2, 4],
    iron: [1, 1, 2, 3],
    cotton: [1, 2, 4],
    manufacturer: [1, 1, 3],
    pottery: [1, 4],
    juice: [1, 2, 4],
  },
});

// ===========================================================================
// FULL MAP 5 — "Skyward Dominion" (canal → rail → AIR)
// A great RING of cities around a central capital hub. Canals trace the ring's
// rim; railways radiate as spokes from the hub; airships then fly long arcs
// across the dominion. Balanced, manufacturer-leaning. 11 towns + 2 farms,
// 5 merchants. The only 3-era map.
// ===========================================================================
const SKYWARD = authorMap({
  id: 'skyward',
  display: 'Skyward Dominion',
  desc: 'A ringed dominion around a capital hub: canals on the rim, railways as spokes, then a sky-network of airships.',
  size: 'large',
  fastPlay: false,
  skin: 'skyward',
  recommendedPlayers: [2, 3, 4],
  estPlayMinutes: 115,
  eraOrder: ['canal', 'rail', 'air'],
  towns: [
    // Central capital hub.
    {
      id: 'aurelia',
      band: 'green',
      slots: [['cotton', 'manufacturer'], ['manufacturer'], ['iron', 'manufacturer']],
      x: 500,
      y: 400,
      display: 'Aurelia',
      eraName: { air: 'Aurelia Skyport' },
    },
    // The ring (clockwise from north).
    {
      id: 'borealis',
      band: 'green',
      slots: [['coal'], ['manufacturer', 'coal']],
      x: 500,
      y: 150,
      display: 'Borealis',
      eraPos: { air: { x: 500, y: 110 } },
    },
    {
      id: 'cirrus',
      band: 'red',
      slots: [['iron'], ['manufacturer']],
      x: 690,
      y: 210,
      display: 'Cirrus',
    },
    {
      id: 'delphi',
      band: 'yellow',
      slots: [['pottery'], ['cotton', 'pottery']],
      x: 810,
      y: 360,
      display: 'Delphi',
      eraPos: { air: { x: 850, y: 330 } },
    },
    {
      id: 'evermist',
      band: 'blue',
      slots: [['manufacturer'], ['cotton', 'juice']],
      x: 800,
      y: 520,
      display: 'Evermist',
    },
    {
      id: 'fjordane',
      band: 'red',
      slots: [['cotton'], ['juice']],
      x: 660,
      y: 640,
      display: 'Fjordane',
      eraName: { air: 'Fjordane Aerie' },
    },
    {
      id: 'gallowin',
      band: 'yellow',
      slots: [['juice'], ['cotton', 'juice']],
      x: 500,
      y: 680,
      display: 'Gallowin',
      eraPos: { air: { x: 500, y: 720 } },
    },
    {
      id: 'highspire',
      band: 'green',
      slots: [['manufacturer', 'coal'], ['pottery']],
      x: 320,
      y: 640,
      display: 'Highspire',
    },
    {
      id: 'icarion',
      band: 'blue',
      slots: [['coal'], ['iron', 'coal']],
      x: 190,
      y: 500,
      display: 'Icarion',
    },
    {
      id: 'jovica',
      band: 'teal',
      slots: [['iron', 'manufacturer'], ['manufacturer']],
      x: 190,
      y: 320,
      display: 'Jovica',
    },
    {
      id: 'kestrel',
      band: 'red',
      slots: [['pottery'], ['cotton']],
      x: 320,
      y: 190,
      display: 'Kestrel',
      eraPos: { air: { x: 300, y: 160 } },
    },
    {
      id: 'farmA',
      band: 'farm',
      slots: [['juice']],
      x: 380,
      y: 410,
      display: 'Sky Cider Works',
      farm: true,
    },
    {
      id: 'farmB',
      band: 'farm',
      slots: [['juice']],
      x: 620,
      y: 410,
      display: 'Cloud Cider Works',
      farm: true,
    },
  ],
  merchants: [
    { id: 'zenith', bonus: 'vp', vp: 4, spaces: 2, x: 500, y: 30, display: 'Zenith' },
    { id: 'meridian', bonus: 'money', money: 5, spaces: 2, x: 950, y: 400, display: 'Meridian' },
    { id: 'nadir', bonus: 'develop', spaces: 2, x: 500, y: 790, display: 'Nadir' },
    {
      id: 'aether',
      bonus: 'income',
      income: 2,
      spaces: 2,
      x: 40,
      y: 400,
      display: 'Aether',
      eraPos: { air: { x: 40, y: 300 } },
    },
    { id: 'solstice', bonus: 'vp', vp: 3, spaces: 1, x: 900, y: 660, display: 'Solstice' },
  ],
  // Canal era: the ring's rim (adjacent cities) + each quadrant reaching a
  // rim merchant. The hub Aurelia is reached only via the farm portages.
  canalLinks: [
    ['borealis', 'cirrus'],
    ['cirrus', 'delphi'],
    ['delphi', 'evermist'],
    ['evermist', 'fjordane'],
    ['fjordane', 'gallowin'],
    ['gallowin', 'highspire'],
    ['highspire', 'icarion'],
    ['icarion', 'jovica'],
    ['jovica', 'kestrel'],
    ['kestrel', 'borealis'],
    ['borealis', 'zenith'],
    ['delphi', 'meridian'],
    ['evermist', 'meridian'],
    ['gallowin', 'nadir'],
    ['icarion', 'aether'],
    ['fjordane', 'solstice'],
    ['kestrel', 'farmA'],
    ['highspire', 'farmA'],
    ['cirrus', 'farmB'],
    ['evermist', 'farmB'],
    ['aurelia', 'farmA'],
    ['aurelia', 'farmB'],
  ],
  // Rail era: railways radiate as SPOKES from the capital hub Aurelia to every
  // rim city; the rim itself keeps only a few arcs. A totally different shape.
  railLinks: [
    ['aurelia', 'borealis'],
    ['aurelia', 'cirrus'],
    ['aurelia', 'delphi'],
    ['aurelia', 'evermist'],
    ['aurelia', 'fjordane'],
    ['aurelia', 'gallowin'],
    ['aurelia', 'highspire'],
    ['aurelia', 'icarion'],
    ['aurelia', 'jovica'],
    ['aurelia', 'kestrel'],
    ['aurelia', 'farmA'],
    ['aurelia', 'farmB'],
    ['borealis', 'zenith'],
    ['delphi', 'meridian'],
    ['gallowin', 'nadir'],
    ['icarion', 'aether'],
    ['fjordane', 'solstice'],
    ['evermist', 'meridian'],
    ['borealis', 'kestrel'],
    ['gallowin', 'highspire'],
  ],
  // Air era: long airship arcs leap across the dominion (hub to far rim and
  // chord flights), ignoring the rim entirely — the sparsest, longest-reach net.
  airLinks: [
    ['aurelia', 'borealis'],
    ['aurelia', 'evermist'],
    ['aurelia', 'highspire'],
    ['aurelia', 'delphi'],
    ['aurelia', 'icarion'],
    ['borealis', 'gallowin'],
    ['cirrus', 'fjordane'],
    ['kestrel', 'evermist'],
    ['jovica', 'delphi'],
    ['borealis', 'zenith'],
    ['delphi', 'meridian'],
    ['gallowin', 'nadir'],
    ['icarion', 'aether'],
    ['fjordane', 'solstice'],
    ['aurelia', 'farmA'],
    ['aurelia', 'farmB'],
    ['cirrus', 'farmB'],
    ['highspire', 'farmA'],
  ],
  islands: {
    canal: [
      { id: 'crown', display: 'The Crown Marches', locationIds: ['borealis', 'cirrus', 'kestrel'] },
      { id: 'fen', display: 'The Lower Fens', locationIds: ['fjordane', 'gallowin', 'highspire'] },
    ],
    rail: [
      { id: 'crown', display: 'Upper Dominion', locationIds: ['borealis', 'cirrus', 'delphi'] },
      { id: 'fen', display: 'Lower Dominion', locationIds: ['icarion', 'jovica', 'kestrel'] },
    ],
    air: [
      { id: 'crown', display: 'Sky Sovereignty', locationIds: ['aurelia', 'borealis', 'gallowin'] },
      { id: 'fen', display: 'Cloud Reaches', locationIds: ['delphi', 'evermist', 'highspire'] },
    ],
  },
  merchantTiles: STANDARD_MERCHANT_TILES,
  emptyMerchants: { 2: ['meridian', 'solstice'], 3: ['solstice'], 4: [] },
  spread: {
    coal: [1, 1, 2],
    iron: [1, 1, 2, 4],
    cotton: [1, 1, 2, 3],
    manufacturer: [1, 1, 2, 3],
    pottery: [1, 2, 4],
    juice: [1, 1, 2, 4],
  },
});

export const FULL_MAPS_AUTHORED: MapDefinition[] = [
  SEVERN_VALE,
  HIGHLAND_REACH,
  IRON_COAST,
  SKYWARD,
];

// ===========================================================================
// FAST-PLAY MAPS (5) — each a DIFFERENT small shape (ring / chain / star /
// twin-cluster / grid), different town count and merchant mix. Quick decks.
// ===========================================================================

const FAST_SPREAD_BASE: Partial<Record<IndustryType, (1 | 2 | 3 | 4)[]>> = {
  coal: [1, 1, 3],
  iron: [1, 2, 4],
  cotton: [1, 1, 2, 3],
  manufacturer: [1, 1, 2, 3],
  pottery: [1, 2, 4],
  juice: [1, 1, 4],
};

interface FastMapInput {
  id: string;
  display: string;
  desc: string;
  skin: string;
  towns: TownInput[];
  merchants: MerchInput[];
  canalLinks: [string, string][];
  railLinks: [string, string][];
  islands?: { canal?: IslandGroup[]; rail?: IslandGroup[] };
  emptyMerchants: Record<number, string[]>;
  spread?: Partial<Record<IndustryType, (1 | 2 | 3 | 4)[]>>;
  locationCardsPerTown?: number;
}

function fastMap(input: FastMapInput): MapDefinition {
  return authorMap({
    id: input.id,
    display: input.display,
    desc: input.desc,
    size: 'small',
    fastPlay: true,
    skin: input.skin,
    recommendedPlayers: [2, 3],
    estPlayMinutes: 35,
    eraOrder: ['canal', 'rail'],
    towns: input.towns,
    merchants: input.merchants,
    canalLinks: input.canalLinks,
    railLinks: input.railLinks,
    ...(input.islands ? { islands: input.islands } : {}),
    merchantTiles: FAST_MERCHANT_TILES,
    emptyMerchants: input.emptyMerchants,
    spread: input.spread ?? FAST_SPREAD_BASE,
    locationCardsPerTown: input.locationCardsPerTown ?? 3,
  });
}

// FAST 1 — "Quill Hollow": a 6-town RING with two markets at the poles.
const QUILL = fastMap({
  id: 'quill',
  display: 'Quill Hollow',
  desc: 'A snug ring of six hollow towns with markets at the poles — race around the loop.',
  skin: 'hollow',
  towns: [
    {
      id: 'q1',
      band: 'green',
      slots: [['cotton', 'manufacturer'], ['coal']],
      x: 500,
      y: 120,
      display: 'Quillford',
    },
    {
      id: 'q2',
      band: 'green',
      slots: [['iron', 'coal'], ['manufacturer']],
      x: 720,
      y: 250,
      display: 'Hollowby',
      eraPos: { rail: { x: 700, y: 270 } },
    },
    {
      id: 'q3',
      band: 'red',
      slots: [['pottery'], ['cotton', 'juice']],
      x: 720,
      y: 470,
      display: 'Mossvale',
    },
    {
      id: 'q4',
      band: 'yellow',
      slots: [['manufacturer', 'coal'], ['juice']],
      x: 500,
      y: 600,
      display: 'Penn',
      eraName: { rail: 'Penn Halt' },
    },
    { id: 'q5', band: 'green', slots: [['cotton'], ['iron']], x: 280, y: 470, display: 'Rookley' },
    {
      id: 'q6',
      band: 'red',
      slots: [['pottery'], ['manufacturer']],
      x: 280,
      y: 250,
      display: 'Sedgely',
      eraPos: { rail: { x: 300, y: 270 } },
    },
    {
      id: 'qf',
      band: 'farm',
      slots: [['juice']],
      x: 500,
      y: 360,
      display: 'Hollow Cider Works',
      farm: true,
    },
  ],
  merchants: [
    { id: 'qm1', bonus: 'income', income: 2, spaces: 2, x: 500, y: 30, display: 'Greenmarket' },
    { id: 'qm2', bonus: 'vp', vp: 4, spaces: 2, x: 500, y: 700, display: 'Southmarket' },
  ],
  // Canal: the pure ring + a spur to each market.
  canalLinks: [
    ['q1', 'q2'],
    ['q2', 'q3'],
    ['q3', 'q4'],
    ['q4', 'q5'],
    ['q5', 'q6'],
    ['q6', 'q1'],
    ['q1', 'qm1'],
    ['q4', 'qm2'],
    ['q3', 'qf'],
    ['q5', 'qf'],
  ],
  // Rail: spokes across the hollow via the central works, plus a market each.
  railLinks: [
    ['q1', 'qf'],
    ['q2', 'qf'],
    ['q3', 'qf'],
    ['q4', 'qf'],
    ['q5', 'qf'],
    ['q6', 'qf'],
    ['q1', 'qm1'],
    ['q2', 'qm1'],
    ['q4', 'qm2'],
    ['q5', 'qm2'],
  ],
  islands: {
    canal: [
      { id: 'rim', display: 'The Hollow Rim', locationIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] },
    ],
    rail: [
      { id: 'spokes', display: 'The Spokes', locationIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] },
    ],
  },
  emptyMerchants: { 2: [], 3: [], 4: [] },
});

// FAST 2 — "Tin Brook": a 7-town linear CHAIN along a stream, iron-hungry.
const TIN = fastMap({
  id: 'tin',
  display: 'Tin Brook',
  desc: 'Seven foundry villages strung along a single brook — a tug-of-war line for iron.',
  skin: 'brook',
  towns: [
    {
      id: 't1',
      band: 'green',
      slots: [['cotton', 'manufacturer'], ['iron']],
      x: 120,
      y: 200,
      display: 'Tinbrook',
    },
    {
      id: 't2',
      band: 'red',
      slots: [['coal'], ['iron', 'coal']],
      x: 260,
      y: 300,
      display: 'Smeltby',
    },
    {
      id: 't3',
      band: 'green',
      slots: [['pottery'], ['cotton']],
      x: 400,
      y: 230,
      display: 'Claymoor',
      eraPos: { rail: { x: 400, y: 260 } },
    },
    {
      id: 't4',
      band: 'yellow',
      slots: [['iron', 'coal'], ['manufacturer']],
      x: 540,
      y: 330,
      display: 'Forgeham',
      eraName: { rail: 'Forgeham Foundry' },
    },
    {
      id: 't5',
      band: 'red',
      slots: [['manufacturer', 'coal'], ['pottery']],
      x: 680,
      y: 250,
      display: 'Kilnwick',
    },
    {
      id: 't6',
      band: 'green',
      slots: [['cotton', 'juice'], ['manufacturer']],
      x: 820,
      y: 360,
      display: 'Weldon',
    },
    { id: 't7', band: 'blue', slots: [['iron'], ['cotton']], x: 720, y: 520, display: 'Brassgate' },
    {
      id: 'tf',
      band: 'farm',
      slots: [['juice']],
      x: 300,
      y: 500,
      display: 'Brook Cider Works',
      farm: true,
    },
  ],
  merchants: [
    { id: 'tm1', bonus: 'money', money: 5, spaces: 2, x: 60, y: 110, display: 'Brookgate' },
    { id: 'tm2', bonus: 'develop', spaces: 2, x: 860, y: 520, display: 'Millgate' },
  ],
  // Canal: a single chain with the farm + a market at each end.
  canalLinks: [
    ['tm1', 't1'],
    ['t1', 't2'],
    ['t2', 't3'],
    ['t3', 't4'],
    ['t4', 't5'],
    ['t5', 't6'],
    ['t6', 't7'],
    ['t7', 'tm2'],
    ['t2', 'tf'],
    ['t4', 'tf'],
  ],
  // Rail: shortcuts fold the chain — branch lines skip towns and add a loop.
  railLinks: [
    ['tm1', 't1'],
    ['t1', 't2'],
    ['t2', 't3'],
    ['t3', 't4'],
    ['t4', 't5'],
    ['t5', 't6'],
    ['t6', 't7'],
    ['t7', 'tm2'],
    ['t2', 'tf'],
    ['t1', 't3'],
    ['t4', 't7'],
    ['t5', 't7'],
    ['tf', 't4'],
  ],
  islands: {
    canal: [{ id: 'brook', display: 'Upper Brook', locationIds: ['t1', 't2', 't3'] }],
    rail: [{ id: 'brook', display: 'The Brookline', locationIds: ['t1', 't2', 't3', 't4'] }],
  },
  emptyMerchants: { 2: [], 3: [], 4: [] },
  spread: {
    coal: [1, 1, 3],
    iron: [1, 1, 4],
    cotton: [1, 2, 3],
    manufacturer: [1, 2, 3],
    pottery: [1, 4],
    juice: [1, 4],
  },
});

// FAST 3 — "Maple Cross": a 5-town STAR around a central crossroads, with
// THREE small markets. Beginner-friendly and balanced.
const MAPLE = fastMap({
  id: 'maple',
  display: 'Maple Cross',
  desc: 'A central crossroads town spoked to four neighbours, ringed by three little markets.',
  skin: 'maple',
  towns: [
    {
      id: 'm1',
      band: 'green',
      slots: [['cotton', 'manufacturer'], ['manufacturer'], ['pottery']],
      x: 500,
      y: 380,
      display: 'Maple Cross',
      eraName: { rail: 'Maple Junction' },
    },
    { id: 'm2', band: 'green', slots: [['coal'], ['iron']], x: 500, y: 160, display: 'Oakdale' },
    {
      id: 'm3',
      band: 'red',
      slots: [['manufacturer'], ['cotton', 'juice']],
      x: 760,
      y: 380,
      display: 'Birchwood',
    },
    {
      id: 'm4',
      band: 'yellow',
      slots: [['iron', 'coal'], ['manufacturer']],
      x: 500,
      y: 600,
      display: 'Elmgrove',
      eraPos: { rail: { x: 480, y: 600 } },
    },
    {
      id: 'm5',
      band: 'green',
      slots: [['pottery'], ['cotton']],
      x: 240,
      y: 380,
      display: 'Aspenford',
    },
    {
      id: 'mf',
      band: 'farm',
      slots: [['juice']],
      x: 330,
      y: 540,
      display: 'Maple Cider Works',
      farm: true,
    },
  ],
  merchants: [
    { id: 'mm1', bonus: 'vp', vp: 3, spaces: 2, x: 500, y: 40, display: 'Crossmarket' },
    { id: 'mm2', bonus: 'income', income: 2, spaces: 1, x: 860, y: 200, display: 'Greenway' },
    { id: 'mm3', bonus: 'develop', spaces: 1, x: 140, y: 560, display: 'Fairgate' },
  ],
  // Canal: pure star from the central crossroads + market spurs.
  canalLinks: [
    ['m1', 'm2'],
    ['m1', 'm3'],
    ['m1', 'm4'],
    ['m1', 'm5'],
    ['m2', 'mm1'],
    ['m3', 'mm2'],
    ['m5', 'mm3'],
    ['m4', 'mf'],
    ['m5', 'mf'],
  ],
  // Rail: the outer towns interconnect into a ring (the hub is bypassable).
  railLinks: [
    ['m1', 'm2'],
    ['m1', 'm4'],
    ['m2', 'm3'],
    ['m3', 'm4'],
    ['m4', 'm5'],
    ['m5', 'm2'],
    ['m2', 'mm1'],
    ['m3', 'mm2'],
    ['m5', 'mm3'],
    ['m4', 'mf'],
    ['m1', 'mf'],
  ],
  islands: {
    canal: [
      { id: 'cross', display: 'The Crossroads', locationIds: ['m1', 'm2', 'm3', 'm4', 'm5'] },
    ],
    rail: [{ id: 'ring', display: 'The Maple Ring', locationIds: ['m2', 'm3', 'm4', 'm5'] }],
  },
  emptyMerchants: { 2: ['mm2'], 3: [], 4: [] },
  locationCardsPerTown: 4,
  spread: {
    coal: [1, 3],
    iron: [1, 2, 4],
    cotton: [1, 1, 2, 3],
    manufacturer: [1, 1, 2, 3],
    pottery: [1, 2, 4],
    juice: [1, 1, 4],
  },
});

// FAST 4 — "Slate Pike": a 6-town TWIN-CLUSTER (two mining camps joined by a
// single mountain pass), resource-tight.
const SLATE = fastMap({
  id: 'slate',
  display: 'Slate Pike',
  desc: 'Two mountain mining camps linked by one narrow pass — sharp and resource-tight.',
  skin: 'slate',
  towns: [
    // Upper camp.
    {
      id: 's1',
      band: 'green',
      slots: [['cotton', 'manufacturer'], ['coal']],
      x: 260,
      y: 150,
      display: 'Slatepike',
    },
    {
      id: 's2',
      band: 'red',
      slots: [['iron', 'coal'], ['pottery']],
      x: 160,
      y: 320,
      display: 'Greyfell',
    },
    {
      id: 's3',
      band: 'green',
      slots: [['manufacturer'], ['cotton']],
      x: 340,
      y: 330,
      display: 'Shalecombe',
      eraPos: { rail: { x: 360, y: 350 } },
    },
    // Lower camp.
    {
      id: 's4',
      band: 'yellow',
      slots: [['coal'], ['iron']],
      x: 660,
      y: 330,
      display: 'Flintmoor',
      eraName: { rail: 'Flintmoor Adit' },
    },
    {
      id: 's5',
      band: 'green',
      slots: [['cotton', 'juice'], ['manufacturer']],
      x: 840,
      y: 320,
      display: 'Cragend',
    },
    {
      id: 's6',
      band: 'red',
      slots: [['pottery'], ['manufacturer', 'coal']],
      x: 740,
      y: 500,
      display: 'Talgarth',
    },
    {
      id: 'sf',
      band: 'farm',
      slots: [['juice']],
      x: 500,
      y: 470,
      display: 'Pike Cider Works',
      farm: true,
    },
  ],
  merchants: [
    { id: 'sm1', bonus: 'develop', spaces: 2, x: 260, y: 30, display: 'Pikegate' },
    { id: 'sm2', bonus: 'money', money: 5, spaces: 2, x: 760, y: 620, display: 'Valgate' },
  ],
  // Canal: each camp internally linked; ONE pass (s3↔sf↔s4) joins them.
  canalLinks: [
    ['s1', 's2'],
    ['s1', 's3'],
    ['s2', 's3'],
    ['s1', 'sm1'],
    ['s3', 'sf'],
    ['sf', 's4'],
    ['s4', 's5'],
    ['s4', 's6'],
    ['s5', 's6'],
    ['s6', 'sm2'],
  ],
  // Rail: a second pass opens (s2↔s4 tunnel) and the camps cross-link directly.
  railLinks: [
    ['s1', 's2'],
    ['s1', 's3'],
    ['s2', 's3'],
    ['s1', 'sm1'],
    ['s3', 's4'],
    ['s2', 's4'],
    ['s4', 's5'],
    ['s4', 's6'],
    ['s5', 's6'],
    ['s6', 'sm2'],
    ['s3', 'sf'],
    ['s6', 'sf'],
  ],
  islands: {
    canal: [
      { id: 'upper', display: 'Upper Camp', locationIds: ['s1', 's2', 's3'] },
      { id: 'lower', display: 'Lower Camp', locationIds: ['s4', 's5', 's6'] },
    ],
    rail: [
      {
        id: 'pike',
        display: 'Pike Consolidated',
        locationIds: ['s1', 's2', 's3', 's4', 's5', 's6'],
      },
    ],
  },
  emptyMerchants: { 2: [], 3: [], 4: [] },
  spread: {
    coal: [1, 1, 3],
    iron: [1, 1, 4],
    cotton: [1, 1, 2, 3],
    manufacturer: [1, 2, 3],
    pottery: [1, 2, 4],
    juice: [1, 2, 4],
  },
});

// FAST 5 — "Amber Fen": an 8-town GRID of marshland weavers & potters (the
// busiest fast map), cotton/pottery-leaning.
const AMBER = fastMap({
  id: 'amber',
  display: 'Amber Fen',
  desc: 'A low marshland grid of weavers and potters — the busiest quick board.',
  skin: 'fen',
  towns: [
    {
      id: 'a1',
      band: 'green',
      slots: [['cotton', 'manufacturer'], ['juice']],
      x: 280,
      y: 160,
      display: 'Amberfen',
    },
    { id: 'a2', band: 'green', slots: [['coal'], ['iron']], x: 520, y: 160, display: 'Reedham' },
    {
      id: 'a3',
      band: 'red',
      slots: [['pottery'], ['cotton']],
      x: 760,
      y: 160,
      display: 'Sedgemoor',
      eraPos: { rail: { x: 740, y: 180 } },
    },
    {
      id: 'a4',
      band: 'yellow',
      slots: [['iron', 'coal'], ['manufacturer']],
      x: 280,
      y: 380,
      display: 'Mirewick',
    },
    {
      id: 'a5',
      band: 'green',
      slots: [['manufacturer'], ['pottery']],
      x: 520,
      y: 380,
      display: 'Fenwell',
      eraName: { rail: 'Fenwell Wharf' },
    },
    {
      id: 'a6',
      band: 'red',
      slots: [['cotton'], ['cotton', 'juice']],
      x: 760,
      y: 380,
      display: 'Boglea',
    },
    {
      id: 'a7',
      band: 'blue',
      slots: [['pottery'], ['manufacturer']],
      x: 400,
      y: 580,
      display: 'Tarnwick',
    },
    {
      id: 'a8',
      band: 'green',
      slots: [['cotton', 'juice'], ['manufacturer']],
      x: 640,
      y: 580,
      display: 'Willowmere',
    },
    {
      id: 'af',
      band: 'farm',
      slots: [['juice']],
      x: 160,
      y: 540,
      display: 'Fen Cider Works',
      farm: true,
    },
  ],
  merchants: [
    { id: 'am1', bonus: 'income', income: 2, spaces: 2, x: 520, y: 30, display: 'Fengate' },
    { id: 'am2', bonus: 'vp', vp: 4, spaces: 2, x: 520, y: 700, display: 'Marshgate' },
  ],
  // Canal: a grid of dykes (rows + columns).
  canalLinks: [
    ['a1', 'a2'],
    ['a2', 'a3'],
    ['a4', 'a5'],
    ['a5', 'a6'],
    ['a1', 'a4'],
    ['a2', 'a5'],
    ['a3', 'a6'],
    ['a4', 'a7'],
    ['a6', 'a8'],
    ['a7', 'a8'],
    ['a2', 'am1'],
    ['a8', 'am2'],
    ['a4', 'af'],
  ],
  // Rail: the diagonals open up (cross-fen embankments) and a couple of dykes
  // silt up — a visibly different mesh.
  railLinks: [
    ['a1', 'a2'],
    ['a2', 'a3'],
    ['a4', 'a5'],
    ['a5', 'a6'],
    ['a1', 'a4'],
    ['a3', 'a6'],
    ['a7', 'a8'],
    ['a1', 'a5'],
    ['a5', 'a3'],
    ['a4', 'a8'],
    ['a5', 'a7'],
    ['a6', 'a8'],
    ['a2', 'am1'],
    ['a8', 'am2'],
    ['a5', 'af'],
  ],
  islands: {
    canal: [
      { id: 'north', display: 'North Fen', locationIds: ['a1', 'a2', 'a3'] },
      { id: 'south', display: 'South Fen', locationIds: ['a7', 'a8'] },
    ],
    rail: [
      { id: 'north', display: 'The Embankment', locationIds: ['a1', 'a2', 'a3', 'a5'] },
      { id: 'south', display: 'The Causeway', locationIds: ['a6', 'a7', 'a8'] },
    ],
  },
  emptyMerchants: { 2: [], 3: [], 4: [] },
  spread: {
    coal: [1, 3],
    iron: [1, 4],
    cotton: [1, 1, 2, 3],
    manufacturer: [1, 1, 2, 3],
    pottery: [1, 1, 4],
    juice: [1, 2, 4],
  },
});

export const FAST_MAPS_AUTHORED: MapDefinition[] = [QUILL, TIN, MAPLE, SLATE, AMBER];
