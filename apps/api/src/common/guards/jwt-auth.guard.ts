import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppError } from '../app-error';
import { COOKIE_ACCESS, type AccessTokenPayload, type AuthedRequest } from '../auth-user';
import { IS_PUBLIC } from '../decorators';

/** Global guard: every route needs a valid access token unless marked @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const token = this.extract(req);
    if (token) {
      try {
        const p = await this.jwt.verifyAsync<AccessTokenPayload>(token);
        req.user = { id: p.sub, role: p.role, emailVerified: p.ev };
      } catch {
        if (!isPublic) throw new AppError('UNAUTHORIZED', 'Session expired');
      }
    }
    if (isPublic) return true;
    if (!req.user) throw new AppError('UNAUTHORIZED', 'Sign in required');
    return true;
  }

  private extract(req: AuthedRequest): string | undefined {
    const cookie = (req.cookies as Record<string, string> | undefined)?.[COOKIE_ACCESS];
    if (cookie) return cookie;
    const header = req.headers.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  }
}
