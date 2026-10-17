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
 * Instagram API with Instagram Login (Business / Creator accounts only).
 * Docs:
 *  - OAuth: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
 *  - Insights: https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights
 * follower_demographics is only returned for accounts with ≥100 followers and needs
 * instagram_business_manage_insights (Meta App Review).
 */
export class InstagramProvider implements SocialProvider {
  readonly platform = 'INSTAGRAM' as const;
  private readonly graph: string;

  constructor(private readonly env: Env) {
    this.graph = `https://graph.instagram.com/${env.INSTAGRAM_GRAPH_VERSION}`;
  }

  authorizeUrl(state: string, redirectUri: string) {
    const q = new URLSearchParams({
      client_id: this.env.INSTAGRAM_APP_ID ?? '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'instagram_business_basic,instagram_business_manage_insights',
      state,
    });
    return `https://www.instagram.com/oauth/authorize?${q}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<TokenSet> {
    const form = new URLSearchParams({
      client_id: this.env.INSTAGRAM_APP_ID ?? '',
      client_secret: this.env.INSTAGRAM_APP_SECRET ?? '',
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    });
    type Short = { access_token?: string; data?: { access_token: string }[]; error_message?: string };
    const short = await fetchJson<Short>('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form });
    const shortToken = short.body.access_token ?? short.body.data?.[0]?.access_token;
    if (!shortToken) throw new ProviderError(`Instagram code exchange failed (${short.status})`);

    // Exchange for a long-lived (60 day) token.
    const q = new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: this.env.INSTAGRAM_APP_SECRET ?? '',
      access_token: shortToken,
    });
    type Long = { access_token?: string; expires_in?: number };
    const long = await fetchJson<Long>(`https://graph.instagram.com/access_token?${q}`);
    if (!long.body.access_token) throw new ProviderError(`Instagram long-lived exchange failed (${long.status})`);
    return {
      accessToken: long.body.access_token,
      expiresAt: long.body.expires_in ? new Date(Date.now() + long.body.expires_in * 1000) : null,
    };
  }

  async refreshIfNeeded(tokens: TokenSet, now: Date): Promise<TokenSet | null> {
    if (tokens.expiresAt && tokens.expiresAt.getTime() <= now.getTime()) throw new TokenRevokedError('Token expired');
    // Long-lived tokens can be refreshed once they are 24h old; refresh when <15 days are left.
    if (tokens.expiresAt && tokens.expiresAt.getTime() - now.getTime() > 15 * 86_400_000) return null;
    const q = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: tokens.accessToken });
    const r = await fetchJson<{ access_token?: string; expires_in?: number }>(
      `https://graph.instagram.com/refresh_access_token?${q}`,
    );
    if (r.status === 400 || r.status === 401) throw new TokenRevokedError();
    if (!r.body.access_token) throw new ProviderError(`Instagram refresh failed (${r.status})`);
    return {
      accessToken: r.body.access_token,
      expiresAt: r.body.expires_in ? new Date(now.getTime() + r.body.expires_in * 1000) : null,
    };
  }

  private async get<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
    const q = new URLSearchParams({ ...params, access_token: token });
    const r = await fetchJson<T & { error?: { code?: number; message?: string } }>(`${this.graph}${path}?${q}`);
    // Graph API error code 190 = invalid / expired / revoked OAuth token.
    if (r.body.error?.code === 190 || r.status === 401) throw new TokenRevokedError();
    if (r.status >= 400) throw new ProviderError(`Instagram ${path} failed (${r.status})`);
    return r.body;
  }

  async fetchStats(token: string): Promise<SocialStats> {
    type Me = {
      user_id: string;
      username: string;
      profile_picture_url?: string;
      followers_count?: number;
      media_count?: number;
    };
    const me = await this.get<Me>('/me', { fields: 'user_id,username,profile_picture_url,followers_count,media_count' }, token);
    type Media = { data: { id: string; like_count?: number; comments_count?: number }[] };
    const media = await this.get<Media>(
      '/me/media',
      { fields: 'id,like_count,comments_count,media_type,timestamp', limit: String(ENGAGEMENT_SAMPLE_SIZE) },
      token,
    );
    const posts = media.data.map((m) => ({ likes: m.like_count ?? 0, comments: m.comments_count ?? 0 }));
    const followers = me.followers_count ?? 0;

    // Reach per recent media (media insights metric "reach").
    const reaches = await Promise.allSettled(
      media.data.map((m) =>
        this.get<{ data: { name: string; values: { value: number }[] }[] }>(`/${m.id}/insights`, { metric: 'reach' }, token),
      ),
    );
    const reachValues = reaches.flatMap((r) =>
      r.status === 'fulfilled' && r.value.data[0]?.values[0] ? [r.value.data[0].values[0].value] : [],
    );

    const [gender, age, country] = await Promise.all(
      (['gender', 'age', 'country'] as const).map((b) => this.demographics(me.user_id, b, token).catch(() => null)),
    );
    let audienceGender = null;
    if (gender) {
      const pct = toPercents(gender);
      audienceGender = { male: pct.M ?? 0, female: pct.F ?? 0, other: pct.U ?? 0 };
    }

    return {
      externalId: me.user_id,
      username: me.username,
      profileUrl: `https://www.instagram.com/${me.username}`,
      avatarUrl: me.profile_picture_url ?? null,
      followers,
      mediaCount: me.media_count ?? null,
      avgViews: averageViews(reachValues),
      engagementRate: engagementRate(posts, followers),
      audienceGender,
      audienceAge: age ? toPercents(age) : null,
      audienceCountries: country ? toPercents(country) : null,
    };
  }

  private async demographics(userId: string, breakdown: 'gender' | 'age' | 'country', token: string) {
    type Insights = {
      data: { total_value?: { breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] } }[];
    };
    const r = await this.get<Insights>(
      `/${userId}/insights`,
      { metric: 'follower_demographics', period: 'lifetime', timeframe: 'last_90_days', metric_type: 'total_value', breakdown },
      token,
    );
    const results = r.data[0]?.total_value?.breakdowns?.[0]?.results ?? [];
    if (results.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const res of results) {
      // dimension_values follow dimension_keys, e.g. ["last_90_days", "AM"]; the breakdown value is last.
      const key = res.dimension_values[res.dimension_values.length - 1];
      if (key) counts[key] = (counts[key] ?? 0) + res.value;
    }
    return counts;
  }
}
