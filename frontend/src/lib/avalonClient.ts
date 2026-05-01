/**
 * ============================================================================
 * AVALON SDK CLIENT — frontend
 * ----------------------------------------------------------------------------
 * O ClientSdk vive aqui, no browser, autenticado com accessToken obtido
 * via /auth/exchange (que é trocado server-side, onde o client_secret mora).
 *
 * Esta camada gerencia:
 *   - Geração da authorization URL (PKCE) — chamada no clique de "Entrar"
 *   - Instanciação do ClientSdk com o accessToken devolvido pelo backend
 *   - Re-instanciação após refresh do token
 * ============================================================================
 */
import { ClientSdk, OAuthMethod } from '@quadcode-tech/client-sdk-js';

const PKCE_VERIFIER_KEY = 'scalper_pkce_verifier';

const ENV = {
  apiBaseUrl:    import.meta.env.VITE_AVALON_API_BASE_URL    as string, // https://api.trade.avalonbroker.com
  wsUrl:         import.meta.env.VITE_AVALON_WS_URL          as string, // wss://ws.trade.avalonbroker.com/echo/websocket
  clientId:      Number(import.meta.env.VITE_AVALON_CLIENT_ID),         // 242284863837060
  platformId:    Number(import.meta.env.VITE_AVALON_PLATFORM_ID),       // 199
  redirectUri:   import.meta.env.VITE_AVALON_REDIRECT_URI    as string, // http://localhost:5173/auth/callback
  scope:         import.meta.env.VITE_AVALON_SCOPE           as string, // 'full offline_access'
};

/**
 * Inicia o login: gera URL de autorização da Avalon e salva o codeVerifier.
 * Chamado quando o usuário clica em "Entrar com Avalon".
 *
 * IMPORTANTE: aqui no browser o OAuthMethod é instanciado SEM clientSecret.
 */
export async function startAvalonLogin(): Promise<string> {
  const oauth = new OAuthMethod(
    ENV.apiBaseUrl,
    ENV.clientId,
    ENV.redirectUri,
    ENV.scope,
    // sem clientSecret no browser
  );

  const { url, codeVerifier } = await oauth.createAuthorizationUrl();
  sessionStorage.setItem(PKCE_VERIFIER_KEY, codeVerifier);
  return url;
}

export function consumeStoredVerifier(): string | null {
  const v = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  if (v) sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  return v;
}

/**
 * Cria a instância do ClientSdk com o accessToken obtido via backend.
 * O accessToken vai como segundo argumento do construtor do OAuthMethod;
 * o SDK fará as chamadas autenticadas com ele.
 */
export async function createSdkWithAccessToken(accessToken: string): Promise<ClientSdk> {
  return ClientSdk.create(
    ENV.wsUrl,
    ENV.platformId,
    new OAuthMethod(
      ENV.apiBaseUrl,
      ENV.clientId,
      ENV.redirectUri,
      ENV.scope,
      undefined,        // NUNCA clientSecret no browser
      accessToken,      // token de acesso obtido via /auth/exchange
    ),
  );
}
