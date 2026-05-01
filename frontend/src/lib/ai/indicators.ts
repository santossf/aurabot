/**
 * ============================================================================
 * INDICADORES TÉCNICOS — funções puras sobre arrays de candles
 * ----------------------------------------------------------------------------
 * Sem dependências externas. Cada função recebe candles e devolve uma série
 * (ou um valor único) sem tocar em estado.
 *
 * Convenção: Candle = { open, high, low, close, time }
 * Os candles do SDK Quadcode usam {open, max, min, close, from} — fazemos
 * o mapeamento na camada de adapter (engine.ts), não aqui.
 * ============================================================================
 */

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  time: number;
}

/**
 * Exponential Moving Average.
 * EMA dá mais peso aos candles mais recentes — útil pra detectar mudança
 * de direção mais rápido que SMA.
 */
export function ema(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  // Seed com SMA dos primeiros `period` valores
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(prev);
  for (let i = period; i < values.length; i++) {
    const curr = values[i] * k + prev * (1 - k);
    out.push(curr);
    prev = curr;
  }
  return out;
}

/**
 * RSI (Relative Strength Index) — 0 a 100.
 * < 30 = sobrevendido (potencial CALL)
 * > 70 = sobrecomprado (potencial PUT)
 * Usamos suavização de Wilder (padrão).
 */
export function rsi(values: number[], period = 14): number[] {
  if (values.length <= period) return [];
  const out: number[] = [];
  let gains = 0;
  let losses = 0;

  // Primeira média
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  out.push(toRSI(avgGain, avgLoss));

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out.push(toRSI(avgGain, avgLoss));
  }
  return out;
}

function toRSI(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * ATR (Average True Range) — medida de volatilidade absoluta.
 * Usado pra escolher tempo de expiração (5s/10s/15s) baseado em
 * quão "agitado" está o mercado.
 */
export function atr(candles: Candle[], period = 14): number[] {
  if (candles.length < 2) return [];
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close),
    );
    trs.push(tr);
  }
  if (trs.length < period) return [];

  const out: number[] = [];
  let avg = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(avg);
  for (let i = period; i < trs.length; i++) {
    avg = (avg * (period - 1) + trs[i]) / period;
    out.push(avg);
  }
  return out;
}

/**
 * Momentum simples — diferença entre o close atual e o close de N candles atrás.
 * Usado como tiebreaker pra detectar força da tendência.
 */
export function momentum(values: number[], period = 5): number {
  if (values.length <= period) return 0;
  return values[values.length - 1] - values[values.length - 1 - period];
}

/**
 * Detecta padrões simples nos últimos 3 candles.
 * Retorna 'bullish_engulfing' | 'bearish_engulfing' | null.
 */
export function detectCandlePattern(candles: Candle[]): 'bullish_engulfing' | 'bearish_engulfing' | null {
  if (candles.length < 2) return null;
  const prev = candles[candles.length - 2];
  const curr = candles[candles.length - 1];

  const prevBody = Math.abs(prev.close - prev.open);
  const currBody = Math.abs(curr.close - curr.open);
  if (currBody < prevBody * 1.1) return null; // corpo precisa ser visivelmente maior

  // Bullish engulfing: vermelho seguido por verde que engole o anterior
  if (prev.close < prev.open && curr.close > curr.open && curr.close > prev.open && curr.open < prev.close) {
    return 'bullish_engulfing';
  }
  // Bearish engulfing: verde seguido por vermelho que engole o anterior
  if (prev.close > prev.open && curr.close < curr.open && curr.close < prev.open && curr.open > prev.close) {
    return 'bearish_engulfing';
  }
  return null;
}

/** Última posição de uma série, ou undefined se vazia. */
export function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1];
}
