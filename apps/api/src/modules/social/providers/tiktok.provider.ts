import { ENGAGEMENT_SAMPLE_SIZE, averageViews, engagementRate } from '@briefluence/shared';
import type { Env } from '../../../config/env';
import { fetchJson, ProviderError, TokenRevokedError, type SocialProvider, type SocialStats, type TokenSet } from './types';

/**
 * TikTok Login Kit (web) + Display API. Audience demographics are not available from this API,
 * so match scoring gives half points for those factors.
 * Docs:
 *  - Authorize: https://developers.tiktok.com/doc/login-kit-web
 *  - Tokens: https://developers.tiktok.com/doc/oauth-user-access-token-management
 *  - User info: https://developers.tiktok.com/doc/tiktok-api-v2-get-user-info
 *  - Video list: https://developers.tiktok.com/doc/tiktok-api-v2-video-list
 */
export class TikTokProvider implements SocialProvider {
  readonly platform = 'TIKTOK' as const;
  constructor(private readonly env: Env) {}

  authorizeUrl(state: string, redirectUri: string) {
    const q = new URLSearchParams({
      client_key: this.env.TIKTOK_CLIENT_KEY ?? '',
      response_type: 'code',
      scope: 'user.info.basic,user.info.profile,user.info.stats,video.list',
      redirect_uri: redirectUri,
      state,
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
  }

  private async token(params: Record<string, string>): Promise<TokenSet> {
    type T = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
    const r = await fetchJson<T>('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: this.env.TIKTOK_CLIENT_KEY ?? '',
        client_secret: this.env.TIKTOK_CLIENT_SECRET ?? '',
        ...params,
      }),
    });
    if (r.body.error === 'invalid_grant') throw new TokenRevokedError();
    if (!r.body.access_token) throw new ProviderError(`TikTok token request failed (${r.status})`);
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
    // Access tokens live 24h; refresh tokens 365 days and may rotate.
    if (tokens.expiresAt && tokens.expiresAt.getTime() - now.getTime() > 60 * 60_000) return null;
    if (!tokens.refreshToken) throw new TokenRevokedError('No refresh token');
    const next = await this.token({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken });
    return { ...next, refreshToken: next.refreshToken ?? tokens.refreshToken };
  }

  private check(status: number, body: { error?: { code?: string } }, what: string) {
    if (body.error?.code === 'access_token_invalid' || status === 401) throw new TokenRevokedError();
    if (status >= 400 || (body.error?.code && body.error.code !== 'ok')) {
      throw new ProviderError(`TikTok ${what} failed (${status} ${body.error?.code ?? ''})`);
    }
  }

  async fetchStats(token: string): Promise<SocialStats> {
    type User = {
      data?: {
        user?: {
          open_id: string;
          username?: string;
          display_name?: string;
          avatar_url?: string;
          follower_count?: number;
          video_count?: number;
          profile_deep_link?: string;
        };
      };
      error?: { code?: string };
    };
    const fields = 'open_id,username,display_name,avatar_url,follower_count,likes_count,video_count,profile_deep_link';
    const u = await fetchJson<User>(`https://open.tiktokapis.com/v2/user/info/?fields=${fields}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    this.check(u.status, u.body, 'user info');
    const user = u.body.data?.user;
    if (!user) throw new ProviderError('TikTok user info missing');

    type Videos = {
      data?: { videos?: { view_count?: number; like_count?: number; comment_count?: number }[] };
      error?: { code?: string };
    };
    const v = await fetchJson<Videos>(
      'https://open.tiktokapis.com/v2/video/list/?fields=id,view_count,like_count,comment_count',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_count: ENGAGEMENT_SAMPLE_SIZE }),
      },
    );
    this.check(v.status, v.body, 'video list');
    const videos = v.body.data?.videos ?? [];
    const followers = user.follower_count ?? 0;
    const username = user.username ?? user.display_name ?? user.open_id;

    return {
      externalId: user.open_id,
      username,
      profileUrl: user.username ? `https://www.tiktok.com/@${user.username}` : (user.profile_deep_link ?? ''),
      avatarUrl: user.avatar_url ?? null,
      followers,
      mediaCount: user.video_count ?? null,
      avgViews: averageViews(videos.map((x) => x.view_count ?? 0)),
      engagementRate: engagementRate(
        videos.map((x) => ({ likes: x.like_count ?? 0, comments: x.comment_count ?? 0 })),
        followers,
      ),
      audienceGender: null,
      audienceAge: null,
      audienceCountries: null,
    };
  }
}
