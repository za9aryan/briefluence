/**
 * Full logical backup of the database to a JSON file (works without pg_dump: local embedded
 * Postgres, Docker or Render). Usage: pnpm db:backup [file]
 * Default file: backups/briefluence-YYYY-MM-DDTHH-MM.json (relative to the repo root).
 */
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadEnv } from '../src/config/env';
import { delegate, TABLES } from './backup-lib';

async function main() {
  loadEnv();
  const stamp = new Date().toISOString().slice(0, 16).replace(':', '-');
  const file = resolve(process.cwd(), '../..', process.argv[2] ?? `backups/briefluence-${stamp}.json`);
  const prisma = new PrismaClient();
  try {
    const data: Record<string, unknown[]> = {};
    for (const t of TABLES) data[t] = await delegate(prisma, t).findMany();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ version: 1, createdAt: new Date().toISOString(), data }));
    const counts = TABLES.map((t) => `${t} ${data[t]!.length}`).join(', ');
    console.log(`Backup saved: ${file}\n${counts}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
