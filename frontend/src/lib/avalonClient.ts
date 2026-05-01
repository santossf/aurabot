/**
 * ============================================================================
 * AVALON SDK CLIENT — frontend (fluxo Online, sem backend)
 * ----------------------------------------------------------------------------
 * Conforme a doc da Quadcode/Avalon (e o exemplo "Online access" da SDK):
 *   1. createAuthorizationUrl() → gera URL + codeVerifier (browser)
 *   2. Usuário loga e volta com ?code=... (browser)
 *   3. issueAccessTokenWithAuthCode(code, codeVerifier) → accessToken (browser)
 *   4. ClientSdk.create(...) com accessToken (browser)
 *
 * Não usa client_secret. Não passa por backend. PKCE puro.
 *
 * Limitação: sem refresh token. Quando o accessToken expirar, usuário
 * precisa relogar. Isso é o esperado pelo fluxo Online.
 * ============================================================================
 */
import { ClientSdk, OAuthMethod } from '@quadcode-tech/client-sdk-js';
 
const PKCE_VERIFIER_KEY = 'scalper_pkce_verifier';
const TOKEN_STORAGE_KEY = 'scalper_access_token';
 
const ENV = {
  apiBaseUrl:    import.meta.env.VITE_AVALON_API_BASE_URL    as string,
  wsUrl:         import.meta.env.VITE_AVALON_WS_URL          as string,
  clientId:      Number(import.meta.env.VITE_AVALON_CLIENT_ID),
  platformId:    Number(import.meta.env.VITE_AVALON_PLATFORM_ID),
  redirectUri:   import.meta.env.VITE_AVALON_REDIRECT_URI    as string,
  scope:         import.meta.env.VITE_AVALON_SCOPE           as string,
};
 
/**
 * Cria instância do OAuthMethod (sem clientSecret — somos browser).
 * Reusada nos 3 momentos do fluxo: gerar URL, trocar code, autenticar SDK.
 */
function makeOAuth(accessToken?: string): OAuthMethod {
  return new OAuthMethod(
    ENV.apiBaseUrl,
    ENV.clientId,
    ENV.redirectUri,
    ENV.scope,
    undefined,        // NUNCA clientSecret no browser
    accessToken,      // só para reuso após troca
  );
}
 
/**
 * Etapa 1: gera URL de autorização e guarda codeVerifier.
 * Retorna a URL para onde redirecionar o usuário.
 */
export async function startAvalonLogin(): Promise<string> {
  const oauth = makeOAuth();
  const { url, codeVerifier } = await oauth.createAuthorizationUrl();
  sessionStorage.setItem(PKCE_VERIFIER_KEY, codeVerifier);
  return url;
}
 
/**
 * Etapa 3: troca o `code` (recebido no callback) pelo accessToken.
 * Mantém uma única instância do OAuthMethod entre createAuthorizationUrl
 * e issueAccessTokenWithAuthCode? Não, são instâncias diferentes — o
 * codeVerifier é passado explicitamente.
 *
 * Persiste o accessToken em sessionStorage para sobreviver a F5.
 */
export interface IssuedTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  obtainedAt: number; // epoch ms
}
 
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
): Promise<IssuedTokens> {
  const oauth = makeOAuth();
  const result = await oauth.issueAccessTokenWithAuthCode(code, codeVerifier);
 
  const tokens: IssuedTokens = {
    accessToken:  result.accessToken,
    expiresIn:    result.expiresIn,
    refreshToken: result.refreshToken,
    obtainedAt:   Date.now(),
  };
 
  sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  return tokens;
}
 
export function consumeStoredVerifier(): string | null {
  const v = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  if (v) sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  return v;
}
 
/**
 * Recupera tokens do sessionStorage (para sobreviver a F5).
 * Retorna null se expirou ou se não há.
 */
export function loadStoredTokens(): IssuedTokens | null {
  const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return null;
 
  try {
    const tokens = JSON.parse(raw) as IssuedTokens;
    const expiresAtMs = tokens.obtainedAt + tokens.expiresIn * 1000;
    if (expiresAtMs <= Date.now()) {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      return null;
    }
    return tokens;
  } catch {
    return null;
  }
}
 
export function clearStoredTokens(): void {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
}
 
/**
 * Cria a instância do ClientSdk autenticada.
 */
export async function createSdkWithAccessToken(accessToken: string): Promise<ClientSdk> {
  return ClientSdk.create(
    ENV.wsUrl,
    ENV.platformId,
    makeOAuth(accessToken),
  );
}
