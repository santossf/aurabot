import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getSession } from '../lib/session.js';
import { exchangeAuthCode, refreshAccessToken, computeExpiresAt } from '../lib/avalon.js';

export const authRouter = Router();

/**
 * POST /auth/exchange
 * Body: { code, codeVerifier }
 *
 * Frontend chama assim que recebe o ?code=... no callback da Avalon.
 * Backend troca por tokens e:
 *   - guarda refreshToken na sessão (cookie httpOnly)
 *   - devolve apenas accessToken + expiresAt para o browser
 */
const exchangeSchema = z.object({
  code: z.string().min(1),
  codeVerifier: z.string().min(1),
});

authRouter.post('/exchange', async (req: Request, res: Response) => {
  const parsed = exchangeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  try {
    const { accessToken, refreshToken, expiresIn } = await exchangeAuthCode(
      parsed.data.code,
      parsed.data.codeVerifier,
    );

    const expiresAt = computeExpiresAt(expiresIn);

    // Persistimos refreshToken APENAS no servidor.
    const session = await getSession(req, res);
    session.refreshToken = refreshToken;
    session.user = { id: 'pending', email: undefined, name: undefined };
    // TODO: chamar API da Avalon para popular user.id/email/name reais
    await session.save();

    return res.json({ accessToken, expiresAt });
  } catch (err) {
    console.error('[auth/exchange] erro:', err);
    return res.status(401).json({ error: 'token_exchange_failed' });
  }
});

/**
 * POST /auth/refresh
 * Frontend chama antes do accessToken expirar.
 * Backend usa o refreshToken da sessão e devolve um novo accessToken.
 */
authRouter.post('/refresh', async (req: Request, res: Response) => {
  const session = await getSession(req, res);
  const refreshToken = session.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: 'no_refresh_token' });
  }

  try {
    const refreshed = await refreshAccessToken(refreshToken);

    // Refresh token pode ter sido rotacionado pela Avalon
    if (refreshed.refreshToken && refreshed.refreshToken !== refreshToken) {
      session.refreshToken = refreshed.refreshToken;
      await session.save();
    }

    return res.json({
      accessToken: refreshed.accessToken,
      expiresAt: computeExpiresAt(refreshed.expiresIn),
    });
  } catch (err) {
    console.error('[auth/refresh] erro:', err);
    // Refresh token inválido — força novo login
    session.destroy();
    return res.status(401).json({ error: 'refresh_failed' });
  }
});

/**
 * GET /auth/me
 * Frontend chama no boot. Se houver refreshToken, somos "autenticados"
 * (o accessToken em si é gerenciado em memória pelo cliente, via /refresh).
 */
authRouter.get('/me', async (req: Request, res: Response) => {
  const session = await getSession(req, res);
  if (!session.refreshToken || !session.user) {
    return res.status(401).json({ authenticated: false });
  }
  return res.json({ authenticated: true, user: session.user });
});

/**
 * POST /auth/logout
 * Limpa a sessão. (Idealmente revogar o refresh token na Avalon também,
 * se o SDK expuser esse método.)
 */
authRouter.post('/logout', async (req: Request, res: Response) => {
  const session = await getSession(req, res);
  session.destroy();
  return res.json({ ok: true });
});
