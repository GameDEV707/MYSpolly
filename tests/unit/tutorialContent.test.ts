import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TUTORIAL_LESSONS } from '../../src/app/data/tutorial.ts';

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

const UI_KEYS = [
  'tutorial.title',
  'tutorial.lessonOf',
  'tutorial.stepOf',
  'tutorial.replayLesson',
  'tutorial.skipLesson',
  'tutorial.exit',
  'tutorial.next',
  'tutorial.finish',
  'tutorial.clickHint',
  'tutorial.offerTitle',
  'tutorial.offerBody',
  'tutorial.offerStart',
  'tutorial.offerSkip',
  'menu.tutorial',
  'rules.startTutorial',
];

describe('Interactive Tutorial content', () => {
  const bundles = {
    en: loadBundle('en'),
    ru: loadBundle('ru'),
    uz: loadBundle('uz'),
  } as const;

  test('teaches the lessons in the required order', () => {
    const ids = TUTORIAL_LESSONS.map((l) => l.id);
    assert.deepEqual(ids, [
      'build',
      'network',
      'sell',
      'develop',
      'loanScout',
      'income',
      'turnOrder',
      'eras',
    ]);
  });

  test('every click step targets a real element in its lesson', () => {
    for (const lesson of TUTORIAL_LESSONS) {
      const ids = new Set(lesson.elements.map((e) => e.id));
      assert.ok(lesson.steps.length > 0, `${lesson.id} has no steps`);
      for (const s of lesson.steps) {
        if (s.kind === 'click') {
          assert.ok(ids.has(s.target), `${lesson.id}: click target ${s.target} missing`);
        }
      }
    }
  });

  test('all tutorial text keys exist & non-empty in EN/RU/UZ', () => {
    const keys = new Set<string>(UI_KEYS);
    for (const l of TUTORIAL_LESSONS) {
      keys.add(l.titleKey);
      keys.add(l.introKey);
      for (const e of l.elements) keys.add(e.labelKey);
      for (const s of l.steps) keys.add(s.instrKey);
    }
    for (const k of keys) {
      for (const [lang, bundle] of Object.entries(bundles)) {
        const v = get(bundle, k);
        assert.equal(typeof v, 'string', `missing key ${k} in ${lang}`);
        assert.ok((v as string).length > 0, `empty key ${k} in ${lang}`);
      }
    }
  });
});
