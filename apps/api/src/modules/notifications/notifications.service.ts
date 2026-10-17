import { Inject, Injectable, Logger } from '@nestjs/common';
import type { NotificationType, Paginated } from '@briefluence/shared';
import type { Notification } from '@prisma/client';
import { notFound } from '../../common/app-error';
import { PrismaService } from '../../common/prisma.service';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { CTA_LABEL, EMAIL_POLICY } from './catalog';
import { EmailService } from './email.service';
import { renderNotificationEmail } from './emails/templates';

export interface NotifyPayload {
  title: string;
  body: string;
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

  /** Writes the in-app notification and, for transactional events, enqueues the email. */
  async notify(userId: string, type: NotificationType, payload: NotifyPayload): Promise<Notification> {
    const row = await this.prisma.notification.create({
      data: { userId, type, title: payload.title, body: payload.body, link: payload.link ?? null },
    });
    if (EMAIL_POLICY[type] === 'instant') {
      try {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
        if (user) {
          const email = await renderNotificationEmail({
            title: payload.title,
            body: payload.body,
            ctaUrl: payload.link ? `${this.env.WEB_URL}${payload.link}` : undefined,
            ctaLabel: CTA_LABEL[type],
          });
          await this.email.send(user.email, email);
        }
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
