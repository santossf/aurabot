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
  selected: BalanceSnapshot | null;
  selectKind: (kind: BalanceKind) => void;
}

function detectKind(b: any): BalanceKind {
  // type pode vir como string ('real'/'demo'), número (1/4), ou enum
  const t = b?.type;
  if (typeof t === 'string') {
    return t.toLowerCase().includes('demo') ? 'demo' : 'real';
  }
  if (typeof t === 'number') {
    // Quadcode: 1=real, 4=demo (varia)
    return t === 1 ? 'real' : 'demo';
  }
  return 'demo';
}

function snapshotOf(b: any): BalanceSnapshot {
  // 'available' = saldo livre para operar (exclui margem de CFDs abertos)
  // 'amount'    = equity total (inclui posições abertas) — NÃO usar pra Blitz
  const free = typeof b.available === 'number' && b.available >= 0
    ? b.available
    : (typeof b.amount === 'number' ? b.amount : 0);

  return {
    id:       b.id,
    kind:     detectKind(b),
    amount:   free,
    currency: b.currency ?? 'USD',
  };
}

/**
 * Carrega balances via SDK e mantém atualizado em tempo real.
 *
 * IMPORTANTE: o handler do subscribeOnUpdateBalance DEVE re-ler o objeto
 * Balance do facade, porque ele é mutável internamente. Closures sobre
 * referências antigas dão valores desatualizados.
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
        const facade = await sdk.balances();
        const list = facade.getBalances();

        const initial = list.map(snapshotOf);
        if (!cancelled) {
          setBalances(initial);
          setLoading(false);
        }

        // Subscreve em cada banca individualmente. O handler relê o estado
        // atualizado dentro do facade — não confiamos em referências capturadas.
        const unsubFns: Array<() => void> = [];
        for (const balance of list) {
          const balanceId = (balance as any).id;
          const handler = (_updated: any) => {
            // Re-busca a banca atual pelo ID — garante valor fresco
            try {
              const fresh = facade.getBalanceById(balanceId);
              if (!fresh) return;
              const snap = snapshotOf(fresh);
              setBalances(prev => prev.map(p => p.id === snap.id ? snap : p));
              console.log(`[balances] update id=${snap.id} kind=${snap.kind} amount=$${snap.amount.toFixed(2)}`);
            } catch (err) {
              console.warn('[balances] erro ao atualizar:', err);
            }
          };
          facade.subscribeOnUpdateBalance(balanceId, handler);
          unsubFns.push(() => {
            try { facade.unsubscribeOnUpdateBalance(balanceId, handler); } catch {}
          });
        }

        // Polling de fallback: a cada 5s, força re-leitura
        // (caso o WebSocket não esteja entregando updates por algum motivo)
        const pollId = window.setInterval(() => {
          try {
            const fresh = facade.getBalances().map(snapshotOf);
            setBalances(fresh);
          } catch {}
        }, 5000);

        cleanup = () => {
          window.clearInterval(pollId);
          unsubFns.forEach(fn => fn());
        };
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
