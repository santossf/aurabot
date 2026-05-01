import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ClientSdk } from '@quadcode-tech/client-sdk-js';
import { auth } from '../lib/api';
import { createSdkWithAccessToken } from '../lib/avalonClient';

type User = { id: string; email?: string; name?: string };

type AuthState =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'authenticated'; user: User; sdk: ClientSdk };

type AuthCtx = {
  state: AuthState;
  /** Chamado pela CallbackPage após troca bem-sucedida do code. */
  onTokenIssued: (accessToken: string, expiresAt: number) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  // accessToken vive em memória — NUNCA em localStorage
  const tokenRef = useRef<{ value: string; expiresAt: number } | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const sdkRef = useRef<ClientSdk | null>(null);

  /** Agenda refresh do token antes de expirar (60s de folga). */
  const scheduleRefresh = useCallback((expiresAt: number) => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }
    const ms = Math.max(0, expiresAt - Date.now() - 60_000);
    refreshTimerRef.current = window.setTimeout(async () => {
      try {
        const { accessToken, expiresAt: newExpiresAt } = await auth.refresh();
        tokenRef.current = { value: accessToken, expiresAt: newExpiresAt };
        // SDK precisa ser re-instanciado com o novo token
        sdkRef.current = await createSdkWithAccessToken(accessToken);
        setState(s => s.status === 'authenticated' ? { ...s, sdk: sdkRef.current! } : s);
        scheduleRefresh(newExpiresAt);
      } catch (err) {
        console.error('[auth] refresh falhou:', err);
        await doLogout();
      }
    }, ms);
  }, []);

  const doLogout = useCallback(async () => {
    try { await auth.logout(); } catch { /* ignore */ }
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    tokenRef.current = null;
    sdkRef.current = null;
    setState({ status: 'guest' });
  }, []);

  /**
   * Após /auth/exchange devolver { accessToken, expiresAt },
   * a CallbackPage chama isto para criar o SDK e marcar autenticado.
   */
  const onTokenIssued = useCallback(async (accessToken: string, expiresAt: number) => {
    tokenRef.current = { value: accessToken, expiresAt };
    const sdk = await createSdkWithAccessToken(accessToken);
    sdkRef.current = sdk;

    const me = await auth.me();
    if (!me.authenticated || !me.user) {
      await doLogout();
      return;
    }

    setState({ status: 'authenticated', user: me.user, sdk });
    scheduleRefresh(expiresAt);
  }, [doLogout, scheduleRefresh]);

  /**
   * Boot: se houver sessão (cookie), tenta refresh para conseguir
   * um accessToken e re-instanciar o SDK. Caso contrário, vira guest.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await auth.me();
        if (cancelled) return;

        if (!me.authenticated) {
          setState({ status: 'guest' });
          return;
        }

        // Há sessão — pega novo accessToken via refresh
        const { accessToken, expiresAt } = await auth.refresh();
        if (cancelled) return;

        tokenRef.current = { value: accessToken, expiresAt };
        const sdk = await createSdkWithAccessToken(accessToken);
        sdkRef.current = sdk;

        setState({
          status: 'authenticated',
          user: me.user!,
          sdk,
        });
        scheduleRefresh(expiresAt);
      } catch {
        if (!cancelled) setState({ status: 'guest' });
      }
    })();

    return () => { cancelled = true; };
  }, [scheduleRefresh]);

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
    throw new Error('useSdk: usuário não autenticado. Renderize só dentro de rota protegida.');
  }
  return state.sdk;
}
