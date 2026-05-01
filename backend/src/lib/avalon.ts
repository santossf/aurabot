/**
 * ============================================================================
 * AVALON / QUADCODE — wrapper server-side
 * ----------------------------------------------------------------------------
 * IMPORTANTE: o SDK não expõe a resposta detalhada da Avalon quando dá erro
 * (só joga "400" e abafa o body). Para conseguir diagnóstico, fazemos a
 * chamada HTTP DIRETAMENTE para o endpoint /oauth2/token, replicando o que
 * o SDK faz internamente.
 *
 * Depois que o login estiver funcionando, podemos voltar a usar o SDK.
 * ============================================================================
 */
import { env } from '../config/env.js';
 
export interface ExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}
 
/**
 * Troca o `code` recebido no callback por accessToken + refreshToken.
 * Implementação manual via fetch, para conseguir log detalhado de erros.
 */
export async function exchangeAuthCode(
  code: string,
  codeVerifier: string,
): Promise<ExchangeResult> {
  const tokenUrl = `${env.AVALON_OAUTH_API_BASE_URL}/oauth2/token`;
 
  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    client_id:     env.AVALON_CLIENT_ID,
    client_secret: env.AVALON_CLIENT_SECRET,
    code:          code,
    code_verifier: codeVerifier,
    redirect_uri:  env.AVALON_REDIRECT_URI,
    scope:         env.AVALON_SCOPE,
  });
 
  console.log('[avalon/exchange] POST', tokenUrl);
  console.log('[avalon/exchange] params:', {
    grant_type:    'authorization_code',
    client_id:     env.AVALON_CLIENT_ID,
    redirect_uri:  env.AVALON_REDIRECT_URI,
    scope:         env.AVALON_SCOPE,
    code_length:   code.length,
    verifier_length: codeVerifier.length,
    // client_secret e code/verifier não logamos por segurança
  });
 
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
 
  const text = await response.text();
 
  if (!response.ok) {
    console.error('[avalon/exchange] FALHOU - status:', response.status);
    console.error('[avalon/exchange] resposta da Avalon:', text);
    throw new Error(`Avalon recusou: ${response.status} ${text}`);
  }
 
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('[avalon/exchange] resposta não-JSON:', text);
    throw new Error('Resposta inválida da Avalon');
  }
 
  console.log('[avalon/exchange] SUCESSO - expiresIn:', data.expires_in);
 
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresIn:    data.expires_in,
  };
}
 
/**
 * Renova o accessToken usando refreshToken.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number; refreshToken?: string }> {
  const tokenUrl = `${env.AVALON_OAUTH_API_BASE_URL}/oauth2/token`;
 
  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    client_id:     env.AVALON_CLIENT_ID,
    client_secret: env.AVALON_CLIENT_SECRET,
    refresh_token: refreshToken,
  });
 
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
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
 
/** Helper: epoch ms até o token expirar (com folga de segurança). */
export function computeExpiresAt(expiresIn: number, safetyMarginSec = 30): number {
  return Date.now() + Math.max(0, (expiresIn - safetyMarginSec) * 1000);
}
