/**
 * ============================================================================
 * AVALON / QUADCODE — wrapper server-side
 * ----------------------------------------------------------------------------
 * Implementação direta via fetch porque o SDK omite o client_secret no
 * body, e a Avalon exige o secret em fluxos server-side (offline_access).
 *
 * Path descoberto via fetch-spy: /auth/oauth.v5/token
 * Formato: application/json
 * ============================================================================
 */
import { env } from '../config/env.js';
 
export interface ExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}
 
const TOKEN_PATH = '/auth/oauth.v5/token';
 
/**
 * Troca o `code` por accessToken + refreshToken via chamada HTTP direta.
 */
export async function exchangeAuthCode(
  code: string,
  codeVerifier: string,
): Promise<ExchangeResult> {
  const tokenUrl = `${env.AVALON_OAUTH_API_BASE_URL}${TOKEN_PATH}`;
 
  const payload = {
    grant_type:    'authorization_code',
    code,
    redirect_uri:  env.AVALON_REDIRECT_URI,
    client_id:     env.AVALON_CLIENT_ID,
    client_secret: env.AVALON_CLIENT_SECRET,
    code_verifier: codeVerifier,
  };
 
  console.log('[avalon/exchange] POST', tokenUrl);
  console.log('[avalon/exchange] keys enviadas:', Object.keys(payload));
 
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':   'auraabot-server/1.0',
    },
    body: JSON.stringify(payload),
  });
 
  const text = await response.text();
 
  if (!response.ok) {
    console.error('[avalon/exchange] FALHOU - status:', response.status);
    console.error('[avalon/exchange] resposta:', text);
    throw new Error(`Avalon recusou: ${response.status} ${text}`);
  }
 
  const data = JSON.parse(text);
  console.log('[avalon/exchange] SUCESSO - expiresIn:', data.expires_in);
 
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresIn:    data.expires_in,
  };
}
 
/**
 * Renova accessToken usando refreshToken.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number; refreshToken?: string }> {
  const tokenUrl = `${env.AVALON_OAUTH_API_BASE_URL}${TOKEN_PATH}`;
 
  const payload = {
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
    client_id:     env.AVALON_CLIENT_ID,
    client_secret: env.AVALON_CLIENT_SECRET,
  };
 
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':   'auraabot-server/1.0',
    },
    body: JSON.stringify(payload),
  });
 
  const text = await response.text();
 
  if (!response.ok) {
    console.error('[avalon/refresh] FALHOU:', response.status, text);
    throw new Error(`Refresh falhou: ${response.status} ${text}`);
  }
 
  const data = JSON.parse(text);
  return {
    accessToken:  data.access_token,
    expiresIn:    data.expires_in,
    refreshToken: data.refresh_token,
  };
}
 
export function computeExpiresAt(expiresIn: number, safetyMarginSec = 30): number {
  return Date.now() + Math.max(0, (expiresIn - safetyMarginSec) * 1000);
}
