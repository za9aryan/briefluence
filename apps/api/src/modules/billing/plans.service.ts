import { Injectable } from '@nestjs/common';
import { PLAN_CODES, type PlanCode, type PlanUpdateInput } from '@briefluence/shared';
import type { Plan } from '@prisma/client';
import { AppError, notFound } from '../../common/app-error';
import { PrismaService } from '../../common/prisma.service';

const ORDER = (p: Plan) => PLAN_CODES.indexOf(p.code);

/** Plan settings (price, currency, Basic's limit, on/off). Admins edit them; bloggers see active ones. */
@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async all() {
    return (await this.prisma.plan.findMany()).sort((a, b) => ORDER(a) - ORDER(b));
  }

  async active() {
    return (await this.all()).filter((p) => p.isActive);
  }

  async get(code: PlanCode) {
    const plan = await this.prisma.plan.findUnique({ where: { code } });
    if (!plan) throw notFound('Plan');
    return plan;
  }

  /** Basic is the free fallback: always active, price 0. Pro plans have no application limit. */
  async update(code: PlanCode, input: PlanUpdateInput) {
    await this.get(code);
    if (code === 'BASIC') {
      if (!input.isActive)
        throw new AppError(
          'VALIDATION_FAILED',
          'Basic is the free fallback and cannot be turned off',
        );
      if (input.priceMinor !== 0) throw new AppError('VALIDATION_FAILED', 'Basic is free');
      if (input.applicationLimit == null)
        throw new AppError('VALIDATION_FAILED', 'Basic needs an application limit');
    } else if (input.priceMinor <= 0) {
      throw new AppError('VALIDATION_FAILED', 'Pro plans need a price');
    }
    return this.prisma.plan.update({
      where: { code },
      data: {
        ...input,
        applicationLimit: code === 'BASIC' ? input.applicationLimit : null,
        // Pro is unlimited; Basic keeps its offer limit unless a new one is sent.
        offerLimit:
          code === 'BASIC' ? (input.offerLimit === undefined ? undefined : input.offerLimit) : null,
      },
    });
  }
}
