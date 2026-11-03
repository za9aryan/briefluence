import { Injectable } from '@nestjs/common';
import { CITIES, type CityOption, type CitySearchInput, type Country } from '@briefluence/shared';

const norm = (s: string) => s.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Cities for location pickers. Today: our built-in list (the launch markets). The live GeoNames
 * search plugs in here once its account is set up; this list stays as the fallback.
 */
@Injectable()
export class GeoService {
  async searchCities(input: CitySearchInput): Promise<CityOption[]> {
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
