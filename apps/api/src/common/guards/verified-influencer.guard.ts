import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AppError } from '../app-error';
import type { AuthedRequest } from '../auth-user';
import { PrismaService } from '../prisma.service';

/** Influencer profile must be APPROVED by an admin. */
@Injectable()
export class VerifiedInfluencerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user || user.role !== 'INFLUENCER') throw new AppError('FORBIDDEN', 'Influencers only');
    const profile = await this.prisma.influencerProfile.findUnique({
      where: { userId: user.id },
      select: { status: true },
    });
    if (!profile) throw new AppError('PROFILE_INCOMPLETE', 'Complete your profile first');
    if (profile.status !== 'APPROVED') {
      throw new AppError('NOT_VERIFIED_INFLUENCER', 'Your profile is not verified yet');
    }
    return true;
  }
}
