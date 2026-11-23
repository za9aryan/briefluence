/**
 * Regions a brief can target besides single countries ("Worldwide", "Europe"…). They are stored
 * in the brief's `countries` list next to ISO country codes; region codes are words, so they never
 * clash with the two-letter country codes.
 */
export const REGIONS = [
  'WORLD',
  'EUROPE',
  'ASIA',
  'NORTH_AMERICA',
  'LATIN_AMERICA',
  'AFRICA',
  'OCEANIA',
] as const;
export type Region = (typeof REGIONS)[number];

/**
 * Countries in each region, after the UN M49 standard
 * (https://unstats.un.org/unsd/methodology/m49/). Changes from M49, so brands get what they
 * expect:
 * - Europe also takes the countries that sit in both Europe and Asia and belong to the Council
 *   of Europe: Armenia, Georgia, Azerbaijan, Cyprus and Turkey. Russia is in Asia too.
 * - North America is the US, Canada and Mexico (plus Bermuda, Greenland, Saint Pierre and
 *   Miquelon); Mexico is in Latin America too.
 * Antarctica (AQ) is in no region, only Worldwide.
 */
// prettier-ignore
export const REGION_COUNTRIES: Record<Exclude<Region, 'WORLD'>, readonly string[]> = {
  EUROPE: [
    // Eastern
    'BY', 'BG', 'CZ', 'HU', 'MD', 'PL', 'RO', 'RU', 'SK', 'UA',
    // Northern
    'AX', 'DK', 'EE', 'FO', 'FI', 'GG', 'IS', 'IE', 'IM', 'JE', 'LV', 'LT', 'NO', 'SJ', 'SE', 'GB',
    // Southern
    'AL', 'AD', 'BA', 'HR', 'GI', 'GR', 'VA', 'IT', 'MT', 'ME', 'MK', 'PT', 'SM', 'RS', 'SI', 'ES',
    // Western
    'AT', 'BE', 'FR', 'DE', 'LI', 'LU', 'MC', 'NL', 'CH',
    // Europe and Asia
    'AM', 'GE', 'AZ', 'CY', 'TR',
  ],
  ASIA: [
    // Central
    'KZ', 'KG', 'TJ', 'TM', 'UZ',
    // Eastern
    'CN', 'HK', 'MO', 'KP', 'JP', 'MN', 'KR', 'TW',
    // South-eastern
    'BN', 'KH', 'ID', 'LA', 'MY', 'MM', 'PH', 'SG', 'TH', 'TL', 'VN',
    // Southern
    'AF', 'BD', 'BT', 'IN', 'IR', 'MV', 'NP', 'PK', 'LK',
    // Western
    'AM', 'AZ', 'BH', 'CY', 'GE', 'IQ', 'IL', 'JO', 'KW', 'LB', 'OM', 'QA', 'SA', 'PS', 'SY', 'TR',
    'AE', 'YE',
    // Europe and Asia
    'RU',
  ],
  NORTH_AMERICA: ['US', 'CA', 'MX', 'BM', 'GL', 'PM'],
  LATIN_AMERICA: [
    // Central America
    'BZ', 'CR', 'SV', 'GT', 'HN', 'MX', 'NI', 'PA',
    // South America
    'AR', 'BO', 'BV', 'BR', 'CL', 'CO', 'EC', 'FK', 'GF', 'GY', 'PY', 'PE', 'GS', 'SR', 'UY', 'VE',
    // Caribbean
    'AI', 'AG', 'AW', 'BS', 'BB', 'BQ', 'VG', 'KY', 'CU', 'CW', 'DM', 'DO', 'GD', 'GP', 'HT', 'JM',
    'MQ', 'MS', 'PR', 'BL', 'KN', 'LC', 'MF', 'VC', 'SX', 'TT', 'TC', 'VI',
  ],
  AFRICA: [
    // Northern
    'DZ', 'EG', 'LY', 'MA', 'SD', 'TN', 'EH',
    // Eastern
    'IO', 'BI', 'KM', 'DJ', 'ER', 'ET', 'TF', 'KE', 'MG', 'MW', 'MU', 'YT', 'MZ', 'RE', 'RW', 'SC',
    'SO', 'SS', 'UG', 'TZ', 'ZM', 'ZW',
    // Middle
    'AO', 'CM', 'CF', 'TD', 'CG', 'CD', 'GQ', 'GA', 'ST',
    // Southern
    'BW', 'SZ', 'LS', 'NA', 'ZA',
    // Western
    'BJ', 'BF', 'CV', 'CI', 'GM', 'GH', 'GN', 'GW', 'LR', 'ML', 'MR', 'NE', 'NG', 'SH', 'SN', 'SL',
    'TG',
  ],
  OCEANIA: [
    'AU', 'NZ', 'NF', 'HM', 'CX', 'CC',
    'FJ', 'NC', 'PG', 'SB', 'VU',
    'GU', 'KI', 'MH', 'FM', 'NR', 'MP', 'PW', 'UM',
    'AS', 'CK', 'PF', 'NU', 'PN', 'WS', 'TK', 'TO', 'TV', 'WF',
  ],
};

const REGION_SET = new Set<string>(REGIONS);
export const isRegion = (code: string): code is Region => REGION_SET.has(code);

/** The regions a country belongs to (not counting Worldwide). */
export function regionsOf(country: string): Region[] {
  return (Object.keys(REGION_COUNTRIES) as Exclude<Region, 'WORLD'>[]).filter((r) =>
    REGION_COUNTRIES[r].includes(country),
  );
}

/**
 * Does a brief's target list (countries and regions) include this country? An empty list means
 * anywhere.
 */
export function targetsCountry(targets: readonly string[], country: string): boolean {
  if (targets.length === 0) return true;
  return targets.some(
    (t) =>
      t === country ||
      t === 'WORLD' ||
      (isRegion(t) && REGION_COUNTRIES[t as Exclude<Region, 'WORLD'>].includes(country)),
  );
}

/**
 * Codes under which a brief can target this country: the country itself, Worldwide and its
 * regions. A brief whose list shares one of them targets the country (for database filters).
 */
export function targetCodesFor(country: string): string[] {
  return [country, 'WORLD', ...regionsOf(country)];
}

/**
 * The countries a target list covers, or null for anywhere (an empty list or Worldwide).
 */
export function targetCountries(targets: readonly string[]): string[] | null {
  if (targets.length === 0 || targets.includes('WORLD')) return null;
  const out = new Set<string>();
  for (const t of targets) {
    if (isRegion(t)) REGION_COUNTRIES[t as Exclude<Region, 'WORLD'>].forEach((c) => out.add(c));
    else out.add(t);
  }
  return [...out];
}

/** The plain countries in a target list (city search needs real countries). */
export const onlyCountries = (targets: readonly string[]) => targets.filter((t) => !isRegion(t));
