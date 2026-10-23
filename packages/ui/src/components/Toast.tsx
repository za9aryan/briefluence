'use client';
import { useCallback, type ReactNode } from 'react';
import { Toaster, toast as vyrn } from 'vyrn';

/**
 * Toasts are Vyrn (https://cdn.jsdelivr.net/npm/vyrn@5.0.0/README.md): accessible live regions,
 * keyboard (Alt+T, Escape), swipe, reduced motion. Brand colours come from styles.css.
 *
 * `useToast()` keeps the app's original call shape — `toast(message, tone?)` — mapped onto
 * Vyrn's states; `toast` (re-exported) gives the full Vyrn API: loading, promise, update…
 */
export type ToastTone = 'success' | 'danger' | 'info' | 'warning';

export const toast = vyrn;

export function ToastProvider({
  children,
  closeLabel = 'Close',
  regionLabel = 'Notifications',
  aboveChat = true,
}: {
  children: ReactNode;
  /** Leave room for the support chat button in the corner (off where there is none). */
  aboveChat?: boolean;
  /** Translated label of each toast's close button. */
  closeLabel?: string;
  /** Translated label of the toast region (Alt+T jumps there). */
  regionLabel?: string;
}) {
  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        // Above the support chat button (56 px + its 24 px margin) so they never overlap.
        offset={aboveChat ? { bottom: 96, right: 24 } : { bottom: 24, right: 24 }}
        mobileOffset={
          aboveChat ? { bottom: 88, right: 16, left: 16 } : { bottom: 16, right: 16, left: 16 }
        }
        visibleToasts={3}
        duration={4500}
        // Brand colours only (styles.css); no extra per-type background tint.
        color={false}
        closeButtonAriaLabel={closeLabel}
        containerAriaLabel={regionLabel}
        toastOptions={{ types: { error: { duration: 7000 } } }}
      />
    </>
  );
}

/** `toast(message)` = success, `toast(message, 'danger')` = error, also 'info' / 'warning'. */
export function useToast() {
  return useCallback((message: ReactNode, tone: ToastTone = 'success') => {
    if (tone === 'danger') return vyrn.error(message);
    if (tone === 'info') return vyrn.info(message);
    if (tone === 'warning') return vyrn.warning(message);
    return vyrn.success(message);
  }, []);
}
