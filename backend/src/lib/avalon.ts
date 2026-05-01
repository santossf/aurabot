/**
 * ============================================================================
 * AVALON / QUADCODE — wrapper com fetch interceptor
 * ----------------------------------------------------------------------------
 * O SDK abafa o body da resposta de erro. Interceptamos o fetch global
 * durante a chamada do SDK para logar TUDO que a Avalon retorna.
 * ============================================================================
 */
import { OAuthMethod } from '@quadcode-tech/client-sdk-js';
import { env } from '../config/env.js';
 
export interface ExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}
 
class CapturingTokensStorage {
  private tokens: { accessToken: string; refreshToken?: string } = { accessToken: '' };
  get() { return this.tokens; }
  set(tokens: { accessToken: string; refreshToken?: string }) { this.tokens = tokens; }
}
 
function buildOAuth(opts: { storage: CapturingTokensStorage; refreshToken?: string }) {
  return new OAuthMethod(
    env.AVALON_OAUTH_API_BASE_URL,
    env.AVALON_CLIENT_ID as any,
    env.AVALON_REDIRECT_URI,
    env.AVALON_SCOPE,
    env.AVALON_CLIENT_SECRET,
    undefined,
    opts.refreshToken,
    undefined,
    undefined,
    undefined,
    opts.storage as any,
  );
}
 
/**
 * Patcha o fetch global temporariamente para logar tudo que sai/entra
 * na chamada à Avalon. Retorna função para desfazer o patch.
 */
function installFetchSpy(): () => void {
  const originalFetch = globalThis.fetch;
 
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input?.url;
    const isAvalon = typeof url === 'string' && url.includes('avalonbroker');
 
    if (isAvalon) {
      console.log('[fetch-spy] →', init?.method ?? 'GET', url);
      console.log('[fetch-spy] → headers:', init?.headers);
      if (init?.body) {
        // Loga body mascarando o secret
        const bodyStr = typeof init.body === 'string' ? init.body : '';
        const masked = bodyStr.replace(/client_secret=[^&]+/g, 'client_secret=***');
        console.log('[fetch-spy] → body:', masked);
      }
    }
 
    const response = await originalFetch(input, init);
 
    if (isAvalon) {
      console.log('[fetch-spy] ← status:', response.status, response.statusText);
      // Clona pra ler o body sem consumir o stream original
      const clone = response.clone();
      try {
        const text = await clone.text();
        console.log('[fetch-spy] ← body:', text.substring(0, 2000));
      } catch (err) {
        console.log('[fetch-spy] ← (não conseguiu ler body)', err);
      }
    }
 
    return response;
  }) as typeof fetch;
 
  return () => { globalThis.fetch = originalFetch; };
}
 
export async function exchangeAuthCode(
  code: string,
  codeVerifier: string,
): Promise<ExchangeResult> {
  console.log('[avalon/exchange] iniciando troca');
 
  const storage = new CapturingTokensStorage();
  const oauth = buildOAuth({ storage });
  const restoreFetch = installFetchSpy();
 
  try {
    const result = await oauth.issueAccessTokenWithAuthCode(code, codeVerifier);
    console.log('[avalon/exchange] SUCESSO');
    return {
      accessToken:  result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn:    result.expiresIn,
    };
  } finally {
    restoreFetch();
  }
}
 
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number; refreshToken?: string }> {
  const storage = new CapturingTokensStorage();
  storage.set({ accessToken: '', refreshToken });
 
  const oauth = buildOAuth({ storage, refreshToken });
  const restoreFetch = installFetchSpy();
 
  try {
    const result = await oauth.refreshAccessToken();
    const updated = storage.get();
    return {
      accessToken:  result.accessToken,
      expiresIn:    result.expiresIn,
      refreshToken: updated.refreshToken ?? refreshToken,
    };
  } finally {
    restoreFetch();
  }
}
 
export function computeExpiresAt(expiresIn: number, safetyMarginSec = 30): number {
  return Date.now() + Math.max(0, (expiresIn - safetyMarginSec) * 1000);
}
