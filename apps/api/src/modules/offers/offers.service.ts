import { Injectable } from '@nestjs/common';
import {
  canOfferTransition,
  canPublishAnotherOffer,
  effectiveTier,
  isAccountUsable,
  isOfferEditable,
  offerContactsRevealed,
  offerPublishTarget,
  offerReviewKey,
  TIMEZONE,
  type OfferFeedQuery,
  type OfferInput,
  type OfferRequestInput,
  type OfferStatus,
} from '@briefluence/shared';
import type { Offer, Prisma } from '@prisma/client';
import { AppError, forbidden, notFound } from '../../common/app-error';
import type { AuthUser } from '../../common/auth-user';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../common/prisma.service';
import { toState } from '../billing/billing.service';
import { BrandsService } from '../brands/brands.service';
import { publicAccount } from '../influencers/serializers';
import { NotificationsService } from '../notifications/notifications.service';

/** Blogger card as brands see it: public profile + approved accounts, never contacts. */
const BLOGGER_CARD = {
  select: {
    id: true,
    displayName: true,
    avatarUrl: true,
    country: true,
    city: true,
    niches: true,
    status: true,
    userId: true,
    socialAccounts: true,
  },
} as const;
type BloggerRow = Prisma.InfluencerProfileGetPayload<typeof BLOGGER_CARD>;

const bloggerCard = (p: BloggerRow) => ({
  id: p.id,
  displayName: p.displayName,
  avatarUrl: p.avatarUrl,
  country: p.country,
  city: p.city,
  niches: p.niches,
  verified: p.status === 'APPROVED',
  socialAccounts: p.socialAccounts
    .filter(isAccountUsable)
    .sort((a, b) => b.followers - a.followers)
    .map(publicAccount),
});

/** Review data is for the blogger and admins only. */
const forBrand = ({
  approvedKey: _k,
  reviewNote: _n,
  reviewedAt: _r,
  submittedAt: _s,
  ...o
}: Offer) => o;

const LIVE: OfferStatus[] = ['IN_REVIEW', 'ACTIVE', 'PAUSED'];

/**
 * Blogger offers ("1 Story for 10,000 AMD"): bloggers publish them (admin-reviewed), brands
 * browse and send requests, the blogger accepts → both see each other's contacts.
 */
@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brands: BrandsService,
    private readonly notifications: NotificationsService,
    private readonly clock: Clock,
  ) {}

  // ─── Blogger side ────────────────────────────────────────

  private async profileOf(userId: string) {
    const p = await this.prisma.influencerProfile.findUnique({ where: { userId } });
    if (!p) throw new AppError('PROFILE_INCOMPLETE', 'Complete your profile first');
    return p;
  }

  private async ownOffer(userId: string, id: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
      include: { influencer: { select: { userId: true, displayName: true } } },
    });
    if (!offer) throw notFound('Offer');
    if (offer.influencer.userId !== userId) throw forbidden();
    return offer;
  }

  async create(userId: string, data: OfferInput) {
    const profile = await this.profileOf(userId);
    return this.prisma.offer.create({
      data: { ...data, influencerId: profile.id, status: 'DRAFT' },
    });
  }

  async update(userId: string, id: string, data: OfferInput) {
    const offer = await this.ownOffer(userId, id);
    if (!isOfferEditable(offer.status))
      throw new AppError('DEAL_NOT_EDITABLE', 'Pause the offer before editing it');
    return this.prisma.offer.update({ where: { id }, data });
  }

  async listMine(userId: string) {
    const profile = await this.profileOf(userId);
    const offers = await this.prisma.offer.findMany({
      where: { influencerId: profile.id },
      orderBy: { createdAt: 'desc' },
      include: { requests: { select: { status: true } } },
    });
    return offers.map(({ requests, ...o }) => ({
      ...o,
      requestCount: requests.filter((r) => r.status !== 'WITHDRAWN').length,
      newRequestCount: requests.filter((r) => r.status === 'PENDING').length,
    }));
  }

  /** Live offers allowed by the blogger's current plan (Basic: admin-set, Pro: unlimited). */
  private async offerLimit(userId: string): Promise<number | null> {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    const tier = sub ? effectiveTier(toState(sub), this.clock.now()) : 'BASIC';
    if (tier === 'PRO') return null;
    const basic = await this.prisma.plan.findUnique({
      where: { code: 'BASIC' },
      select: { offerLimit: true },
    });
    return basic?.offerLimit ?? null;
  }

  /**
   * "Publish": admin review unless this exact content was approved before (resuming a paused
   * offer). A new live offer must fit the plan's limit.
   */
  async publish(userId: string, id: string) {
    const offer = await this.ownOffer(userId, id);
    const to = offerPublishTarget(offer);
    if (!canOfferTransition(offer.status, to)) {
      throw new AppError(
        'INVALID_TRANSITION',
        `Cannot publish a ${offer.status.toLowerCase()} offer`,
      );
    }
    if (!LIVE.includes(offer.status)) {
      const limit = await this.offerLimit(userId);
      const live = await this.prisma.offer.count({
        where: { influencerId: offer.influencerId, status: { in: LIVE }, id: { not: id } },
      });
      if (!canPublishAnotherOffer(live, limit)) {
        throw new AppError('OFFER_LIMIT_REACHED', 'Your plan allows no more live offers', {
          limit,
          live,
        });
      }
    }
    const now = this.clock.now();
    const updated = await this.prisma.offer.update({
      where: { id },
      data: {
        status: to,
        ...(to === 'IN_REVIEW' ? { submittedAt: now } : {}),
        ...(to === 'ACTIVE' && !offer.publishedAt ? { publishedAt: now } : {}),
      },
    });
    if (to === 'IN_REVIEW') {
      await this.notifications.notifyAdmins('OFFER_REVIEW_PENDING', {
        params: { name: offer.influencer.displayName, offer: offer.title },
        link: '/admin/offer-review',
      });
    }
    return updated;
  }

  async transition(userId: string, id: string, to: 'PAUSED' | 'CLOSED') {
    const offer = await this.ownOffer(userId, id);
    if (!canOfferTransition(offer.status, to)) {
      throw new AppError(
        'INVALID_TRANSITION',
        `Cannot change a ${offer.status.toLowerCase()} offer to ${to.toLowerCase()}`,
      );
    }
    return this.prisma.offer.update({ where: { id }, data: { status: to } });
  }

  /** Requests on one of the blogger's offers; brand contacts only once accepted. */
  async requestsFor(userId: string, offerId: string) {
    await this.ownOffer(userId, offerId);
    const rows = await this.prisma.offerRequest.findMany({
      where: { offerId, status: { not: 'WITHDRAWN' } },
      orderBy: { createdAt: 'desc' },
      include: { brand: true },
    });
    return rows.map(({ brand, ...r }) => ({
      ...r,
      brand: {
        id: brand.id,
        companyName: brand.companyName,
        logoUrl: brand.logoUrl,
        website: brand.website,
        instagramUrl: brand.instagramUrl,
        description: brand.description,
        city: brand.city,
      },
      contacts: offerContactsRevealed(r.status)
        ? {
            name: brand.contactName,
            position: brand.contactPosition,
            method: brand.contactMethod,
            value: brand.contactValue,
          }
        : null,
    }));
  }

  async decide(userId: string, requestId: string, accept: boolean) {
    const req = await this.prisma.offerRequest.findUnique({
      where: { id: requestId },
      include: {
        offer: { include: { influencer: { select: { userId: true, displayName: true } } } },
        brand: { select: { userId: true } },
      },
    });
    if (!req) throw notFound('Request');
    if (req.offer.influencer.userId !== userId) throw forbidden();
    if (req.status !== 'PENDING')
      throw new AppError('INVALID_TRANSITION', 'This request was already answered');
    const status = accept ? 'ACCEPTED' : 'DECLINED';
    await this.prisma.offerRequest.update({
      where: { id: requestId },
      data: { status, decidedAt: this.clock.now() },
    });
    await this.notifications.notify(
      req.brand.userId,
      accept ? 'OFFER_REQUEST_ACCEPTED' : 'OFFER_REQUEST_DECLINED',
      {
        params: { name: req.offer.influencer.displayName, offer: req.offer.title },
        link: accept ? '/brand/offers?tab=requests' : '/brand/offers',
      },
    );
    return { status };
  }

  // ─── Brand side ──────────────────────────────────────────

  async feed(userId: string, q: OfferFeedQuery) {
    const brand = await this.brands.requireMine(userId);
    const where: Prisma.OfferWhereInput = {
      status: 'ACTIVE',
      influencer: { status: 'APPROVED', user: { blockedAt: null } },
      ...(q.platform.length ? { platforms: { hasSome: q.platform } } : {}),
      ...(q.format.length ? { contentFormats: { hasSome: q.format } } : {}),
      ...(q.niche.length ? { niches: { hasSome: q.niche } } : {}),
      ...(q.collaboration.length ? { collaborationType: { in: q.collaboration } } : {}),
      ...(q.q
        ? {
            OR: [
              { title: { contains: q.q, mode: 'insensitive' } },
              { description: { contains: q.q, mode: 'insensitive' } },
              { idealBrands: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.offer.count({ where }),
      this.prisma.offer.findMany({
        where,
        orderBy:
          q.sort === 'price'
            ? [{ priceMinor: { sort: 'asc', nulls: 'last' } }, { publishedAt: 'desc' }]
            : { publishedAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          influencer: BLOGGER_CARD,
          requests: { where: { brandId: brand.id }, select: { id: true, status: true } },
        },
      }),
    ]);
    return {
      items: rows.map(({ influencer, requests, ...o }) => ({
        ...forBrand(o as Offer),
        blogger: bloggerCard(influencer),
        myRequest: requests[0] ?? null,
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  /** Offer detail: owner and admins see everything; brands see active offers (or ones they asked about). */
  async getForViewer(viewer: AuthUser, id: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
      include: { influencer: BLOGGER_CARD },
    });
    if (!offer) throw notFound('Offer');
    const { influencer, ...o } = offer;
    if (viewer.role === 'ADMIN') return { ...o, blogger: bloggerCard(influencer) };
    if (viewer.role === 'INFLUENCER') {
      if (influencer.userId !== viewer.id) throw notFound('Offer');
      return { ...o, blogger: bloggerCard(influencer) };
    }
    const brand = await this.brands.requireMine(viewer.id);
    const myRequest = await this.prisma.offerRequest.findUnique({
      where: { offerId_brandId: { offerId: id, brandId: brand.id } },
    });
    if (!myRequest && (offer.status !== 'ACTIVE' || influencer.status !== 'APPROVED'))
      throw notFound('Offer');
    const counted = offer.status === 'ACTIVE' && (await this.recordView(id, brand.id));
    const contacts =
      myRequest && offerContactsRevealed(myRequest.status)
        ? await this.prisma.influencerProfile.findUnique({
            where: { id: influencer.id },
            select: { contactMethod: true, contactValue: true },
          })
        : null;
    return {
      ...forBrand(o as Offer),
      viewCount: o.viewCount + (counted ? 1 : 0),
      blogger: bloggerCard(influencer),
      myRequest: myRequest && {
        ...myRequest,
        contacts: contacts && { method: contacts.contactMethod, value: contacts.contactValue },
      },
    };
  }

  private async recordView(offerId: string, brandId: string) {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(this.clock.now());
    const { count } = await this.prisma.offerView.createMany({
      data: [{ offerId, brandId, day }],
      skipDuplicates: true,
    });
    if (count > 0)
      await this.prisma.offer.update({
        where: { id: offerId },
        data: { viewCount: { increment: 1 } },
      });
    return count > 0;
  }

  async request(userId: string, offerId: string, input: OfferRequestInput) {
    const brand = await this.brands.requireMine(userId);
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: { influencer: { select: { userId: true, status: true } } },
    });
    if (!offer || offer.status !== 'ACTIVE' || offer.influencer.status !== 'APPROVED')
      throw notFound('Offer');
    const existing = await this.prisma.offerRequest.findUnique({
      where: { offerId_brandId: { offerId, brandId: brand.id } },
    });
    if (existing && existing.status !== 'WITHDRAWN')
      throw new AppError('ALREADY_APPLIED', 'You already sent a request for this offer');
    const now = this.clock.now();
    const req = existing
      ? await this.prisma.offerRequest.update({
          where: { id: existing.id },
          data: { ...input, status: 'PENDING', decidedAt: null, createdAt: now },
        })
      : await this.prisma.offerRequest.create({
          data: { ...input, offerId, brandId: brand.id, createdAt: now },
        });
    await this.notifications.notify(offer.influencer.userId, 'OFFER_REQUEST_NEW', {
      params: { brand: brand.companyName, offer: offer.title },
      link: `/influencer/offers/${offerId}`,
    });
    return req;
  }

  async withdraw(userId: string, requestId: string) {
    const brand = await this.brands.requireMine(userId);
    const req = await this.prisma.offerRequest.findUnique({ where: { id: requestId } });
    if (!req || req.brandId !== brand.id) throw notFound('Request');
    if (req.status !== 'PENDING')
      throw new AppError('INVALID_TRANSITION', 'Only waiting requests can be withdrawn');
    return this.prisma.offerRequest.update({
      where: { id: requestId },
      data: { status: 'WITHDRAWN' },
    });
  }

  /** The brand's requests; blogger contacts only once accepted. */
  async myRequests(userId: string) {
    const brand = await this.brands.requireMine(userId);
    const rows = await this.prisma.offerRequest.findMany({
      where: { brandId: brand.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        offer: {
          include: {
            influencer: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                contactMethod: true,
                contactValue: true,
              },
            },
          },
        },
      },
    });
    return rows.map(({ offer, ...r }) => {
      const { influencer, ...o } = offer;
      return {
        ...r,
        offer: {
          id: o.id,
          title: o.title,
          priceMinor: o.priceMinor,
          currency: o.currency,
          collaborationType: o.collaborationType,
          status: o.status,
        },
        blogger: {
          id: influencer.id,
          displayName: influencer.displayName,
          avatarUrl: influencer.avatarUrl,
        },
        contacts: offerContactsRevealed(r.status)
          ? { method: influencer.contactMethod, value: influencer.contactValue }
          : null,
      };
    });
  }

  // ─── Admin review ────────────────────────────────────────

  async reviewQueue(status: 'IN_REVIEW' | 'REJECTED') {
    const rows = await this.prisma.offer.findMany({
      where: { status },
      orderBy: status === 'IN_REVIEW' ? { submittedAt: 'asc' } : { reviewedAt: 'desc' },
      take: 200,
      include: {
        influencer: {
          ...BLOGGER_CARD,
          select: { ...BLOGGER_CARD.select, user: { select: { email: true } } },
        },
      },
    });
    return rows.map(({ influencer, ...o }) => ({
      ...o,
      blogger: { ...bloggerCard(influencer), email: influencer.user.email },
    }));
  }

  async approve(id: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
      include: { influencer: { select: { userId: true } } },
    });
    if (!offer) throw notFound('Offer');
    if (offer.status !== 'IN_REVIEW')
      throw new AppError('INVALID_TRANSITION', 'This offer is not waiting for review');
    const now = this.clock.now();
    const { count } = await this.prisma.offer.updateMany({
      where: { id, status: 'IN_REVIEW' },
      data: {
        status: 'ACTIVE',
        publishedAt: offer.publishedAt ?? now,
        reviewedAt: now,
        reviewNote: null,
        approvedKey: offerReviewKey(offer),
      },
    });
    if (count)
      await this.notifications.notify(offer.influencer.userId, 'OFFER_APPROVED', {
        params: { offer: offer.title },
        link: '/influencer/offers',
      });
  }

  async reject(id: string, reason: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
      include: { influencer: { select: { userId: true } } },
    });
    if (!offer) throw notFound('Offer');
    if (offer.status !== 'IN_REVIEW')
      throw new AppError('INVALID_TRANSITION', 'This offer is not waiting for review');
    const { count } = await this.prisma.offer.updateMany({
      where: { id, status: 'IN_REVIEW' },
      data: { status: 'REJECTED', reviewedAt: this.clock.now(), reviewNote: reason },
    });
    if (count)
      await this.notifications.notify(offer.influencer.userId, 'OFFER_REJECTED', {
        params: { offer: offer.title, reason },
        link: `/influencer/offers/${id}/edit`,
      });
  }
}
