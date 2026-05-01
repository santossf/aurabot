import { useEffect, useState } from 'react';
import type { ClientSdk } from '@quadcode-tech/client-sdk-js';

export type BalanceKind = 'real' | 'demo';

export interface BalanceSnapshot {
  id: number;
  kind: BalanceKind;
  amount: number;
  currency: string;
}

export interface UseBalancesResult {
  balances: BalanceSnapshot[];
  loading: boolean;
  error: string | null;
  /** Banca selecionada para uso atual. */
  selected: BalanceSnapshot | null;
  /** Troca a banca selecionada. */
  selectKind: (kind: BalanceKind) => void;
}

/**
 * Carrega balances via SDK e mantém atualizado em tempo real
 * (subscribeOnUpdateBalance). Mantém a seleção entre re-renders.
 */
export function useBalances(sdk: ClientSdk | null): UseBalancesResult {
  const [balances, setBalances] = useState<BalanceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<BalanceKind>('demo');

  useEffect(() => {
    if (!sdk) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const balancesFacade = await sdk.balances();
        const list = balancesFacade.getBalances();

        const snapshot: BalanceSnapshot[] = list.map((b: any) => ({
          id:       b.id,
          kind:     (b.type === 'real' || b.type === 1) ? 'real' : 'demo',
          amount:   b.amount ?? 0,
          currency: b.currency ?? 'USD',
        }));

        if (!cancelled) {
          setBalances(snapshot);
          setLoading(false);
        }

        // Subscribe para atualizações em tempo real
        const callbacks: Array<() => void> = [];
        for (const b of list) {
          const handler = () => {
            const updated: BalanceSnapshot = {
              id:       (b as any).id,
              kind:     ((b as any).type === 'real' || (b as any).type === 1) ? 'real' : 'demo',
              amount:   (b as any).amount ?? 0,
              currency: (b as any).currency ?? 'USD',
            };
            setBalances(prev => prev.map(p => p.id === updated.id ? updated : p));
          };
          balancesFacade.subscribeOnUpdateBalance((b as any).id, handler);
          callbacks.push(() => balancesFacade.unsubscribeOnUpdateBalance((b as any).id, handler));
        }
        cleanup = () => callbacks.forEach(fn => fn());
      } catch (err) {
        console.error('[useBalances] erro:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar banca');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [sdk]);

  const selected = balances.find(b => b.kind === selectedKind) ?? balances[0] ?? null;

  return {
    balances,
    loading,
    error,
    selected,
    selectKind: setSelectedKind,
  };
}
