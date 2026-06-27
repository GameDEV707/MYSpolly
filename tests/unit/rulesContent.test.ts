import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  RULE_CHAPTERS,
  chapterTextKeys,
  chapterIndex,
  HELP_TOPIC_CHAPTER,
} from '../../src/app/data/rules.ts';

function loadBundle(name: string): Record<string, unknown> {
  const url = new URL(`../../src/app/i18n/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as Record<string, unknown>;
}

function get(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => {
    if (o && typeof o === 'object') return (o as Record<string, unknown>)[k];
    return undefined;
  }, obj);
}

const GLOSSARY_MEANING_KEYS = [
  'cotton',
  'coal',
  'iron',
  'manufacturer',
  'pottery',
  'juice',
  'coalCube',
  'ironCube',
  'juice',
  'vp',
  'money',
  'income',
  'canal',
  'rail',
  'special',
  'builtTile',
  'flipped',
  'buildSlot',
  'farmJuice',
  'bonus_develop',
  'bonus_income',
  'bonus_vp',
  'bonus_money',
].map((k) => `rulesLib.glossary.m.${k}`);

describe('Rules Library content', () => {
  const bundles = {
    en: loadBundle('en'),
    ru: loadBundle('ru'),
    uz: loadBundle('uz'),
  } as const;

  test('covers the whole game with a healthy set of chapters', () => {
    assert.ok(RULE_CHAPTERS.length >= 17, 'expected at least 17 chapters');
    // The seven actions each get their own page.
    for (const id of [
      'actBuild',
      'actNetwork',
      'actDevelop',
      'actSell',
      'actLoan',
      'actScout',
      'actPass',
    ]) {
      assert.ok(chapterIndex(id) >= 0, `missing action chapter ${id}`);
    }
    // Key reference chapters exist.
    for (const id of ['overview', 'eras', 'components', 'setup', 'turns', 'glossary']) {
      assert.ok(chapterIndex(id) >= 0, `missing chapter ${id}`);
    }
  });

  test('chapter ids are unique', () => {
    const ids = RULE_CHAPTERS.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('every chapter text key + glossary key exists & is non-empty in EN/RU/UZ', () => {
    const keys = new Set<string>(GLOSSARY_MEANING_KEYS);
    for (const ch of RULE_CHAPTERS) for (const k of chapterTextKeys(ch)) keys.add(k);
    for (const k of keys) {
      for (const [lang, bundle] of Object.entries(bundles)) {
        const v = get(bundle, k);
        assert.equal(typeof v, 'string', `missing key ${k} in ${lang}`);
        assert.ok((v as string).length > 0, `empty key ${k} in ${lang}`);
      }
    }
  });

  test('help topic chapters all resolve to real chapters', () => {
    for (const id of Object.values(HELP_TOPIC_CHAPTER)) {
      assert.ok(chapterIndex(id) >= 0, `help topic points to missing chapter ${id}`);
    }
  });
});
