import { Injectable, Logger } from '@nestjs/common';
import {
  CURRENCIES,
  PLAN_CODES,
  paddleAmountMinor,
  type Currency,
  type PlanCode,
  type PlanUpdateInput,
} from '@briefluence/shared';
import type { Plan } from '@prisma/client';
import { AppError, notFound } from '../../common/app-error';
import { PrismaService } from '../../common/prisma.service';
import { PaddleClient, type PaddlePrice, type ProPlanCode } from './paddle/paddle.client';

/** A plan as the app uses it; Pro plans under Paddle also carry where they come from. */
export type PlanView = Plan & {
  source: 'db' | 'paddle';
  paddle?: { priceId: string; name: string | null; interval: string | null; frequency: number };
};

const ORDER = (p: Plan) => PLAN_CODES.indexOf(p.code);
const CACHE_MS = 5 * 60 * 1000;

/**
 * Plan settings. Basic (free; its limits) always lives in our database and admins edit it. Pro plans
 * come from the database with the test payment page, and from Paddle's prices with Paddle: amount,
 * currency and active/archived are read from Paddle, so what bloggers see always matches checkout.
 */
@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);
  private cache: { at: number; plans: PlanView[] } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paddle: PaddleClient,
  ) {}

  get paddleManaged() {
    return !!this.paddle.config;
  }

  async all(): Promise<PlanView[]> {
    const db = (await this.prisma.plan.findMany()).map((p) => ({ ...p, source: 'db' as const }));
    const plans = this.paddle.config
      ? [...db.filter((p) => p.code === 'BASIC'), ...(await this.paddlePlans(db))]
      : db;
    return plans.sort((a, b) => ORDER(a) - ORDER(b));
  }

  async active() {
    return (await this.all()).filter((p) => p.isActive);
  }

  async get(code: PlanCode) {
    const plan = (await this.all()).find((p) => p.code === code);
    if (!plan) throw notFound('Plan');
    return plan;
  }

  /** Drop the cached Paddle prices (e.g. right after an admin opens the Plans page). */
  refresh() {
    this.cache = null;
  }

  /**
   * One Pro plan per configured Paddle price. If Paddle can't be reached we keep the last known
   * prices, or fall back to the database row for that plan, so bloggers never see an empty page.
   */
  private async paddlePlans(db: PlanView[]): Promise<PlanView[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.plans;
    const prices = Object.entries(this.paddle.config!.prices) as [ProPlanCode, string][];
    let failed = false;
    const plans = await Promise.all(
      prices.map(async ([code, priceId]) => {
        try {
          return toPlan(code, await this.paddle.getPrice(priceId));
        } catch {
          failed = true;
          return (
            this.cache?.plans.find((p) => p.code === code) ??
            db.find((p) => p.code === code) ??
            null
          );
        }
      }),
    );
    const list = plans.filter((p): p is PlanView => !!p);
    if (!failed) this.cache = { at: Date.now(), plans: list };
    else this.logger.warn('Could not read some Paddle prices; using the last known ones');
    return list;
  }

  /** Admins edit Basic only when Paddle manages Pro; otherwise every plan as before. */
  async update(code: PlanCode, input: PlanUpdateInput) {
    if (code !== 'BASIC' && this.paddle.config)
      throw new AppError('CONFLICT', 'Pro plans are managed in Paddle');
    const existing = await this.prisma.plan.findUnique({ where: { code } });
    if (!existing) throw notFound('Plan');
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

function toPlan(code: ProPlanCode, p: PaddlePrice): PlanView | null {
  const currency = p.unit_price.currency_code as Currency;
  if (!CURRENCIES.includes(currency)) return null;
  return {
    code,
    priceMinor: paddleAmountMinor(p.unit_price.amount),
    currency,
    applicationLimit: null,
    offerLimit: null,
    isActive: p.status === 'active',
    updatedAt: new Date(),
    source: 'paddle',
    paddle: {
      priceId: p.id,
      name: p.name,
      interval: p.billing_cycle?.interval ?? null,
      frequency: p.billing_cycle?.frequency ?? 1,
    },
  };
}
