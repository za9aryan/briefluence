import type { MetadataRoute } from 'next';

/**
 * Web app manifest: makes briefluence installable (Add to Home Screen / Install app). "standalone"
 * is also what iOS requires before it allows Web Push. Colours from the brand tokens.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'briefluence',
    short_name: 'briefluence',
    description: 'Brands post briefs, bloggers apply. Made for Armenia.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#FFFFFF',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
