import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  SUPPORT_GUEST_TICKETS_PER_DAY,
  SUPPORT_GUEST_TICKETS_PER_IP_PER_DAY,
  SUPPORT_MESSAGES_PER_10_MIN,
  adminsToNotify,
  isNotificationLocale,
  isTicketActive,
  renderNotification,
  shouldAutoClose,
  statusAfterAdminMessage,
  statusAfterUserMessage,
  unreadForAdmin,
  unreadForUser,
  type NotificationLocale,
  type SupportBox,
  type SupportMessageData,
  type SupportStartData,
} from '@briefluence/shared';
import type { Prisma, SupportMessage, SupportTicket } from '@prisma/client';
import { AppError, notFound } from '../../common/app-error';
import type { AuthUser } from '../../common/auth-user';
import { Clock } from '../../common/clock';
import { CryptoService } from '../../common/crypto.service';
import { PrismaService } from '../../common/prisma.service';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { EmailService } from '../notifications/email.service';
import { renderNotificationEmail } from '../notifications/emails/templates';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

const DAY = 86_400_000;
/** Short text for notifications; an image-only message shows as "[image]". */
const preview = (body: string, imageUrl: string | null) =>
  (body || (imageUrl ? '[image]' : '')).replace(/\s+/g, ' ').slice(0, 80);

/** Who is asking: a signed-in user and/or the holder of a guest support cookie. */
export interface Requester {
  user?: AuthUser;
  guestToken?: string;
  ip?: string;
  locale?: string;
}

const publicMessage = (m: SupportMessage) => ({
  id: m.id,
  author: m.author,
  body: m.body,
  imageUrl: m.imageUrl,
  createdAt: m.createdAt,
});

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    private readonly storage: StorageService,
    private readonly gateway: RealtimeGateway,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ─── Users and guests ────────────────────────────────────

  /** The requester's latest ticket (signed-in users) or the guest cookie's ticket, with messages. */
  async current(r: Requester) {
    const ticket = r.user
      ? await this.prisma.supportTicket.findFirst({
          where: { userId: r.user.id },
          orderBy: { createdAt: 'desc' },
        })
      : r.guestToken
        ? await this.byGuestToken(r.guestToken)
        : null;
    if (!ticket) return { ticket: null, messages: [] };
    return this.view(ticket);
  }

  private async view(ticket: SupportTicket) {
    const messages = await this.prisma.supportMessage.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'asc' },
    });
    return {
      ticket: {
        id: ticket.id,
        topic: ticket.topic,
        status: ticket.status,
        createdAt: ticket.createdAt,
        guestEmail: ticket.guestEmail,
        unread: unreadForUser(ticket),
      },
      messages: messages.map(publicMessage),
    };
  }

  private byGuestToken(token: string) {
    return this.prisma.supportTicket.findUnique({
      where: { guestTokenHash: CryptoService.sha256(token) },
    });
  }

  /** The ticket if this requester owns it; 404 otherwise (no hint that the id exists). */
  private async owned(r: Requester, ticketId: string) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    const mine =
      !!t &&
      ((r.user && t.userId === r.user.id) ||
        (!!r.guestToken && t.guestTokenHash === CryptoService.sha256(r.guestToken)));
    if (!t || !mine) throw notFound('Ticket');
    return t;
  }

  private checkImage(url: string | null) {
    if (url && !this.storage.isOwnUpload(url, 'support'))
      throw new AppError('VALIDATION_FAILED', 'Upload the image first', { field: 'imageUrl' });
  }

  /** Starts a ticket. Returns the guest's secret token (to set as a cookie) for guests. */
  async start(r: Requester, data: SupportStartData) {
    // Honeypot: people never see this field, bots fill it in.
    if (data.website) throw new AppError('VALIDATION_FAILED', 'Invalid request');
    this.checkImage(data.imageUrl);
    const now = this.clock.now();
    let guest: { email: string; token: string } | null = null;
    let locale = isNotificationLocale(r.locale) ? r.locale : 'en';

    if (r.user) {
      const open = await this.prisma.supportTicket.findFirst({
        where: { userId: r.user.id, status: { not: 'CLOSED' } },
        select: { id: true },
      });
      if (open)
        throw new AppError('INVALID_TRANSITION', 'You already have an open conversation', {
          ticketId: open.id,
        });
      const u = await this.prisma.user.findUnique({
        where: { id: r.user.id },
        select: { locale: true },
      });
      if (isNotificationLocale(u?.locale)) locale = u.locale;
    } else {
      if (!data.guestEmail)
        throw new AppError('VALIDATION_FAILED', 'Email is required', { field: 'guestEmail' });
      const since = new Date(now.getTime() - DAY);
      const [byEmail, byIp] = await Promise.all([
        this.prisma.supportTicket.count({
          where: { guestEmail: data.guestEmail, createdAt: { gte: since } },
        }),
        r.ip
          ? this.prisma.supportTicket.count({
              where: { createdIp: r.ip, createdAt: { gte: since } },
            })
          : 0,
      ]);
      if (byEmail >= SUPPORT_GUEST_TICKETS_PER_DAY || byIp >= SUPPORT_GUEST_TICKETS_PER_IP_PER_DAY)
        throw new AppError('RATE_LIMITED', 'Too many new conversations. Try again tomorrow.');
      guest = { email: data.guestEmail, token: CryptoService.randomToken(32) };
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId: r.user?.id ?? null,
        guestEmail: guest?.email ?? null,
        guestName: r.user ? null : data.guestName,
        guestTokenHash: guest ? CryptoService.sha256(guest.token) : null,
        guestTokenEnc: guest ? this.crypto.encrypt(guest.token) : null,
        locale,
        createdIp: r.ip ?? null,
        topic: data.topic,
        status: 'OPEN',
        lastMessageAt: now,
        lastUserMessageAt: now,
        userLastReadAt: now,
        createdAt: now,
        messages: {
          create: {
            author: r.user ? 'USER' : 'GUEST',
            authorId: r.user?.id ?? null,
            body: data.body,
            imageUrl: data.imageUrl,
            createdAt: now,
          },
        },
      },
    });

    const name = await this.personName(ticket);
    await this.notifications.notifyAdmins('SUPPORT_NEW_TICKET', {
      params: { name, preview: preview(data.body, data.imageUrl) },
      link: `/admin/support?ticket=${ticket.id}`,
    });
    this.gateway.ticketChanged(ticket);
    return { view: await this.view(ticket), guestToken: guest?.token ?? null };
  }

  async addMessage(r: Requester, ticketId: string, data: SupportMessageData) {
    const t = await this.owned(r, ticketId);
    if (!isTicketActive(t.status))
      throw new AppError('INVALID_TRANSITION', 'This conversation is closed. Start a new one.');
    this.checkImage(data.imageUrl);
    const now = this.clock.now();
    const recent = await this.prisma.supportMessage.count({
      where: { ticketId, createdAt: { gte: new Date(now.getTime() - 10 * 60_000) } },
    });
    if (recent >= SUPPORT_MESSAGES_PER_10_MIN)
      throw new AppError('RATE_LIMITED', 'Too many messages. Wait a few minutes.');

    const [, updated] = await this.prisma.$transaction([
      this.prisma.supportMessage.create({
        data: {
          ticketId,
          author: t.userId ? 'USER' : 'GUEST',
          authorId: t.userId,
          body: data.body,
          imageUrl: data.imageUrl,
          createdAt: now,
        },
      }),
      this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: statusAfterUserMessage(),
          lastMessageAt: now,
          lastUserMessageAt: now,
          userLastReadAt: now,
        },
      }),
    ]);

    const admins = await this.adminIds();
    const name = await this.personName(updated);
    await Promise.all(
      adminsToNotify(updated.assigneeId, admins).map((id) =>
        this.notifications.notify(id, 'SUPPORT_USER_MESSAGE', {
          params: { name, preview: preview(data.body, data.imageUrl) },
          link: `/admin/support?ticket=${ticketId}`,
        }),
      ),
    );
    this.gateway.ticketChanged(updated);
    return this.view(updated);
  }

  async markRead(r: Requester, ticketId: string) {
    await this.owned(r, ticketId);
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { userLastReadAt: this.clock.now() },
    });
  }

  /** Opens a guest conversation from the emailed link; the caller sets the cookie. */
  async resume(token: string) {
    const t = await this.byGuestToken(token);
    if (!t) throw new AppError('INVALID_TOKEN', 'This link is not valid any more');
    return this.view(t);
  }

  // ─── Admin ───────────────────────────────────────────────

  private adminIds() {
    return this.prisma.user
      .findMany({ where: { role: 'ADMIN', blockedAt: null }, select: { id: true } })
      .then((rows) => rows.map((a) => a.id));
  }

  private async personName(t: Pick<SupportTicket, 'userId' | 'guestName' | 'guestEmail'>) {
    if (!t.userId) return t.guestName || t.guestEmail || 'Guest';
    const u = await this.prisma.user.findUnique({
      where: { id: t.userId },
      select: {
        email: true,
        influencer: { select: { displayName: true } },
        brand: { select: { companyName: true } },
      },
    });
    return u?.influencer?.displayName ?? u?.brand?.companyName ?? u?.email ?? 'User';
  }

  async inbox(adminId: string, box: SupportBox) {
    const where: Prisma.SupportTicketWhereInput =
      box === 'unassigned'
        ? { assigneeId: null, status: { not: 'CLOSED' } }
        : box === 'mine'
          ? { assigneeId: adminId, status: { not: 'CLOSED' } }
          : box === 'open'
            ? { status: { not: 'CLOSED' } }
            : { status: 'CLOSED' };
    const rows = await this.prisma.supportTicket.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      take: 200,
      include: {
        user: {
          select: {
            email: true,
            role: true,
            blockedAt: true,
            influencer: { select: { displayName: true, avatarUrl: true } },
            brand: { select: { companyName: true, logoUrl: true } },
          },
        },
        assignee: { select: { id: true, email: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    const counts = await this.counts(adminId);
    return {
      counts,
      items: rows.map((t) => ({
        id: t.id,
        topic: t.topic,
        status: t.status,
        lastMessageAt: t.lastMessageAt,
        waitingSince: t.status === 'OPEN' ? t.lastUserMessageAt : null,
        unread: unreadForAdmin(t),
        person: {
          kind: t.userId ? ('USER' as const) : ('GUEST' as const),
          name:
            t.user?.influencer?.displayName ??
            t.user?.brand?.companyName ??
            t.guestName ??
            t.user?.email ??
            t.guestEmail,
          email: t.user?.email ?? t.guestEmail,
          avatarUrl: t.user?.influencer?.avatarUrl ?? t.user?.brand?.logoUrl ?? null,
          role: t.user?.role ?? null,
          blocked: !!t.user?.blockedAt,
        },
        assignee: t.assignee,
        lastMessage: t.messages[0] ? publicMessage(t.messages[0]) : null,
      })),
    };
  }

  private async counts(adminId: string) {
    const active = { status: { not: 'CLOSED' as const } };
    const [unassigned, mine, open] = await Promise.all([
      this.prisma.supportTicket.count({ where: { ...active, assigneeId: null } }),
      this.prisma.supportTicket.count({ where: { ...active, assigneeId: adminId } }),
      this.prisma.supportTicket.count({ where: active }),
    ]);
    return { unassigned, mine, open };
  }

  /** Full ticket for an admin: messages, who is asking (incl. a blocked account) and admins. */
  async detail(id: string) {
    const t = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        assignee: { select: { id: true, email: true } },
      },
    });
    if (!t) throw notFound('Ticket');
    // A guest may be someone with an account (e.g. blocked and unable to sign in).
    const userId =
      t.userId ??
      (t.guestEmail
        ? (
            await this.prisma.user.findUnique({
              where: { email: t.guestEmail },
              select: { id: true },
            })
          )?.id
        : undefined);
    const account = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            role: true,
            blockedAt: true,
            emailVerifiedAt: true,
            createdAt: true,
            influencer: { select: { id: true, displayName: true, status: true } },
            brand: { select: { id: true, companyName: true } },
            subscription: { select: { status: true, planCode: true } },
          },
        })
      : null;
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', blockedAt: null },
      select: { id: true, email: true },
      orderBy: { email: 'asc' },
    });
    return {
      id: t.id,
      topic: t.topic,
      status: t.status,
      createdAt: t.createdAt,
      assignee: t.assignee,
      guest: t.userId ? null : { email: t.guestEmail, name: t.guestName },
      /** Signed-in owner, or the account that matches a guest's email. */
      account: account && {
        id: account.id,
        email: account.email,
        role: account.role,
        blocked: !!account.blockedAt,
        emailVerified: !!account.emailVerifiedAt,
        createdAt: account.createdAt,
        name: account.influencer?.displayName ?? account.brand?.companyName ?? null,
        verification: account.influencer?.status ?? null,
        plan: account.subscription?.planCode ?? null,
        matchedByEmail: !t.userId,
      },
      messages: t.messages.map(publicMessage),
      admins,
    };
  }

  async reply(adminId: string, id: string, data: SupportMessageData) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!t) throw notFound('Ticket');
    this.checkImage(data.imageUrl);
    const now = this.clock.now();
    const [, updated] = await this.prisma.$transaction([
      this.prisma.supportMessage.create({
        data: {
          ticketId: id,
          author: 'ADMIN',
          authorId: adminId,
          body: data.body,
          imageUrl: data.imageUrl,
          createdAt: now,
        },
      }),
      this.prisma.supportTicket.update({
        where: { id },
        data: {
          // Replying to a closed ticket reopens it.
          status: statusAfterAdminMessage(),
          closedAt: null,
          lastMessageAt: now,
          lastAdminMessageAt: now,
          adminLastReadAt: now,
          // Whoever answers first owns the ticket.
          assigneeId: t.assigneeId ?? adminId,
        },
      }),
    ]);
    await this.notifyReply(updated, preview(data.body, data.imageUrl));
    this.gateway.ticketChanged(updated);
    return this.detail(id);
  }

  /** Users: in-app + email (catalog policy). Guests: email with a link back to the chat. */
  private async notifyReply(t: SupportTicket, text: string) {
    if (t.userId) {
      await this.notifications.notify(t.userId, 'SUPPORT_REPLY', {
        params: { preview: text },
        link: '/support',
      });
      return;
    }
    if (!t.guestEmail || !t.guestTokenEnc) return;
    try {
      const locale: NotificationLocale = isNotificationLocale(t.locale) ? t.locale : 'en';
      const rendered = renderNotification('SUPPORT_REPLY', { preview: text }, locale);
      if (!rendered) return;
      const token = this.crypto.decrypt(t.guestTokenEnc);
      const email = await renderNotificationEmail(locale, {
        title: rendered.title,
        body: rendered.body,
        ctaUrl: `${this.env.WEB_URL}/support?t=${encodeURIComponent(token)}`,
        ctaLabel: rendered.cta,
      });
      await this.email.send(t.guestEmail, email);
    } catch (err) {
      // The reply is saved; a failed email must not fail the admin's action.
      this.logger.error(`Support reply email failed: ${(err as Error).message}`);
    }
  }

  async assign(adminId: string, id: string, assigneeId: string | null) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!t) throw notFound('Ticket');
    if (assigneeId) {
      const a = await this.prisma.user.findUnique({
        where: { id: assigneeId },
        select: { role: true, blockedAt: true },
      });
      if (!a || a.role !== 'ADMIN' || a.blockedAt)
        throw new AppError('VALIDATION_FAILED', 'Assign the ticket to an admin', {
          field: 'assigneeId',
        });
    }
    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: { assigneeId },
    });
    if (assigneeId && assigneeId !== adminId) {
      const last = await this.prisma.supportMessage.findFirst({
        where: { ticketId: id },
        orderBy: { createdAt: 'desc' },
      });
      await this.notifications.notify(assigneeId, 'SUPPORT_ASSIGNED', {
        params: {
          name: await this.personName(updated),
          preview: last ? preview(last.body, last.imageUrl) : '',
        },
        link: `/admin/support?ticket=${id}`,
      });
    }
    this.gateway.ticketChanged(updated);
    return this.detail(id);
  }

  async setClosed(id: string, closed: boolean) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!t) throw notFound('Ticket');
    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: closed
        ? { status: 'CLOSED', closedAt: this.clock.now() }
        : { status: statusAfterUserMessage(), closedAt: null },
    });
    this.gateway.ticketChanged(updated);
    return this.detail(id);
  }

  async adminRead(id: string) {
    await this.prisma.supportTicket.update({
      where: { id },
      data: { adminLastReadAt: this.clock.now() },
    });
  }

  /** Daily: close answered tickets where the user has been silent for a week. */
  async autoClose() {
    const now = this.clock.now();
    const answered = await this.prisma.supportTicket.findMany({ where: { status: 'ANSWERED' } });
    let closed = 0;
    for (const t of answered.filter((x) => shouldAutoClose(x, now))) {
      await this.prisma.supportTicket.update({
        where: { id: t.id },
        data: { status: 'CLOSED', closedAt: now },
      });
      this.gateway.ticketChanged(t);
      closed++;
    }
    return { closed };
  }
}
