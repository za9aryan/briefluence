import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import type { Breakpoint } from '../lib/responsive';

type Bp = Exclude<Breakpoint, 'base'>;
const ABOVE: Record<Bp, string> = { sm: 'hidden sm:contents', md: 'hidden md:contents', lg: 'hidden lg:contents', xl: 'hidden xl:contents', '2xl': 'hidden 2xl:contents' };
const BELOW: Record<Bp, string> = { sm: 'contents sm:hidden', md: 'contents md:hidden', lg: 'contents lg:hidden', xl: 'contents xl:hidden', '2xl': 'contents 2xl:hidden' };

/**
 * CSS-only responsive visibility (no hydration flicker):
 *   <Show above="lg">desktop sidebar</Show>   <Show below="lg">mobile menu</Show>
 */
export function Show({ above, below, children }: { above?: Bp; below?: Bp; children: ReactNode }) {
  return <div className={cn(above && ABOVE[above], below && BELOW[below])}>{children}</div>;
}
