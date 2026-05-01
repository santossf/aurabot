import { useEffect, useState } from 'react';
import type { ClientSdk } from '@quadcode-tech/client-sdk-js';

export interface AvailableActive {
  id: number;
  ticker: string;
  isSuspended: boolean;
  expirationTimes: number[];
  profitCommissionPercent: number;
  /** Income percent (100 - commission) */
  incomePercent: number;
}

export interface UseAvailableActivesResult {
  actives: AvailableActive[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Carrega ativos disponíveis para Blitz Options.
 * Atualiza periodicamente (a cada 30s) para refletir suspensões/aberturas.
 */
export function useAvailableActives(sdk: ClientSdk | null): UseAvailableActivesResult {
  const [actives, setActives] = useState<AvailableActive[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!sdk) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const blitz = await sdk.blitzOptions();
        if (cancelled) return;

        const list = blitz.getActives();
        const adapted: AvailableActive[] = list.map((a: any) => ({
          id:                      a.id,
          ticker:                  a.ticker,
          isSuspended:             a.isSuspended ?? false,
          expirationTimes:         a.expirationTimes ?? [],
          profitCommissionPercent: a.profitCommissionPercent ?? 0,
          incomePercent:           Math.max(0, 100 - (a.profitCommissionPercent ?? 0)),
        }));

        if (!cancelled) {
          setActives(adapted);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[useAvailableActives] erro:', err);
          setError(err instanceof Error ? err.message : 'Erro ao carregar ativos');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [sdk, tick]);

  return {
    actives,
    loading,
    error,
    refresh: () => setTick(t => t + 1),
  };
}
