import { ENGAGEMENT_SAMPLE_SIZE, averageViews, engagementRate } from '@briefluence/shared';
import type { Env } from '../../../config/env';
import {
  fetchJson,
  ProviderError,
  toPercents,
  TokenRevokedError,
  type SocialProvider,
  type SocialStats,
  type TokenSet,
} from './types';

/**
 * YouTube Data API v3 + YouTube Analytics API v2 via Google OAuth (sensitive scopes need
 * Google OAuth verification).
 * Docs:
 *  - OAuth web server flow: https://developers.google.com/identity/protocols/oauth2/web-server
 *  - channels.list: https://developers.google.com/youtube/v3/docs/channels/list
 *  - Analytics reports: https://developers.google.com/youtube/analytics/channel_reports
 */
export class YouTubeProvider implements SocialProvider {
  readonly platform = 'YOUTUBE' as const;
  constructor(private readonly env: Env) {}

  authorizeUrl(state: string, redirectUri: string) {
    const q = new URLSearchParams({
      client_id: this.env.GOOGLE_CLIENT_ID ?? '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/yt-analytics.readonly',
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }

  private async token(params: Record<string, string>): Promise<TokenSet> {
    type T = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
    const r = await fetchJson<T>('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: this.env.GOOGLE_CLIENT_SECRET ?? '',
        ...params,
      }),
    });
    if (r.body.error === 'invalid_grant') throw new TokenRevokedError();
    if (!r.body.access_token) throw new ProviderError(`Google token request failed (${r.status})`);
    return {
      accessToken: r.body.access_token,
      refreshToken: r.body.refresh_token ?? null,
      expiresAt: r.body.expires_in ? new Date(Date.now() + r.body.expires_in * 1000) : null,
    };
  }

  exchangeCode(code: string, redirectUri: string) {
    return this.token({ code, grant_type: 'authorization_code', redirect_uri: redirectUri });
  }

  async refreshIfNeeded(tokens: TokenSet, now: Date): Promise<TokenSet | null> {
    if (tokens.expiresAt && tokens.expiresAt.getTime() - now.getTime() > 5 * 60_000) return null;
    if (!tokens.refreshToken) throw new TokenRevokedError('No refresh token');
    const next = await this.token({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken });
    return { ...next, refreshToken: next.refreshToken ?? tokens.refreshToken };
  }

  private async get<T>(url: string, token: string): Promise<T> {
    const r = await fetchJson<T>(url, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 401) throw new TokenRevokedError();
    if (r.status >= 400) throw new ProviderError(`Google API failed (${r.status})`);
    return r.body;
  }

  async fetchStats(token: string): Promise<SocialStats> {
    type Channels = {
      items?: {
        id: string;
        snippet: { title: string; customUrl?: string; thumbnails?: { default?: { url: string } } };
        statistics: { subscriberCount?: string; videoCount?: string };
        contentDetails: { relatedPlaylists: { uploads: string } };
      }[];
    };
    const ch = await this.get<Channels>(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true',
      token,
    );
    const channel = ch.items?.[0];
    if (!channel) throw new ProviderError('No YouTube channel on this Google account');
    const subscribers = Number(channel.statistics.subscriberCount ?? 0);

    type Playlist = { items?: { contentDetails: { videoId: string } }[] };
    const pl = await this.get<Playlist>(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=${ENGAGEMENT_SAMPLE_SIZE}&playlistId=${channel.contentDetails.relatedPlaylists.uploads}`,
      token,
    );
    const ids = (pl.items ?? []).map((i) => i.contentDetails.videoId);
    type Videos = { items?: { statistics: { viewCount?: string; likeCount?: string; commentCount?: string } }[] };
    const vids = ids.length
      ? await this.get<Videos>(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.join(',')}`, token)
      : { items: [] };
    const stats = (vids.items ?? []).map((v) => v.statistics);

    const [demo, countries] = await Promise.all([
      this.report(token, { metrics: 'viewerPercentage', dimensions: 'ageGroup,gender' }).catch(() => null),
      this.report(token, { metrics: 'views', dimensions: 'country', sort: '-views', maxResults: '10' }).catch(() => null),
    ]);

    let audienceGender = null;
    let audienceAge = null;
    if (demo?.length) {
      const g: Record<string, number> = {};
      const a: Record<string, number> = {};
      for (const [ageGroup, gender, pct] of demo as [string, string, number][]) {
        g[gender] = (g[gender] ?? 0) + pct;
        const bucket = ageGroup.replace(/^age/, ''); // "age18-24" -> "18-24", "age65-" -> "65-"
        const key = bucket.endsWith('-') ? `${bucket.slice(0, -1)}+` : bucket;
        a[key] = (a[key] ?? 0) + pct;
      }
      const gp = toPercents(g);
      audienceGender = { male: gp.male ?? 0, female: gp.female ?? 0, other: gp.user_specified ?? 0 };
      audienceAge = toPercents(a);
    }
    const audienceCountries = countries?.length
      ? toPercents(Object.fromEntries((countries as [string, number][]).map(([c, v]) => [c, v])))
      : null;

    return {
      externalId: channel.id,
      username: channel.snippet.customUrl ?? channel.snippet.title,
      profileUrl: channel.snippet.customUrl
        ? `https://www.youtube.com/${channel.snippet.customUrl}`
        : `https://www.youtube.com/channel/${channel.id}`,
      avatarUrl: channel.snippet.thumbnails?.default?.url ?? null,
      followers: subscribers,
      mediaCount: Number(channel.statistics.videoCount ?? 0),
      avgViews: averageViews(stats.map((s) => Number(s.viewCount ?? 0))),
      engagementRate: engagementRate(
        stats.map((s) => ({ likes: Number(s.likeCount ?? 0), comments: Number(s.commentCount ?? 0) })),
        subscribers,
      ),
      audienceGender,
      audienceAge,
      audienceCountries,
    };
  }

  private async report(token: string, params: Record<string, string>) {
    const end = new Date();
    const start = new Date(end.getTime() - 90 * 86_400_000);
    const q = new URLSearchParams({
      ids: 'channel==MINE',
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      ...params,
    });
    const r = await this.get<{ rows?: unknown[][] }>(`https://youtubeanalytics.googleapis.com/v2/reports?${q}`, token);
    return r.rows ?? [];
  }
}
