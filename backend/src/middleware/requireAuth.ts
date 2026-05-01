import type { Request, Response, NextFunction } from 'express';
import { getSession } from '../lib/session.js';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email?: string; name?: string };
    }
  }
}

/**
 * Garante que existe sessão válida (com refreshToken).
 * Como o accessToken vive no frontend, este middleware só verifica
 * a presença da sessão. Endpoints que precisam falar com a Avalon
 * são chamados pelo frontend diretamente, não pelo backend.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await getSession(req, res);

  if (!session.refreshToken || !session.user) {
    return res.status(401).json({ error: 'unauthenticated' });
  }

  req.user = session.user;
  next();
}
