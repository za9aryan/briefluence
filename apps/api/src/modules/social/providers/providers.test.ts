import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../../config/env';
import { InstagramProvider } from './instagram.provider';
import { TikTokProvider } from './tiktok.provider';
import { YouTubeProvider } from './youtube.provider';

/**
 * The real providers against canned responses shaped like the documented API answers (see the doc
 * links in each provider). Checks what we send and how we read the answers; no network.
 */
const env = {
  INSTAGRAM_APP_ID: 'ig-app',
  INSTAGRAM_APP_SECRET: 'ig-secret',
  INSTAGRAM_GRAPH_VERSION: 'v27.0',
  TIKTOK_CLIENT_KEY: 'tt-key',
  TIKTOK_CLIENT_SECRET: 'tt-secret',
  GOOGLE_CLIENT_ID: 'g-id',
  GOOGLE_CLIENT_SECRET: 'g-secret',
} as Env;

type Call = { url: string; init?: RequestInit };

/** Replaces fetch: `route(url)` returns [status, body] for each request; every call is recorded. */
function stubFetch(route: (url: string, init?: RequestInit) => [number, unknown]) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const [status, body] = route(String(url), init);
    return new Response(JSON.stringify(body), { status });
  });
  return calls;
}
const form = (init?: RequestInit) => Object.fromEntries(new URLSearchParams(String(init?.body)));

afterEach(() => vi.unstubAllGlobals());

describe('YouTubeProvider', () => {
  it('reads the channel, recent videos and audience; leaves out unknown countries (ZZ)', async () => {
    stubFetch((url) => {
      if (url.includes('/channels'))
        return [
          200,
          {
            items: [
              {
                id: 'UC1',
                snippet: {
                  title: 'Anna',
                  customUrl: '@anna',
                  thumbnails: { default: { url: 'a.jpg' } },
                },
                statistics: { subscriberCount: '1000', videoCount: '50' },
                contentDetails: { relatedPlaylists: { uploads: 'UU1' } },
              },
            ],
          },
        ];
      if (url.includes('/playlistItems'))
        return [
          200,
          { items: [{ contentDetails: { videoId: 'v1' } }, { contentDetails: { videoId: 'v2' } }] },
        ];
      if (url.includes('/videos'))
        return [
          200,
          {
            items: [
              { statistics: { viewCount: '300', likeCount: '20', commentCount: '5' } },
              { statistics: { viewCount: '100', likeCount: '10', commentCount: '5' } },
            ],
          },
        ];
      if (url.includes('dimensions=ageGroup'))
        return [
          200,
          {
            rows: [
              ['age18-24', 'female', 40],
              ['age18-24', 'male', 20],
              ['age65-', 'female', 40],
            ],
          },
        ];
      if (url.includes('dimensions=country'))
        return [
          200,
          {
            rows: [
              ['DE', 60],
              ['ZZ', 20],
              ['FR', 20],
            ],
          },
        ];
      return [404, {}];
    });

    const s = await new YouTubeProvider(env).fetchStats('tok');
    expect(s).toMatchObject({
      externalId: 'UC1',
      username: '@anna',
      profileUrl: 'https://www.youtube.com/@anna',
      followers: 1000,
      mediaCount: 50,
      audienceGender: { female: 80, male: 20, other: 0 },
      audienceAge: { '18-24': 60, '65+': 40 },
      audienceCountries: { DE: 75, FR: 25 },
    });
    expect(s.avgViews).toBe(200);
  });

  it('revokes with the refresh token (ends the whole grant)', async () => {
    const calls = stubFetch(() => [200, {}]);
    await new YouTubeProvider(env).revoke({ accessToken: 'a', refreshToken: 'r' });
    expect(calls[0]!.url).toBe('https://oauth2.googleapis.com/revoke');
    expect(calls[0]!.init?.method).toBe('POST');
    expect(form(calls[0]!.init)).toEqual({ token: 'r' });
  });

  it('treats an already invalid token as revoked, but fails on server errors', async () => {
    stubFetch(() => [400, { error: 'invalid_token' }]);
    await expect(new YouTubeProvider(env).revoke({ accessToken: 'a' })).resolves.toBeUndefined();
    stubFetch(() => [500, {}]);
    await expect(new YouTubeProvider(env).revoke({ accessToken: 'a' })).rejects.toThrow();
  });
});

describe('TikTokProvider', () => {
  it('reads user info and recent videos', async () => {
    const calls = stubFetch((url) => {
      if (url.includes('/user/info/'))
        return [
          200,
          {
            data: {
              user: {
                open_id: 'o1',
                username: 'anna',
                avatar_url: 'a.jpg',
                follower_count: 2000,
                video_count: 30,
              },
            },
            error: { code: 'ok' },
          },
        ];
      if (url.includes('/video/list/'))
        return [
          200,
          {
            data: { videos: [{ view_count: 500, like_count: 40, comment_count: 10 }] },
            error: { code: 'ok' },
          },
        ];
      return [404, {}];
    });
    const s = await new TikTokProvider(env).fetchStats('tok');
    expect(s).toMatchObject({
      externalId: 'o1',
      username: 'anna',
      profileUrl: 'https://www.tiktok.com/@anna',
      followers: 2000,
      mediaCount: 30,
      avgViews: 500,
      audienceGender: null,
    });
    // Video list is a POST with max_count ≤ 20 (documented maximum).
    const list = calls.find((c) => c.url.includes('/video/list/'))!;
    expect(list.init?.method).toBe('POST');
    expect(JSON.parse(String(list.init?.body)).max_count).toBeLessThanOrEqual(20);
  });

  it('revokes with client key, secret and the access token', async () => {
    const calls = stubFetch(() => [200, {}]);
    await new TikTokProvider(env).revoke({ accessToken: 'a' });
    expect(calls[0]!.url).toBe('https://open.tiktokapis.com/v2/oauth/revoke/');
    expect(form(calls[0]!.init)).toEqual({
      client_key: 'tt-key',
      client_secret: 'tt-secret',
      token: 'a',
    });
  });
});

describe('InstagramProvider', () => {
  it('reads the profile, media reach and follower demographics', async () => {
    const calls = stubFetch((url) => {
      const u = new URL(url);
      if (u.pathname.endsWith('/me'))
        return [200, { user_id: '17', username: 'anna', followers_count: 1000, media_count: 80 }];
      if (u.pathname.endsWith('/me/media'))
        return [200, { data: [{ id: 'm1', like_count: 30, comments_count: 10 }] }];
      if (u.pathname.endsWith('/m1/insights'))
        return [200, { data: [{ name: 'reach', values: [{ value: 400 }] }] }];
      if (u.pathname.endsWith('/17/insights')) {
        const b = u.searchParams.get('breakdown');
        const results =
          b === 'gender'
            ? [
                { dimension_values: ['F'], value: 70 },
                { dimension_values: ['M'], value: 30 },
              ]
            : b === 'country'
              ? [{ dimension_values: ['AM'], value: 100 }]
              : [{ dimension_values: ['18-24'], value: 100 }];
        return [200, { data: [{ total_value: { breakdowns: [{ results }] } }] }];
      }
      return [404, {}];
    });
    const s = await new InstagramProvider(env).fetchStats('tok');
    expect(s).toMatchObject({
      externalId: '17',
      username: 'anna',
      followers: 1000,
      mediaCount: 80,
      avgViews: 400,
      audienceGender: { female: 70, male: 30, other: 0 },
      audienceAge: { '18-24': 100 },
      audienceCountries: { AM: 100 },
    });
    // Graph host and version from the env; demographics use the documented parameters.
    const demo = calls.find((c) => c.url.includes('breakdown=gender'))!;
    expect(demo.url.startsWith('https://graph.instagram.com/v27.0/17/insights')).toBe(true);
    const q = new URL(demo.url).searchParams;
    expect(q.get('metric')).toBe('follower_demographics');
    expect(q.get('period')).toBe('lifetime');
    expect(q.get('metric_type')).toBe('total_value');
  });

  it('has no revoke (Instagram Login offers no revoke endpoint)', () => {
    expect('revoke' in new InstagramProvider(env)).toBe(false);
  });
});
