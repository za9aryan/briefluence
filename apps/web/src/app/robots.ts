import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/server';

/** Search engines may index the public site and blogger pages, never the signed-in app. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteOrigin();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin/',
        '/brand/',
        '/influencer/',
        '/notifications',
        '/billing/',
        '/oauth/',
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
