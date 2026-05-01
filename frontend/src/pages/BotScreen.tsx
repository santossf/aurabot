/**
 * ============================================================================
 * BOT SCREEN — versão reformulada com IA, histórico de operações e relatório
 * ----------------------------------------------------------------------------
 * Layout (desktop):
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │ Header: ativo + ticker + stats                                        │
 *   ├─────────────────────────┬──────────┬──────────────┬──────────────────┤
 *   │                         │  Lista   │              │                  │
 *   │       GRÁFICO           │   de     │  Controle    │                  │
 *   │       (1m candles)      │ ativos   │   do Bot     │                  │
 *   │                         │          │              │                  │
 *   ├─────────────────────────┴──────────┤  + StopLoss  │   Relatório de   │
 *   │   ÚLTIMAS OPERAÇÕES (tabela)       │     Card     │   Inteligência   │
 *   │                                    │              │                  │
 *   └────────────────────────────────────┴──────────────┴──────────────────┘
 * ============================================================================
 */
import { useEffect, useMemo, useState } from 'react';
import type { ClientSdk } from '@quadcode-tech/client-sdk-js';
import { ArrowLeft, Bot, Play, Square, Sparkles, Wallet } from 'lucide-react';

import { useBot } from '../hooks/useBot';
import type { Profile } from '../lib/ai/engine';
import { StopLossCard } from '../components/StopLossCard';
import { OperationsLog } from '../components/OperationsLog';
import { IntelligenceReport } from '../components/IntelligenceReport';
import { StopLossModal } from '../components/StopLossModal';

const T = {
  bg: '#0A0E14', bgElev: '#0F141C', panel: '#121821', panelHi: '#171E29',
  border: '#1F2733', text: '#E6EDF3', textDim: '#8B97A8', textMute: '#5C677A',
  accent: '#00E0B8', accentDim: '#00E0B833',
  long: '#26D782', warn: '#F5A524', short: '#F0506E',
};

interface Props {
  sdk: ClientSdk | null;
  onBack: () => void;
}

export function BotScreen({ sdk, onBack }: Props) {
  // ── Seleção de ativo ────────────────────────────────────────────────────
  // TODO: substituir por sdk.actives() / blitzOptions.getActives()
  // Por ora, hardcoded para mockar a UI.
  const [activeId, setActiveId] = useState(1);
  const [assetSymbol, setAssetSymbol] = useState('EURUSD');

  // ── Banca ──────────────────────────────────────────────────────────────
  // TODO: pegar de sdk.balances().getBalances() — usar real ou demo
  const balanceId = 0;
  const balance = 1250;

  // ── Configuração do bot ────────────────────────────────────────────────
  const [profile, setProfile] = useState<Profile>('moderado');
  const [config, setConfig] = useState({
    profile,
    entryValue: 31.25,    // 2.5% da banca
    takeProfit: 0.8,
    maxGales: 2,
    multiplier: 2.2,
  });

  // sincroniza profile na config
  useEffect(() => { setConfig(c => ({ ...c, profile })); }, [profile]);

  // ── Bot engine ─────────────────────────────────────────────────────────
  const { state, signal, operations, sequence, actions } = useBot({
    sdk, activeId, assetSymbol, balanceId, balance,
    config,
    dryRun: !sdk, // se SDK não disponível, simula
  });

  const isRunning = state.kind !== 'idle' && state.kind !== 'stopped';
  const stopLossHit = state.kind === 'stopped' && state.reason === 'stop_loss_hit';

  const openOp = useMemo(
    () => operations.find(o => o.status === 'open' || o.status === 'pending') ?? null,
    [operations],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: T.bg }}>
      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <Topbar onBack={onBack} assetSymbol={assetSymbol} balance={balance} />

      {/* ── Main grid ───────────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 360px 320px',
        gridTemplateRows: 'minmax(0, 1.4fr) minmax(0, 1fr)',
        minHeight: 0,
      }}>
        {/* Coluna 1, linha 1: Gráfico */}
        <ChartArea
          assetSymbol={assetSymbol}
          activeId={activeId}
          state={state}
          signal={signal}
        />

        {/* Coluna 1, linha 2: Operações */}
        <div style={{ gridColumn: '1', gridRow: '2' }}>
          <OperationsLog operations={operations} />
        </div>

        {/* Coluna 2, linhas 1-2: Controle do bot */}
        <div style={{
          gridColumn: '2', gridRow: '1 / span 2',
          background: T.bgElev,
          borderLeft: `1px solid ${T.border}`,
          overflowY: 'auto',
        }}>
          <BotControl
            profile={profile}
            setProfile={setProfile}
            config={config}
            setConfig={setConfig}
            balance={balance}
            isRunning={isRunning}
            onStart={actions.start}
            onStop={actions.stop}
          />
        </div>

        {/* Coluna 3, linhas 1-2: Relatório de Inteligência */}
        <div style={{ gridColumn: '3', gridRow: '1 / span 2' }}>
          <IntelligenceReport
            liveSignal={signal}
            openOperation={openOp}
            state={state}
            profile={profile}
          />
        </div>
      </main>

      {/* Modal de stop loss */}
      <StopLossModal
        open={stopLossHit}
        detail={state.kind === 'stopped' ? state.detail : undefined}
        accumulatedLoss={sequence.accumulatedLoss}
        onConfirm={() => { actions.acknowledgeStopAndReset(); actions.start(); }}
        onDismiss={actions.acknowledgeStopAndReset}
      />
    </div>
  );
}

// ─── Subcomponentes ────────────────────────────────────────────────────────

function Topbar({ onBack, assetSymbol, balance }:
  { onBack: () => void; assetSymbol: string; balance: number }
) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 20px',
      borderBottom: `1px solid ${T.border}`,
      background: T.bgElev,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={onBack} style={{
          all: 'unset', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          color: T.textDim, fontSize: 13,
          padding: '6px 10px',
          borderRadius: 6,
        }}>
          <ArrowLeft size={14} /> Voltar
        </button>
        <div style={{ height: 20, width: 1, background: T.border }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: `linear-gradient(135deg, ${T.accent}, ${T.accent}66)`,
            display: 'grid', placeItems: 'center',
            boxShadow: `0 0 14px ${T.accentDim}`,
          }}>
            <Bot size={14} color={T.bg} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{assetSymbol}</div>
            <div style={{ fontSize: 10, color: T.textMute, letterSpacing: '0.08em' }}>BLITZ OPTIONS</div>
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 12px',
        background: T.panel,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        fontSize: 12,
      }}>
        <Wallet size={13} color={T.textDim} />
        <span style={{ color: T.textDim }}>Banca</span>
        <span style={{ fontWeight: 700, color: T.accent, fontFamily: '"JetBrains Mono", monospace' }}>
          $ {balance.toFixed(2)}
        </span>
      </div>
    </header>
  );
}

function ChartArea({ assetSymbol, activeId, state, signal }: any) {
  // Placeholder do gráfico — em produção, plugar o componente Chart
  // (que usa lightweight-charts + sdk.realTimeChartDataLayer).
  return (
    <div style={{
      gridColumn: '1', gridRow: '1',
      background: T.bg,
      display: 'grid', placeItems: 'center',
      color: T.textMute,
      borderRight: `1px solid ${T.border}`,
      position: 'relative',
    }}>
      <div style={{ textAlign: 'center', fontSize: 12 }}>
        [ Gráfico de candles 1s ]
        <div style={{ marginTop: 8, fontSize: 10 }}>
          Plugar &lt;Chart activeId={activeId} candleSize={1} /&gt; aqui
        </div>
      </div>

      {/* Overlay de status do bot */}
      <div style={{
        position: 'absolute', top: 14, left: 14,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px',
        background: T.bgElev + 'CC',
        backdropFilter: 'blur(6px)',
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        fontSize: 11,
        color: T.textDim,
        letterSpacing: '0.05em',
      }}>
        <BotStatusDot state={state} />
        {labelForState(state, signal)}
      </div>
    </div>
  );
}

function BotStatusDot({ state }: { state: any }) {
  const color =
    state.kind === 'idle'         ? T.textMute :
    state.kind === 'stopped'      ? T.short :
    state.kind === 'in_position'  ? T.warn :
                                     T.accent;
  const animated = state.kind !== 'idle' && state.kind !== 'stopped';
  return (
    <span style={{ position: 'relative', width: 8, height: 8 }}>
      {animated && (
        <span style={{
          position: 'absolute', inset: -3,
          background: color, borderRadius: '50%',
          opacity: 0.4,
          animation: 'pulse 1.6s infinite',
        }} />
      )}
      <span style={{
        position: 'absolute', inset: 0,
        background: color, borderRadius: '50%',
      }} />
    </span>
  );
}

function labelForState(state: any, signal: any): string {
  switch (state.kind) {
    case 'idle':           return 'BOT INATIVO';
    case 'analyzing':      return 'ANALISANDO MERCADO';
    case 'waiting_signal': return `AGUARDANDO SINAL (${state.lastConfidence?.toFixed(0) ?? 0})`;
    case 'placing_order':  return 'ENVIANDO ORDEM';
    case 'in_position':    return 'OPERAÇÃO EM CURSO';
    case 'stopped':        return state.reason === 'stop_loss_hit' ? 'STOP LOSS ATINGIDO' : 'BOT PARADO';
    default:               return '';
  }
}

// ─── Painel de controle do bot (versão refatorada) ─────────────────────────

interface BotControlProps {
  profile: Profile;
  setProfile: (p: Profile) => void;
  config: any;
  setConfig: (c: any) => void;
  balance: number;
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
}

function BotControl({
  profile, setProfile, config, setConfig, balance, isRunning, onStart, onStop,
}: BotControlProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{
        padding: '14px 16px',
        borderBottom: `1px solid ${T.border}`,
      }}>
        <h3 style={{
          margin: 0, fontSize: 11, letterSpacing: '0.12em',
          color: T.textDim, fontWeight: 600,
        }}>
          CONTROLE DO BOT
        </h3>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Stop loss em destaque (PRIMEIRO ITEM, intencionalmente) */}
        <StopLossCard
          entryValue={config.entryValue}
          multiplier={config.multiplier}
          maxGales={config.maxGales}
          balance={balance}
        />

        {/* Perfil */}
        <FieldGroup label="Perfil de Risco">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {(['conservador', 'moderado', 'ousado'] as Profile[]).map(p => (
              <button
                key={p}
                onClick={() => setProfile(p)}
                disabled={isRunning}
                style={{
                  all: 'unset',
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                  textAlign: 'center',
                  padding: '8px 4px',
                  borderRadius: 6,
                  fontSize: 11, fontWeight: 600,
                  textTransform: 'capitalize',
                  background: profile === p ? T.accent + '14' : T.panel,
                  border: `1px solid ${profile === p ? T.accent + '55' : T.border}`,
                  color: profile === p ? T.accent : T.textDim,
                  opacity: isRunning ? 0.5 : 1,
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </FieldGroup>

        {/* Campos numéricos */}
        <FieldGroup label="Valor de entrada">
          <NumberField
            value={config.entryValue}
            onChange={v => setConfig({ ...config, entryValue: v })}
            unit="$" step={0.5}
            disabled={isRunning}
          />
        </FieldGroup>

        <FieldGroup label="Quantidade máxima de gales">
          <NumberField
            value={config.maxGales}
            onChange={v => setConfig({ ...config, maxGales: Math.max(0, Math.round(v)) })}
            unit="" step={1}
            disabled={isRunning}
            integer
          />
        </FieldGroup>

        <FieldGroup label="Multiplicador pós loss">
          <NumberField
            value={config.multiplier}
            onChange={v => setConfig({ ...config, multiplier: Math.max(1, v) })}
            unit="x" step={0.1}
            disabled={isRunning}
          />
        </FieldGroup>
      </div>

      {/* CTA */}
      <div style={{ marginTop: 'auto', padding: 16 }}>
        <button
          onClick={isRunning ? onStop : onStart}
          style={{
            all: 'unset', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', boxSizing: 'border-box',
            padding: '14px 0', textAlign: 'center',
            background: isRunning ? T.short : `linear-gradient(135deg, ${T.accent}, ${T.long})`,
            color: T.bg,
            fontWeight: 700, letterSpacing: '0.05em', fontSize: 12,
            borderRadius: 10,
            boxShadow: isRunning ? `0 0 24px ${T.short}55` : `0 0 24px ${T.accentDim}`,
          }}
        >
          {isRunning
            ? <><Square size={13} fill={T.bg} /> PARAR BOT</>
            : <><Play size={13} fill={T.bg} /> INICIAR OPERAÇÕES</>
          }
        </button>
      </div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 11, color: T.textDim,
        marginBottom: 6, letterSpacing: '0.02em',
      }}>{label}</label>
      {children}
    </div>
  );
}

function NumberField({
  value, onChange, unit, step, disabled, integer,
}: {
  value: number; onChange: (v: number) => void; unit: string; step: number;
  disabled?: boolean; integer?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      background: T.panel,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      padding: '0 4px 0 12px',
      opacity: disabled ? 0.5 : 1,
    }}>
      <input
        type="number"
        value={integer ? Math.round(value) : value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        disabled={disabled}
        step={step}
        style={{
          flex: 1,
          background: 'transparent', border: 'none', outline: 'none',
          color: T.text, fontSize: 14, fontWeight: 600,
          fontFamily: '"JetBrains Mono", monospace',
          padding: '10px 0', width: '100%', minWidth: 0,
        }}
      />
      {unit && <span style={{ color: T.textMute, fontSize: 11, marginRight: 8 }}>{unit}</span>}
      <div style={{ display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${T.border}` }}>
        <button onClick={() => onChange(value + step)} disabled={disabled} style={stepBtn(true)}>+</button>
        <button onClick={() => onChange(Math.max(0, value - step))} disabled={disabled} style={stepBtn(false)}>−</button>
      </div>
    </div>
  );
}

function stepBtn(top: boolean): React.CSSProperties {
  return {
    all: 'unset', cursor: 'pointer',
    width: 28, height: 22,
    display: 'grid', placeItems: 'center',
    color: T.textDim, fontSize: 14, fontWeight: 700,
    borderBottom: top ? `1px solid ${T.border}` : 'none',
  };
}
