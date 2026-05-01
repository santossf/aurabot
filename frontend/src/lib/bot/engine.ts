/**
 * ============================================================================
 * BOT ENGINE
 * ----------------------------------------------------------------------------
 * v2 — fixes:
 *   - Logging extensivo no onPositionUpdate (debug)
 *   - Detecção robusta de win/loss em múltiplos campos da API
 *   - Watchdog timer: se posição não fecha em expiração+5s, força resolução
 *   - Match mais permissivo entre brokerPositionId e payload
 * ============================================================================
 */
import type { ClientSdk } from '@quadcode-tech/client-sdk-js';
import { BlitzOptionsDirection } from '@quadcode-tech/client-sdk-js';
import { analyze, shouldEnter, thresholdFor, type Profile, type Signal, type Reason } from '../ai/engine.js';
import type { Candle } from '../ai/indicators.js';
import type {
  Operation,
  OperationAnalysis,
  BotState,
  SequenceState,
  SessionStats,
  TakeProfitConfig,
} from './types.js';

export interface BotConfig {
  profile: Profile;
  entryValue: number;
  maxConsecutiveLosses: number;
  multiplier: number;
  takeProfit: TakeProfitConfig;
}

export interface BotContext {
  sdk: ClientSdk;
  activeId: number;
  assetSymbol: string;
  config: BotConfig;
  balanceId: number;
  balance: number;
  dryRun?: boolean;
}

export interface BotEvents {
  onStateChange:     (state: BotState) => void;
  onSignalUpdate:    (signal: Signal) => void;
  onOperationCreate: (op: Operation) => void;
  onOperationUpdate: (op: Operation) => void;
  onSequenceUpdate:  (seq: SequenceState) => void;
  onSessionUpdate:   (stats: SessionStats) => void;
  onError:           (err: Error) => void;
}

const ANALYSIS_INTERVAL_MS = 1000;
/** Tempo extra após expiração antes de forçar resolução pelo preço */
const RESOLUTION_GRACE_MS = 5000;

export class BotEngine {
  private state: BotState = { kind: 'idle' };
  private sequence: SequenceState = { operations: [], lossesInRow: 0, accumulatedLoss: 0 };
  private session: SessionStats;
  private candles: Candle[] = [];
  private lastSignal: Signal | null = null;

  private analysisTimer: number | null = null;
  private chartUnsub: (() => void) | null = null;
  private positionsUnsub: (() => void) | null = null;
  /** Watchdog por operação — força resolução se a corretora não responde */
  private resolutionTimers: Map<string, number> = new Map();

  constructor(private ctx: BotContext, private events: BotEvents) {
    this.session = {
      greensCount:  0,
      totalPnl:     0,
      startBalance: ctx.balance,
    };
  }

  async start(): Promise<void> {
    if (this.state.kind !== 'idle' && this.state.kind !== 'stopped') {
      throw new Error('Bot já está rodando');
    }

    if (this.state.kind === 'stopped') {
      this.resetSequence();
      this.resetSession();
    }

    await this.subscribeChart();
    await this.subscribePositions();

    this.transition({ kind: 'analyzing' });
    this.startAnalysisLoop();
  }

  stop(reason: 'manual' | 'stop_loss_hit' | 'take_profit_hit' | 'error' = 'manual', detail?: string): void {
    this.stopAnalysisLoop();
    this.unsubscribeAll();
    this.clearAllResolutionTimers();
    this.transition({ kind: 'stopped', reason, detail });
  }

  acknowledgeStopAndReset(): void {
    if (this.state.kind !== 'stopped') return;
    this.resetSequence();
    this.resetSession();
    this.transition({ kind: 'idle' });
  }

  private async subscribeChart(): Promise<void> {
    const layer = await this.ctx.sdk.realTimeChartDataLayer(this.ctx.activeId, 1);
    const fromSec = Math.floor(Date.now() / 1000) - 5 * 60;
    const initial = await layer.fetchAllCandles(fromSec);

    this.candles = initial.map(adaptCandle);

    layer.subscribeOnLastCandleChanged((c: any) => {
      const adapted = adaptCandle(c);
      const last = this.candles[this.candles.length - 1];
      if (last && last.time === adapted.time) {
        this.candles[this.candles.length - 1] = adapted;
      } else {
        this.candles.push(adapted);
        if (this.candles.length > 600) this.candles = this.candles.slice(-600);
      }
    });

    this.chartUnsub = () => { /* SDK não expõe unsub direto */ };
  }

  private async subscribePositions(): Promise<void> {
    const positions = await this.ctx.sdk.positions();
    const handler = (p: any) => this.onPositionUpdate(p);
    positions.subscribeOnUpdatePosition(handler);
    this.positionsUnsub = () => { /* idem */ };
  }

  private unsubscribeAll(): void {
    this.chartUnsub?.();     this.chartUnsub = null;
    this.positionsUnsub?.(); this.positionsUnsub = null;
  }

  private startAnalysisLoop(): void {
    if (this.analysisTimer) return;
    const tick = () => {
      try {
        this.analyzeAndMaybeEnter();
      } catch (err) {
        console.error('[bot] erro no loop de análise', err);
        this.events.onError(err as Error);
      }
    };
    tick();
    this.analysisTimer = window.setInterval(tick, ANALYSIS_INTERVAL_MS);
  }

  private stopAnalysisLoop(): void {
    if (this.analysisTimer !== null) {
      window.clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }
  }

  private analyzeAndMaybeEnter(): void {
    const signal = analyze(this.candles);
    this.lastSignal = signal;
    this.events.onSignalUpdate(signal);

    const threshold = thresholdFor(this.ctx.config.profile);
    if (signal.direction) {
      console.log(
        `[bot] sinal ${signal.direction} confiança=${signal.confidence}% ` +
        `threshold=${threshold}% → ${shouldEnter(signal, this.ctx.config.profile) ? 'ENTRAR' : 'aguardar'}`
      );
    } else if (signal.blockedReason) {
      console.log(`[bot] sem entrada: ${signal.blockedReason}`);
    }

    if (this.state.kind === 'in_position' || this.state.kind === 'stopped' || this.state.kind === 'placing_order') {
      return;
    }

    if (shouldEnter(signal, this.ctx.config.profile)) {
      this.placeOrder(signal).catch(err => {
        console.error('[bot] falha ao colocar ordem', err);
        this.events.onError(err);
        this.transition({ kind: 'analyzing' });
      });
    } else {
      this.transition({ kind: 'waiting_signal', lastConfidence: signal.confidence });
    }
  }

  private async placeOrder(signal: Signal): Promise<void> {
    if (!signal.direction) return;
    this.transition({ kind: 'placing_order' });

    const galeLevel = this.sequence.operations.length;
    const amount = this.ctx.config.entryValue * Math.pow(this.ctx.config.multiplier, galeLevel);

    if (galeLevel === 0) {
      this.sequence.lockedDirection = signal.direction;
    }

    const analysis = buildAnalysisFromSignal(signal);

    const op: Operation = {
      id:        cryptoRandomId(),
      asset:     this.ctx.assetSymbol,
      direction: signal.direction,
      amount,
      expiration: signal.expiration,
      openedAt:  Date.now(),
      expiresAt: Date.now() + signal.expiration * 1000,
      status:    'analyzing',
      galeLevel,
      signal,
      analysis,
    };
    this.sequence.operations.push(op);
    this.events.onOperationCreate(op);
    this.events.onSequenceUpdate({ ...this.sequence });

    if (this.ctx.dryRun) {
      window.setTimeout(() => {
        op.status = 'open';
        this.events.onOperationUpdate({ ...op });
      }, 300);
      window.setTimeout(() => this.simulateResolution(op.id), signal.expiration * 1000 + 200);
      this.transition({ kind: 'in_position', operationId: op.id });
      return;
    }

    try {
      const blitzOptions = await this.ctx.sdk.blitzOptions();
      const actives = blitzOptions.getActives();
      const active = actives.find((a: any) => a.id === this.ctx.activeId);
      if (!active) throw new Error(`Ativo ${this.ctx.activeId} não disponível em Blitz`);

      const targetSec = signal.expiration;
      const expTime = active.expirationTimes.find((t: number) => t === targetSec) ?? active.expirationTimes[0];

      const balances = await this.ctx.sdk.balances();
      const balance = balances.getBalanceById(this.ctx.balanceId);
      if (!balance) throw new Error(`Banca ${this.ctx.balanceId} não encontrada`);

      op.status = 'pending';
      this.events.onOperationUpdate({ ...op });

      const direction = signal.direction === 'CALL'
        ? BlitzOptionsDirection.Call
        : BlitzOptionsDirection.Put;
      const result = await blitzOptions.buy(active, direction, expTime, amount, balance);

      const positionId = (result as any).id ?? (result as any).externalId;
      op.brokerPositionId = positionId;
      op.status = 'open';
      this.events.onOperationUpdate({ ...op });

      console.log(`[bot] ordem confirmada: opId=${op.id} positionId=${positionId} amount=$${amount.toFixed(2)} ${signal.direction} ${signal.expiration}s`);

      this.transition({ kind: 'in_position', operationId: op.id });

      // Watchdog: se não fechar em expiração + grace, força resolução
      this.scheduleResolutionWatchdog(op);
    } catch (err) {
      op.status = 'error';
      op.errorMessage = (err as Error).message;
      this.events.onOperationUpdate({ ...op });
      this.transition({ kind: 'analyzing' });
      throw err;
    }
  }

  /**
   * Programa um timer que, se a corretora não responder, resolve a operação
   * pelo movimento do preço comparando com o openQuote.
   */
  private scheduleResolutionWatchdog(op: Operation): void {
    const totalMs = (op.expiresAt - op.openedAt) + RESOLUTION_GRACE_MS;
    const timerId = window.setTimeout(() => {
      const current = this.sequence.operations.find(o => o.id === op.id);
      if (!current) return;
      // Se já foi resolvido por evento da corretora, ignora
      if (current.status === 'win' || current.status === 'loss' || current.status === 'error') return;

      console.warn(`[bot] watchdog: opId=${op.id} não fechou em ${totalMs}ms — resolvendo pelo preço`);
      this.resolveByPriceMovement(op.id);
    }, totalMs);
    this.resolutionTimers.set(op.id, timerId);
  }

  private clearResolutionTimer(opId: string): void {
    const timerId = this.resolutionTimers.get(opId);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      this.resolutionTimers.delete(opId);
    }
  }

  private clearAllResolutionTimers(): void {
    for (const [, timerId] of this.resolutionTimers) {
      window.clearTimeout(timerId);
    }
    this.resolutionTimers.clear();
  }

  /**
   * Resolução de fallback: compara o preço atual com o do momento da entrada.
   * Para CALL: win se subiu, loss se desceu/igualou.
   * Para PUT: win se desceu, loss se subiu/igualou.
   */
  private resolveByPriceMovement(opId: string): void {
    const op = this.sequence.operations.find(o => o.id === opId);
    if (!op) return;
    if (op.status === 'win' || op.status === 'loss' || op.status === 'error') return;

    const currentPrice = this.candles[this.candles.length - 1]?.close;
    const openPriceCandle = this.candles.find(c => c.time >= Math.floor(op.openedAt / 1000));
    const openPrice = openPriceCandle?.close;

    if (currentPrice === undefined || openPrice === undefined) {
      console.warn('[bot] watchdog: sem candles suficientes para resolver pelo preço');
      // Última tentativa: marca como erro pra não travar o bot
      op.status = 'error';
      op.errorMessage = 'Sem dados de preço para resolução';
      this.events.onOperationUpdate({ ...op });
      this.handleResolution('loss', 0);
      return;
    }

    const isWin = op.direction === 'CALL'
      ? currentPrice > openPrice
      : currentPrice < openPrice;

    // Estimativa de pnl (sem o profitIncome real, usamos 85% como aproximação típica de Blitz)
    const estimatedPnl = isWin ? op.amount * 0.85 : -op.amount;
    op.pnl = estimatedPnl;
    op.status = isWin ? 'win' : 'loss';
    this.events.onOperationUpdate({ ...op });

    console.log(`[bot] watchdog resolveu: opId=${op.id} ${isWin ? 'WIN' : 'LOSS'} (open=${openPrice} → close=${currentPrice})`);

    this.handleResolution(op.status, estimatedPnl);
  }

  private onPositionUpdate(p: any): void {
    // Log completo do payload pra debug
    console.log('[bot] onPositionUpdate:', {
      id:               p.id,
      externalId:       p.externalId,
      status:           p.status,
      closeReason:      p.closeReason,
      pnl:              p.pnl,
      pnlNet:           p.pnlNet,
      pnlRealized:      p.pnlRealized,
      closeProfit:      p.closeProfit,
      profit:           p.profit,
      sellProfit:       p.sellProfit,
      invest:           p.invest,
      openQuote:        p.openQuote,
      closeQuote:       p.closeQuote,
    });

    // Match permissivo: tenta vários campos do payload
    const op = this.sequence.operations.find(o => {
      if (o.brokerPositionId === undefined) return false;
      const ids = [p.id, p.externalId, p.internalId, p.positionId];
      return ids.some(id => id !== undefined && String(id) === String(o.brokerPositionId));
    });

    if (!op) {
      console.log('[bot] onPositionUpdate: nenhuma operação local correspondente');
      return;
    }

    // Considera fechada se status é "closed" OU se tem closeReason setado
    const closed = p.status === 'closed' || (typeof p.closeReason === 'string' && p.closeReason.length > 0);
    if (!closed) {
      console.log(`[bot] posição ${op.id} ainda aberta (status=${p.status})`);
      return;
    }

    // Se já resolvemos pelo watchdog, ignora
    if (op.status === 'win' || op.status === 'loss') {
      console.log(`[bot] posição ${op.id} já estava resolvida como ${op.status}`);
      return;
    }

    // Cancela watchdog se ainda agendado
    this.clearResolutionTimer(op.id);

    // Detecta pnl em múltiplos campos possíveis
    const pnl = pickPnl(p, op.amount);

    // Usa pnl calculado, com fallback para comparação de quotes se ainda assim for 0
    let finalPnl = pnl;
    let isWin: boolean;

    if (pnl === 0 && typeof p.closeQuote === 'number' && typeof p.openQuote === 'number') {
      // Compara quotes para inferir win/loss
      if (op.direction === 'CALL') {
        isWin = p.closeQuote > p.openQuote;
      } else {
        isWin = p.closeQuote < p.openQuote;
      }
      finalPnl = isWin ? op.amount * 0.85 : -op.amount;
      console.log(`[bot] pnl=0 da API, inferido pela quote: ${isWin ? 'WIN' : 'LOSS'} (open=${p.openQuote} close=${p.closeQuote})`);
    } else {
      isWin = finalPnl > 0;
    }

    op.pnl = finalPnl;
    op.status = isWin ? 'win' : 'loss';
    this.events.onOperationUpdate({ ...op });

    console.log(`[bot] resolução: opId=${op.id} ${isWin ? 'WIN' : 'LOSS'} pnl=$${finalPnl.toFixed(2)}`);

    this.handleResolution(op.status, finalPnl);
  }

  private simulateResolution(opId: string): void {
    const op = this.sequence.operations.find(o => o.id === opId);
    if (!op || op.status !== 'open') return;

    const winChance = 0.45 + (op.signal.confidence / 1000);
    const win = Math.random() < winChance;
    const pnl = win ? op.amount * 0.85 : -op.amount;
    op.pnl = pnl;
    op.status = win ? 'win' : 'loss';
    this.events.onOperationUpdate({ ...op });
    this.handleResolution(op.status, pnl);
  }

  private handleResolution(status: 'win' | 'loss', pnl: number): void {
    this.session.totalPnl += pnl;
    if (status === 'win') this.session.greensCount += 1;
    this.events.onSessionUpdate({ ...this.session });

    if (status === 'win') {
      this.resetSequence();

      if (this.checkTakeProfit()) {
        this.stop('take_profit_hit', `Meta atingida: ${formatTpReason(this.ctx.config.takeProfit, this.session)}`);
        return;
      }

      this.transition({ kind: 'analyzing' });
      return;
    }

    this.sequence.lossesInRow += 1;
    this.sequence.accumulatedLoss += Math.abs(pnl);
    this.events.onSequenceUpdate({ ...this.sequence });

    if (this.sequence.lossesInRow > this.ctx.config.maxConsecutiveLosses) {
      this.stop('stop_loss_hit', `${this.sequence.lossesInRow} perdas consecutivas`);
      return;
    }

    this.transition({ kind: 'analyzing' });
  }

  private checkTakeProfit(): boolean {
    const tp = this.ctx.config.takeProfit;
    switch (tp.mode) {
      case 'absolute':
        return this.session.totalPnl >= tp.value;
      case 'percent':
        return this.session.totalPnl >= (this.session.startBalance * tp.value / 100);
      case 'greens':
        return this.session.greensCount >= tp.value;
    }
  }

  private resetSequence(): void {
    this.sequence = { operations: [], lossesInRow: 0, accumulatedLoss: 0 };
    this.events.onSequenceUpdate({ ...this.sequence });
  }

  private resetSession(): void {
    this.session = {
      greensCount:  0,
      totalPnl:     0,
      startBalance: this.ctx.balance,
    };
    this.events.onSessionUpdate({ ...this.session });
  }

  private transition(state: BotState): void {
    this.state = state;
    this.events.onStateChange(state);
  }

  getState(): BotState { return this.state; }
  getSequence(): SequenceState { return this.sequence; }
  getSession(): SessionStats { return this.session; }
  getCandles(): Candle[] { return this.candles; }
  getLastSignal(): Signal | null { return this.lastSignal; }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function adaptCandle(c: any): Candle {
  return {
    time:   c.from ?? c.id ?? 0,
    open:   c.open ?? 0,
    high:   c.max ?? c.high ?? 0,
    low:    c.min ?? c.low ?? 0,
    close:  c.close ?? 0,
  };
}

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Tenta obter o pnl da posição em múltiplos campos comuns da API Quadcode.
 * Retorna 0 se nenhum estiver disponível (chamador deve fazer fallback).
 */
function pickPnl(p: any, _amount: number): number {
  // Ordem de preferência (do mais específico ao genérico)
  const candidates = [
    p.pnlRealized,    // pnl realizado após fechamento (mais confiável)
    p.closeProfit,    // alguns endpoints usam este nome
    p.pnlNet,         // pnl líquido
    p.pnl,            // pnl atual
    p.profit,         // alguns endpoints
    p.sellProfit,     // pnl ao vender (raro pra Blitz, mas vale)
  ];

  for (const c of candidates) {
    if (typeof c === 'number' && !isNaN(c)) {
      return c;
    }
  }
  return 0;
}

function buildAnalysisFromSignal(signal: Signal): OperationAnalysis {
  const relevant = signal.reasons
    .filter((r: Reason) => r.side === signal.direction || r.side === 'neutral')
    .sort((a: Reason, b: Reason) => b.weight - a.weight);

  const summary = relevant
    .slice(0, 3)
    .map((r: Reason) => r.label)
    .join(' · ') || 'Sinal de IA detectado';

  return {
    confidence: Math.round(signal.confidence),
    summary,
    signals: relevant.map((r: Reason) => ({
      label:  r.label,
      weight: r.weight,
    })),
  };
}

function formatTpReason(tp: TakeProfitConfig, session: SessionStats): string {
  switch (tp.mode) {
    case 'absolute': return `lucro de $${session.totalPnl.toFixed(2)}`;
    case 'percent':  return `+${((session.totalPnl / session.startBalance) * 100).toFixed(1)}% da banca`;
    case 'greens':   return `${session.greensCount} vitórias`;
  }
}
