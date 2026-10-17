import { Prisma, PrismaClient } from '@prisma/client';

/** Tables in foreign-key order (parents first). Restore inserts in this order, wipes in reverse. */
export const TABLES = [
  'User',
  'RefreshToken',
  'InfluencerProfile',
  'BrandProfile',
  'SocialAccount',
  'Deal',
  'Application',
  'DealView',
  'Subscription',
  'Payment',
  'Notification',
  'FeedSearch',
  'ExchangeRate',
] as const;

type Delegate = { findMany: (a?: object) => Promise<unknown[]>; createMany: (a: { data: unknown[] }) => Promise<unknown> };

export function delegate(prisma: PrismaClient, table: string): Delegate {
  const key = table[0]!.toLowerCase() + table.slice(1);
  return (prisma as unknown as Record<string, Delegate>)[key]!;
}

/** Json columns per model: a SQL NULL there must be written back as Prisma.DbNull. */
export function jsonFields(table: string): string[] {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === table);
  return model ? model.fields.filter((f) => f.type === 'Json').map((f) => f.name) : [];
}

export function prepareRows(table: string, rows: Record<string, unknown>[]) {
  const json = jsonFields(table);
  return rows.map((r) => {
    const out = { ...r };
    for (const k of json) if (out[k] === null) out[k] = Prisma.DbNull;
    return out;
  });
}
