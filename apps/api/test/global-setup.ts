import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { loadTestEnv } from './load-test-env';

/** Applies migrations to the test database once per run. */
export default function setup() {
  loadTestEnv();
  execSync('npx prisma migrate deploy', {
    cwd: resolve(__dirname, '..'),
    env: process.env,
    stdio: 'pipe',
  });
}
