/**
 * ============================================================================
 * AI SIGNAL ENGINE — Recalibrado para Blitz Options (candles de 1s)
 * ----------------------------------------------------------------------------
 * Em Blitz (5s/10s/15s), candles são de 1 segundo. Indicadores tradicionais
 * (EMA21, RSI14) ficam ruidosos. Ajustamos:
 *   - Períodos curtos (EMA3/EMA8, RSI7)
 *   - Pesos maiores para padrões instantâneos (engulfing, momentum)
 *   - Thresholds mais baixos para o scalping ser viável
 * ============================================================================
 */
import { Candle, ema, rsi, atr, momentum, detectCandlePattern, last } from './indicators.js';

export type Direction = 'CALL' | 'PUT';
export type Expiration = 5 | 10 | 15;
export type Profile = 'conservador' | 'moderado' | 'ousado';

export interface Reason {
  label: string;
  weight: number;
  side: Direction | 'neutral';
}

export interface Signal {
  direction: Direction | null;
  confidence: number;
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
  /** Pra debugging — porque o sinal não foi disparado (se não foi). */
  blockedReason?: string;
}

const MIN_CANDLES = 15;

/**
 * Threshold por perfil — recalibrado para Blitz.
 * Conservador 50, Moderado 40, Ousado 30 — permite operar mas mantém gradação.
 */
const CONFIDENCE_THRESHOLD: Record<Profile, number> = {
  conservador: 50,
  moderado:    40,
  ousado:      30,
};

export function shouldEnter(signal: Signal, profile: Profile): boolean {
  return signal.direction !== null && signal.confidence >= CONFIDENCE_THRESHOLD[profile];
}

export function thresholdFor(profile: Profile): number {
  return CONFIDENCE_THRESHOLD[profile];
}

export function analyze(candles: Candle[]): Signal {
  if (candles.length < MIN_CANDLES) {
    return emptySignal(`Coletando candles (${candles.length}/${MIN_CANDLES})`);
  }

  const closes = candles.map(c => c.close);
  const emaShortSeries = ema(closes, 3);
  const emaLongSeries  = ema(closes, 8);
  const rsiSeries      = rsi(closes, 7);
  const atrSeries      = atr(candles, 7);

  const emaShort = last(emaShortSeries);
  const emaLong  = last(emaLongSeries);
  const rsiNow   = last(rsiSeries);
  const atrNow   = last(atrSeries);
  const mom      = momentum(closes, 3);
  const pattern  = detectCandlePattern(candles);

  if (
    emaShort === undefined || emaLong === undefined ||
    rsiNow === undefined   || atrNow === undefined
  ) {
    return emptySignal('Indicadores ainda não convergiram');
  }

  const reasons: Reason[] = [];
  let bullScore = 0;
  let bearScore = 0;

  // ── EMA 3 vs EMA 8 ──────────────────────────────────────────────────────
  // Pesos maiores; threshold de spread menor (forex se move em frações).
  const emaSpread = (emaShort - emaLong) / emaLong;
  if (emaSpread > 0.00005) {
    const w = Math.min(1, Math.abs(emaSpread) * 5000) * 0.40;
    reasons.push({
      label: `EMA 3 acima da EMA 8 (+${(emaSpread * 100).toFixed(4)}%)`,
      weight: w, side: 'CALL',
    });
    bullScore += w;
  } else if (emaSpread < -0.00005) {
    const w = Math.min(1, Math.abs(emaSpread) * 5000) * 0.40;
    reasons.push({
      label: `EMA 3 abaixo da EMA 8 (${(emaSpread * 100).toFixed(4)}%)`,
      weight: w, side: 'PUT',
    });
    bearScore += w;
  }

  // ── RSI 7 (zonas mais largas para timeframes curtos) ────────────────────
  if (rsiNow < 40) {
    const w = ((40 - rsiNow) / 40) * 0.30;
    reasons.push({
      label: `RSI ${rsiNow.toFixed(1)} — pressão de compra`,
      weight: w, side: 'CALL',
    });
    bullScore += w;
  } else if (rsiNow > 60) {
    const w = ((rsiNow - 60) / 40) * 0.30;
    reasons.push({
      label: `RSI ${rsiNow.toFixed(1)} — pressão de venda`,
      weight: w, side: 'PUT',
    });
    bearScore += w;
  }

  // ── Momentum (peso aumentado em Blitz) ──────────────────────────────────
  if (atrNow > 0 && Math.abs(mom) > atrNow * 0.2) {
    const w = Math.min(1, Math.abs(mom) / atrNow) * 0.30;
    if (mom > 0) {
      reasons.push({
        label: `Momentum positivo forte`,
        weight: w, side: 'CALL',
      });
      bullScore += w;
    } else {
      reasons.push({
        label: `Momentum negativo forte`,
        weight: w, side: 'PUT',
      });
      bearScore += w;
    }
  }

  // ── Padrão de candles (mais peso) ───────────────────────────────────────
  if (pattern === 'bullish_engulfing') {
    reasons.push({ label: 'Engolfo de alta detectado', weight: 0.30, side: 'CALL' });
    bullScore += 0.30;
  } else if (pattern === 'bearish_engulfing') {
    reasons.push({ label: 'Engolfo de baixa detectado', weight: 0.30, side: 'PUT' });
    bearScore += 0.30;
  }

  // ── Direção dos últimos 3 candles (sinal simples e direto) ──────────────
  const recent3 = closes.slice(-3);
  if (recent3.length === 3) {
    const allUp   = recent3[0] < recent3[1] && recent3[1] < recent3[2];
    const allDown = recent3[0] > recent3[1] && recent3[1] > recent3[2];
    if (allUp) {
      reasons.push({ label: 'Sequência de 3 candles em alta', weight: 0.20, side: 'CALL' });
      bullScore += 0.20;
    } else if (allDown) {
      reasons.push({ label: 'Sequência de 3 candles em baixa', weight: 0.20, side: 'PUT' });
      bearScore += 0.20;
    }
  }

  // ── Resolução ───────────────────────────────────────────────────────────
  const totalScore = bullScore + bearScore;
  let direction: Direction | null = null;
  let confidence = 0;
  let blockedReason: string | undefined;

  // Threshold mínimo de score baixo (0.15) — começa a considerar entrada cedo
  const MIN_SCORE = 0.15;

  if (totalScore > 0) {
    if (bullScore > bearScore && bullScore >= MIN_SCORE) {
      direction = 'CALL';
      // confiança proporcional à dominância × magnitude
      const dominance = bullScore / totalScore;
      const magnitude = Math.min(1, bullScore * 1.5);
      confidence = Math.round(dominance * magnitude * 100);
    } else if (bearScore > bullScore && bearScore >= MIN_SCORE) {
      direction = 'PUT';
      const dominance = bearScore / totalScore;
      const magnitude = Math.min(1, bearScore * 1.5);
      confidence = Math.round(dominance * magnitude * 100);
    } else if (Math.abs(bullScore - bearScore) < 0.05) {
      blockedReason = 'Sinais contraditórios — mercado indeciso';
    } else {
      blockedReason = `Score insuficiente (${Math.max(bullScore, bearScore).toFixed(2)} < ${MIN_SCORE})`;
    }
  } else {
    blockedReason = 'Sem sinais detectados';
  }

  // ── Expiração baseada em volatilidade ──────────────────────────────────
  const lastClose = last(closes)!;
  const volPct = (atrNow / lastClose) * 100;

  let expiration: Expiration;
  if (volPct < 0.02)      expiration = 15;
  else if (volPct < 0.05) expiration = 10;
  else                    expiration = 5;

  // Se confiança for baixa, prefere expiração curta (5s) — menos tempo no risco
  if (direction !== null && confidence < 50 && expiration > 5) {
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
    blockedReason,
  };
}

function emptySignal(why: string): Signal {
  return {
    direction: null,
    confidence: 0,
    expiration: 10,
    reasons: [{ label: why, weight: 0, side: 'neutral' }],
    metrics: {},
    blockedReason: why,
  };
}
