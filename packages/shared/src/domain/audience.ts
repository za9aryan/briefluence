/** Shapes stored in SocialAccount.audience* JSON columns (percent values, 0–100). */
export type AudienceGender = { male?: number; female?: number; other?: number };
export type AudienceAge = Record<string, number>; // { "18-24": 30.1, "65+": 2 }
export type AudienceCountries = Record<string, number>; // { "AM": 72.4 }

export type MajorityGender = 'MALE' | 'FEMALE' | null;

export function majorityGender(g: AudienceGender | null | undefined): MajorityGender {
  if (!g) return null;
  const male = g.male ?? 0;
  const female = g.female ?? 0;
  if (male === 0 && female === 0) return null;
  if (male === female) return null;
  return male > female ? 'MALE' : 'FEMALE';
}

export function mainCountry(c: AudienceCountries | null | undefined): string | null {
  if (!c) return null;
  let best: string | null = null;
  let bestValue = -1;
  for (const [code, value] of Object.entries(c)) {
    if (value > bestValue) {
      best = code;
      bestValue = value;
    }
  }
  return best;
}

function parseBucket(key: string): [number, number] | null {
  const plus = /^(\d+)\+$/.exec(key);
  if (plus) return [Number(plus[1]), 100];
  const range = /^(\d+)-(\d+)$/.exec(key);
  if (range) return [Number(range[1]), Number(range[2])];
  return null;
}

/**
 * Percent of followers whose age falls in [min, max]. Buckets that only partly
 * overlap the range contribute proportionally (uniform age distribution inside a bucket).
 */
export function shareInAgeRange(
  age: AudienceAge | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
): number | null {
  if (!age || Object.keys(age).length === 0) return null;
  const lo = min ?? 0;
  const hi = max ?? 100;
  let total = 0;
  for (const [key, value] of Object.entries(age)) {
    const bucket = parseBucket(key);
    if (!bucket) continue;
    const [bLo, bHi] = bucket;
    const overlap = Math.min(hi, bHi) - Math.max(lo, bLo) + 1;
    if (overlap <= 0) continue;
    total += value * (overlap / (bHi - bLo + 1));
  }
  return Math.min(100, total);
}

/** Engagement rate = average (likes + comments) of recent posts / followers × 100. */
export function engagementRate(
  posts: { likes: number; comments: number }[],
  followers: number,
): number | null {
  if (followers <= 0 || posts.length === 0) return null;
  const avg = posts.reduce((sum, p) => sum + p.likes + p.comments, 0) / posts.length;
  return Math.round((avg / followers) * 100 * 100) / 100;
}

export function averageViews(views: number[]): number | null {
  if (views.length === 0) return null;
  return Math.round(views.reduce((a, b) => a + b, 0) / views.length);
}
