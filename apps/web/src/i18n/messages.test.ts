import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES } from './config';
import { negotiateLocale } from './config';
import { NAMESPACES } from './namespaces';

const load = (locale: string, ns: string) =>
  JSON.parse(readFileSync(join(__dirname, '../../messages', locale, `${ns}.json`), 'utf8')) as object;

function flatten(obj: object, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? Object.entries(flatten(v as object, `${prefix}${k}.`)) : [[`${prefix}${k}`, String(v)]],
    ),
  );
}
const vars = (s: string) => [...new Set([...s.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1]!))].sort();

describe('translations', () => {
  for (const ns of NAMESPACES) {
    const en = flatten(load('en', ns));
    for (const locale of LOCALES.filter((l) => l !== 'en')) {
      it(`${locale}/${ns} has the same keys and placeholders as en`, () => {
        const other = flatten(load(locale, ns));
        expect(Object.keys(other).sort()).toEqual(Object.keys(en).sort());
        for (const [k, v] of Object.entries(en)) {
          for (const p of vars(v)) expect(other[k], `${ns}.${k} is missing {${p}}`).toContain(`{${p}`);
          expect(other[k]!.trim(), `${ns}.${k} is empty`).not.toBe('');
        }
      });
    }
  }
});

describe('negotiateLocale', () => {
  it('picks the best supported language', () => {
    expect(negotiateLocale('hy-AM,hy;q=0.9,en;q=0.8')).toBe('hy');
    expect(negotiateLocale('de-DE,ru;q=0.7')).toBe('ru');
    expect(negotiateLocale('fr')).toBe('en');
    expect(negotiateLocale(null)).toBe('en');
  });
});
