import type { Direction, Expiration, Signal } from '../ai/engine.js';
 
export type OperationStatus =
  | 'analyzing'   // IA decidiu entrar mas ainda não enviou ordem
  | 'pending'     // ordem enviada à corretora, aguardando confirmação
  | 'open'        // confirmada, candle de expiração rolando
  | 'expiring'    // últimos 3s antes do vencimento
  | 'win'
  | 'loss'
  | 'error';
 
export interface OperationAnalysis {
  /** Score 0..100 — confiança da IA na entrada */
  confidence: number;
  /** Resumo curto em uma linha — ex: "EMA cruzou + RSI 28 + alta vol" */
  summary: string;
  /** Lista de sinais individuais que dispararam a entrada */
  signals: Array<{ label: string; weight: number }>;
}
 
export interface Operation {
  id: string;
  asset: string;
  direction: Direction;
  amount: number;
  expiration: Expiration;
  openedAt: number;
  expiresAt: number;
  status: OperationStatus;
  pnl?: number;
  galeLevel: number;
  signal: Signal;
  analysis: OperationAnalysis;
  brokerPositionId?: string | number;
  errorMessage?: string;
}
 
export type TakeProfitMode = 'absolute' | 'percent' | 'greens';
 
export interface TakeProfitConfig {
  mode: TakeProfitMode;
  /** Em $ se mode=absolute, em % se mode=percent, em count se mode=greens */
  value: number;
}
 
export type BotState =
  | { kind: 'idle' }
  | { kind: 'analyzing' }
  | { kind: 'waiting_signal'; lastConfidence: number }
  | { kind: 'placing_order' }
  | { kind: 'in_position'; operationId: string }
  | {
      kind: 'stopped';
      reason: 'stop_loss_hit' | 'take_profit_hit' | 'manual' | 'error';
      detail?: string;
    };
 
export interface SequenceState {
  operations: Operation[];
  lossesInRow: number;
  accumulatedLoss: number;
  lockedDirection?: Direction;
}
 
/** Acumulado da sessão atual do bot — usado pra avaliar take profit. */
export interface SessionStats {
  greensCount: number;
  totalPnl: number;
  startBalance: number;
}
