import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Loads the nearest .env (walking up from cwd to the repo root) without overriding variables
 * that are already set, so real deployments configure everything through the environment.
 */
export function loadDotenv() {
  let dir = process.cwd();
  for (let i = 0; i < 4; i++) {
    const file = join(dir, '.env');
    if (existsSync(file)) {
      process.loadEnvFile(file);
      return;
    }
    dir = dirname(dir);
  }
}
