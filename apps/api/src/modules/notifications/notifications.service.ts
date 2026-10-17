import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  isNotificationLocale,
  renderNotification,
  type NotificationLocale,
  type NotificationParams,
  type NotificationType,
  type Paginated,
} from '@briefluence/shared';
import { Prisma, type Notification } from '@prisma/client';
import { notFound } from '../../common/app-error';
import { PrismaService } from '../../common/prisma.service';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { EMAIL_POLICY } from './catalog';
import { EmailService } from './email.service';
import { renderNotificationEmail } from './emails/templates';

export interface NotifyPayload {
  /** Raw values for the text (titles, amounts in minor units, ISO dates); rendered per language. */
  params?: NotificationParams;
  /** Path inside the web app, e.g. /influencer/applications */
  link?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Writes the in-app notification (type + params, plus the text rendered in the user's language
   * as a fallback) and, for transactional events, enqueues the email in that language.
   */
  async notify(userId: string, type: NotificationType, payload: NotifyPayload = {}): Promise<Notification> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, locale: true } });
    const locale: NotificationLocale = isNotificationLocale(user?.locale) ? user.locale : 'en';
    const params = payload.params ?? {};
    const text = renderNotification(type, params, locale) ?? { title: type, body: '', cta: '' };
    const row = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title: text.title,
        body: text.body,
        params: params as Prisma.InputJsonValue,
        link: payload.link ?? null,
      },
    });
    if (EMAIL_POLICY[type] === 'instant' && user) {
      try {
        const email = await renderNotificationEmail(locale, {
          title: text.title,
          body: text.body,
          ctaUrl: payload.link ? `${this.env.WEB_URL}${payload.link}` : undefined,
          ctaLabel: text.cta,
        });
        await this.email.send(user.email, email);
      } catch (err) {
        // The in-app notification is already stored; an email failure must not fail the action.
        this.logger.error(`Failed to enqueue ${type} email: ${(err as Error).message}`);
      }
    }
    return row;
  }

  async notifyAdmins(type: NotificationType, payload: NotifyPayload) {
    const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN', blockedAt: null }, select: { id: true } });
    await Promise.all(admins.map((a) => this.notify(a.id, type, payload)));
  }

  async list(userId: string, page: number, pageSize: number): Promise<Paginated<Notification>> {
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return { items, total, page, pageSize };
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (count === 0) {
      const exists = await this.prisma.notification.findFirst({ where: { id, userId }, select: { id: true } });
      if (!exists) throw notFound('Notification');
    }
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }
}
