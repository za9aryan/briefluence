import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/** Horizontally scrollable on small screens so wide tables never break the layout. */
export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-card border border-line bg-surface-raised">
      <table className={cn('w-full min-w-[640px] border-collapse text-small', className)} {...rest} />
    </div>
  );
}
export const THead = (p: HTMLAttributes<HTMLTableSectionElement>) => <thead {...p} className={cn('bg-surface', p.className)} />;
export const TBody = (p: HTMLAttributes<HTMLTableSectionElement>) => <tbody {...p} className={cn('divide-y divide-line', p.className)} />;
export const TR = (p: HTMLAttributes<HTMLTableRowElement>) => <tr {...p} className={cn('align-top', p.className)} />;
export const TH = ({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn('px-4 py-3 text-left text-small font-bold uppercase tracking-wide text-ink-muted', className)} {...rest} />
);
export const TD = ({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-4 py-3 text-ink', className)} {...rest} />
);
