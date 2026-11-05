/**
 * Public profile usernames: briefluence.com/@anna. Lowercase letters, digits, "." and "_";
 * starts and ends with a letter or digit, no ".." (like Instagram handles, so bloggers can reuse
 * theirs). Stored normalized, so "@Anna" and "anna" are the same name.
 */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

const PATTERN = /^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/;

/** Names that would look official or clash with our own pages and routes. */
const RESERVED = new Set([
  'admin',
  'administrator',
  'api',
  'app',
  'brand',
  'brands',
  'briefluence',
  'billing',
  'dashboard',
  'deals',
  'help',
  'influencer',
  'influencers',
  'login',
  'logout',
  'me',
  'moderator',
  'notifications',
  'null',
  'offers',
  'official',
  'pricing',
  'privacy',
  'root',
  'settings',
  'signup',
  'staff',
  'support',
  'team',
  'terms',
  'undefined',
  'www',
]);

/** "  @Anna.Art " → "anna.art". */
export function normalizePublicUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

export type UsernameProblem = 'length' | 'format' | 'reserved';

/** Why a (normalized) username cannot be used, or null when it is fine. */
export function publicUsernameProblem(name: string): UsernameProblem | null {
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) return 'length';
  if (!PATTERN.test(name) || name.includes('..')) return 'format';
  if (RESERVED.has(name) || name.startsWith('briefluence')) return 'reserved';
  return null;
}
