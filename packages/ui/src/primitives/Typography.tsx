import { forwardRef, type ElementType, type HTMLAttributes, type LabelHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { rx, type Responsive } from '../lib/responsive';

/** Brand type scale: display 48 · h1 32 · h2 22 · body 16 · small 13 · label 12 (uppercase). */
export type TypeSize = 'display' | 'h1' | 'h2' | 'body' | 'small' | 'label';
export type Tone = 'default' | 'muted' | 'accent' | 'success' | 'danger' | 'onPrimary';

export const TONE_TEXT: Record<Tone, string> = {
  default: 'text-ink',
  muted: 'text-ink-muted',
  accent: 'text-primary-text',
  success: 'text-success',
  danger: 'text-primary-text', // brand: no separate error red — primary-text + icon + text
  onPrimary: 'text-on-primary',
};
const WEIGHT = {
  regular: 'font-normal',
  medium: 'font-medium',
  bold: 'font-bold',
  extrabold: 'font-extrabold',
};
const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' };

const sizeClass = (v: TypeSize) => (v === 'label' ? 'text-label uppercase' : `text-${v}`);

/** Default size per level, mobile → desktop (display is 48px, too big for a 360px phone). */
const HEADING_SIZE: Record<1 | 2 | 3 | 4, Responsive<TypeSize>> = {
  1: { base: 'h1', md: 'display' },
  2: 'h1',
  3: 'h2',
  4: 'body',
};

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4;
  /** Visual size, independent of the semantic level. */
  size?: Responsive<TypeSize>;
  tone?: Tone;
  align?: Responsive<keyof typeof ALIGN>;
}

/**
 * All headings use the UI font (Manrope; Noto Sans Armenian for Armenian) so English, Russian and
 * Armenian look the same: levels 1–2 extrabold, 3–4 bold. Syne is reserved for the logo wordmark.
 */
export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(function Heading(
  { level = 2, size, tone = 'default', align, className, ...rest },
  ref,
) {
  const Tag = `h${level}` as ElementType;
  return (
    <Tag
      ref={ref}
      className={cn(
        // break-words: long Armenian/Russian words must not push the page wider than a phone.
        'max-w-full text-balance break-words',
        level <= 2 ? 'font-extrabold' : 'font-bold',
        rx(size ?? HEADING_SIZE[level], sizeClass),
        TONE_TEXT[tone],
        rx(align, (v) => ALIGN[v]),
        className,
      )}
      {...rest}
    />
  );
});

export interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: 'p' | 'span' | 'div' | 'small' | 'strong' | 'em' | 'time';
  size?: Responsive<TypeSize>;
  tone?: Tone;
  weight?: keyof typeof WEIGHT;
  align?: Responsive<keyof typeof ALIGN>;
  truncate?: boolean;
  clamp?: 1 | 2 | 3;
  dateTime?: string;
}

const CLAMP = { 1: 'line-clamp-1', 2: 'line-clamp-2', 3: 'line-clamp-3' };

export const Text = forwardRef<HTMLElement, TextProps>(function Text(
  {
    as: Tag = 'p',
    size = 'body',
    tone = 'default',
    weight,
    align,
    truncate,
    clamp,
    className,
    ...rest
  },
  ref,
) {
  return (
    <Tag
      ref={ref as never}
      className={cn(
        rx(size, sizeClass),
        TONE_TEXT[tone],
        weight && WEIGHT[weight],
        rx(align, (v) => ALIGN[v]),
        truncate && 'truncate',
        clamp && CLAMP[clamp],
        className,
      )}
      {...rest}
    />
  );
});

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  function Label({ className, ...rest }, ref) {
    return <label ref={ref} className={cn('text-small font-bold text-ink', className)} {...rest} />;
  },
);

/** Small uppercase label above sections. */
export function Eyebrow({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-label uppercase text-primary-text', className)} {...rest} />;
}

export const Typography = { Heading, Text, Label, Eyebrow };
