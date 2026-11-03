import { z } from 'zod';
import { countryCode } from './common';

/** City search for location pickers: `country=AM,GE&q=gyu&lang=ru`. */
export const citySearchSchema = z.object({
  country: z.preprocess(
    (v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v),
    z.array(countryCode).min(1).max(10),
  ),
  q: z.string().trim().max(60).default(''),
  lang: z.enum(['en', 'ru', 'hy']).default('en'),
});
export type CitySearchInput = z.infer<typeof citySearchSchema>;

/**
 * One city. `name` is the stored value (English, so briefs and profiles match whatever language
 * each side uses); `label` is how it reads in the viewer's language.
 */
export interface CityOption {
  name: string;
  label: string;
  country: string;
  region: string | null;
}
