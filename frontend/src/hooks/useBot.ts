import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClientSdk } from '@quadcode-tech/client-sdk-js';
import { BotEngine, type BotConfig, type BotContext } from '../lib/bot/engine';
import type { BotState, Operation, SequenceState } from '../lib/bot/types';
import type { Signal } from '../lib/ai/engine';

interface UseBotArgs {
  sdk: ClientSdk | null;
  activeId: number;
  assetSymbol: string;
  balanceId: number;
  balance: number;
  config: BotConfig;
  /** Em dev/preview, defina true para não chamar a corretora de verdade. */
  dryRun?: boolean;
}

export function useBot(args: UseBotArgs) {
  const { sdk, activeId, assetSymbol, balanceId, balance, config, dryRun } = args;

  const [state, setState] = useState<BotState>({ kind: 'idle' });
  const [signal, setSignal] = useState<Signal | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [sequence, setSequence] = useState<SequenceState>({
    operations: [], lossesInRow: 0, accumulatedLoss: 0,
  });
  const [error, setError] = useState<Error | null>(null);

  const engineRef = useRef<BotEngine | null>(null);

  // Re-cria o engine quando contexto crítico muda. Config muda dentro do engine
  // sem reset (pra UX fluida quando o usuário mexe em sliders com bot parado).
  useEffect(() => {
    if (!sdk) return;

    const ctx: BotContext = {
      sdk, activeId, assetSymbol, balanceId, balance, config, dryRun,
    };

    const engine = new BotEngine(ctx, {
      onStateChange:      s => setState(s),
      onSignalUpdate:     sig => setSignal(sig),
      onOperationCreate:  op => setOperations(ops => [op, ...ops].slice(0, 100)),
      onOperationUpdate:  updated => setOperations(ops =>
        ops.map(o => o.id === updated.id ? updated : o)
      ),
      onSequenceUpdate:   seq => setSequence(seq),
      onError:            err => setError(err),
    });

    engineRef.current = engine;
    return () => {
      // Garante shutdown limpo ao desmontar/trocar de ativo
      try { engine.stop('manual'); } catch { /* ignore */ }
      engineRef.current = null;
    };
  }, [sdk, activeId, assetSymbol, balanceId, dryRun]);

  // Atualiza config no engine sem reiniciá-lo (acessamos a referência interna).
  // Como o engine lê config.entryValue etc. em tempo de uso, ele sempre vê o
  // valor mais recente — basta atribuir.
  useEffect(() => {
    if (engineRef.current) {
      (engineRef.current as any).ctx.config = config;
      (engineRef.current as any).ctx.balance = balance;
    }
  }, [config, balance]);

  const actions = useMemo(() => ({
    start: () => engineRef.current?.start().catch(setError),
    stop:  () => engineRef.current?.stop('manual'),
    acknowledgeStopAndReset: () => engineRef.current?.acknowledgeStopAndReset(),
  }), []);

  return { state, signal, operations, sequence, error, actions };
}
