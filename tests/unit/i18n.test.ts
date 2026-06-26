import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function loadBundle(name: string): Record<string, unknown> {
  const url = new URL(`../../src/app/i18n/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as Record<string, unknown>;
}

function flatKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flatKeys(v as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

describe('i18n bundles', () => {
  const en = loadBundle('en');
  const ru = loadBundle('ru');
  const uz = loadBundle('uz');
  const enKeys = flatKeys(en);

  test('Russian bundle has exactly the same keys as English', () => {
    assert.deepEqual(flatKeys(ru), enKeys);
  });

  test('Uzbek bundle has exactly the same keys as English', () => {
    assert.deepEqual(flatKeys(uz), enKeys);
  });

  test('no translation value is empty', () => {
    for (const [name, bundle] of [
      ['ru', ru],
      ['uz', uz],
      ['en', en],
    ] as const) {
      const check = (obj: Record<string, unknown>): void => {
        for (const v of Object.values(obj)) {
          if (typeof v === 'string') assert.ok(v.length > 0, `empty value in ${name}`);
          else if (v && typeof v === 'object') check(v as Record<string, unknown>);
        }
      };
      check(bundle);
    }
  });
});
