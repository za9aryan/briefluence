import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CURRENCIES, type Currency, type Rates } from '@briefluence/shared';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../common/prisma.service';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';

export interface RatesSnapshot {
  rates: Rates; // AMD per 1 unit
  source: string;
  fetchedAt: Date;
}

/** Used only when no source answers and nothing is stored yet (offline dev); flagged as "fallback". */
const FALLBACK: Rates = { AMD: 1, USD: 390, RUB: 4.5 };
const STALE_MS = 24 * 3_600_000;
const CACHE_MS = 10 * 60_000;

/**
 * Exchange rates for display conversion. Primary source: Central Bank of Armenia
 * (https://api.cba.am/exchangerates.asmx, SOAP ExchangeRatesLatest, rates in AMD per `Amount` units).
 * Fallback: https://open.er-api.com/v6/latest/USD (free, daily, base USD). Rates are stored in the
 * ExchangeRate table and refreshed every 6 hours by the jobs module.
 */
@Injectable()
export class RatesService implements OnModuleInit {
  private readonly logger = new Logger(RatesService.name);
  private cache?: { at: number; snapshot: RatesSnapshot };

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit() {
    if (this.env.NODE_ENV === 'test' || this.env.RATES_SOURCE === 'static') return;
    // Refresh in the background if stored rates are missing or older than a day.
    void this.get()
      .then((s) => (this.clock.now().getTime() - s.fetchedAt.getTime() > STALE_MS || s.source === 'fallback' ? this.refresh() : null))
      .catch(() => undefined);
  }

  async get(): Promise<RatesSnapshot> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.snapshot;
    if (this.env.RATES_SOURCE === 'static') return this.remember({ rates: FALLBACK, source: 'static', fetchedAt: this.clock.now() });
    const rows = await this.prisma.exchangeRate.findMany();
    if (CURRENCIES.every((c) => rows.some((r) => r.currency === c))) {
      const rates = Object.fromEntries(rows.map((r) => [r.currency, r.amdPerUnit])) as Rates;
      const oldest = rows.reduce((d, r) => (r.fetchedAt < d ? r.fetchedAt : d), rows[0]!.fetchedAt);
      return this.remember({ rates, source: rows[0]!.source, fetchedAt: oldest });
    }
    return (await this.refresh()) ?? this.remember({ rates: FALLBACK, source: 'fallback', fetchedAt: this.clock.now() });
  }

  /** Fetches fresh rates (CBA, then open.er-api) and stores them. Returns null if both fail. */
  async refresh(): Promise<RatesSnapshot | null> {
    for (const [name, fetcher] of [
      ['cba', () => this.fromCba()],
      ['open.er-api', () => this.fromOpenErApi()],
    ] as const) {
      try {
        const rates = await fetcher();
        const fetchedAt = this.clock.now();
        await this.prisma.$transaction(
          CURRENCIES.map((currency) =>
            this.prisma.exchangeRate.upsert({
              where: { currency },
              create: { currency, amdPerUnit: rates[currency], source: name, fetchedAt },
              update: { amdPerUnit: rates[currency], source: name, fetchedAt },
            }),
          ),
        );
        this.logger.log(`Exchange rates updated from ${name}: USD ${rates.USD} AMD, RUB ${rates.RUB} AMD`);
        return this.remember({ rates, source: name, fetchedAt });
      } catch (err) {
        this.logger.warn(`Exchange rates from ${name} failed: ${(err as Error).message}`);
      }
    }
    return null;
  }

  private remember(snapshot: RatesSnapshot) {
    this.cache = { at: Date.now(), snapshot };
    return snapshot;
  }

  private validate(rates: Partial<Record<Currency, number>>): Rates {
    for (const c of CURRENCIES) {
      const v = rates[c];
      if (!v || !Number.isFinite(v) || v <= 0) throw new Error(`no valid ${c} rate`);
    }
    return rates as Rates;
  }

  private async fromCba(): Promise<Rates> {
    const body =
      '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
      '<soap:Body><ExchangeRatesLatest xmlns="http://www.cba.am/" /></soap:Body></soap:Envelope>';
    const res = await fetch('https://api.cba.am/exchangerates.asmx', {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '"http://www.cba.am/ExchangeRatesLatest"' },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const rate = (iso: string) => {
      const m = new RegExp(`<ISO>${iso}</ISO><Amount>([\\d.]+)</Amount><Rate>([\\d.]+)</Rate>`).exec(xml);
      return m ? Number(m[2]) / Number(m[1]) : undefined; // AMD per 1 unit
    };
    return this.validate({ AMD: 1, USD: rate('USD'), RUB: rate('RUB') });
  }

  private async fromOpenErApi(): Promise<Rates> {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (json.result !== 'success' || !json.rates?.AMD || !json.rates.RUB) throw new Error('unexpected response');
    const amdPerUsd = json.rates.AMD;
    return this.validate({ AMD: 1, USD: amdPerUsd, RUB: amdPerUsd / json.rates.RUB });
  }
}
