import { describe, expect, it } from 'vitest';
import { rx } from './responsive';

describe('rx', () => {
  it('maps a single value', () => {
    expect(rx(4, (v) => `gap-${v}`)).toBe('gap-4');
  });
  it('maps breakpoints in order with prefixes', () => {
    expect(rx({ xl: 6, base: 2, md: 4 }, (v) => `gap-${v}`)).toBe('gap-2 md:gap-4 xl:gap-6');
  });
  it('prefixes every class of a multi-class value', () => {
    expect(rx({ base: 'col', lg: 'row' }, (v) => `flex-${v}`)).toBe('flex-col lg:flex-row');
    expect(rx({ md: true }, (v) => (v ? 'px-4 py-2' : null))).toBe('md:px-4 md:py-2');
  });
  it('ignores undefined', () => {
    expect(rx(undefined, (v) => `gap-${v}`)).toBe('');
  });
});
