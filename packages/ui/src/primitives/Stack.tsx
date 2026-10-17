import { forwardRef } from 'react';
import { cn } from '../lib/cn';
import { rx, type Responsive, type Space } from '../lib/responsive';
import { Block, type BlockProps } from './Block';

type Direction = 'row' | 'col' | 'row-reverse' | 'col-reverse';
type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
type Justify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

export interface StackProps extends BlockProps {
  direction?: Responsive<Direction>;
  gap?: Responsive<Space>;
  align?: Responsive<Align>;
  justify?: Responsive<Justify>;
  wrap?: boolean;
}

/**
 * Flex layout. Vertical by default; switch per breakpoint, e.g.
 * <Stack direction={{ base: 'col', md: 'row' }} gap={{ base: 3, md: 6 }} />
 */
export const Stack = forwardRef<HTMLElement, StackProps>(function Stack(
  { direction = 'col', gap = 0, align, justify, wrap, className, ...rest },
  ref,
) {
  return (
    <Block
      ref={ref}
      className={cn(
        'flex',
        rx(direction, (v) => `flex-${v}`),
        rx(gap, (v) => `gap-${v}`),
        rx(align, (v) => `items-${v}`),
        rx(justify, (v) => `justify-${v}`),
        wrap && 'flex-wrap',
        className,
      )}
      {...rest}
    />
  );
});

/** Horizontal stack, centered vertically: the common "row of things" case. */
export const Inline = forwardRef<HTMLElement, StackProps>(function Inline(props, ref) {
  return <Stack ref={ref} direction="row" align="center" gap={2} {...props} />;
});
