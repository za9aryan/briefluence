/**
 * Restores a backup made by `pnpm db:backup`. REPLACES all current data.
 * Usage: pnpm db:restore <file> --yes
 * Run migrations first (`pnpm db:migrate`) so the schema matches the backup.
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from '../src/config/env';
import { delegate, prepareRows, TABLES } from './backup-lib';

async function main() {
  loadEnv();
  const arg = process.argv[2];
  if (!arg || !process.argv.includes('--yes')) {
    console.error('Usage: pnpm db:restore <backup-file> --yes   (replaces ALL current data)');
    process.exit(1);
  }
  const file = resolve(process.cwd(), '../..', arg);
  const backup = JSON.parse(readFileSync(file, 'utf8')) as { version: number; data: Record<string, Record<string, unknown>[]> };
  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`TRUNCATE ${[...TABLES].reverse().map((t) => `"${t}"`).join(', ')} CASCADE`);
        for (const t of TABLES) {
          const rows = backup.data[t] ?? [];
          for (let i = 0; i < rows.length; i += 500) {
            await delegate(tx as unknown as PrismaClient, t).createMany({ data: prepareRows(t, rows.slice(i, i + 500)) });
          }
        }
        // Payment.orderNumber is autoincrement: continue after the highest restored value.
        await tx.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"Payment"', 'orderNumber'), COALESCE((SELECT MAX("orderNumber") FROM "Payment"), 0) + 1, false)`,
        );
      },
      { timeout: 120_000 },
    );
    console.log(`Restored ${file}\n${TABLES.map((t) => `${t} ${(backup.data[t] ?? []).length}`).join(', ')}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
