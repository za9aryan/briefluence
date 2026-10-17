import { forwardRef, type ElementType, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { rx, type Responsive, type Space } from '../lib/responsive';

/** Brand surfaces: page = `surface`, raised = cards/modals, soft = primary tint, primary/ink = solid fills. */
export type Surface = 'none' | 'page' | 'raised' | 'soft' | 'primary' | 'ink';
const SURFACE: Record<Surface, string> = {
  none: '',
  page: 'bg-surface',
  raised: 'bg-surface-raised',
  soft: 'bg-primary-soft',
  primary: 'bg-primary text-on-primary',
  ink: 'bg-ink text-surface',
};
const RADIUS = { none: '', sm: 'rounded-sm', card: 'rounded-card', lg: 'rounded-lg', pill: 'rounded-pill' };

export interface SpacingProps {
  p?: Responsive<Space>;
  px?: Responsive<Space>;
  py?: Responsive<Space>;
  pt?: Responsive<Space>;
  pb?: Responsive<Space>;
}

export function spacingClasses({ p, px, py, pt, pb }: SpacingProps): string {
  return cn(
    rx(p, (v) => `p-${v}`),
    rx(px, (v) => `px-${v}`),
    rx(py, (v) => `py-${v}`),
    rx(pt, (v) => `pt-${v}`),
    rx(pb, (v) => `pb-${v}`),
  );
}

export interface BlockProps extends HTMLAttributes<HTMLElement>, SpacingProps {
  as?: ElementType;
  surface?: Surface;
  radius?: keyof typeof RADIUS;
  bordered?: boolean;
  shadow?: boolean;
}

/** The base box: padding on the brand spacing scale, surface, radius, border. */
export const Block = forwardRef<HTMLElement, BlockProps>(function Block(
  { as: Tag = 'div', surface = 'none', radius = 'none', bordered, shadow, p, px, py, pt, pb, className, ...rest },
  ref,
) {
  return (
    <Tag
      ref={ref}
      className={cn(
        SURFACE[surface],
        RADIUS[radius],
        bordered && 'border border-line',
        shadow && 'shadow-card',
        spacingClasses({ p, px, py, pt, pb }),
        className,
      )}
      {...rest}
    />
  );
});
