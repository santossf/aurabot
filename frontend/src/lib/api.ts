/**
 * Cliente HTTP do frontend para o nosso backend Express.
 * (Não confundir com chamadas para a Avalon — essas vão direto via SDK.)
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include', // envia cookie httpOnly de sessão
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error ?? res.statusText);
  }

  return res.status === 204 ? (undefined as T) : res.json();
}

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(`${status} ${code}`);
  }
}

// Endpoints tipados
export const auth = {
  exchange: (code: string, codeVerifier: string) =>
    api<{ accessToken: string; expiresAt: number }>('/auth/exchange', {
      method: 'POST',
      body: JSON.stringify({ code, codeVerifier }),
    }),

  refresh: () =>
    api<{ accessToken: string; expiresAt: number }>('/auth/refresh', {
      method: 'POST',
    }),

  me: () =>
    api<{ authenticated: boolean; user?: { id: string; email?: string; name?: string } }>('/auth/me'),

  logout: () => api('/auth/logout', { method: 'POST' }),
};
