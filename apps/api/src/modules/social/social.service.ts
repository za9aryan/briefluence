import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  needsAccountReview,
  PLATFORMS,
  profileUrlFor,
  type ManualAccountInput,
  type Platform,
} from '@briefluence/shared';
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
import { AccountLinksService } from './account-links.service';
import { InstagramProvider } from './providers/instagram.provider';
import { MockSocialProvider } from './providers/mock.provider';
import { TikTokProvider } from './providers/tiktok.provider';
import {
  TokenRevokedError,
  type SocialProvider,
  type SocialStats,
  type TokenSet,
} from './providers/types';
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
    private readonly links: AccountLinksService,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {
    const mock = (p: Platform) => env.SOCIAL_MOCK.includes(p);
    this.providers = {
      INSTAGRAM: mock('INSTAGRAM')
        ? new MockSocialProvider('INSTAGRAM')
        : new InstagramProvider(env),
      TIKTOK: mock('TIKTOK') ? new MockSocialProvider('TIKTOK') : new TikTokProvider(env),
      YOUTUBE: mock('YOUTUBE') ? new MockSocialProvider('YOUTUBE') : new YouTubeProvider(env),
    };
    const real = PLATFORMS.filter((p) => !mock(p));
    this.logger.log(
      `Social OAuth: real=[${real.join(', ') || 'none'}] mock=[${env.SOCIAL_MOCK.join(', ') || 'none'}]`,
    );
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
    const profile = await this.prisma.influencerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new AppError('PROFILE_INCOMPLETE', 'Complete your profile first');
    const nonce = CryptoService.randomToken(16);
    const state = await this.jwt.signAsync({ sub: userId, platform, nonce } satisfies OAuthState, {
      secret: this.env.JWT_EMAIL_SECRET,
      expiresIn: '15m',
    });
    return { url: this.providers[platform].authorizeUrl(state, this.redirectUri(platform)), nonce };
  }

  /** Verifies state (signed + bound to the browser via the nonce cookie), stores tokens and stats. */
  async handleCallback(
    platform: Platform,
    code: string,
    state: string,
    cookieNonce: string | undefined,
  ) {
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
    // Reconnecting the same account is fine; a second account on this platform is not.
    if (!existing) await this.assertPlatformFree(profile.id, platform);
    const data = {
      ...this.statsData(stats),
      ...this.tokenData(tokens),
      tokenRevokedAt: null,
      lastSyncedAt: this.clock.now(),
    };
    // New accounts start in review; reconnecting a rejected one asks for a new review.
    const toReview = !existing || existing.reviewStatus === 'REJECTED';
    const account = existing
      ? await this.prisma.socialAccount.update({
          where: { id: existing.id },
          data: {
            ...data,
            ...(toReview ? { reviewStatus: 'PENDING' as const, reviewNote: null } : {}),
          },
        })
      : await this.prisma.socialAccount.create({
          data: { influencerId: profile.id, platform, ...data },
        });
    if (!existing) await this.links.record(account);
    if (toReview) await this.askForReview(account);
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
    const acc = await this.prisma.socialAccount.findFirst({
      where: { id: accountId, influencer: { userId } },
    });
    if (!acc) throw notFound('Social account');
    return acc;
  }

  /** Blogger adds an account by hand. Its numbers are self-reported and labelled as such. */
  async addManual(userId: string, input: ManualAccountInput) {
    const profile = await this.prisma.influencerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new AppError('PROFILE_INCOMPLETE', 'Complete your profile first');
    await this.assertPlatformFree(profile.id, input.platform);
    const sameHandle = await this.prisma.socialAccount.findFirst({
      where: {
        platform: input.platform,
        username: { equals: input.username, mode: 'insensitive' },
      },
      select: { influencerId: true },
    });
    if (sameHandle) {
      throw new AppError(
        'SOCIAL_ACCOUNT_TAKEN',
        sameHandle.influencerId === profile.id
          ? 'You already added this account'
          : 'This account is already added to another profile',
      );
    }
    const account = await this.prisma.socialAccount.create({
      data: {
        influencerId: profile.id,
        platform: input.platform,
        source: 'MANUAL',
        externalId: `manual:${input.username.toLowerCase()}`,
        ...this.manualData(input),
      },
    });
    await this.links.record(account);
    await this.askForReview(account);
    return publicAccount(account);
  }

  async updateManual(userId: string, accountId: string, input: ManualAccountInput) {
    const acc = await this.owned(userId, accountId);
    if (acc.source !== 'MANUAL')
      throw new AppError('CONFLICT', 'Connected accounts update from the platform');
    if (input.platform !== acc.platform)
      await this.assertPlatformFree(acc.influencerId, input.platform);
    if (
      input.platform !== acc.platform ||
      input.username.toLowerCase() !== acc.username.toLowerCase()
    ) {
      const taken = await this.prisma.socialAccount.findFirst({
        where: {
          id: { not: acc.id },
          platform: input.platform,
          username: { equals: input.username, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (taken) throw new AppError('SOCIAL_ACCOUNT_TAKEN', 'This account is already added');
    }
    const review = needsAccountReview(acc, input);
    const updated = await this.prisma.socialAccount.update({
      where: { id: acc.id },
      data: {
        platform: input.platform,
        externalId: `manual:${input.username.toLowerCase()}`,
        ...this.manualData(input),
        ...(review ? { reviewStatus: 'PENDING' as const, reviewNote: null } : {}),
      },
    });
    if (
      updated.platform !== acc.platform ||
      updated.username.toLowerCase() !== acc.username.toLowerCase()
    )
      await this.links.record(updated);
    if (review) await this.askForReview(updated);
    return publicAccount(updated);
  }

  /**
   * New or changed accounts of an already approved blogger go to the admin account queue. Accounts
   * added before the first approval are reviewed together with the profile.
   */
  private async askForReview(account: SocialAccount) {
    const profile = await this.prisma.influencerProfile.findUnique({
      where: { id: account.influencerId },
      select: { status: true, displayName: true },
    });
    if (profile?.status !== 'APPROVED') return;
    await this.notifications.notifyAdmins('SOCIAL_ACCOUNT_PENDING', {
      params: { name: profile.displayName, platform: account.platform, username: account.username },
      link: '/admin/accounts',
    });
  }

  /** One account per platform per blogger (also enforced by a unique index). */
  private async assertPlatformFree(influencerId: string, platform: Platform) {
    const has = await this.prisma.socialAccount.findFirst({
      where: { influencerId, platform },
      select: { id: true },
    });
    if (has)
      throw new AppError(
        'SOCIAL_PLATFORM_TAKEN',
        `You already have a ${platform.toLowerCase()} account. Remove it first to add another one.`,
      );
  }

  private manualData(i: ManualAccountInput) {
    const json = (v: unknown) => (v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue));
    return {
      username: i.username,
      profileUrl: i.profileUrl ?? profileUrlFor(i.platform, i.username),
      followers: i.followers,
      avgViews: i.avgViews,
      engagementRate: i.engagementRate,
      audienceGender: json(
        i.audienceFemale == null
          ? null
          : { female: i.audienceFemale, male: Math.round((100 - i.audienceFemale) * 10) / 10 },
      ),
      audienceCountries: json(
        i.topCountry && i.topCountryShare != null ? { [i.topCountry]: i.topCountryShare } : null,
      ),
      audienceAge: json(i.topAge && i.topAgeShare != null ? { [i.topAge]: i.topAgeShare } : null),
      lastSyncedAt: this.clock.now(),
    };
  }

  async syncMine(userId: string, accountId: string) {
    const own = await this.owned(userId, accountId);
    if (own.source === 'MANUAL')
      throw new AppError('CONFLICT', 'Manually added accounts are updated by editing them');
    const result = await this.sync(accountId);
    if (result === 'revoked')
      throw new AppError('INVALID_TOKEN', 'Access was revoked. Reconnect the account.');
    return publicAccount(
      await this.prisma.socialAccount.findUniqueOrThrow({ where: { id: accountId } }),
    );
  }

  async disconnect(userId: string, accountId: string) {
    const acc = await this.owned(userId, accountId);
    const activeApplications = await this.prisma.application.count({
      where: {
        socialAccountId: acc.id,
        status: { in: ['APPLIED', 'VIEWED', 'SHORTLISTED', 'ACCEPTED'] },
      },
    });
    if (activeApplications > 0) {
      throw new AppError(
        'CONFLICT',
        'This account is used in active applications. Withdraw or finish them first.',
      );
    }
    await this.links.unlink(acc.id);
    await this.prisma.socialAccount.delete({ where: { id: acc.id } });
    const remaining = await this.prisma.socialAccount.count({
      where: { influencerId: acc.influencerId },
    });
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
    if (acc.source === 'MANUAL' || !acc.accessTokenEnc) return 'ok'; // nothing to fetch
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
        await this.prisma.socialAccount.update({
          where: { id: acc.id },
          data: { tokenRevokedAt: now },
        });
        await this.notifications.notify(acc.influencer.userId, 'SOCIAL_TOKEN_REVOKED', {
          params: { platform: acc.platform, username: acc.username },
          link: '/influencer/verification',
        });
      }
      return 'revoked';
    }
  }

  /** Weekly job: queue a sync for every connected account. */
  async enqueueAllSyncs() {
    const accounts = await this.prisma.socialAccount.findMany({
      where: { tokenRevokedAt: null, source: 'OAUTH' },
      select: { id: true },
    });
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
