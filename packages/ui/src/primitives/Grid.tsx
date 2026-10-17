import { forwardRef } from 'react';
import { cn } from '../lib/cn';
import { rx, type Responsive, type Space } from '../lib/responsive';
import { Block, type BlockProps } from './Block';

type Cols = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface GridProps extends BlockProps {
  cols?: Responsive<Cols>;
  gap?: Responsive<Space>;
}

/** CSS grid with responsive columns: <Grid cols={{ base: 1, md: 2, xl: 3 }} gap={6} /> */
export const Grid = forwardRef<HTMLElement, GridProps>(function Grid({ cols = 1, gap = 4, className, ...rest }, ref) {
  return (
    <Block
      ref={ref}
      className={cn('grid', rx(cols, (v) => `grid-cols-${v}`), rx(gap, (v) => `gap-${v}`), className)}
      {...rest}
    />
  );
});

export interface GridItemProps extends BlockProps {
  span?: Responsive<Cols | 'full'>;
}

export const GridItem = forwardRef<HTMLElement, GridItemProps>(function GridItem({ span, className, ...rest }, ref) {
  return <Block ref={ref} className={cn('min-w-0', rx(span, (v) => `col-span-${v}`), className)} {...rest} />;
});
