import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
// API origin for the /api/v1 rewrite. On Render the Blueprint passes the API's private host:port.
const apiOrigin =
  process.env.API_INTERNAL_URL ??
  (process.env.API_INTERNAL_HOSTPORT
    ? `http://${process.env.API_INTERNAL_HOSTPORT}`
    : 'http://localhost:4000');

const nextConfig: NextConfig = {
  // Separate build folder for the isolated E2E server (see playwright.config.ts).
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  transpilePackages: ['@briefluence/ui', '@briefluence/shared'],
  poweredByHeader: false,
  // Support chat WebSocket. Production: same origin (Caddy routes /api/v1/ws to the API).
  // Dev and E2E: straight to the API, because Next.js rewrites do not carry WebSockets.
  env: {
    NEXT_PUBLIC_SOCKET_ORIGIN:
      process.env.NEXT_PUBLIC_SOCKET_ORIGIN ??
      (process.env.NODE_ENV === 'production' ? '' : apiOrigin),
  },
  // Dev only: let the dev server answer through HTTPS tunnels used for real OAuth testing
  // (see docs/social-oauth-setup.md).
  allowedDevOrigins: ['*.trycloudflare.com', '*.ngrok-free.app', '*.ngrok.app'],
  // The browser talks to the API through the web origin, so auth cookies are first-party
  // and OAuth / bank redirects land on the same site.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiOrigin}/api/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
