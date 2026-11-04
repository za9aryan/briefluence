import { Inject, Injectable, Logger } from '@nestjs/common';
import { CITIES, type CityOption, type CitySearchInput, type Country } from '@briefluence/shared';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';

const norm = (s: string) => s.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * GeoNames search, https://www.geonames.org/export/geonames-search.html (HTTPS host per
 * https://www.geonames.org/export/ws-overview.html). Fields used, as returned by `style=LONG`:
 * `toponymName` (main name, stored), `name` (the name that matched, in the typed language),
 * `adminName1` (region, in `lang`), `countryCode`, `fcode`. Errors come as `{ status: { message,
 * value } }`, https://www.geonames.org/export/webservice-exception.html.
 */
const GEONAMES_URL = 'https://secure.geonames.org/searchJSON';
/** Cities, towns and villages; not districts (PPLX) or historical / abandoned places. */
const FCODES = ['PPLC', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPL', 'PPLL', 'PPLS', 'PPLF', 'PPLG'];
/** Only Latin letters (with accents), spaces and punctuation. */
const LATIN = /^[\p{Script=Latin}\p{P}\p{Zs}\d]+$/u;
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE = 2000;

export interface GeoNamesPlace {
  toponymName?: string;
  name?: string;
  adminName1?: string;
  countryCode?: string;
}

/**
 * GeoNames results → our options: stored by the main name, labelled in the viewer's language.
 * `name` is whatever alternate name matched the query, so it is used only when it is written in a
 * non-Latin script (ru / hy: "Ереван", "Երևան"); otherwise the main name ("Dilijan", not the
 * matched alias "Dili"; "Munich", not "München").
 */
export function fromGeoNames(places: GeoNamesPlace[], lang: string): CityOption[] {
  const seen = new Set<string>();
  const out: CityOption[] = [];
  for (const p of places) {
    const name = p.toponymName?.trim();
    if (!name || !p.countryCode) continue;
    const key = `${p.countryCode}:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      label: lang !== 'en' && p.name && !LATIN.test(p.name) ? p.name.trim() : name,
      country: p.countryCode,
      region: p.adminName1?.trim() || null,
    });
  }
  return out;
}

/**
 * Cities for location pickers: GeoNames when `GEONAMES_USERNAME` is set (cached a day, so the
 * free plan's hourly limit is no problem), else — or when GeoNames fails — our built-in list.
 */
@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);
  private readonly cache = new Map<string, { at: number; items: CityOption[] }>();

  constructor(@Inject(ENV) private readonly env: Env) {}

  async searchCities(input: CitySearchInput): Promise<CityOption[]> {
    if (!this.env.GEONAMES_USERNAME) return this.builtIn(input);
    const key = `${[...input.country].sort().join(',')}|${norm(input.q)}|${input.lang}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.items;
    try {
      const items = await this.geoNames(input, this.env.GEONAMES_USERNAME);
      if (this.cache.size >= MAX_CACHE) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { at: Date.now(), items });
      return items;
    } catch (e) {
      this.logger.warn(`GeoNames search failed, using the built-in list: ${(e as Error).message}`);
      return this.builtIn(input);
    }
  }

  private async geoNames(input: CitySearchInput, username: string) {
    const params = new URLSearchParams({
      featureClass: 'P',
      maxRows: '20',
      lang: input.lang,
      orderby: 'population',
      style: 'LONG',
      username,
    });
    if (input.q) params.set('name_startsWith', input.q);
    for (const c of input.country) params.append('country', c);
    for (const f of FCODES) params.append('fcode', f);
    const res = await fetch(`${GEONAMES_URL}?${params}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as {
      geonames?: GeoNamesPlace[];
      status?: { message?: string; value?: number };
    };
    if (body.status) throw new Error(`status ${body.status.value}: ${body.status.message}`);
    return fromGeoNames(body.geonames ?? [], input.lang);
  }

  private builtIn(input: CitySearchInput): CityOption[] {
    const q = norm(input.q);
    return input.country
      .flatMap((country) =>
        (CITIES[country as Country] ?? []).map((name) => ({
          name,
          label: name,
          country,
          region: null,
        })),
      )
      .filter((c) => !q || norm(c.name).startsWith(q) || norm(c.name).includes(q))
      .slice(0, 20);
  }
}
