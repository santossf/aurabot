/**
 * ============================================================================
 * BOT ENGINE
 * ----------------------------------------------------------------------------
 * Orquestra:
 *   1. Subscrição em candles em tempo real (via SDK)
 *   2. Análise contínua (engine de IA)
 *   3. Decisão de entrada (confidence >= threshold por perfil)
 *   4. Compra via sdk.blitzOptions().buy(...)
 *   5. Acompanhamento da posição via sdk.positions().subscribeOnUpdatePosition
 *   6. Aplicação do gale após loss / reset após win
 *   7. Stop loss: para o bot ao atingir maxConsecutiveLosses+1 perdas
 *   8. Take profit: para o bot ao atingir meta de lucro
 * ============================================================================
 */
import type { ClientSdk } from '@quadcode-tech/client-sdk-js';
import { BlitzOptionsDirection } from '@quadcode-tech/client-sdk-js';
import { analyze, shouldEnter, type Profile, type Signal, type Reason } from '../ai/engine.js';
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

export class BotEngine {
  private state: BotState = { kind: 'idle' };
  private sequence: SequenceState = { operations: [], lossesInRow: 0, accumulatedLoss: 0 };
  private session: SessionStats;
  private candles: Candle[] = [];
  private lastSignal: Signal | null = null;

  private analysisTimer: number | null = null;
  private chartUnsub: (() => void) | null = null;
  private positionsUnsub: (() => void) | null = null;

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

    // Log para diagnóstico (visível no console do navegador)
    if (signal.direction) {
      console.log(
        `[bot] sinal ${signal.direction} confiança=${signal.confidence}% ` +
        `threshold=${this.ctx.config.profile === 'conservador' ? 50 : this.ctx.config.profile === 'moderado' ? 40 : 30}% ` +
        `→ ${shouldEnter(signal, this.ctx.config.profile) ? 'ENTRAR' : 'aguardar'}`
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

      op.brokerPositionId = (result as any).id ?? (result as any).externalId;
      op.status = 'open';
      this.events.onOperationUpdate({ ...op });
      this.transition({ kind: 'in_position', operationId: op.id });
    } catch (err) {
      op.status = 'error';
      op.errorMessage = (err as Error).message;
      this.events.onOperationUpdate({ ...op });
      this.transition({ kind: 'analyzing' });
      throw err;
    }
  }

  private onPositionUpdate(p: any): void {
    const op = this.sequence.operations.find(
      o => o.brokerPositionId !== undefined &&
           (o.brokerPositionId === p.id || o.brokerPositionId === p.externalId),
    );
    if (!op) return;

    const closed = p.status === 'closed' || p.closeReason !== undefined;
    if (!closed) return;

    const pnl = typeof p.pnlNet === 'number' ? p.pnlNet : (p.profit ?? 0);
    op.pnl = pnl;
    op.status = pnl > 0 ? 'win' : 'loss';
    this.events.onOperationUpdate({ ...op });

    this.handleResolution(op.status, pnl);
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
    // Atualiza session stats
    this.session.totalPnl += pnl;
    if (status === 'win') this.session.greensCount += 1;
    this.events.onSessionUpdate({ ...this.session });

    if (status === 'win') {
      this.resetSequence();

      // Verifica take profit
      if (this.checkTakeProfit()) {
        this.stop('take_profit_hit', `Meta atingida: ${formatTpReason(this.ctx.config.takeProfit, this.session)}`);
        return;
      }

      this.transition({ kind: 'analyzing' });
      return;
    }

    // status === 'loss'
    this.sequence.lossesInRow += 1;
    this.sequence.accumulatedLoss += Math.abs(pnl);
    this.events.onSequenceUpdate({ ...this.sequence });

    // Stop loss: tentamos N gales (maxConsecutiveLosses+1 = entrada inicial + N gales)
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

  // ── Getters ────────────────────────────────────────────────────────────
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
 * Constrói OperationAnalysis a partir do Signal da IA.
 * Pega os reasons da direção que ganhou e gera resumo + lista.
 */
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
