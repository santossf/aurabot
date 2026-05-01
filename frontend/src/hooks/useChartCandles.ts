import { useEffect, useRef, useState } from 'react';
import type { ClientSdk } from '@quadcode-tech/client-sdk-js';

export interface ChartCandle {
  time: number;   // unix timestamp em segundos (formato lightweight-charts)
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface UseChartCandlesResult {
  candles: ChartCandle[];
  /** Última candle pode mudar a cada tick — fica separada para updates eficientes */
  lastCandle: ChartCandle | null;
  loading: boolean;
  error: string | null;
}

/**
 * Carrega histórico inicial de candles + subscreve em tempo real via SDK.
 * Usa realTimeChartDataLayer da Quadcode.
 *
 * IMPORTANTE: lightweight-charts espera time em segundos (não ms).
 */
export function useChartCandles(
  sdk: ClientSdk | null,
  activeId: number | null,
  candleSize: number = 1, // segundos por candle
): UseChartCandlesResult {
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [lastCandle, setLastCandle] = useState<ChartCandle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs pra cleanup correto
  const layerRef = useRef<any>(null);
  const handlerRef = useRef<((c: any) => void) | null>(null);

  useEffect(() => {
    if (!sdk || !activeId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const layer = await sdk.realTimeChartDataLayer(activeId, candleSize);
        if (cancelled) return;
        layerRef.current = layer;

        // Carrega histórico (últimas ~500 candles)
        const now = Math.floor(Date.now() / 1000);
        const from = now - candleSize * 500;
        const initial = await layer.fetchAllCandles(from);

        if (cancelled) return;

        const adapted = initial.map(adaptCandle);
        setCandles(adapted);
        if (adapted.length > 0) {
          setLastCandle(adapted[adapted.length - 1]);
        }
        setLoading(false);

        // Subscreve em ticks
        const handler = (c: any) => {
          const adapted = adaptCandle(c);
          setLastCandle(adapted);

          setCandles((prev) => {
            // Se o time da nova candle é maior que o último → append
            // Se é igual → substitui (atualização da candle atual)
            const last = prev[prev.length - 1];
            if (!last || adapted.time > last.time) {
              // Limita histórico em ~1000 candles pra performance
              const next = prev.length >= 1000 ? prev.slice(-999) : prev;
              return [...next, adapted];
            }
            if (adapted.time === last.time) {
              return [...prev.slice(0, -1), adapted];
            }
            return prev;
          });
        };
        handlerRef.current = handler;
        layer.subscribeOnLastCandleChanged(handler);
      } catch (err) {
        if (cancelled) return;
        console.error('[useChartCandles] erro:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar candles');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (layerRef.current && handlerRef.current) {
        try {
          layerRef.current.unsubscribeOnLastCandleChanged(handlerRef.current);
        } catch (err) {
          console.warn('[useChartCandles] erro no unsubscribe:', err);
        }
      }
      layerRef.current = null;
      handlerRef.current = null;
    };
  }, [sdk, activeId, candleSize]);

  return { candles, lastCandle, loading, error };
}

function adaptCandle(c: any): ChartCandle {
  return {
    time:  Math.floor((c.from ?? c.id ?? Date.now() / 1000)),
    open:  c.open  ?? 0,
    high:  c.max   ?? c.high ?? 0,
    low:   c.min   ?? c.low  ?? 0,
    close: c.close ?? 0,
  };
}
