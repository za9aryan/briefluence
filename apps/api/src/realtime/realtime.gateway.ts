import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WebSocketGateway, WebSocketServer, type OnGatewayConnection } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { COOKIE_ACCESS, type AccessTokenPayload } from '../common/auth-user';
import { CryptoService } from '../common/crypto.service';
import { PrismaService } from '../common/prisma.service';

/** Guest support conversations are identified by this httpOnly cookie (the raw secret token). */
export const SUPPORT_COOKIE = 'bf_support';
/** Socket.IO endpoint; Caddy routes it straight to the API in production. */
export const REALTIME_PATH = '/api/v1/ws';
/** "This support ticket changed" — clients reload it over the REST API. */
export const SUPPORT_EVENT = 'support:update';
/** "Your notifications changed" (a new one, or read elsewhere) — clients reload them. */
export const NOTIFICATIONS_EVENT = 'notifications:update';

function readCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/**
 * One live channel for the whole app (notifications, support chat). Sockets authenticate with
 * the same cookies as the API: the session cookie (room `user:<id>`, admins also `admins`)
 * and/or the guest support cookie (room `ticket:<id>`). Pushes carry ids and kinds only, never
 * content: clients reload the data over the REST API, which checks permissions.
 */
@WebSocketGateway({ path: REALTIME_PATH })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);
  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const cookies = readCookies(client.handshake.headers.cookie);
    const rooms: string[] = [];
    const access = cookies[COOKIE_ACCESS];
    if (access) {
      try {
        const p = await this.jwt.verifyAsync<AccessTokenPayload>(access);
        rooms.push(`user:${p.sub}`);
        if (p.role === 'ADMIN') rooms.push('admins');
      } catch {
        // Expired session: the client reconnects after its next token refresh.
      }
    }
    const guest = cookies[SUPPORT_COOKIE];
    if (guest) {
      const t = await this.prisma.supportTicket.findUnique({
        where: { guestTokenHash: CryptoService.sha256(guest) },
        select: { id: true },
      });
      if (t) rooms.push(`ticket:${t.id}`);
    }
    if (!rooms.length) {
      client.disconnect(true);
      return;
    }
    await client.join(rooms);
  }

  /** Tell one user's open tabs and devices that something of theirs changed. */
  toUser(userId: string, event: string, data: Record<string, unknown>) {
    try {
      this.server.to(`user:${userId}`).emit(event, data);
    } catch (err) {
      this.logger.warn(`Push failed: ${(err as Error).message}`);
    }
  }

  /** Tell everyone who may see this support ticket that it changed. */
  ticketChanged(t: { id: string; userId: string | null }) {
    try {
      const target = this.server.to('admins').to(`ticket:${t.id}`);
      (t.userId ? target.to(`user:${t.userId}`) : target).emit(SUPPORT_EVENT, { ticketId: t.id });
    } catch (err) {
      // Live updates are best-effort; clients also refetch when they reconnect.
      this.logger.warn(`Support push failed: ${(err as Error).message}`);
    }
  }
}
