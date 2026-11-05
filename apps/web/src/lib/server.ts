import { headers } from 'next/headers';

/** The API as the website's server reaches it (inside Docker: http://api:4000). */
const API_ORIGIN = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

/**
 * GET from the API during server rendering, as the visitor: their cookies (so a signed-in brand
 * gets its own view) and their address (so rate limits count them, not the website). Returns
 * null on 404.
 */
export async function serverGet<T>(path: string): Promise<T | null> {
  const h = await headers();
  const forwarded: Record<string, string> = {};
  for (const name of ['cookie', 'x-forwarded-for', 'accept-language']) {
    const v = h.get(name);
    if (v) forwarded[name] = v;
  }
  const res = await fetch(`${API_ORIGIN}/api/v1${path}`, { headers: forwarded, cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${path} responded ${res.status}`);
  return (await res.json()) as T;
}

/** This site's public origin (https://briefluence.com), from the request Caddy passed on. */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
