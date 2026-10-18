import { Injectable } from '@nestjs/common';
import { Prisma, type SocialAccount } from '@prisma/client';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Same account on the same platform: by handle (works for manual ones) or by platform id. */
export function sameAccountWhere(a: {
  platform: SocialAccount['platform'];
  username: string;
  externalId?: string | null;
  source?: string;
}): Prisma.SocialAccountLinkWhereInput {
  const handle = a.username.replace(/^@/, '').toLowerCase();
  const externalId = a.source === 'OAUTH' ? a.externalId : null;
  return { platform: a.platform, OR: [{ handle }, ...(externalId ? [{ externalId }] : [])] };
}

/**
 * Keeps a history of which user linked which social account and when. If an account shows up
 * on a different user than before, admins get a re-registration warning; the blogger is not
 * blocked — the admin decides.
 */
@Injectable()
export class AccountLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly clock: Clock,
  ) {}

  /** Call after an account is created, or its platform / handle changed. */
  async record(account: SocialAccount) {
    const profile = await this.prisma.influencerProfile.findUniqueOrThrow({
      where: { id: account.influencerId },
      select: { userId: true, displayName: true, user: { select: { email: true } } },
    });
    const now = this.clock.now();
    // A changed handle closes the previous link of this account.
    await this.prisma.socialAccountLink.updateMany({
      where: { socialAccountId: account.id, unlinkedAt: null },
      data: { unlinkedAt: now },
    });
    const others = await this.prisma.socialAccountLink.count({
      where: {
        ...sameAccountWhere(account),
        OR: [{ userId: null }, { userId: { not: profile.userId } }],
      },
    });
    await this.prisma.socialAccountLink.create({
      data: {
        platform: account.platform,
        handle: account.username.replace(/^@/, '').toLowerCase(),
        externalId: account.source === 'OAUTH' ? account.externalId : null,
        socialAccountId: account.id,
        userId: profile.userId,
        email: profile.user.email,
        displayName: profile.displayName,
        linkedAt: now,
      },
    });
    if (others > 0) {
      // A new reuse needs a fresh look even if an earlier one was allowed.
      await this.prisma.socialAccount.update({
        where: { id: account.id },
        data: { reuseReviewedAt: null },
      });
      await this.notifications.notifyAdmins('SOCIAL_ACCOUNT_REUSED', {
        params: {
          platform: account.platform,
          username: account.username,
          name: profile.displayName,
        },
        link: '/admin/accounts',
      });
    }
  }

  /** Call before an account is deleted. */
  async unlink(accountId: string) {
    await this.prisma.socialAccountLink.updateMany({
      where: { socialAccountId: accountId, unlinkedAt: null },
      data: { unlinkedAt: this.clock.now() },
    });
  }

  /**
   * Accounts (optionally only these) that were linked to another user before and whose warning
   * the admin has not cleared. One query over the link history.
   */
  async flaggedIds(accountIds?: string[]): Promise<Set<string>> {
    if (accountIds && !accountIds.length) return new Set();
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT s."id" FROM "SocialAccount" s
      JOIN "InfluencerProfile" p ON p."id" = s."influencerId"
      WHERE s."reuseReviewedAt" IS NULL
        ${accountIds ? Prisma.sql`AND s."id" IN (${Prisma.join(accountIds)})` : Prisma.empty}
        AND EXISTS (
          SELECT 1 FROM "SocialAccountLink" l
          WHERE l."platform" = s."platform"
            AND (l."handle" = lower(s."username") OR (s."source" = 'OAUTH' AND l."externalId" = s."externalId"))
            AND (l."userId" IS NULL OR l."userId" <> p."userId")
        )`;
    return new Set(rows.map((r) => r.id));
  }

  /** Full history of this account across users, newest first. */
  history(account: Pick<SocialAccount, 'platform' | 'username' | 'externalId' | 'source'>) {
    return this.prisma.socialAccountLink.findMany({
      where: sameAccountWhere(account),
      orderBy: { linkedAt: 'desc' },
      take: 50,
      include: { user: { select: { id: true, email: true, role: true, blockedAt: true } } },
    });
  }
}
