/**
 * ============================================================================
 * AVALON / QUADCODE SDK — wrapper server-side
 * ----------------------------------------------------------------------------
 * O backend serve a 2 propósitos no fluxo "offline_access":
 *
 *   1. Trocar o `code` (vindo do callback do frontend) por accessToken,
 *      e GUARDAR o refreshToken no servidor.
 *   2. Renovar o accessToken sob demanda, sem expor o refreshToken ao browser.
 *
 * O SDK propriamente dito (ClientSdk) roda no FRONTEND, autenticado via
 * accessToken que esta API devolve.
 * ============================================================================
 */
import { OAuthMethod } from '@quadcode-tech/client-sdk-js';
import { env } from '../config/env.js';

/**
 * Storage de tokens que o SDK injeta. Como cada chamada é por usuário,
 * criamos um storage isolado por chamada e capturamos os tokens via callback.
 *
 * O SDK chama `set()` quando recebe novos tokens da Avalon.
 */
class CapturingTokensStorage {
  private tokens: { accessToken: string; refreshToken?: string } = { accessToken: '' };

  get() {
    return this.tokens;
  }

  set(tokens: { accessToken: string; refreshToken?: string }) {
    this.tokens = tokens;
  }
}

/**
 * Constrói uma instância de OAuthMethod configurada com client_secret
 * (server-side only, NUNCA exposto ao browser).
 *
 * Atenção ao construtor posicional do SDK — segue a ordem documentada:
 *   apiBaseUrl, clientId, redirectUri, scope, clientSecret,
 *   accessToken, refreshToken, _, _, _, tokensStorage
 */
function buildOAuth(opts: {
  accessToken?: string;
  refreshToken?: string;
  storage: CapturingTokensStorage;
}) {
  return new OAuthMethod(
    env.AVALON_OAUTH_API_BASE_URL,    // 1. apiBaseUrl
    env.AVALON_CLIENT_ID as any,      // 2. clientId (SDK aceita number; valor vem como string do .env)
    env.AVALON_REDIRECT_URI,          // 3. redirectUri
    env.AVALON_SCOPE,                 // 4. scope
    env.AVALON_CLIENT_SECRET,         // 5. clientSecret (server-side only)
    opts.accessToken,                 // 6. accessToken
    opts.refreshToken,                // 7. refreshToken
    undefined,                        // 8.
    undefined,                        // 9.
    undefined,                        // 10.
    opts.storage as any,              // 11. tokensStorage
  );
}

export interface ExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

/**
 * Troca o `code` recebido no callback por accessToken + refreshToken.
 * Chamado no endpoint /auth/exchange logo após o redirect.
 */
export async function exchangeAuthCode(
  code: string,
  codeVerifier: string,
): Promise<ExchangeResult> {
  const storage = new CapturingTokensStorage();
  const oauth = buildOAuth({ storage });

  const result = await oauth.issueAccessTokenWithAuthCode(code, codeVerifier);

  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
  };
}

/**
 * Renova o accessToken usando refreshToken armazenado no servidor.
 * O SDK lê o refreshToken do storage e chama o endpoint de refresh internamente.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number; refreshToken?: string }> {
  const storage = new CapturingTokensStorage();
  storage.set({ accessToken: '', refreshToken });

  const oauth = buildOAuth({ refreshToken, storage });
  const result = await oauth.refreshAccessToken();

  // Após refresh, o storage pode ter um novo refreshToken (rotation)
  const updated = storage.get();
  return {
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
    refreshToken: updated.refreshToken ?? refreshToken,
  };
}

/** Helper: epoch ms até o token expirar (com folga de segurança). */
export function computeExpiresAt(expiresIn: number, safetyMarginSec = 30): number {
  return Date.now() + Math.max(0, (expiresIn - safetyMarginSec) * 1000);
}
