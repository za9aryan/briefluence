#!/usr/bin/env node
/**
 * Writes messages/{en,ru,hy}/{namespace}.json from a module whose leaves are [en, ru, hy] tuples.
 * Usage: node scripts/write-messages.mjs <source.mjs>
 * Existing namespaces not present in the source are left untouched; listed ones are replaced.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'messages');
const src = (await import(pathToFileURL(resolve(process.argv[2])).href)).default;
const LOCALES = ['en', 'ru', 'hy'];

function pick(node, i, path) {
  if (Array.isArray(node)) {
    if (node.length !== 3) throw new Error(`${path}: expected [en, ru, hy]`);
    return node[i];
  }
  return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, pick(v, i, `${path}.${k}`)]));
}

for (const [ns, tree] of Object.entries(src)) {
  LOCALES.forEach((l, i) => writeFileSync(join(root, l, `${ns}.json`), JSON.stringify(pick(tree, i, ns), null, 2) + '\n'));
  console.log(`wrote ${ns}`);
}
