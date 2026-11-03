import { Controller, Get } from '@nestjs/common';
import { citySearchSchema, type CitySearchInput } from '@briefluence/shared';
import { ZodQuery } from '../../common/zod';
import { GeoService } from './geo.service';

@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  /** Signed-in users search cities while filling a profile or a brief. */
  @Get('cities')
  cities(@ZodQuery(citySearchSchema) q: CitySearchInput) {
    return this.geo.searchCities(q);
  }
}
