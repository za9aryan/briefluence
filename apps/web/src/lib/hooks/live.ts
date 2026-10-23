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

function connection(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_ORIGIN || window.location.origin, {
      path: '/api/v1/ws',
      withCredentials: true,
      autoConnect: false,
    });
    // Signed in, out or refreshed: join the rooms that belong to the new cookies.
    window.addEventListener(SESSION_EVENT, () => reconnectLive());
  }
  return socket;
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
