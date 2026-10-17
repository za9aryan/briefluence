import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { hasAccess } from '@briefluence/shared';
import { AppError } from '../app-error';
import type { AuthedRequest } from '../auth-user';
import { Clock } from '../clock';
import { PrismaService } from '../prisma.service';

/** Applying needs a trial or paid period that is currently valid (TRIALING or ACTIVE). */
@Injectable()
export class ActiveSubscriptionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user) throw new AppError('UNAUTHORIZED', 'Sign in required');
    const sub = await this.prisma.subscription.findUnique({ where: { userId: user.id } });
    if (!hasAccess(sub, this.clock.now())) {
      throw new AppError('SUBSCRIPTION_REQUIRED', 'An active subscription is required to apply');
    }
    return true;
  }
}
