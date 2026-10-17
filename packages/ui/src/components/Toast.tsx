'use client';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Icon } from '../primitives/Icon';

type ToastTone = 'success' | 'danger' | 'info';
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: ReactNode;
}

const Ctx = createContext<((message: ReactNode, tone?: ToastTone) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((message: ReactNode, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, tone, message }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-sm border bg-surface-raised px-4 py-3 text-small shadow-pop',
              t.tone === 'danger' ? 'border-primary-text/30' : 'border-line',
            )}
          >
            <Icon
              name={t.tone === 'success' ? 'check-circle' : t.tone === 'danger' ? 'alert' : 'info'}
              tone={t.tone === 'success' ? 'success' : t.tone === 'danger' ? 'danger' : 'accent'}
              size="md"
            />
            <div className="min-w-0 flex-1 text-ink">{t.message}</div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const push = useContext(Ctx);
  if (!push) throw new Error('useToast must be used inside <ToastProvider>');
  return push;
}
