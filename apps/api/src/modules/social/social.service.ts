import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PLATFORMS, type Platform } from '@briefluence/shared';
import { Prisma, type SocialAccount } from '@prisma/client';
import { AppError, notFound } from '../../common/app-error';
import { Clock } from '../../common/clock';
import { CryptoService } from '../../common/crypto.service';
import { PrismaService } from '../../common/prisma.service';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { QueueService } from '../../queue/queue.service';
import { publicAccount } from '../influencers/serializers';
import { NotificationsService } from '../notifications/notifications.service';
import { InstagramProvider } from './providers/instagram.provider';
import { MockSocialProvider } from './providers/mock.provider';
import { TikTokProvider } from './providers/tiktok.provider';
import { TokenRevokedError, type SocialProvider, type SocialStats, type TokenSet } from './providers/types';
import { YouTubeProvider } from './providers/youtube.provider';

export const SOCIAL_SYNC_JOB = 'social.sync';

interface OAuthState {
  sub: string;
  platform: Platform;
  nonce: string;
}

@Injectable()
export class SocialService implements OnModuleInit {
  private readonly logger = new Logger(SocialService.name);
  private readonly providers: Record<Platform, SocialProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly jwt: JwtService,
    private readonly queue: QueueService,
    private readonly notifications: NotificationsService,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {
    const mock = (p: Platform) => env.SOCIAL_MOCK.includes(p);
    this.providers = {
      INSTAGRAM: mock('INSTAGRAM') ? new MockSocialProvider('INSTAGRAM') : new InstagramProvider(env),
      TIKTOK: mock('TIKTOK') ? new MockSocialProvider('TIKTOK') : new TikTokProvider(env),
      YOUTUBE: mock('YOUTUBE') ? new MockSocialProvider('YOUTUBE') : new YouTubeProvider(env),
    };
    const real = PLATFORMS.filter((p) => !mock(p));
    this.logger.log(`Social OAuth: real=[${real.join(', ') || 'none'}] mock=[${env.SOCIAL_MOCK.join(', ') || 'none'}]`);
  }

  onModuleInit() {
    this.queue.register<{ accountId: string }>(SOCIAL_SYNC_JOB, async ({ accountId }) => {
      await this.sync(accountId);
    });
  }

  parsePlatform(raw: string): Platform {
    const p = raw.toUpperCase() as Platform;
    if (!PLATFORMS.includes(p)) throw notFound('Platform');
    return p;
  }

  /** OAuth redirect goes through the web origin (Next.js rewrite) so session cookies are sent. */
  redirectUri(platform: Platform) {
    return `${this.env.WEB_URL}/api/v1/social/${platform.toLowerCase()}/callback`;
  }

  async connectUrl(userId: string, platform: Platform): Promise<{ url: string; nonce: string }> {
    const profile = await this.prisma.influencerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) throw new AppError('PROFILE_INCOMPLETE', 'Complete your profile first');
    const nonce = CryptoService.randomToken(16);
    const state = await this.jwt.signAsync({ sub: userId, platform, nonce } satisfies OAuthState, {
      secret: this.env.JWT_EMAIL_SECRET,
      expiresIn: '15m',
    });
    return { url: this.providers[platform].authorizeUrl(state, this.redirectUri(platform)), nonce };
  }

  /** Verifies state (signed + bound to the browser via the nonce cookie), stores tokens and stats. */
  async handleCallback(platform: Platform, code: string, state: string, cookieNonce: string | undefined) {
    let s: OAuthState;
    try {
      s = await this.jwt.verifyAsync<OAuthState>(state, { secret: this.env.JWT_EMAIL_SECRET });
    } catch {
      throw new AppError('INVALID_TOKEN', 'Connection link expired, try again');
    }
    if (s.platform !== platform || !cookieNonce || s.nonce !== cookieNonce) {
      throw new AppError('INVALID_TOKEN', 'Connection could not be verified, try again');
    }
    const profile = await this.prisma.influencerProfile.findUnique({ where: { userId: s.sub } });
    if (!profile) throw new AppError('PROFILE_INCOMPLETE', 'Complete your profile first');

    const provider = this.providers[platform];
    const tokens = await provider.exchangeCode(code, this.redirectUri(platform));
    const stats = await provider.fetchStats(tokens.accessToken);

    const existing = await this.prisma.socialAccount.findUnique({
      where: { platform_externalId: { platform, externalId: stats.externalId } },
    });
    if (existing && existing.influencerId !== profile.id) {
      throw new AppError('CONFLICT', 'This account is already connected to another profile');
    }
    const data = { ...this.statsData(stats), ...this.tokenData(tokens), tokenRevokedAt: null, lastSyncedAt: this.clock.now() };
    const account = existing
      ? await this.prisma.socialAccount.update({ where: { id: existing.id }, data })
      : await this.prisma.socialAccount.create({ data: { influencerId: profile.id, platform, ...data } });
    return publicAccount(account);
  }

  async listMine(userId: string) {
    const accounts = await this.prisma.socialAccount.findMany({
      where: { influencer: { userId } },
      orderBy: { createdAt: 'asc' },
    });
    return accounts.map(publicAccount);
  }

  private async owned(userId: string, accountId: string): Promise<SocialAccount> {
    const acc = await this.prisma.socialAccount.findFirst({ where: { id: accountId, influencer: { userId } } });
    if (!acc) throw notFound('Social account');
    return acc;
  }

  async syncMine(userId: string, accountId: string) {
    await this.owned(userId, accountId);
    const result = await this.sync(accountId);
    if (result === 'revoked') throw new AppError('INVALID_TOKEN', 'Access was revoked. Reconnect the account.');
    return publicAccount(await this.prisma.socialAccount.findUniqueOrThrow({ where: { id: accountId } }));
  }

  async disconnect(userId: string, accountId: string) {
    const acc = await this.owned(userId, accountId);
    const activeApplications = await this.prisma.application.count({
      where: { socialAccountId: acc.id, status: { in: ['APPLIED', 'VIEWED', 'SHORTLISTED', 'ACCEPTED'] } },
    });
    if (activeApplications > 0) {
      throw new AppError('CONFLICT', 'This account is used in active applications. Withdraw or finish them first.');
    }
    await this.prisma.socialAccount.delete({ where: { id: acc.id } });
    const remaining = await this.prisma.socialAccount.count({ where: { influencerId: acc.influencerId } });
    if (remaining === 0) {
      // A pending review without any accounts makes no sense; go back to draft.
      await this.prisma.influencerProfile.updateMany({
        where: { id: acc.influencerId, status: 'PENDING_REVIEW' },
        data: { status: 'DRAFT' },
      });
    }
  }

  /** Refreshes tokens and stats. A revoked token flags the account and emails the influencer once. */
  async sync(accountId: string): Promise<'ok' | 'revoked' | 'missing'> {
    const acc = await this.prisma.socialAccount.findUnique({
      where: { id: accountId },
      include: { influencer: { select: { userId: true } } },
    });
    if (!acc) return 'missing';
    const provider = this.providers[acc.platform];
    const now = this.clock.now();
    try {
      let tokens: TokenSet = {
        accessToken: this.crypto.decrypt(acc.accessTokenEnc),
        refreshToken: acc.refreshTokenEnc ? this.crypto.decrypt(acc.refreshTokenEnc) : null,
        expiresAt: acc.tokenExpiresAt,
      };
      const refreshed = await provider.refreshIfNeeded(tokens, now);
      if (refreshed) tokens = refreshed;
      const stats = await provider.fetchStats(tokens.accessToken);
      await this.prisma.socialAccount.update({
        where: { id: acc.id },
        data: {
          ...this.statsData(stats),
          ...(refreshed ? this.tokenData(tokens) : {}),
          tokenRevokedAt: null,
          lastSyncedAt: now,
        },
      });
      return 'ok';
    } catch (err) {
      if (!(err instanceof TokenRevokedError)) throw err;
      if (!acc.tokenRevokedAt) {
        await this.prisma.socialAccount.update({ where: { id: acc.id }, data: { tokenRevokedAt: now } });
        await this.notifications.notify(acc.influencer.userId, 'SOCIAL_TOKEN_REVOKED', {
          title: 'Reconnect your account',
          body: `We lost access to your ${acc.platform.toLowerCase()} account @${acc.username}. Reconnect it so brands see up-to-date stats.`,
          link: '/influencer/verification',
        });
      }
      return 'revoked';
    }
  }

  /** Weekly job: queue a sync for every connected account. */
  async enqueueAllSyncs() {
    const accounts = await this.prisma.socialAccount.findMany({ where: { tokenRevokedAt: null }, select: { id: true } });
    for (const a of accounts) await this.queue.add(SOCIAL_SYNC_JOB, { accountId: a.id });
    this.logger.log(`Queued ${accounts.length} social syncs`);
    return accounts.length;
  }

  private statsData(s: SocialStats) {
    const json = (v: unknown) => (v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue));
    return {
      externalId: s.externalId,
      username: s.username,
      profileUrl: s.profileUrl,
      avatarUrl: s.avatarUrl,
      followers: s.followers,
      mediaCount: s.mediaCount,
      avgViews: s.avgViews,
      engagementRate: s.engagementRate,
      audienceGender: json(s.audienceGender),
      audienceAge: json(s.audienceAge),
      audienceCountries: json(s.audienceCountries),
    };
  }

  private tokenData(t: TokenSet) {
    return {
      accessTokenEnc: this.crypto.encrypt(t.accessToken),
      refreshTokenEnc: t.refreshToken ? this.crypto.encrypt(t.refreshToken) : null,
      tokenExpiresAt: t.expiresAt ?? null,
    };
  }
}
