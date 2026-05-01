/**
 * Chart — gráfico de candles em tempo real com header informativo.
 *
 * Mostra ticker grande, badge "AO VIVO · Avalon", preço atual e variação,
 * banca disponível. Usa lightweight-charts (TradingView).
 *
 * Características:
 *   - Fundo 100% transparente
 *   - 5 casas decimais (padrão forex) para ver pips se movendo
 *   - Auto-resize via ResizeObserver
 *   - Markers para entradas do bot
 */
import { useEffect, useRef, useMemo } from 'react';
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
  type SeriesMarker,
} from 'lightweight-charts';
import { Wifi, TrendingUp, TrendingDown } from 'lucide-react';
import type { ChartCandle } from '../hooks/useChartCandles';
import { theme as T } from '../lib/theme';

export interface ChartMarker {
  time: number;
  position: 'aboveBar' | 'belowBar';
  side: 'long' | 'short';
  text: string;
}

interface ChartProps {
  candles: ChartCandle[];
  lastCandle: ChartCandle | null;
  markers?: ChartMarker[];
  loading?: boolean;
  /** Símbolo do ativo (ex: EUR/USD) */
  ticker?: string;
  /** Nome / descrição do ativo */
  assetName?: string;
  /** Banca disponível em $ (mostrada no header) */
  balance?: number;
  /** Tipo da banca (real ou demo) */
  balanceKind?: 'real' | 'demo';
  /** Pill de status do bot (renderizado no header do gráfico) */
  botStatus?: React.ReactNode;
}

export function Chart({
  candles, lastCandle, markers = [], loading,
  ticker, assetName, balance, balanceKind, botStatus,
}: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  // Calcula preço atual e variação
  const priceInfo = useMemo(() => {
    if (!lastCandle || candles.length < 2) return null;
    const current = lastCandle.close;
    // Variação: comparar com o close de ~30 candles atrás (≈ 30s)
    const reference = candles[Math.max(0, candles.length - 30)]?.close ?? current;
    const change = current - reference;
    const changePct = reference > 0 ? (change / reference) * 100 : 0;
    return { current, change, changePct };
  }, [lastCandle, candles]);

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
      // 5 casas decimais — padrão de forex (pra ver pips se movendo)
      priceFormat: {
        type: 'price',
        precision: 5,
        minMove: 0.00001,
      },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resize = () => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width:  containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    };
    const obs = new ResizeObserver(resize);
    obs.observe(containerRef.current);

    return () => {
      obs.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

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

    if (chartRef.current && data.length > 0) {
      chartRef.current.timeScale().scrollToRealTime();
    }
  }, [candles.length]);

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

  useEffect(() => {
    if (!seriesRef.current) return;

    const seriesMarkers: SeriesMarker<Time>[] = markers.map(m => ({
      time: m.time as Time,
      position: m.position,
      color: m.side === 'long' ? T.long : T.short,
      shape: m.side === 'long' ? 'arrowUp' : 'arrowDown',
      text: m.text,
    }));

    if ((seriesRef.current as any).setMarkers) {
      (seriesRef.current as any).setMarkers(seriesMarkers);
    }
  }, [markers]);

  const isUp = priceInfo ? priceInfo.change >= 0 : true;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <style>{`
        @keyframes live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* Header rico */}
      {ticker && (
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {botStatus}

            {/* Ticker + nome */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={tickerIconStyle}>
                {ticker.replace('/', '').slice(0, 3)}
              </div>
              <div>
                <div style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: T.text,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                }}>
                  {ticker}
                </div>
                <div style={{
                  fontSize: 10,
                  color: T.textMute,
                  letterSpacing: '0.08em',
                  marginTop: 2,
                }}>
                  {assetName ?? 'BLITZ OPTIONS'}
                </div>
              </div>
            </div>

            {/* Preço atual */}
            {priceInfo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: T.text,
                    fontFamily: 'JetBrains Mono, monospace',
                    letterSpacing: '-0.02em',
                    lineHeight: 1,
                  }}>
                    {priceInfo.current.toFixed(5)}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: isUp ? T.long : T.short,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 600,
                    marginTop: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {isUp ? '+' : ''}{priceInfo.change.toFixed(5)} ({isUp ? '+' : ''}{priceInfo.changePct.toFixed(3)}%)
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Banca */}
            {balance !== undefined && (
              <div style={balancePillStyle}>
                <div style={{
                  fontSize: 9,
                  color: T.textMute,
                  letterSpacing: '0.1em',
                  marginBottom: 2,
                }}>
                  BANCA {balanceKind?.toUpperCase()}
                </div>
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: T.text,
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  ${balance.toFixed(2)}
                </div>
              </div>
            )}

            {/* Badge AO VIVO */}
            <div style={liveBadgeStyle}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: T.long,
                boxShadow: `0 0 8px ${T.long}`,
                animation: 'live-pulse 1.4s ease-in-out infinite',
                display: 'inline-block',
              }} />
              <Wifi size={11} color={T.long} />
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: T.long,
                letterSpacing: '0.1em',
              }}>
                AO VIVO
              </span>
              <span style={{
                fontSize: 9,
                color: T.textMute,
                letterSpacing: '0.06em',
              }}>
                · Avalon
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Container do gráfico */}
      <div style={{ position: 'relative', flex: 1, width: '100%', minHeight: 0 }}>
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            background: 'transparent',
          }}
        />

        {loading && (
          <div style={loadingOverlayStyle}>
            CARREGANDO CANDLES...
          </div>
        )}

        {!loading && candles.length === 0 && (
          <div style={emptyOverlayStyle}>
            AGUARDANDO DADOS DO MERCADO
          </div>
        )}
      </div>
    </div>
  );
}

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  borderBottom: `1px solid ${T.border}`,
  flexWrap: 'wrap' as const,
  gap: 12,
  flexShrink: 0,
  rowGap: 8,
};

const tickerIconStyle = {
  width: 40,
  height: 40,
  borderRadius: 10,
  background: `linear-gradient(135deg, ${T.accent}, ${T.accentDeep})`,
  color: T.bg,
  display: 'grid',
  placeItems: 'center',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '-0.02em',
  boxShadow: `0 0 16px ${T.accentDim}`,
};

const balancePillStyle = {
  padding: '6px 12px',
  background: T.bgElev,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
};

const liveBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  background: T.long + '14',
  border: `1px solid ${T.long}44`,
  borderRadius: 8,
};

const loadingOverlayStyle = {
  position: 'absolute' as const,
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  color: T.textDim,
  fontSize: 12,
  letterSpacing: '0.08em',
  background: T.bg + 'CC',
  backdropFilter: 'blur(4px)',
};

const emptyOverlayStyle = {
  position: 'absolute' as const,
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  color: T.textMute,
  fontSize: 12,
  letterSpacing: '0.08em',
};
