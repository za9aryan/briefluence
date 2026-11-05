import type { MetadataRoute } from 'next';
import { serverGet, siteOrigin } from '@/lib/server';

export const dynamic = 'force-dynamic';

/** Public pages plus every live blogger page (briefluence.com/@username). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  const pages = ['', '/for-brands', '/for-influencers', '/support', '/terms', '/privacy'].map(
    (path) => ({ url: `${origin}${path}` }),
  );
  const bloggers =
    (await serverGet<{ username: string; approvedAt: string | null }[]>(
      '/public/influencers',
    ).catch(() => null)) ?? [];
  return [
    ...pages,
    ...bloggers.map((b) => ({
      url: `${origin}/@${b.username}`,
      lastModified: b.approvedAt ?? undefined,
    })),
  ];
}
