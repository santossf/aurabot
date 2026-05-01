/**
 * ============================================================================
 * AVALON / QUADCODE — wrapper server-side
 * ----------------------------------------------------------------------------
 * Usa o SDK para a troca de tokens (ele conhece o path correto na API da
 * Avalon). Em caso de erro, capturamos contexto extra para diagnóstico.
 * ============================================================================
 */
import { OAuthMethod } from '@quadcode-tech/client-sdk-js';
import { env } from '../config/env.js';
 
export interface ExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}
 
/**
 * Storage de tokens que o SDK injeta. Capturamos os tokens via o método set().
 */
class CapturingTokensStorage {
  private tokens: { accessToken: string; refreshToken?: string } = { accessToken: '' };
  get() { return this.tokens; }
  set(tokens: { accessToken: string; refreshToken?: string }) { this.tokens = tokens; }
}
 
function buildOAuth(opts: {
  accessToken?: string;
  refreshToken?: string;
  storage: CapturingTokensStorage;
}) {
  return new OAuthMethod(
    env.AVALON_OAUTH_API_BASE_URL,
    env.AVALON_CLIENT_ID as any,
    env.AVALON_REDIRECT_URI,
    env.AVALON_SCOPE,
    env.AVALON_CLIENT_SECRET,
    opts.accessToken,
    opts.refreshToken,
    undefined,
    undefined,
    undefined,
    opts.storage as any,
  );
}
 
/**
 * Troca o `code` por accessToken + refreshToken via SDK.
 * Loga contexto detalhado em caso de erro para diagnóstico.
 */
export async function exchangeAuthCode(
  code: string,
  codeVerifier: string,
): Promise<ExchangeResult> {
  console.log('[avalon/exchange] iniciando troca, params:', {
    apiBaseUrl:    env.AVALON_OAUTH_API_BASE_URL,
    client_id:     env.AVALON_CLIENT_ID,
    redirect_uri:  env.AVALON_REDIRECT_URI,
    scope:         env.AVALON_SCOPE,
    code_length:   code.length,
    verifier_length: codeVerifier.length,
    secret_set:    !!env.AVALON_CLIENT_SECRET,
    secret_length: env.AVALON_CLIENT_SECRET.length,
  });
 
  const storage = new CapturingTokensStorage();
  const oauth = buildOAuth({ storage });
 
  try {
    const result = await oauth.issueAccessTokenWithAuthCode(code, codeVerifier);
    console.log('[avalon/exchange] SUCESSO - expiresIn:', result.expiresIn);
    return {
      accessToken:  result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn:    result.expiresIn,
    };
  } catch (err: any) {
    // Loga TUDO sobre o erro para descobrir a causa
    console.error('[avalon/exchange] FALHOU');
    console.error('[avalon/exchange] err.name:', err?.name);
    console.error('[avalon/exchange] err.message:', err?.message);
    console.error('[avalon/exchange] err.code:', err?.code);
    console.error('[avalon/exchange] err.status:', err?.status);
    console.error('[avalon/exchange] err.response:', err?.response);
    console.error('[avalon/exchange] err.cause:', err?.cause);
    if (err?.response?.data) {
      console.error('[avalon/exchange] err.response.data:', err.response.data);
    }
    if (err?.body) {
      console.error('[avalon/exchange] err.body:', err.body);
    }
    // Stringify para pegar tudo
    try {
      console.error('[avalon/exchange] err full:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    } catch {}
    throw err;
  }
}
 
/**
 * Renova o accessToken usando refreshToken.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number; refreshToken?: string }> {
  const storage = new CapturingTokensStorage();
  storage.set({ accessToken: '', refreshToken });
 
  const oauth = buildOAuth({ refreshToken, storage });
 
  try {
    const result = await oauth.refreshAccessToken();
    const updated = storage.get();
    return {
      accessToken:  result.accessToken,
      expiresIn:    result.expiresIn,
      refreshToken: updated.refreshToken ?? refreshToken,
    };
  } catch (err: any) {
    console.error('[avalon/refresh] FALHOU');
    console.error('[avalon/refresh] err.message:', err?.message);
    try {
      console.error('[avalon/refresh] err full:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    } catch {}
    throw err;
  }
}
 
/** Helper: epoch ms até o token expirar (com folga de segurança). */
export function computeExpiresAt(expiresIn: number, safetyMarginSec = 30): number {
  return Date.now() + Math.max(0, (expiresIn - safetyMarginSec) * 1000);
}
