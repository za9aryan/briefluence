import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { applicationsLeft, basicWindowStart, effectiveTier } from '@briefluence/shared';
import { toState } from '../../modules/billing/billing.service';
import { AppError } from '../app-error';
import type { AuthedRequest } from '../auth-user';
import { Clock } from '../clock';
import { PrismaService } from '../prisma.service';

/**
 * Applying needs a chosen plan. Pro (free days or paid) is unlimited; Basic allows the admin-set
 * number of applications per rolling 30 days.
 */
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
    if (!sub) throw new AppError('TRIAL_NOT_STARTED', 'Choose a plan to apply');
    const now = this.clock.now();
    const state = toState(sub);
    const tier = effectiveTier(state, now);
    if (tier === 'PRO') return true;
    const basic = await this.prisma.plan.findUnique({
      where: { code: 'BASIC' },
      select: { applicationLimit: true },
    });
    const used = await this.prisma.application.count({
      where: { influencer: { userId: user.id }, createdAt: { gte: basicWindowStart(state, now) } },
    });
    if (applicationsLeft(tier, basic?.applicationLimit ?? null, used) === 0) {
      throw new AppError(
        'APPLICATION_LIMIT_REACHED',
        'You used all applications of the Basic plan for now',
        {
          limit: basic?.applicationLimit ?? null,
          used,
        },
      );
    }
    return true;
  }
}
