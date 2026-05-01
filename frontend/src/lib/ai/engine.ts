/**
 * ============================================================================
 * AI SIGNAL ENGINE
 * ----------------------------------------------------------------------------
 * Recebe candles e produz um veredicto:
 *   - direction: 'CALL' | 'PUT' | null
 *   - confidence: 0..100
 *   - expiration: 5 | 10 | 15 (segundos)
 *   - reasons: lista de fatores que contribuíram (pra mostrar no relatório)
 *
 * Filosofia: vários indicadores votam. Se a maioria concorda com força,
 * a confiança sobe. Sem consenso → null (bot não entra).
 *
 * Threshold de confiança configurável por perfil de risco.
 * ============================================================================
 */
import { Candle, ema, rsi, atr, momentum, detectCandlePattern, last } from './indicators.js';

export type Direction = 'CALL' | 'PUT';
export type Expiration = 5 | 10 | 15;
export type Profile = 'conservador' | 'moderado' | 'ousado';

export interface Reason {
  label: string;          // ex: "RSI 28 — sobrevendido"
  weight: number;         // 0..1, contribuição p/ confidence
  side: Direction | 'neutral';
}

export interface Signal {
  direction: Direction | null;
  confidence: number;     // 0..100
  expiration: Expiration;
  reasons: Reason[];
  metrics: {
    rsi?: number;
    emaShort?: number;
    emaLong?: number;
    atr?: number;
    momentum?: number;
    pattern?: string | null;
  };
}

const MIN_CANDLES = 30; // precisa de histórico mínimo pra indicadores

/**
 * Threshold de confiança por perfil — quanto mais arriscado, menor o filtro.
 * Conservador exige 75+ pra entrar. Ousado entra com 55+.
 */
const CONFIDENCE_THRESHOLD: Record<Profile, number> = {
  conservador: 75,
  moderado: 65,
  ousado: 55,
};

export function shouldEnter(signal: Signal, profile: Profile): boolean {
  return signal.direction !== null && signal.confidence >= CONFIDENCE_THRESHOLD[profile];
}

export function thresholdFor(profile: Profile): number {
  return CONFIDENCE_THRESHOLD[profile];
}

/**
 * Função principal: dados os candles, devolve um Signal.
 */
export function analyze(candles: Candle[]): Signal {
  if (candles.length < MIN_CANDLES) {
    return emptySignal('Dados insuficientes — coletando candles...');
  }

  const closes = candles.map(c => c.close);
  const emaShortSeries = ema(closes, 5);
  const emaLongSeries = ema(closes, 21);
  const rsiSeries = rsi(closes, 14);
  const atrSeries = atr(candles, 14);

  const emaShort = last(emaShortSeries);
  const emaLong = last(emaLongSeries);
  const rsiNow = last(rsiSeries);
  const atrNow = last(atrSeries);
  const mom = momentum(closes, 5);
  const pattern = detectCandlePattern(candles);

  if (emaShort === undefined || emaLong === undefined || rsiNow === undefined || atrNow === undefined) {
    return emptySignal('Indicadores ainda não convergiram');
  }

  // Coleta votos
  const reasons: Reason[] = [];
  let bullScore = 0;
  let bearScore = 0;

  // ── EMA crossover (fator dominante) ──────────────────────────────────────
  const emaSpread = (emaShort - emaLong) / emaLong;
  if (emaSpread > 0.0003) {
    const w = Math.min(1, Math.abs(emaSpread) * 1000) * 0.35;
    reasons.push({ label: `EMA 5 acima da EMA 21 (+${(emaSpread * 100).toFixed(3)}%)`, weight: w, side: 'CALL' });
    bullScore += w;
  } else if (emaSpread < -0.0003) {
    const w = Math.min(1, Math.abs(emaSpread) * 1000) * 0.35;
    reasons.push({ label: `EMA 5 abaixo da EMA 21 (${(emaSpread * 100).toFixed(3)}%)`, weight: w, side: 'PUT' });
    bearScore += w;
  } else {
    reasons.push({ label: 'EMAs sem separação clara', weight: 0, side: 'neutral' });
  }

  // ── RSI (zonas extremas) ─────────────────────────────────────────────────
  if (rsiNow < 30) {
    const w = ((30 - rsiNow) / 30) * 0.25;
    reasons.push({ label: `RSI ${rsiNow.toFixed(1)} — sobrevendido`, weight: w, side: 'CALL' });
    bullScore += w;
  } else if (rsiNow > 70) {
    const w = ((rsiNow - 70) / 30) * 0.25;
    reasons.push({ label: `RSI ${rsiNow.toFixed(1)} — sobrecomprado`, weight: w, side: 'PUT' });
    bearScore += w;
  } else {
    reasons.push({ label: `RSI ${rsiNow.toFixed(1)} — zona neutra`, weight: 0, side: 'neutral' });
  }

  // ── Momentum (tiebreaker) ────────────────────────────────────────────────
  if (Math.abs(mom) > atrNow * 0.5) {
    const w = Math.min(1, Math.abs(mom) / atrNow / 2) * 0.15;
    if (mom > 0) {
      reasons.push({ label: `Momentum positivo (${mom.toFixed(4)})`, weight: w, side: 'CALL' });
      bullScore += w;
    } else {
      reasons.push({ label: `Momentum negativo (${mom.toFixed(4)})`, weight: w, side: 'PUT' });
      bearScore += w;
    }
  }

  // ── Padrão de candles ────────────────────────────────────────────────────
  if (pattern === 'bullish_engulfing') {
    reasons.push({ label: 'Engolfo de alta nos últimos 2 candles', weight: 0.2, side: 'CALL' });
    bullScore += 0.2;
  } else if (pattern === 'bearish_engulfing') {
    reasons.push({ label: 'Engolfo de baixa nos últimos 2 candles', weight: 0.2, side: 'PUT' });
    bearScore += 0.2;
  }

  // ── Resolução ────────────────────────────────────────────────────────────
  const totalScore = bullScore + bearScore;
  let direction: Direction | null = null;
  let confidence = 0;

  if (totalScore > 0) {
    if (bullScore > bearScore && bullScore > 0.25) {
      direction = 'CALL';
      // confiança = quanto bullScore domina × magnitude
      confidence = Math.round(Math.min(100, (bullScore / totalScore) * 100 * Math.min(1, bullScore * 2)));
    } else if (bearScore > bullScore && bearScore > 0.25) {
      direction = 'PUT';
      confidence = Math.round(Math.min(100, (bearScore / totalScore) * 100 * Math.min(1, bearScore * 2)));
    }
  }

  // ── Tempo de expiração baseado em volatilidade ───────────────────────────
  // Usamos ATR normalizado como proxy de volatilidade.
  // Mercado calmo → expiração maior (sinal precisa de tempo pra se materializar)
  // Mercado agitado → expiração menor (movimento rápido, pega o impulso curto)
  const lastClose = last(closes)!;
  const volPct = (atrNow / lastClose) * 100; // ATR em % do preço

  let expiration: Expiration;
  if (volPct < 0.05) {
    expiration = 15;
  } else if (volPct < 0.12) {
    expiration = 10;
  } else {
    expiration = 5;
  }

  return {
    direction,
    confidence,
    expiration,
    reasons,
    metrics: {
      rsi: rsiNow,
      emaShort,
      emaLong,
      atr: atrNow,
      momentum: mom,
      pattern,
    },
  };
}

function emptySignal(why: string): Signal {
  return {
    direction: null,
    confidence: 0,
    expiration: 10,
    reasons: [{ label: why, weight: 0, side: 'neutral' }],
    metrics: {},
  };
}
