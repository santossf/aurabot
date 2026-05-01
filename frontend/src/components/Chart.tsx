/**
 * Chart — gráfico de candles em tempo real.
 *
 * Usa lightweight-charts (TradingView). Recebe candles de useChartCandles
 * e atualiza em tempo real conforme novos ticks chegam.
 *
 * Características:
 *   - Fundo 100% transparente (usa o bg do componente pai)
 *   - Paleta integrada com tema (verde long, rosa short)
 *   - Auto-resize via ResizeObserver
 *   - Markers para marcar entradas do bot
 */
import { useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
  type SeriesMarker,
} from 'lightweight-charts';
import type { ChartCandle } from '../hooks/useChartCandles';
import { theme as T } from '../lib/theme';

export interface ChartMarker {
  time: number;       // unix seconds
  position: 'aboveBar' | 'belowBar';
  side: 'long' | 'short';
  text: string;       // ex: "CALL 31.25"
}

interface ChartProps {
  candles: ChartCandle[];
  lastCandle: ChartCandle | null;
  markers?: ChartMarker[];
  loading?: boolean;
}

export function Chart({ candles, lastCandle, markers = [], loading }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);

  // Inicializa o chart uma única vez
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: T.textDim,
        fontFamily: '"Inter", "JetBrains Mono", monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: T.border, style: 1 },
        horzLines: { color: T.border, style: 1 },
      },
      timeScale: {
        borderColor: T.border,
        timeVisible: true,
        secondsVisible: true,
      },
      rightPriceScale: {
        borderColor: T.border,
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: T.accent,
          width: 1,
          style: 3,
          labelBackgroundColor: T.accent,
        },
        horzLine: {
          color: T.accent,
          width: 1,
          style: 3,
          labelBackgroundColor: T.accent,
        },
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor:        T.long,
      downColor:      T.short,
      borderUpColor:  T.long,
      borderDownColor: T.short,
      wickUpColor:    T.long,
      wickDownColor:  T.short,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // ResizeObserver pra ajustar tamanho automaticamente
    const resize = () => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width:  containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    };
    const obs = new ResizeObserver(resize);
    obs.observe(containerRef.current);
    resizeObsRef.current = obs;

    return () => {
      obs.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      resizeObsRef.current = null;
    };
  }, []);

  // Atualiza dados sempre que candles mudar
  useEffect(() => {
    if (!seriesRef.current) return;
    if (candles.length === 0) return;

    const data: CandlestickData[] = candles.map(c => ({
      time:  c.time as Time,
      open:  c.open,
      high:  c.high,
      low:   c.low,
      close: c.close,
    }));

    seriesRef.current.setData(data);

    // Foca no final (mais recente) com algumas barras de margem
    if (chartRef.current && data.length > 0) {
      chartRef.current.timeScale().scrollToRealTime();
    }
  }, [candles.length]); // só quando o tamanho muda — updates de tick são via lastCandle

  // Atualiza só a última candle em ticks (otimizado)
  useEffect(() => {
    if (!seriesRef.current || !lastCandle) return;
    seriesRef.current.update({
      time:  lastCandle.time as Time,
      open:  lastCandle.open,
      high:  lastCandle.high,
      low:   lastCandle.low,
      close: lastCandle.close,
    });
  }, [lastCandle]);

  // Atualiza markers
  useEffect(() => {
    if (!seriesRef.current) return;

    const seriesMarkers: SeriesMarker<Time>[] = markers.map(m => ({
      time: m.time as Time,
      position: m.position,
      color: m.side === 'long' ? T.long : T.short,
      shape: m.side === 'long' ? 'arrowUp' : 'arrowDown',
      text: m.text,
    }));

    // Em versões recentes, markers vão via createSeriesMarkers
    // Aqui usamos o método antigo que ainda funciona em muitas versões
    if ((seriesRef.current as any).setMarkers) {
      (seriesRef.current as any).setMarkers(seriesMarkers);
    }
  }, [markers]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          background: 'transparent',
        }}
      />

      {loading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          color: T.textDim,
          fontSize: 12,
          letterSpacing: '0.08em',
          background: T.bg + 'CC',
          backdropFilter: 'blur(4px)',
        }}>
          CARREGANDO CANDLES...
        </div>
      )}

      {!loading && candles.length === 0 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          color: T.textMute,
          fontSize: 12,
          letterSpacing: '0.08em',
        }}>
          AGUARDANDO DADOS DO MERCADO
        </div>
      )}
    </div>
  );
}
