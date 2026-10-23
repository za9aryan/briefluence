import type { ApiErrorBody, ErrorCode } from '@briefluence/shared';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
  /** Field errors from a Zod flatten() payload, if any. */
  get fieldErrors(): Record<string, string[]> {
    const d = this.details as { fieldErrors?: Record<string, string[]> } | undefined;
    return d?.fieldErrors ?? {};
  }
}

let refreshing: Promise<boolean> | null = null;

/** Fired when the session cookies change, so the live channel re-authenticates (lib/hooks/live). */
export const SESSION_EVENT = 'bf:session-changed';
const sessionChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_EVENT));
};
const SESSION_PATHS = /^\/auth\/(login|signup|logout|verify-email|oauth)/;

/** One shared refresh for all requests that hit 401 at the same time. */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((r) => {
      if (r.ok) sessionChanged();
      return r.ok;
    })
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

type Query = Record<string, string | number | boolean | string[] | null | undefined>;

export function toQuery(q?: Query): string {
  if (!q) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    p.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  query?: Query,
  retried = false,
): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}${toQuery(query)}`, {
    method,
    credentials: 'include',
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body == null ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (
    res.status === 401 &&
    !retried &&
    !path.startsWith('/auth/login') &&
    !path.startsWith('/auth/refresh')
  ) {
    if (await refreshSession()) return request<T>(method, path, body, query, true);
  }
  if (res.ok && SESSION_PATHS.test(path)) sessionChanged();
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'INTERNAL',
      err?.message ?? res.statusText,
      err?.details,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  /** Support chat images: open to guests too, so they use their own endpoint. */
  uploadSupport: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ url: string }>('POST', '/support/attachments', form);
  },
  upload: (kind: 'avatar' | 'logo' | 'deal' | 'portfolio' | 'offer', file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ url: string }>('POST', `/uploads/${kind}`, form);
  },
};
