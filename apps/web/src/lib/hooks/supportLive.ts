'use client';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

/** One shared Socket.IO connection for the support chat (widget and admin inbox). */
let socket: Socket | null = null;
let listeners = 0;

function connection(): Socket {
  socket ??= io(process.env.NEXT_PUBLIC_SOCKET_ORIGIN || window.location.origin, {
    path: '/api/v1/ws',
    withCredentials: true,
    autoConnect: false,
  });
  return socket;
}

/**
 * Calls `onUpdate(ticketId)` whenever the server says a support ticket changed, and with `null`
 * after every (re)connect so missed changes are reloaded. Pushes carry ids only; data comes
 * from the REST API.
 */
export function useSupportLive(onUpdate: (ticketId: string | null) => void, enabled = true) {
  const cb = useRef(onUpdate);
  cb.current = onUpdate;
  useEffect(() => {
    if (!enabled) return;
    const s = connection();
    const onEvent = (e: { ticketId: string }) => cb.current(e.ticketId);
    const onConnect = () => cb.current(null);
    s.on('support:update', onEvent);
    s.on('connect', onConnect);
    listeners++;
    if (!s.connected) s.connect();
    return () => {
      s.off('support:update', onEvent);
      s.off('connect', onConnect);
      if (--listeners === 0) s.disconnect();
    };
  }, [enabled]);
}

/** Re-authenticate the socket, e.g. after a guest started a conversation (new cookie). */
export function reconnectSupportLive() {
  if (socket) socket.disconnect().connect();
}
