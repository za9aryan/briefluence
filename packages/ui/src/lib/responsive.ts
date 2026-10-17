/**
 * Responsive props keyed by Tailwind's default breakpoints.
 *   gap={4}                       → "gap-4"
 *   gap={{ base: 2, md: 4, xl: 6 }} → "gap-2 md:gap-4 xl:gap-6"
 * Every class these helpers can produce is safelisted in styles.css via @source inline().
 */
export const BREAKPOINTS = ['base', 'sm', 'md', 'lg', 'xl', '2xl'] as const;
export type Breakpoint = (typeof BREAKPOINTS)[number];

/** Pixel widths of Tailwind's default breakpoints (min-width). */
export const BREAKPOINT_PX: Record<Exclude<Breakpoint, 'base'>, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

export type Responsive<T> = T | Partial<Record<Breakpoint, T>>;

/** Brand spacing scale: 4/8/16/24/32px (1,2,4,6,8); 12 and 16 (48/64px) only for section rhythm. */
export type Space = 0 | 1 | 2 | 4 | 6 | 8 | 12 | 16;

function isMap<T>(v: Responsive<T>): v is Partial<Record<Breakpoint, T>> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Builds classes for a responsive value. `toClass` maps one value to a utility without prefix,
 * e.g. (v) => `gap-${v}`.
 */
export function rx<T>(value: Responsive<T> | undefined, toClass: (v: T) => string | null): string {
  if (value === undefined) return '';
  if (!isMap(value)) return toClass(value) ?? '';
  const out: string[] = [];
  for (const bp of BREAKPOINTS) {
    const v = value[bp];
    if (v === undefined) continue;
    const cls = toClass(v);
    if (!cls) continue;
    out.push(bp === 'base' ? cls : cls.split(' ').map((c) => `${bp}:${c}`).join(' '));
  }
  return out.join(' ');
}
