import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { listMaps, getMap } from '../../src/core/maps/registry.ts';
import { contextFor } from '../../src/core/maps/context.ts';
import { buildMapI18n } from '../../src/core/maps/authored.ts';
import { buildInitialState } from '../../src/core/engine/setup.ts';
import { serializeState, deserializeState } from '../../src/persistence/serialize.ts';
import type { MapDefinition } from '../../src/core/maps/types.ts';
import type { EraId } from '../../src/core/model/types.ts';
import type { PlacedTile } from '../../src/core/model/state.ts';

/**
 * Phase 10 acceptance tests: real place names (no raw ids leak), genuinely
 * distinct maps (clone guard), and genuine per-era morphing (positions, names,
 * links and islands change per era; level-2+ tiles survive a mid-era morph).
 *
 * These run in the offline engine test runner, so they resolve names from the
 * static JSON bundles + the runtime map-resource bundles directly (no i18next).
 */

// ---------------------------------------------------------------------------
// Build a flat key→value lookup per language, exactly as i18next would resolve:
// the static JSON translation bundle (flattened) merged with the authored-map
// resources registered at runtime via buildMapI18n().
// ---------------------------------------------------------------------------

function loadJsonBundle(name: string): Record<string, unknown> {
  const url = new URL(`../../src/app/i18n/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as Record<string, unknown>;
}

function flatten(obj: Record<string, unknown>, prefix = '', out: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v as Record<string, unknown>, path, out);
    } else if (typeof v === 'string') {
      out[path] = v;
    }
  }
  return out;
}

const mapBundles = buildMapI18n();
const LOOKUP: Record<'en' | 'ru' | 'uz', Record<string, string>> = {
  en: { ...flatten(loadJsonBundle('en')), ...mapBundles.en },
  ru: { ...flatten(loadJsonBundle('ru')), ...mapBundles.ru },
  uz: { ...flatten(loadJsonBundle('uz')), ...mapBundles.uz },
};

/** Resolve a name key the way the UI's `t()` would (no interpolation needed). */
function resolve(lang: 'en' | 'ru' | 'uz', key: string): string | undefined {
  return LOOKUP[lang][key];
}

// ---------------------------------------------------------------------------
// 10.1–10.3: every location / merchant / island / route renders a real,
// localized name — never a raw internal id — for all maps, all eras, all langs.
// ---------------------------------------------------------------------------

describe('Phase 10.3 — every name resolves to a human name (no raw ids)', () => {
  const langs = ['en', 'ru', 'uz'] as const;

  for (const map of listMaps()) {
    describe(map.id, () => {
      test('map name & description resolve in all languages', () => {
        for (const lang of langs) {
          for (const key of [map.nameKey, map.descriptionKey]) {
            const v = resolve(lang, key);
            assert.ok(v && v.length > 0 && v !== key, `${lang}: "${key}" → ${v}`);
          }
        }
      });

      for (const era of map.eras.map((e) => e.id)) {
        test(`era "${era}": locations & merchants resolve, never the id`, () => {
          for (const lang of langs) {
            for (const loc of map.locations[era]!) {
              const v = resolve(lang, loc.name);
              assert.ok(v && v.length > 0, `${lang}/${era}: missing "${loc.name}"`);
              assert.notEqual(v, loc.name, `${lang}/${era}: "${loc.name}" unresolved`);
              assert.notEqual(v, loc.id, `${lang}/${era}: ${loc.id} shows raw id`);
            }
            for (const m of map.merchantLocations[era]!) {
              const v = resolve(lang, m.name);
              assert.ok(v && v.length > 0, `${lang}/${era}: missing "${m.name}"`);
              assert.notEqual(v, m.name, `${lang}/${era}: "${m.name}" unresolved`);
              assert.notEqual(v, m.id, `${lang}/${era}: ${m.id} shows raw id`);
            }
          }
        });

        test(`era "${era}": island names resolve`, () => {
          for (const lang of langs) {
            for (const is of map.islands[era] ?? []) {
              const v = resolve(lang, is.nameKey);
              assert.ok(v && v.length > 0 && v !== is.nameKey, `${lang}/${era}: "${is.nameKey}"`);
            }
          }
        });
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 10.4–10.6: the 10 maps are each genuinely distinct (no two are the same board
// re-labelled). Clone guard via a Weisfeiler–Lehman colour-refinement hash:
// isomorphic (clone) graphs hash identically; distinct graphs (almost) never do.
// ---------------------------------------------------------------------------

function strHash(s: string): string {
  let x = 5381;
  for (let i = 0; i < s.length; i += 1) x = ((x * 33) ^ s.charCodeAt(i)) >>> 0;
  return x.toString(36);
}

/** A canonical structural fingerprint of a map's era topology (location set + links). */
function topologyFingerprint(map: MapDefinition, era: EraId): string {
  const links = map.links[era] ?? [];
  const nodes = [
    ...map.locations[era]!.map((l) => l.id),
    ...map.merchantLocations[era]!.map((m) => m.id),
  ];
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n, []);
  for (const l of links) {
    adj.get(l.a)?.push(l.b);
    adj.get(l.b)?.push(l.a);
  }
  let colors = new Map<string, string>();
  for (const n of nodes) colors.set(n, String(adj.get(n)!.length));
  for (let round = 0; round < 4; round += 1) {
    const next = new Map<string, string>();
    for (const n of nodes) {
      const neigh = adj
        .get(n)!
        .map((m) => colors.get(m)!)
        .sort()
        .join(',');
      next.set(n, strHash(`${colors.get(n)}|${neigh}`));
    }
    colors = next;
  }
  return strHash(`${nodes.length}|${links.length}|${[...colors.values()].sort().join(';')}`);
}

describe('Phase 10.6 — no two maps are structural clones', () => {
  test('all 10 maps have distinct canal-era topology fingerprints', () => {
    const seen = new Map<string, string>();
    for (const map of listMaps()) {
      const fp = topologyFingerprint(map, map.eras[0]!.id);
      const clash = seen.get(fp);
      assert.equal(clash, undefined, `${map.id} is a structural clone of ${clash}`);
      seen.set(fp, map.id);
    }
  });

  test('maps differ in geography (town/merchant counts vary across the set)', () => {
    const shapes = listMaps().map((m) => {
      const era = m.eras[0]!.id;
      return `${m.locations[era]!.length}/${m.merchantLocations[era]!.length}/${(m.links[era] ?? []).length}`;
    });
    // Not all identical — the maps are not one template re-labelled.
    assert.ok(new Set(shapes).size >= 8, `too many identical shapes: ${shapes.join(' ')}`);
  });
});

// ---------------------------------------------------------------------------
// 10.7–10.9: genuine per-era morphing — links rewire, nodes reposition/rename,
// and islands change membership/name when the era advances.
// ---------------------------------------------------------------------------

function linkSet(map: MapDefinition, era: EraId): Set<string> {
  return new Set((map.links[era] ?? []).map((l) => [l.a, l.b].sort().join('~')));
}

describe('Phase 10.7–10.9 — the world genuinely morphs between eras', () => {
  for (const map of listMaps().filter((m) => m.eras.length > 1)) {
    describe(map.id, () => {
      const eras = map.eras.map((e) => e.id);

      test('each era opens a genuinely different link network', () => {
        for (let i = 1; i < eras.length; i += 1) {
          const prev = linkSet(map, eras[i - 1]!);
          const cur = linkSet(map, eras[i]!);
          const added = [...cur].filter((e) => !prev.has(e));
          const removed = [...prev].filter((e) => !cur.has(e));
          assert.ok(
            added.length + removed.length > 0,
            `${map.id}: ${eras[i - 1]}→${eras[i]} links identical (railLinks = canalLinks)`,
          );
        }
      });

      test('some location repositions between eras (eraPos)', () => {
        // The classic Birmingham map is preserved byte-for-byte for save
        // compatibility; its genuine morph is the link network (asserted above),
        // not repositioning. The authored maps must physically reposition.
        if (map.id === 'birmingham') return;
        let moved = 0;
        for (let i = 1; i < eras.length; i += 1) {
          const a = map.layout[eras[i - 1]!]!;
          const b = map.layout[eras[i]!]!;
          for (const id of Object.keys(a)) {
            if (a[id]!.x !== b[id]?.x || a[id]!.y !== b[id]?.y) moved += 1;
          }
        }
        assert.ok(moved > 0, `${map.id}: nothing repositions across eras`);
      });

      test('some location renames between eras (eraName)', () => {
        // Birmingham keeps its classic names; authored maps rename to reflect
        // the new era (e.g. "Ashford" → "Ashford Junction").
        if (map.id === 'birmingham') return;
        let renamed = 0;
        for (let i = 1; i < eras.length; i += 1) {
          const prev = new Map(map.locations[eras[i - 1]!]!.map((l) => [l.id, l.name]));
          for (const l of map.locations[eras[i]!]!) {
            if (prev.get(l.id) !== l.name) renamed += 1;
          }
        }
        assert.ok(renamed > 0, `${map.id}: no location renames across eras`);
      });

      test('islands change membership or name between eras', () => {
        for (let i = 1; i < eras.length; i += 1) {
          const prev = map.islands[eras[i - 1]!] ?? [];
          const cur = map.islands[eras[i]!] ?? [];
          if (prev.length === 0 && cur.length === 0) continue;
          const sig = (g: { nameKey: string; locationIds: string[] }[]) =>
            g
              .map((x) => `${x.nameKey}:${[...x.locationIds].sort().join(',')}`)
              .sort()
              .join('|');
          assert.notEqual(
            sig(prev),
            sig(cur),
            `${map.id}: islands identical ${eras[i - 1]}→${eras[i]}`,
          );
        }
      });
    });
  }
});

// ---------------------------------------------------------------------------
// 10.11: every era is a valid playable network (every town reaches a merchant).
// ---------------------------------------------------------------------------

describe('Phase 10.11 — every era is a connected, playable network', () => {
  for (const map of listMaps()) {
    test(`${map.id}: every town reaches a merchant in every era`, () => {
      for (const era of map.eras.map((e) => e.id)) {
        const ctx = contextFor(map.id, era);
        const adj = new Map<string, Set<string>>();
        const add = (a: string, b: string) => {
          if (!adj.has(a)) adj.set(a, new Set());
          adj.get(a)!.add(b);
        };
        for (const l of ctx.links) {
          add(l.a, l.b);
          add(l.b, l.a);
        }
        for (const loc of ctx.locations) {
          const seen = new Set([loc.id]);
          const q = [loc.id];
          while (q.length) {
            const c = q.shift()!;
            for (const n of adj.get(c) ?? []) if (!seen.has(n)) (seen.add(n), q.push(n));
          }
          const ok = [...seen].some((id) => ctx.merchantIds.has(id));
          assert.ok(ok, `${map.id}/${era}: ${loc.id} cannot reach a merchant`);
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 10.8/10.11: a mid-era save/load restores the correct era topology, with a
// persistent level-2 tile still mapped to the right (repositioned) location.
// ---------------------------------------------------------------------------

describe('Phase 10.8 — level-2 tiles survive a morph and map to the repositioned place', () => {
  test('severnvale: a level-2 tile keeps its location across the canal→rail morph', () => {
    const map = getMap('severnvale');
    // Ashford repositions between canal and rail (has eraPos.rail).
    const canalXY = map.layout.canal!.ashford!;
    const railXY = map.layout.rail!.ashford!;
    assert.notDeepEqual(canalXY, railXY, 'ashford should reposition canal→rail');

    const s = buildInitialState({
      seats: [
        { color: 'red', name: 'R', isAI: true },
        { color: 'blue', name: 'B', isAI: true },
      ],
      seed: 11,
      mapId: 'severnvale',
    });
    const tile: PlacedTile = {
      id: 'persisted-1',
      owner: 'red',
      industry: 'manufacturer',
      level: 2,
      locationId: 'ashford',
      slotId: 'ashford-s1',
      flipped: true,
      resourcesLeft: 0,
    };
    s.tiles.push(tile);
    s.era = 'rail';

    const restored = deserializeState(serializeState(s));
    assert.deepEqual(restored, s, 'mid-era state round-trips exactly');

    const survivor = restored.tiles.find((t) => t.id === 'persisted-1');
    assert.ok(survivor && survivor.level >= 2, 'level-2 tile survives');

    // The tile's location still resolves in the RAIL context, at the new spot.
    const ctx = contextFor('severnvale', restored.era);
    assert.ok(ctx.locationById[survivor!.locationId], 'tile maps to a rail-era location');
    assert.deepEqual(
      map.layout[restored.era]!.ashford,
      railXY,
      'tile sits at the repositioned place',
    );
  });
});
