import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  checkEligibility,
  formatMoney,
  isNotificationLocale,
  PLATFORM_LABELS,
  shouldExpire,
  TIMEZONE,
  type NotificationLocale,
} from '@briefluence/shared';
import { AppError } from '../../common/app-error';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../common/prisma.service';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { BillingService } from '../billing/billing.service';
import { RatesService } from '../currency/rates.service';
import { toMatchDeal, toMatchInfluencer } from '../deals/match-input';
import { EmailService } from '../notifications/email.service';
import { DIGEST, renderDigestEmail } from '../notifications/emails/templates';

const INTL = { en: 'en-GB', ru: 'ru-RU', hy: 'hy-AM' } as const;
/** Brief line for digests: confidential briefs never show the brand name. */
const digestLine = (d: { title: string; isConfidential: boolean; brand: { companyName: string } }) =>
  d.isConfidential ? d.title : `${d.brand.companyName}: ${d.title}`;
const localeOf = (v: string | null | undefined): NotificationLocale => (isNotificationLocale(v) ? v : 'en');
import { NotificationsService } from '../notifications/notifications.service';
import { SocialService } from '../social/social.service';

export const JOB_NAMES = ['expire-deals', 'billing-daily', 'social-sync', 'digests', 'rates'] as const;
export type JobName = (typeof JOB_NAMES)[number];

/**
 * Scheduled jobs. Crons only fire in processes that run workers (PROCESS_ROLE all|worker) so
 * scaling the API horizontally does not run them twice.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly social: SocialService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    private readonly clock: Clock,
    private readonly rates: RatesService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private get scheduled() {
    return this.env.PROCESS_ROLE !== 'api' && this.env.NODE_ENV !== 'test';
  }

  @Cron('0 * * * *', { timeZone: TIMEZONE })
  async cronExpire() {
    if (this.scheduled) await this.safe('expire-deals');
  }

  @Cron('0 9 * * *', { timeZone: TIMEZONE })
  async cronBilling() {
    if (this.scheduled) await this.safe('billing-daily');
  }

  @Cron('0 3 * * 1', { timeZone: TIMEZONE })
  async cronSocial() {
    if (this.scheduled) await this.safe('social-sync');
  }

  /** CBA publishes once per business day; refreshing every 6 hours keeps rates current. */
  @Cron('0 */6 * * *', { timeZone: TIMEZONE })
  async cronRates() {
    if (this.scheduled) await this.safe('rates');
  }

  @Cron('0 10 * * *', { timeZone: TIMEZONE })
  async cronDigests() {
    if (this.scheduled) await this.safe('digests');
  }

  private async safe(name: JobName) {
    try {
      await this.run(name);
    } catch (err) {
      this.logger.error(`Job ${name} failed: ${(err as Error).stack}`);
    }
  }

  async run(name: JobName): Promise<unknown> {
    switch (name) {
      case 'expire-deals':
        return this.expireDeals();
      case 'billing-daily':
        return this.billing.runDaily();
      case 'social-sync':
        return { queued: await this.social.enqueueAllSyncs() };
      case 'rates':
        return { updated: !!(await this.rates.refresh()) };
      case 'digests':
        return { influencers: await this.influencerDigest(), brands: await this.brandDigest() };
      default:
        throw new AppError('NOT_FOUND', `Unknown job ${String(name)}`);
    }
  }

  async expireDeals() {
    const now = this.clock.now();
    const due = await this.prisma.deal.findMany({
      where: { status: { in: ['ACTIVE', 'PAUSED'] }, applicationDeadline: { lte: now } },
      include: { brand: { select: { userId: true } } },
    });
    for (const d of due.filter((x) => shouldExpire(x, now))) {
      const { count } = await this.prisma.deal.updateMany({
        where: { id: d.id, status: { in: ['ACTIVE', 'PAUSED'] } },
        data: { status: 'EXPIRED' },
      });
      if (count) {
        await this.notifications.notify(d.brand.userId, 'DEAL_EXPIRED', { params: { deal: d.title }, link: `/brand/deals/${d.id}/applicants` });
      }
    }
    return { expired: due.length };
  }

  /** New deals published in the last 24h that each approved influencer is eligible for. */
  private async influencerDigest() {
    const now = this.clock.now();
    const since = new Date(now.getTime() - 86_400_000);
    const deals = await this.prisma.deal.findMany({
      where: { status: 'ACTIVE', publishedAt: { gte: since }, applicationDeadline: { gt: now } },
      include: { brand: { select: { companyName: true } } },
    });
    if (!deals.length) return 0;
    const influencers = await this.prisma.influencerProfile.findMany({
      where: { status: 'APPROVED', user: { blockedAt: null } },
      include: { socialAccounts: true, user: { select: { email: true, digestEmails: true, locale: true } } },
    });
    let sent = 0;
    for (const p of influencers) {
      const inf = toMatchInfluencer(p);
      const matching = deals.filter((d) => checkEligibility(toMatchDeal(d), inf, now) === null);
      if (!matching.length) continue;
      sent++;
      await this.notifications.notify(p.userId, 'NEW_MATCHING_DEALS', {
        params: { count: matching.length, list: matching.slice(0, 3).map(digestLine).join('\n') },
        link: '/influencer/deals',
      });
      if (p.user.digestEmails) {
        const L = localeOf(p.user.locale);
        const email = await renderDigestEmail({
          locale: L,
          title: DIGEST.bloggerTitle[L](matching.length),
          intro: DIGEST.bloggerIntro[L],
          items: matching.slice(0, 10).map((d) => ({
            title: digestLine(d),
            subtitle: [
              d.platforms.map((x) => PLATFORM_LABELS[x]).join(', '),
              d.budgetMax != null ? `${DIGEST.upTo[L]} ${formatMoney(d.budgetMax, d.currency, INTL[L])}` : DIGEST.barter[L],
              `${DIGEST.applyBy[L]} ${d.applicationDeadline.toLocaleDateString(INTL[L], { timeZone: TIMEZONE })}`,
            ].join(' · '),
            url: `${this.env.WEB_URL}/influencer/deals/${d.id}`,
          })),
          ctaUrl: `${this.env.WEB_URL}/influencer/deals`,
          ctaLabel: DIGEST.bloggerCta[L],
        });
        await this.email.send(p.user.email, email);
      }
    }
    return sent;
  }

  /** Daily email of new applicants per brand (in-app notifications were sent at apply time). */
  private async brandDigest() {
    const since = new Date(this.clock.now().getTime() - 86_400_000);
    const apps = await this.prisma.application.findMany({
      where: { createdAt: { gte: since }, status: { not: 'WITHDRAWN' } },
      include: {
        influencer: { select: { displayName: true } },
        deal: { select: { id: true, title: true, brand: { select: { user: { select: { email: true, digestEmails: true, blockedAt: true, locale: true } } } } } },
      },
    });
    const byBrand = new Map<string, typeof apps>();
    for (const a of apps) {
      const u = a.deal.brand.user;
      if (!u.digestEmails || u.blockedAt) continue;
      byBrand.set(u.email, [...(byBrand.get(u.email) ?? []), a]);
    }
    for (const [to, list] of byBrand) {
      const L = localeOf(list[0]!.deal.brand.user.locale);
      const email = await renderDigestEmail({
        locale: L,
        title: DIGEST.brandTitle[L](list.length),
        intro: DIGEST.brandIntro[L],
        items: list.slice(0, 15).map((a) => ({
          title: `${a.influencer.displayName} → ${a.deal.title}`,
          subtitle: `${DIGEST.match[L]} ${a.matchScore}%`,
          url: `${this.env.WEB_URL}/brand/deals/${a.deal.id}/applicants`,
        })),
        ctaUrl: `${this.env.WEB_URL}/brand/dashboard`,
        ctaLabel: DIGEST.brandCta[L],
      });
      await this.email.send(to, email);
    }
    return byBrand.size;
  }
}
