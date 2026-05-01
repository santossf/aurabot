import { getIronSession, SessionOptions } from 'iron-session';
import type { Request, Response } from 'express';
import { env, isProd } from '../config/env.js';

/**
 * Conteúdo da sessão.
 *
 * O accessToken NÃO é armazenado na sessão — ele vive em memória no frontend
 * e é renovado via /auth/refresh quando próximo do vencimento.
 *
 * Já o refreshToken JAMAIS sai do backend (cookie httpOnly).
 */
export type SessionData = {
  refreshToken?: string;
  user?: {
    id: string;
    email?: string;
    name?: string;
  };
};

const sessionOptions: SessionOptions = {
  password: env.SESSION_SECRET,
  cookieName: 'scalper_sess',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 60 * 60 * 24 * 30, // 30 dias — refresh tokens duram bastante
    path: '/',
  },
};

export function getSession(req: Request, res: Response) {
  return getIronSession<SessionData>(req, res, sessionOptions);
}
