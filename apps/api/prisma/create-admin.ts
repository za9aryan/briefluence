/**
 * Creates the admin account (or resets its password) from ADMIN_EMAIL / ADMIN_PASSWORD.
 * Safe for production: touches only that one user, never deletes data.
 *   pnpm admin:create
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { loadEnv } from '../src/config/env';

async function main() {
  const env = loadEnv();
  const email = env.ADMIN_EMAIL.toLowerCase();
  if (env.NODE_ENV === 'production' && env.ADMIN_PASSWORD === 'Admin12345') {
    throw new Error('Set a strong ADMIN_PASSWORD before creating the production admin');
  }
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.role !== 'ADMIN') {
      throw new Error(`${email} already belongs to a ${existing.role.toLowerCase()} account; use another ADMIN_EMAIL`);
    }
    const passwordHash = await argon2.hash(env.ADMIN_PASSWORD, { type: argon2.argon2id });
    await prisma.user.upsert({
      where: { email },
      create: { email, passwordHash, role: 'ADMIN', emailVerifiedAt: new Date() },
      update: { passwordHash, blockedAt: null },
    });
    // A password reset should end existing admin sessions.
    if (existing) await prisma.refreshToken.updateMany({ where: { userId: existing.id, revokedAt: null }, data: { revokedAt: new Date() } });
    console.log(existing ? `Admin password updated for ${email}` : `Admin created: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
