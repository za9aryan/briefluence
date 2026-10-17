import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AppError } from '../app-error';
import type { AuthedRequest } from '../auth-user';
import { PrismaService } from '../prisma.service';

/**
 * Briefs are visible only after the blogger explicitly started the free month (a subscription
 * exists in any state). Applying additionally needs ActiveSubscriptionGuard.
 */
@Injectable()
export class TrialStartedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user) throw new AppError('UNAUTHORIZED', 'Sign in required');
    const sub = await this.prisma.subscription.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!sub) throw new AppError('TRIAL_NOT_STARTED', 'Start your free month to see briefs');
    return true;
  }
}
