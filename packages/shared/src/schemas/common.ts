import { z } from 'zod';

export const idSchema = z.string().min(1).max(64);
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
export const optionalUrl = z
  .union([z.url({ protocol: /^https?$/ }).max(500), z.literal('')])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));
/**
 * A web address the user typed: "instagram.com/ani" → "https://instagram.com/ani". An existing
 * http(s):// is kept, so pasting a full link works too; empty stays empty.
 */
export function withScheme(v: string): string {
  const s = v.trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`;
}
/** For editing: the address without its scheme (the field shows "https://" in front). */
export function stripScheme(v: string | null | undefined): string {
  return (v ?? '').trim().replace(/^https?:\/\//i, '');
}
/** Optional link typed by a person (website, profile, portfolio): the scheme is added when missing. */
export const webUrl = z
  .string()
  .max(520)
  .optional()
  .nullable()
  .transform((v) => (v ? withScheme(v) : ''))
  .pipe(
    z
      .union([z.url({ protocol: /^https?$/ }).max(500), z.literal('')])
      .transform((v) => (v ? v : null)),
  );
export const countryCode = z.string().regex(/^[A-Z]{2}$/, 'invalid');
export const languageCode = z.string().regex(/^[a-z]{2}$/, 'ISO 639-1 code');
export const minorAmount = z.number().int().min(0).max(1_000_000_000_00);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationInput = z.infer<typeof paginationSchema>;
