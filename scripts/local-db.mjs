#!/usr/bin/env node
// Runs a real PostgreSQL 16 on localhost without Docker (uses the embedded-postgres binaries).
// Use `docker compose up -d` instead if you have Docker. Data lives in ./.local-db.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const port = Number(process.env.LOCAL_DB_PORT ?? 5432);
const databaseDir = resolve(process.cwd(), '.local-db/data');
const databases = (process.env.LOCAL_DB_NAMES ?? 'briefluence,briefluence_test').split(',');

const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: true,
  onLog: () => {},
});

const fresh = !existsSync(databaseDir);
if (fresh) await pg.initialise();
await pg.start();
for (const name of databases) {
  try {
    await pg.createDatabase(name);
    console.log(`created database ${name}`);
  } catch {
    // already exists
  }
}
console.log(`PostgreSQL 16 running on postgresql://postgres:postgres@localhost:${port} (Ctrl+C to stop)`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
