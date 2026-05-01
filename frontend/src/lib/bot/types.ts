import type { Direction, Expiration, Signal } from '../ai/engine.js';

export type OperationStatus =
  | 'pending'   // criada, aguardando confirmação da corretora
  | 'open'      // em curso, candle de expiração ainda rolando
  | 'win'
  | 'loss'
  | 'error';    // falha ao abrir (ex: corretora rejeitou)

export interface Operation {
  id: string;
  asset: string;
  direction: Direction;
  amount: number;
  expiration: Expiration;
  openedAt: number;       // epoch ms
  expiresAt: number;      // epoch ms
  status: OperationStatus;
  pnl?: number;           // só após resolver
  galeLevel: number;      // 0 = entrada inicial, 1 = primeiro gale, etc.
  signal: Signal;         // snapshot da análise da IA no momento da entrada
  brokerPositionId?: string | number;
  errorMessage?: string;
}

export type BotState =
  | { kind: 'idle' }
  | { kind: 'analyzing' }
  | { kind: 'waiting_signal'; lastConfidence: number }
  | { kind: 'placing_order' }
  | { kind: 'in_position'; operationId: string }
  | { kind: 'stopped'; reason: 'stop_loss_hit' | 'manual' | 'error'; detail?: string };

export interface SequenceState {
  /** Operações da sequência atual (entrada inicial + gales). Limpa ao vencer. */
  operations: Operation[];
  /** Quantas perdas consecutivas até agora. */
  lossesInRow: number;
  /** Total acumulado de perda na sequência atual. */
  accumulatedLoss: number;
  /** Direção da entrada inicial — gales mantêm a mesma direção. */
  lockedDirection?: Direction;
}
