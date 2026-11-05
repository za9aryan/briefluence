import { Injectable } from '@nestjs/common';
import {
  APPLICATION_STATUSES,
  hasAccess,
  trialDaysLeft,
  type ApplicationStatus,
  type InfluencerProfileData,
  answeredFaq,
  isAccountUsable,
  isPortfolioVisible,
} from '@briefluence/shared';
import { Prisma } from '@prisma/client';
import { AppError, notFound } from '../../common/app-error';
import type { AuthUser } from '../../common/auth-user';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { publicPortfolioItem } from './portfolio.service';
import { publicAccount } from './serializers';

/** Active offers shown on a blogger's profile (newest first). */
const PROFILE_OFFERS = {
  where: { status: 'ACTIVE' },
  orderBy: { publishedAt: 'desc' },
  select: {
    id: true,
    title: true,
    imageUrl: true,
    priceMinor: true,
    currency: true,
    collaborationType: true,
    platforms: true,
    contentFormats: true,
  },
} satisfies Prisma.InfluencerProfile$offersArgs;

const PROFILE_INCLUDE = {
  socialAccounts: { orderBy: { followers: 'desc' } },
  portfolio: { orderBy: { createdAt: 'desc' } },
  offers: PROFILE_OFFERS,
} satisfies Prisma.InfluencerProfileInclude;

type ProfileWithParts = Prisma.InfluencerProfileGetPayload<{ include: typeof PROFILE_INCLUDE }>;

/** Who is looking at a public profile page; decides how much of it they see. */
export type ProfileAccess = 'admin' | 'brand' | 'owner' | 'guest';

@Injectable()
export class InfluencersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly clock: Clock,
  ) {}

  async getMine(userId: string) {
    const p = await this.prisma.influencerProfile.findUnique({
      where: { userId },
      include: { socialAccounts: { orderBy: { createdAt: 'asc' } } },
    });
    if (!p) return null;
    const { socialAccounts, ...rest } = p;
    return { ...rest, socialAccounts: socialAccounts.map(publicAccount) };
  }

  /** Creates or updates the profile. The free month is started separately, by the blogger (POST /billing/trial). */
  async upsertMine(userId: string, data: InfluencerProfileData) {
    await this.prisma.influencerProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return this.getMine(userId);
  }

  async submitForReview(userId: string) {
    const p = await this.prisma.influencerProfile.findUnique({
      where: { userId },
      include: { socialAccounts: { where: { tokenRevokedAt: null }, select: { id: true } } },
    });
    if (!p) throw new AppError('PROFILE_INCOMPLETE', 'Complete your profile first');
    if (p.status === 'PENDING_REVIEW' || p.status === 'APPROVED') {
      throw new AppError('INVALID_TRANSITION', 'Profile is already submitted');
    }
    if (p.socialAccounts.length === 0) {
      throw new AppError('PROFILE_INCOMPLETE', 'Connect at least one social account');
    }
    await this.prisma.influencerProfile.update({
      where: { id: p.id },
      data: { status: 'PENDING_REVIEW', submittedAt: this.clock.now(), rejectionReason: null },
    });
    await this.notifications.notifyAdmins('VERIFICATION_PENDING', {
      params: { name: p.displayName },
      link: '/admin/verifications',
    });
    return this.getMine(userId);
  }

  async saveFilters(userId: string, filters: unknown) {
    await this.prisma.influencerProfile.update({
      where: { userId },
      data: { savedFilters: (filters ?? Prisma.JsonNull) as Prisma.InputJsonValue },
    });
  }

  async dashboard(userId: string) {
    const p = await this.prisma.influencerProfile.findUnique({ where: { userId } });
    if (!p) throw new AppError('PROFILE_INCOMPLETE', 'Complete your profile first');
    const [groups, sub] = await Promise.all([
      this.prisma.application.groupBy({
        by: ['status'],
        where: { influencerId: p.id },
        _count: true,
      }),
      this.prisma.subscription.findUnique({ where: { userId } }),
    ]);
    const byStatus = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as Record<
      ApplicationStatus,
      number
    >;
    for (const g of groups) byStatus[g.status] = g._count;
    const now = this.clock.now();
    return {
      applications: Object.values(byStatus).reduce((a, b) => a + b, 0),
      accepted: byStatus.ACCEPTED + byStatus.COMPLETED,
      completed: byStatus.COMPLETED,
      byStatus,
      profileViews: p.profileViews,
      verificationStatus: p.status,
      trialDaysLeft: sub ? trialDaysLeft(sub, now) : 0,
      subscriptionStatus: sub?.status ?? null,
      hasAccess: hasAccess(sub, now),
    };
  }

  /**
   * Public profile for brands (approved influencers only). Contacts are included only when the
   * viewing brand has accepted this influencer on one of its deals.
   */
  async getForViewer(viewer: AuthUser, influencerId: string) {
    const p = await this.prisma.influencerProfile.findUnique({
      where: { id: influencerId },
      include: PROFILE_INCLUDE,
    });
    if (!p || (p.status !== 'APPROVED' && viewer.role !== 'ADMIN')) throw notFound('Influencer');

    let showContacts = viewer.role === 'ADMIN';
    if (viewer.role === 'BRAND') {
      const accepted = await this.prisma.application.findFirst({
        where: {
          influencerId,
          status: { in: ['ACCEPTED', 'COMPLETED'] },
          deal: { brand: { userId: viewer.id } },
        },
        select: { id: true },
      });
      showContacts = !!accepted;
      await this.prisma.influencerProfile.update({
        where: { id: p.id },
        data: { profileViews: { increment: 1 } },
      });
    }
    return {
      ...this.publicView(p, { admin: viewer.role === 'ADMIN', showContacts }),
      access: (viewer.role === 'ADMIN' ? 'admin' : 'brand') as ProfileAccess,
    };
  }

  // ─── Public page: briefluence.com/@username ─────────────

  /** Sets (or with null removes) the blogger's public link name. */
  async setUsername(userId: string, username: string | null) {
    try {
      await this.prisma.influencerProfile.update({ where: { userId }, data: { username } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
        throw new AppError('USERNAME_TAKEN', 'This username is taken');
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025')
        throw new AppError('PROFILE_INCOMPLETE', 'Complete your profile first');
      throw e;
    }
    return this.getMine(userId);
  }

  /**
   * The public page by username. Live only for verified, active bloggers (the owner and admins
   * also see it before that). Brands and admins get the full brand view; everyone else (guests,
   * other bloggers) gets the guest view without numbers, prices or contacts.
   */
  async getByUsername(viewer: AuthUser | undefined, username: string) {
    const p = await this.prisma.influencerProfile.findUnique({
      where: { username: username.toLowerCase() },
      include: { ...PROFILE_INCLUDE, user: { select: { blockedAt: true } } },
    });
    const owner = !!viewer && p?.userId === viewer.id;
    const live = !!p && p.status === 'APPROVED' && !p.user.blockedAt;
    if (!p || (!live && !owner && viewer?.role !== 'ADMIN')) throw notFound('Influencer');
    if (viewer?.role === 'BRAND' || viewer?.role === 'ADMIN')
      return { ...(await this.getForViewer(viewer, p.id)), username: p.username, live };
    if (owner)
      return {
        ...this.publicView(p, { admin: false, showContacts: false }),
        access: 'owner' as ProfileAccess,
        live,
      };
    return { ...this.guestView(p), live };
  }

  /** Usernames of live public pages, for the sitemap. */
  async publicUsernames() {
    const rows = await this.prisma.influencerProfile.findMany({
      where: { username: { not: null }, status: 'APPROVED', user: { blockedAt: null } },
      select: { username: true, approvedAt: true },
      orderBy: { approvedAt: 'desc' },
      take: 5000,
    });
    return rows.map((r) => ({ username: r.username!, approvedAt: r.approvedAt }));
  }

  /** What a signed-out visitor sees: who the blogger is and their work, no stats or prices. */
  private guestView(p: ProfileWithParts) {
    return {
      access: 'guest' as ProfileAccess,
      id: p.id,
      username: p.username,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      bio: p.bio,
      country: p.country,
      city: p.city,
      languages: p.languages,
      niches: p.niches,
      verified: p.status === 'APPROVED',
      socialAccounts: p.socialAccounts.filter(isAccountUsable).map((a) => ({
        id: a.id,
        platform: a.platform,
        username: a.username,
        profileUrl: a.profileUrl,
      })),
      contacts: null,
      faq: answeredFaq(p),
      portfolio: p.portfolio
        .filter(isPortfolioVisible)
        .map((i) => ({ ...publicPortfolioItem(i), reviewNote: null })),
      offers: p.offers.map(({ priceMinor, currency: _c, ...o }) => ({
        ...o,
        priceMinor: null,
        currency: null,
        hasPrice: priceMinor != null,
      })),
    };
  }

  /**
   * "See how brands see me": the blogger's own profile in exactly the brand view (contacts hidden
   * as before acceptance, only approved accounts and work). No view is counted. `status` tells the
   * page whether brands can see it yet (only verified profiles are shown to brands).
   */
  async previewForBrands(userId: string) {
    const p = await this.prisma.influencerProfile.findUnique({
      where: { userId },
      include: PROFILE_INCLUDE,
    });
    if (!p) throw notFound('Influencer');
    return {
      ...this.publicView(p, { admin: false, showContacts: false }),
      access: 'owner' as ProfileAccess,
      status: p.status,
    };
  }

  private publicView(
    p: ProfileWithParts,
    { admin, showContacts }: { admin: boolean; showContacts: boolean },
  ) {
    return {
      id: p.id,
      username: p.username,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      bio: p.bio,
      country: p.country,
      city: p.city,
      gender: p.gender,
      birthYear: p.birthYear,
      languages: p.languages,
      niches: p.niches,
      verified: p.status === 'APPROVED',
      approvedAt: p.approvedAt,
      // Brands see only accounts an admin approved.
      socialAccounts: p.socialAccounts
        .filter((a) => admin || isAccountUsable(a))
        .map(publicAccount),
      contacts: showContacts ? { method: p.contactMethod, value: p.contactValue } : null,
      // Only answered questions and approved work; brands see nothing for empty sections.
      faq: answeredFaq(p),
      portfolio: p.portfolio.filter((i) => admin || isPortfolioVisible(i)).map(publicPortfolioItem),
      offers: p.offers.map((o) => ({ ...o, hasPrice: o.priceMinor != null })),
    };
  }
}
