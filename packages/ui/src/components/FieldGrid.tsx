'use client';
import type { ReactNode } from 'react';
import { Grid, type GridProps } from '../primitives/Grid';
import { cn } from '../lib/cn';
import { FieldGridContext } from './Field';

/**
 * Responsive grid for form fields. Every <Field> inside spans three shared rows (label, control,
 * hint/error) via CSS subgrid, so inputs in the same row stay aligned even when a label wraps —
 * e.g. long Armenian or Russian labels next to short ones.
 *   <FieldGrid cols={{ base: 1, md: 3 }}>…fields…</FieldGrid>
 */
export function FieldGrid({ children, gap = { base: 4, md: 6 }, className, ...rest }: GridProps & { children: ReactNode }) {
  return (
    <FieldGridContext.Provider value={true}>
      <Grid gap={gap} className={cn('gap-y-4', className)} {...rest}>
        {children}
      </Grid>
    </FieldGridContext.Provider>
  );
}
