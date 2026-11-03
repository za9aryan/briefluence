'use client';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

export interface ConfirmOptions {
  title: ReactNode;
  description?: ReactNode;
  /** The action's own words ("Close brief", "Log out"), never just "OK". */
  confirmLabel: string;
  /** `danger` for destructive actions (default), `primary` for neutral ones. */
  tone?: 'danger' | 'primary';
}

type Ask = (o: ConfirmOptions) => Promise<boolean>;
const Ctx = createContext<Ask | null>(null);

/**
 * One app-wide "are you sure?" dialog (a bottom sheet on phones, via Modal).
 * `const confirm = useConfirm(); if (await confirm({ title, confirmLabel })) doIt();`
 */
export function ConfirmProvider({
  children,
  cancelLabel,
  closeLabel,
}: {
  children: ReactNode;
  cancelLabel: string;
  closeLabel: string;
}) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const finish = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(false);
  };
  const ask = useCallback<Ask>((o) => {
    resolver.current?.(false);
    setOpts(o);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);
  return (
    <Ctx.Provider value={ask}>
      {children}
      <Modal
        open={open}
        onClose={() => finish(false)}
        size="sm"
        closeLabel={closeLabel}
        title={opts?.title}
        description={opts?.description}
        footer={
          <>
            <Button variant="ghost" onClick={() => finish(false)}>
              {cancelLabel}
            </Button>
            <Button
              variant={opts?.tone === 'primary' ? 'primary' : 'danger'}
              onClick={() => finish(true)}
            >
              {opts?.confirmLabel}
            </Button>
          </>
        }
      />
    </Ctx.Provider>
  );
}

export function useConfirm(): Ask {
  const ask = useContext(Ctx);
  if (!ask) throw new Error('useConfirm needs <ConfirmProvider>');
  return ask;
}
