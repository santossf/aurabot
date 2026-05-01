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
 *   7. Stop loss: para o bot ao atingir maxGales+1 perdas consecutivas
 *
 * Padrão: máquina de estados explícita, eventos via callback (sem RxJS).
 * Fácil de testar, fácil de mockar (vide DRY_RUN).
 * ============================================================================
 */
import type { ClientSdk } from '@quadcode-tech/client-sdk-js';
import { BlitzOptionsDirection } from '@quadcode-tech/client-sdk-js';
import { analyze, shouldEnter, type Profile, type Signal } from '../ai/engine.js';
import type { Candle } from '../ai/indicators.js';
import type { Operation, BotState, SequenceState } from './types.js';
import { computeStopLoss } from './stopLoss.js';
 
export interface BotConfig {
  profile: Profile;
  entryValue: number;
  takeProfit: number;     // % — não usado no Blitz (sai por expiração)
  maxGales: number;
  multiplier: number;
}
 
export interface BotContext {
  sdk: ClientSdk;
  activeId: number;
  assetSymbol: string;
  config: BotConfig;
  balanceId: number;       // ID da banca real ou demo do usuário
  balance: number;         // valor atual em $ (pra cálculo de stop loss)
  /** Modo dry-run: simula compras sem chamar a corretora. Útil para testes. */
  dryRun?: boolean;
}
 
export interface BotEvents {
  onStateChange: (state: BotState) => void;
  onSignalUpdate: (signal: Signal) => void;
  onOperationCreate: (op: Operation) => void;
  onOperationUpdate: (op: Operation) => void;
  onSequenceUpdate: (seq: SequenceState) => void;
  onError: (err: Error) => void;
}
 
const ANALYSIS_INTERVAL_MS = 1000;
const POLL_RESULT_INTERVAL_MS = 500;
 
export class BotEngine {
  private state: BotState = { kind: 'idle' };
  private sequence: SequenceState = { operations: [], lossesInRow: 0, accumulatedLoss: 0 };
  private candles: Candle[] = [];
  private lastSignal: Signal | null = null;
 
  private analysisTimer: number | null = null;
  private chartUnsub: (() => void) | null = null;
  private positionsUnsub: (() => void) | null = null;
 
  constructor(private ctx: BotContext, private events: BotEvents) {}
 
  // ── Lifecycle ──────────────────────────────────────────────────────────
  async start(): Promise<void> {
    if (this.state.kind !== 'idle' && this.state.kind !== 'stopped') {
      throw new Error('Bot já está rodando');
    }
 
    // Reseta sequência se vinha de um stop_loss_hit que foi confirmado
    if (this.state.kind === 'stopped') {
      this.resetSequence();
    }
 
    await this.subscribeChart();
    await this.subscribePositions();
 
    this.transition({ kind: 'analyzing' });
    this.startAnalysisLoop();
  }
 
  stop(reason: 'manual' | 'stop_loss_hit' | 'error' = 'manual', detail?: string): void {
    this.stopAnalysisLoop();
    this.unsubscribeAll();
    this.transition({ kind: 'stopped', reason, detail });
  }
 
  /** Chamado pela UI quando o usuário confirma o reinício após stop loss. */
  acknowledgeStopAndReset(): void {
    if (this.state.kind !== 'stopped') return;
    this.resetSequence();
    this.transition({ kind: 'idle' });
  }
 
  // ── Subscriptions ──────────────────────────────────────────────────────
  private async subscribeChart(): Promise<void> {
    // Candles de 1s para Blitz (movimento ultracurto). 5 minutos de histórico
    // é suficiente pra encher os indicadores (300 candles >> MIN_CANDLES).
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
        // mantém janela razoável em memória
        if (this.candles.length > 600) this.candles = this.candles.slice(-600);
      }
    });
 
    this.chartUnsub = () => {
      // SDK não expõe unsubscribe direto do RealTimeChartDataLayer no exemplo;
      // se houver método, plugar aqui. Por ora o garbage collection cuida.
    };
  }
 
  private async subscribePositions(): Promise<void> {
    const positions = await this.ctx.sdk.positions();
    const handler = (p: any) => this.onPositionUpdate(p);
    positions.subscribeOnUpdatePosition(handler);
    this.positionsUnsub = () => {
      // se SDK expuser unsubscribe, chamar aqui
    };
  }
 
  private unsubscribeAll(): void {
    this.chartUnsub?.(); this.chartUnsub = null;
    this.positionsUnsub?.(); this.positionsUnsub = null;
  }
 
  // ── Loop de análise ────────────────────────────────────────────────────
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
 
    // Não entra em novas operações se está em posição ou parado
    if (this.state.kind === 'in_position' || this.state.kind === 'stopped' || this.state.kind === 'placing_order') {
      return;
    }
 
    // Se está em sequência de gale, só entra na MESMA direção da inicial
    const lockedDir = this.sequence.lockedDirection;
    if (lockedDir && signal.direction !== lockedDir) {
      // Espera o sinal voltar pra direção travada
      this.transition({ kind: 'waiting_signal', lastConfidence: signal.confidence });
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
 
  // ── Entrada ────────────────────────────────────────────────────────────
  private async placeOrder(signal: Signal): Promise<void> {
    if (!signal.direction) return;
    this.transition({ kind: 'placing_order' });
 
    const galeLevel = this.sequence.operations.length;
    const amount = this.ctx.config.entryValue * Math.pow(this.ctx.config.multiplier, galeLevel);
 
    // Trava a direção na primeira operação da sequência
    if (galeLevel === 0) {
      this.sequence.lockedDirection = signal.direction;
    }
 
    const op: Operation = {
      id: cryptoRandomId(),
      asset: this.ctx.assetSymbol,
      direction: signal.direction,
      amount,
      expiration: signal.expiration,
      openedAt: Date.now(),
      expiresAt: Date.now() + signal.expiration * 1000,
      status: 'pending',
      galeLevel,
      signal,
    };
    this.sequence.operations.push(op);
    this.events.onOperationCreate(op);
    this.events.onSequenceUpdate({ ...this.sequence });
 
    if (this.ctx.dryRun) {
      // Simula resultado após expiração
      window.setTimeout(() => this.simulateResolution(op.id), signal.expiration * 1000 + 200);
      this.transition({ kind: 'in_position', operationId: op.id });
      op.status = 'open';
      this.events.onOperationUpdate({ ...op });
      return;
    }
 
    try {
      const blitzOptions = await this.ctx.sdk.blitzOptions();
      const actives = blitzOptions.getActives();
      const active = actives.find((a: any) => a.id === this.ctx.activeId);
      if (!active) throw new Error(`Ativo ${this.ctx.activeId} não disponível em Blitz`);
 
      // Acha o expirationTime mais próximo do desejado
      const targetSec = signal.expiration;
      const expTime = active.expirationTimes.find((t: number) => t === targetSec) ?? active.expirationTimes[0];
 
      // Banca
      const balances = await this.ctx.sdk.balances();
      const balance = balances.getBalanceById(this.ctx.balanceId);
      if (!balance) throw new Error(`Banca ${this.ctx.balanceId} não encontrada`);
 
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
 
  // ── Resolução ──────────────────────────────────────────────────────────
  private onPositionUpdate(p: any): void {
    // Achamos a operação correspondente pelo brokerPositionId
    const op = this.sequence.operations.find(
      o => o.brokerPositionId !== undefined &&
           (o.brokerPositionId === p.id || o.brokerPositionId === p.externalId),
    );
    if (!op) return;
 
    // SDK marca posição como fechada com pnl. O nome exato do campo de status
    // varia por instrumento; nos exemplos da doc usa-se pnlNet/sellProfit pra
    // posições abertas e um estado "closed" pra finalizadas. Adaptamos:
    const closed = p.status === 'closed' || p.closeReason !== undefined;
    if (!closed) return;
 
    const pnl = typeof p.pnlNet === 'number' ? p.pnlNet : (p.profit ?? 0);
    op.pnl = pnl;
    op.status = pnl > 0 ? 'win' : 'loss';
    this.events.onOperationUpdate({ ...op });
 
    this.handleResolution(op.status, pnl);
  }
 
  /** Caminho do dry-run: simula um resultado pseudo-aleatório. */
  private simulateResolution(opId: string): void {
    const op = this.sequence.operations.find(o => o.id === opId);
    if (!op || op.status !== 'open') return;
 
    // Simulação ~50% win/loss com leve viés de acordo com a confidence
    const winChance = 0.45 + (op.signal.confidence / 1000);
    const win = Math.random() < winChance;
    const pnl = win ? op.amount * 0.85 : -op.amount;
    op.pnl = pnl;
    op.status = win ? 'win' : 'loss';
    this.events.onOperationUpdate({ ...op });
    this.handleResolution(op.status, pnl);
  }
 
  private handleResolution(status: 'win' | 'loss', pnl: number): void {
    if (status === 'win') {
      // Sequência venceu — reseta tudo, volta a analisar
      this.resetSequence();
      this.transition({ kind: 'analyzing' });
      return;
    }
 
    // Loss
    this.sequence.lossesInRow += 1;
    this.sequence.accumulatedLoss += Math.abs(pnl);
    this.events.onSequenceUpdate({ ...this.sequence });
 
    // Atingiu stop loss? (entrada inicial + maxGales = maxGales+1 operações)
    if (this.sequence.lossesInRow > this.ctx.config.maxGales) {
      const sl = computeStopLoss({
        entryValue: this.ctx.config.entryValue,
        multiplier: this.ctx.config.multiplier,
        maxGales: this.ctx.config.maxGales,
        balance: this.ctx.balance,
      });
      this.stop(
        'stop_loss_hit',
        `Sequência de ${this.sequence.lossesInRow} perdas atingida. Prejuízo: $ ${this.sequence.accumulatedLoss.toFixed(2)} (limite calculado: $ ${sl.maxLoss.toFixed(2)}).`,
      );
      return;
    }
 
    // Volta a analisar — próxima entrada será o gale, com direção travada
    this.transition({ kind: 'analyzing' });
  }
 
  private resetSequence(): void {
    this.sequence = { operations: [], lossesInRow: 0, accumulatedLoss: 0 };
    this.events.onSequenceUpdate({ ...this.sequence });
  }
 
  // ── Helpers ────────────────────────────────────────────────────────────
  private transition(next: BotState): void {
    this.state = next;
    this.events.onStateChange(next);
  }
 
  getState(): BotState { return this.state; }
  getSequence(): SequenceState { return this.sequence; }
  getLastSignal(): Signal | null { return this.lastSignal; }
}
 
// ── helpers ───────────────────────────────────────────────────────────────
function adaptCandle(c: any): Candle {
  // SDK Quadcode usa { open, max, min, close, from }
  return {
    open: c.open,
    high: c.max ?? c.high,
    low: c.min ?? c.low,
    close: c.close,
    time: c.from ?? c.time,
  };
}
 
function cryptoRandomId(): string {
  return crypto.getRandomValues(new Uint32Array(2)).join('-');
}
 
