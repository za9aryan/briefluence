import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AppError } from '../app-error';
import type { AuthedRequest } from '../auth-user';
import { PrismaService } from '../prisma.service';

/** Applying and posting deals require a verified email. Checked against the DB, not the token. */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user) throw new AppError('UNAUTHORIZED', 'Sign in required');
    const row = await this.prisma.user.findUnique({ where: { id: user.id }, select: { emailVerifiedAt: true } });
    if (!row?.emailVerifiedAt) throw new AppError('EMAIL_NOT_VERIFIED', 'Verify your email first');
    return true;
  }
}
