'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/**
 * PWA helpers: service worker registration, the install prompt (Chrome/Edge/Android) and Web
 * Push on this device. iPhone/iPad only allow push for sites added to the Home Screen (iOS 16.4+),
 * and only after a tap: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
 */

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
let deferredPrompt: InstallPrompt | null = null;
const installListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  // Chrome fires this early; keep it so the Install button can show the browser's dialog later.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPrompt;
    installListeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installListeners.forEach((l) => l());
  });
}

export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

export type Platform = 'ios' | 'android' | 'desktop';

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch points give it away.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1))
    return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/** Opened from the Home Screen / as an installed app. */
export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function useInstall() {
  const [state, setState] = useState<{
    platform: Platform;
    installed: boolean;
    canPrompt: boolean;
  } | null>(null);
  useEffect(() => {
    const read = () =>
      setState({
        platform: detectPlatform(),
        installed: isStandalone(),
        canPrompt: !!deferredPrompt,
      });
    read();
    installListeners.add(read);
    return () => {
      installListeners.delete(read);
    };
  }, []);
  const prompt = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => undefined);
    deferredPrompt = null;
    installListeners.forEach((l) => l());
  }, []);
  return { state, prompt };
}

async function currentSubscription() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (!('Notification' in window) || Notification.permission !== 'granted') return null;
  const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  return (await reg?.pushManager.getSubscription().catch(() => null)) ?? null;
}

/**
 * Push follows whoever is signed in on this device. Push is saved per account, so after signing
 * in to another account (or after the server forgot this device) the phone would stay silent
 * until push was turned on again. If this device already allows notifications, link it now.
 */
export function usePushFollowsAccount(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    void currentSubscription().then((sub) =>
      sub ? api.post('/push/subscriptions', sub.toJSON()).catch(() => undefined) : undefined,
    );
  }, [userId]);
}

/** Before logging out: stop sending this account's pushes to this device. */
export async function unlinkPushFromAccount() {
  const sub = await currentSubscription();
  if (sub)
    await api.post('/push/subscriptions/remove', { endpoint: sub.endpoint }).catch(() => undefined);
}

export type PushState =
  | 'loading'
  | 'unavailable' // push not set up on the server
  | 'unsupported' // this browser can't do Web Push
  | 'needs-install' // iPhone/iPad in Safari: add to Home Screen first
  | 'denied' // the user blocked notifications for this site
  | 'off'
  | 'on';

function keyBytes(base64url: string) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Push notifications on this device: current state plus turn on / off (call from a tap). */
export function usePush() {
  const [state, setState] = useState<PushState>('loading');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const supported =
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) {
      setState(detectPlatform() === 'ios' && !isStandalone() ? 'needs-install' : 'unsupported');
      return;
    }
    const server = await api.get<{ enabled: boolean }>('/push/public-key').catch(() => null);
    if (!server?.enabled) return setState('unavailable');
    if (Notification.permission === 'denied') return setState('denied');
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    setState(sub && Notification.permission === 'granted' ? 'on' : 'off');
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async (): Promise<PushState> => {
    setBusy(true);
    try {
      const { publicKey } = await api.get<{ publicKey: string | null }>('/push/public-key');
      if (!publicKey) {
        setState('unavailable');
        return 'unavailable';
      }
      // Must run inside the tap (iOS requires a user gesture for the permission dialog).
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        const next = permission === 'denied' ? 'denied' : 'off';
        setState(next);
        return next;
      }
      const reg =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register('/sw.js'));
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(publicKey),
        }));
      await api.post('/push/subscriptions', sub.toJSON());
      setState('on');
      return 'on';
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api
          .post('/push/subscriptions/remove', { endpoint: sub.endpoint })
          .catch(() => undefined);
        await sub.unsubscribe();
      }
      setState('off');
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, enable, disable };
}
