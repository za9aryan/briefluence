import { forwardRef } from 'react';
import { cn } from '../lib/cn';
import { Block, type BlockProps } from './Block';

const SIZES = { sm: 'max-w-xl', md: 'max-w-3xl', lg: 'max-w-5xl', xl: 'max-w-7xl', full: 'max-w-none' } as const;

export interface ContainerProps extends BlockProps {
  size?: keyof typeof SIZES;
}

/** Centered page column: 16px side padding on phones (brand rule), 24px from md, 32px from lg. */
export const Container = forwardRef<HTMLElement, ContainerProps>(function Container(
  { size = 'xl', className, px = { base: 4, md: 6, lg: 8 }, ...rest },
  ref,
) {
  return <Block ref={ref} px={px} className={cn('mx-auto w-full', SIZES[size], className)} {...rest} />;
});
