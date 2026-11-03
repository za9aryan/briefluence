'use client';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SESSION_EVENT } from '../api';

/**
 * One shared Socket.IO connection for the whole app (notifications, support chat). The server
 * pushes ids and kinds only; components reload the actual data over the REST API.
 */
let socket: Socket | null = null;
let listeners = 0;

/** Where the socket goes. Dev builds point at localhost:4000, which a phone can't reach, so use
 * the host the page was opened on (e.g. http://192.168.1.20:4000) instead. */
function socketOrigin() {
  const configured = process.env.NEXT_PUBLIC_SOCKET_ORIGIN;
  if (!configured) return window.location.origin;
  const url = new URL(configured);
  if (url.hostname === 'localhost' && window.location.hostname !== 'localhost')
    url.hostname = window.location.hostname;
  return url.origin;
}

function connection(): Socket {
  if (!socket) {
    socket = io(socketOrigin(), {
      path: '/api/v1/ws',
      withCredentials: true,
      autoConnect: false,
    });
    // Signed in, out or refreshed: join the rooms that belong to the new cookies.
    window.addEventListener(SESSION_EVENT, () => reconnectLive());
    socket.on('connect', () => void reportPresence());
    document.addEventListener('visibilitychange', () => void reportPresence());
    // Repeat while on screen: the server stops trusting a report after 30 s, so a phone frozen
    // in the background (socket still open) gets pushes again.
    window.setInterval(() => {
      if (document.visibilityState === 'visible') void reportPresence();
    }, PRESENCE_EVERY_MS);
  }
  return socket;
}

const PRESENCE_EVERY_MS = 20_000;

/** This device's push endpoint, if it has push turned on. */
async function pushEndpoint(): Promise<string | null> {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return null;
  if (Notification.permission !== 'granted') return null;
  const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  return sub?.endpoint ?? null;
}

/**
 * Tell the server whether the app is on screen here, so it skips the push to this device (the
 * bell and toasts already show the notification live). Also call after turning push on.
 */
export async function reportPresence() {
  if (!socket?.connected) return;
  const endpoint = await pushEndpoint();
  if (!endpoint) return;
  socket.emit('presence', { visible: document.visibilityState === 'visible', endpoint });
}

export const LIVE = {
  support: 'support:update',
  notifications: 'notifications:update',
} as const;

/**
 * Calls `onEvent(data)` for every `event` push, and `onEvent(null)` after every (re)connect so
 * anything missed while offline is reloaded.
 */
export function useLive<T = Record<string, unknown>>(
  event: (typeof LIVE)[keyof typeof LIVE],
  onEvent: (data: T | null) => void,
  enabled = true,
) {
  const cb = useRef(onEvent);
  cb.current = onEvent;
  useEffect(() => {
    if (!enabled) return;
    const s = connection();
    const handle = (data: T) => cb.current(data);
    const onConnect = () => cb.current(null);
    s.on(event, handle);
    s.on('connect', onConnect);
    listeners++;
    if (!s.connected) s.connect();
    return () => {
      s.off(event, handle);
      s.off('connect', onConnect);
      if (--listeners === 0) s.disconnect();
    };
  }, [event, enabled]);
}

/**
 * Re-authenticate the live channel after the cookies changed: sign-in, sign-out, a refreshed
 * session, or a guest who just started a support conversation.
 */
export function reconnectLive() {
  if (socket && listeners > 0) socket.disconnect().connect();
}
