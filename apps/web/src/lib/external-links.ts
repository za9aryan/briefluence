/**
 * Links to other sites open in a new tab, so the app stays open behind them. Most links set
 * `target="_blank"` themselves; this catches the rest (and links added later). Links that must
 * leave in the same tab and come back (sign-in and connect flows) carry `data-same-tab`.
 */
export function openExternalLinksInNewTab() {
  const onClick = (e: MouseEvent) => {
    const a = (e.target as Element | null)?.closest?.('a[href]');
    if (
      !(a instanceof HTMLAnchorElement) ||
      a.target ||
      a.hasAttribute('data-same-tab') ||
      a.hasAttribute('download')
    )
      return;
    if (!/^https?:$/.test(a.protocol) || a.origin === window.location.origin) return;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  };
  // Capture phase: runs before the browser follows the link, so the new target applies.
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}
