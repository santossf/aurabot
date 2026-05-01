import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ClientSdk } from '@quadcode-tech/client-sdk-js';
import {
  createSdkWithAccessToken,
  loadStoredTokens,
  clearStoredTokens,
  type IssuedTokens,
} from '../lib/avalonClient';

type User = { id: string; email?: string; name?: string };

type AuthState =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'authenticated'; user: User; sdk: ClientSdk };

type AuthCtx = {
  state: AuthState;
  /** Chamado pela CallbackPage após troca bem-sucedida do code. */
  onTokenIssued: (tokens: IssuedTokens) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const sdkRef = useRef<ClientSdk | null>(null);
  const expiryTimerRef = useRef<number | null>(null);

  const doLogout = useCallback(async () => {
    if (expiryTimerRef.current) {
      window.clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
    clearStoredTokens();
    sdkRef.current = null;
    setState({ status: 'guest' });
  }, []);

  /**
   * Agenda logout automático quando o accessToken expirar.
   * Como estamos no fluxo Online sem refresh, ao expirar o usuário
   * é deslogado e precisa relogar.
   */
  const scheduleExpiry = useCallback((tokens: IssuedTokens) => {
    if (expiryTimerRef.current) {
      window.clearTimeout(expiryTimerRef.current);
    }
    const expiresAtMs = tokens.obtainedAt + tokens.expiresIn * 1000;
    const ms = Math.max(0, expiresAtMs - Date.now());
    expiryTimerRef.current = window.setTimeout(() => {
      console.log('[auth] accessToken expirou, deslogando');
      doLogout();
    }, ms);
  }, [doLogout]);

  /**
   * Após CallbackPage trocar code por tokens, chama isto para criar o SDK.
   */
  const onTokenIssued = useCallback(async (tokens: IssuedTokens) => {
    try {
      const sdk = await createSdkWithAccessToken(tokens.accessToken);
      sdkRef.current = sdk;

      // Tenta puxar dados do usuário via SDK (userProfile fica disponível após connect)
      const user: User = {
        id:   String((sdk as any).userProfile?.userId ?? 'unknown'),
        name: [(sdk as any).userProfile?.firstName, (sdk as any).userProfile?.lastName]
                .filter(Boolean).join(' ') || undefined,
      };

      setState({ status: 'authenticated', user, sdk });
      scheduleExpiry(tokens);
    } catch (err) {
      console.error('[auth] falha ao criar SDK:', err);
      await doLogout();
      throw err;
    }
  }, [doLogout, scheduleExpiry]);

  /**
   * Boot: tenta recuperar tokens do sessionStorage (sobrevive a F5).
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tokens = loadStoredTokens();
      if (!tokens) {
        if (!cancelled) setState({ status: 'guest' });
        return;
      }
      try {
        await onTokenIssued(tokens);
      } catch {
        if (!cancelled) setState({ status: 'guest' });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Ctx.Provider value={{ state, onTokenIssued, logout: doLogout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}

/** Hook conveniente para componentes que sabem que estão autenticados. */
export function useSdk(): ClientSdk {
  const { state } = useAuth();
  if (state.status !== 'authenticated') {
    throw new Error('useSdk: usuário não autenticado.');
  }
  return state.sdk;
}
