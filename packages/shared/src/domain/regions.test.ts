import { describe, expect, it } from 'vitest';
import { ALL_COUNTRIES } from '../constants';
import {
  REGION_COUNTRIES,
  isRegion,
  onlyCountries,
  regionsOf,
  targetCodesFor,
  targetCountries,
  targetsCountry,
} from './regions';

describe('regions', () => {
  it('puts every country except Antarctica in at least one region', () => {
    const missing = ALL_COUNTRIES.filter((c) => c !== 'AQ' && regionsOf(c).length === 0);
    expect(missing).toEqual([]);
  });

  it('uses only real country codes, once per region', () => {
    const all = new Set(ALL_COUNTRIES);
    for (const list of Object.values(REGION_COUNTRIES)) {
      expect(list.filter((c) => !all.has(c))).toEqual([]);
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it('knows the countries that sit in two regions', () => {
    expect(regionsOf('AM')).toEqual(['EUROPE', 'ASIA']);
    expect(regionsOf('RU')).toEqual(['EUROPE', 'ASIA']);
    expect(regionsOf('MX')).toEqual(['NORTH_AMERICA', 'LATIN_AMERICA']);
    expect(regionsOf('FR')).toEqual(['EUROPE']);
  });

  it('matches a country against countries, regions and Worldwide', () => {
    expect(targetsCountry([], 'AM')).toBe(true);
    expect(targetsCountry(['AM', 'GE'], 'AM')).toBe(true);
    expect(targetsCountry(['GE'], 'AM')).toBe(false);
    expect(targetsCountry(['WORLD'], 'AM')).toBe(true);
    expect(targetsCountry(['EUROPE'], 'DE')).toBe(true);
    expect(targetsCountry(['EUROPE'], 'US')).toBe(false);
    expect(targetsCountry(['NORTH_AMERICA', 'FR'], 'US')).toBe(true);
  });

  it('lists the codes a brief can use to reach a country', () => {
    expect(targetCodesFor('AM')).toEqual(['AM', 'WORLD', 'EUROPE', 'ASIA']);
    expect(targetCodesFor('AQ')).toEqual(['AQ', 'WORLD']);
  });

  it('expands targets to countries, null meaning anywhere', () => {
    expect(targetCountries([])).toBeNull();
    expect(targetCountries(['WORLD', 'AM'])).toBeNull();
    expect(targetCountries(['AM', 'GE'])).toEqual(['AM', 'GE']);
    const na = targetCountries(['NORTH_AMERICA', 'AM'])!;
    expect(na).toContain('US');
    expect(na).toContain('AM');
  });

  it('tells regions from countries', () => {
    expect(isRegion('EUROPE')).toBe(true);
    expect(isRegion('EU')).toBe(false);
    expect(onlyCountries(['WORLD', 'AM', 'ASIA', 'GE'])).toEqual(['AM', 'GE']);
  });
});
