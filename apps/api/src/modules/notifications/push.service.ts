import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { PushSubscriptionInput } from '@briefluence/shared';
import webpush, { WebPushError } from 'web-push';
import { PrismaService } from '../../common/prisma.service';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { QueueService } from '../../queue/queue.service';

export const PUSH_JOB = 'push.send';
/** How long a push service keeps an undelivered message (device offline), in seconds. */
const TTL_SECONDS = 24 * 3600;

export interface PushPayload {
  title: string;
  body: string;
  /** Page to open when the notification is tapped. */
  url: string;
  /** Same tag replaces an older notification instead of stacking. */
  tag: string;
}

type Sender = (sub: webpush.PushSubscription, payload: string) => Promise<unknown>;

/**
 * Web Push (https://www.npmjs.com/package/web-push, RFC 8030/8291/8292 via VAPID). Every in-app
 * notification is also pushed to the user's devices through the job queue; devices the push
 * service reports gone (404/410) are removed. Off when VAPID keys are not configured.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  /** Replaced in tests; sends through web-push with our VAPID keys. */
  sender: Sender = (sub, payload) =>
    webpush.sendNotification(sub, payload, {
      TTL: TTL_SECONDS,
      vapidDetails: {
        subject: this.env.VAPID_SUBJECT,
        publicKey: this.env.VAPID_PUBLIC_KEY!,
        privateKey: this.env.VAPID_PRIVATE_KEY!,
      },
    });
  /** Tests switch push on without real keys. */
  forceEnabled = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  get enabled() {
    return this.forceEnabled || (!!this.env.VAPID_PUBLIC_KEY && !!this.env.VAPID_PRIVATE_KEY);
  }

  onModuleInit() {
    this.queue.register<{ notificationId: string }>(PUSH_JOB, ({ notificationId }) =>
      this.deliver(notificationId),
    );
  }

  publicKey() {
    return {
      enabled: this.enabled,
      publicKey: this.enabled ? (this.env.VAPID_PUBLIC_KEY ?? null) : null,
    };
  }

  /** Saves this device for the user (a browser endpoint moves to whoever is signed in now). */
  async subscribe(userId: string, s: PushSubscriptionInput, userAgent?: string) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: s.endpoint },
      create: { userId, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, userAgent },
      update: { userId, p256dh: s.keys.p256dh, auth: s.keys.auth, userAgent },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  /** Called for every new notification; the queue does the sending. */
  async enqueue(notificationId: string) {
    if (!this.enabled) return;
    await this.queue.add(PUSH_JOB, { notificationId });
  }

  async deliver(notificationId: string) {
    const n = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { user: { include: { pushSubscriptions: true } } },
    });
    if (!n || n.readAt || !n.user.pushSubscriptions.length) return;
    const payload: PushPayload = {
      title: n.title,
      body: n.body,
      url: n.link ?? '/notifications',
      tag: n.id,
    };
    const json = JSON.stringify(payload);
    for (const s of n.user.pushSubscriptions) {
      try {
        await this.sender({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, json);
        await this.prisma.pushSubscription.update({
          where: { id: s.id },
          data: { lastSentAt: new Date() },
        });
      } catch (err) {
        const status =
          err instanceof WebPushError
            ? err.statusCode
            : (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // The browser unsubscribed or the app was removed: forget this device.
          await this.prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
        } else {
          this.logger.warn(
            `Push to one device failed (${status ?? 'network'}): ${(err as Error).message}`,
          );
        }
      }
    }
  }
}
