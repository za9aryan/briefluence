import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES } from './config';
import { negotiateLocale } from './config';
import { NAMESPACES } from './namespaces';

const load = (locale: string, ns: string) =>
  JSON.parse(
    readFileSync(join(__dirname, '../../messages', locale, `${ns}.json`), 'utf8'),
  ) as object;

function flatten(obj: object, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object'
        ? Object.entries(flatten(v as object, `${prefix}${k}.`))
        : [[`${prefix}${k}`, String(v)]],
    ),
  );
}
const vars = (s: string) =>
  [...new Set([...s.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1]!))].sort();

describe('translations', () => {
  for (const ns of NAMESPACES) {
    const en = flatten(load('en', ns));
    for (const locale of LOCALES.filter((l) => l !== 'en')) {
      it(`${locale}/${ns} has the same keys and placeholders as en`, () => {
        const other = flatten(load(locale, ns));
        expect(Object.keys(other).sort()).toEqual(Object.keys(en).sort());
        for (const [k, v] of Object.entries(en)) {
          for (const p of vars(v))
            expect(other[k], `${ns}.${k} is missing {${p}}`).toContain(`{${p}`);
          expect(other[k]!.trim(), `${ns}.${k} is empty`).not.toBe('');
        }
      });
    }
  }
});

/** Every .ts/.tsx file under src (tests excluded). */
function sourceFiles(dir = join(__dirname, '..')): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(e.name) && !e.name.includes('.test.') ? [p] : [];
  });
}

describe('code ↔ translations', () => {
  // `const t = useTranslations('ns')` / `await getTranslations('ns')`, then t('key'), t.rich('key')…
  // Each call is matched to the nearest declaration of that name above it. Keys built at runtime
  // (template strings) are not checked here.
  it('every literal key the code reads exists in the English messages', () => {
    const en = Object.fromEntries(NAMESPACES.map((ns) => [ns, flatten(load('en', ns))]));
    const exists = (full: string) => {
      const [ns, ...rest] = full.split('.');
      const flat = en[ns!];
      if (!flat) return false;
      const key = rest.join('.');
      return key in flat || Object.keys(flat).some((k) => k.startsWith(`${key}.`));
    };
    const decl =
      /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*'([^']*)'\s*\)/g;
    const missing: string[] = [];
    for (const file of sourceFiles()) {
      const src = readFileSync(file, 'utf8');
      const decls = [...src.matchAll(decl)].map((m) => ({ at: m.index!, name: m[1]!, ns: m[2]! }));
      for (const name of new Set(decls.map((d) => d.name))) {
        const call = new RegExp(
          `(?<![\\w.])${name}(?:\\.rich|\\.markup|\\.raw)?\\(\\s*'([^'\`$]+)'`,
          'g',
        );
        for (const m of src.matchAll(call)) {
          const d = decls.filter((x) => x.name === name && x.at < m.index!).at(-1);
          if (!d) continue;
          const full = d.ns ? `${d.ns}.${m[1]}` : m[1]!;
          if (!exists(full)) missing.push(`${file.split('/src/')[1]}: ${full}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('negotiateLocale', () => {
  it('picks the best supported language', () => {
    expect(negotiateLocale('hy-AM,hy;q=0.9,en;q=0.8')).toBe('hy');
    expect(negotiateLocale('de-DE,ru;q=0.7')).toBe('ru');
    expect(negotiateLocale('fr')).toBe('en');
    expect(negotiateLocale(null)).toBe('en');
  });
});
