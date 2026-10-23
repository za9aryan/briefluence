import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WebSocketGateway, WebSocketServer, type OnGatewayConnection } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { COOKIE_ACCESS, type AccessTokenPayload } from '../../common/auth-user';
import { CryptoService } from '../../common/crypto.service';
import { PrismaService } from '../../common/prisma.service';

/** Guest support conversations are identified by this httpOnly cookie (the raw secret token). */
export const SUPPORT_COOKIE = 'bf_support';
/** Socket.IO endpoint; Caddy routes it straight to the API in production. */
export const SUPPORT_WS_PATH = '/api/v1/ws';
/** The only event: "this ticket changed" — clients then reload it over the REST API. */
export const SUPPORT_EVENT = 'support:update';

function readCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/**
 * Live updates for the support chat. Sockets authenticate with the same cookies as the API:
 * the session cookie (user → room `user:<id>`, admins also join `admins`) and/or the guest
 * support cookie (room `ticket:<id>`). Pushes carry only ids, never message content.
 */
@WebSocketGateway({ path: SUPPORT_WS_PATH })
export class SupportGateway implements OnGatewayConnection {
  private readonly logger = new Logger(SupportGateway.name);
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

  /** Tell everyone who may see this ticket that it changed. */
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
