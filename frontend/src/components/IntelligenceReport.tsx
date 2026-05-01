import { Brain, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import type { Signal } from '../lib/ai/engine';
import type { Operation, BotState } from '../lib/bot/types';
import { thresholdFor, type Profile } from '../lib/ai/engine';

const T = {
  bg: '#0A0E14', bgElev: '#0F141C', panel: '#121821', panelHi: '#171E29',
  border: '#1F2733', text: '#E6EDF3', textDim: '#8B97A8', textMute: '#5C677A',
  accent: '#00E0B8', accentDim: '#00E0B833',
  long: '#26D782', warn: '#F5A524', short: '#F0506E',
};

interface Props {
  liveSignal: Signal | null;
  openOperation: Operation | null;
  state: BotState;
  profile: Profile;
}

/**
 * Estratégia de exibição:
 *   - Se há operação aberta → mostra o snapshot do sinal QUE FUNDAMENTOU a entrada
 *   - Se não há operação aberta → mostra a leitura ao vivo da IA
 * O usuário sempre tem contexto: o que motivou a entrada atual ou o que a IA
 * está pensando agora.
 */
export function IntelligenceReport({ liveSignal, openOperation, state, profile }: Props) {
  const showingFor = openOperation ? 'in_position' : 'live';
  const signal = openOperation?.signal ?? liveSignal;
  const threshold = thresholdFor(profile);

  return (
    <div style={{
      background: T.bgElev,
      borderLeft: `1px solid ${T.border}`,
      borderTop: `1px solid ${T.border}`,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      width: 320,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: `linear-gradient(135deg, ${T.accent}, ${T.accent}66)`,
          display: 'grid', placeItems: 'center',
          boxShadow: `0 0 12px ${T.accentDim}`,
        }}>
          <Brain size={14} color={T.bg} strokeWidth={2.5} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{
            margin: 0, fontSize: 11, letterSpacing: '0.12em',
            color: T.textDim, fontWeight: 600,
          }}>
            RELATÓRIO DE INTELIGÊNCIA
          </h3>
          <span style={{ fontSize: 10, color: T.textMute, letterSpacing: '0.05em' }}>
            {showingFor === 'in_position' ? 'OPERAÇÃO EM CURSO' : 'LEITURA AO VIVO'}
          </span>
        </div>
      </div>

      <div style={{ padding: 14, overflowY: 'auto', flex: 1 }}>
        {!signal ? (
          <Empty />
        ) : (
          <Body signal={signal} threshold={threshold} state={state} openOp={openOperation} />
        )}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div style={{ color: T.textMute, fontSize: 12, textAlign: 'center', padding: '40px 16px' }}>
      Aguardando dados de mercado...
    </div>
  );
}

function Body({ signal, threshold, state, openOp }:
  { signal: Signal; threshold: number; state: BotState; openOp: Operation | null }
) {
  const hasDirection = signal.direction !== null;
  const meetsThreshold = signal.confidence >= threshold;

  return (
    <>
      {/* Verdicto */}
      <Verdict signal={signal} />

      {/* Confiança vs threshold */}
      <Confidence value={signal.confidence} threshold={threshold} />

      {/* Estado / decisão */}
      <Decision
        hasDirection={hasDirection}
        meetsThreshold={meetsThreshold}
        threshold={threshold}
        confidence={signal.confidence}
        state={state}
        openOp={openOp}
      />

      {/* Métricas */}
      <Section title="Indicadores">
        <Metrics signal={signal} />
      </Section>

      {/* Razões */}
      <Section title="Fatores avaliados">
        <Reasons signal={signal} />
      </Section>

      {/* Expiração escolhida */}
      <Section title="Expiração escolhida pela IA">
        <ExpirationExplain signal={signal} />
      </Section>
    </>
  );
}

function Verdict({ signal }: { signal: Signal }) {
  const color =
    signal.direction === 'CALL' ? T.long :
    signal.direction === 'PUT'  ? T.short :
                                   T.textDim;
  const icon =
    signal.direction === 'CALL' ? <TrendingUp size={20} /> :
    signal.direction === 'PUT'  ? <TrendingDown size={20} /> :
                                   <Minus size={20} />;
  const label =
    signal.direction === 'CALL' ? 'COMPRA (CALL)' :
    signal.direction === 'PUT'  ? 'VENDA (PUT)'   :
                                   'NEUTRO';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      background: color + '14',
      border: `1px solid ${color}44`,
      borderRadius: 8,
      marginBottom: 14,
    }}>
      <span style={{ color }}>{icon}</span>
      <div>
        <div style={{ fontSize: 10, color: T.textMute, letterSpacing: '0.08em' }}>VEREDICTO</div>
        <div style={{ fontSize: 14, fontWeight: 700, color, letterSpacing: '0.02em' }}>{label}</div>
      </div>
    </div>
  );
}

function Confidence({ value, threshold }: { value: number; threshold: number }) {
  const pct = Math.min(100, value);
  const above = value >= threshold;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 11, marginBottom: 6,
      }}>
        <span style={{ color: T.textDim, letterSpacing: '0.05em' }}>CONFIANÇA</span>
        <span style={{
          color: above ? T.accent : T.textDim,
          fontWeight: 700,
          fontFamily: '"JetBrains Mono", monospace',
        }}>
          {value.toFixed(0)} / 100
        </span>
      </div>
      <div style={{
        position: 'relative',
        height: 8, background: T.panel,
        borderRadius: 4, overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: above ? T.accent : T.textMute,
          transition: 'width 200ms ease',
        }} />
        {/* Marcador do threshold */}
        <div style={{
          position: 'absolute', top: -2, bottom: -2,
          left: `${threshold}%`, width: 1,
          background: T.warn,
        }} />
      </div>
      <div style={{
        marginTop: 4, fontSize: 10, color: T.textMute,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Limite p/ entrar: <b style={{ color: T.warn }}>{threshold}</b></span>
        <span>{above ? 'ACIMA do limite' : 'abaixo do limite'}</span>
      </div>
    </div>
  );
}

function Decision({
  hasDirection, meetsThreshold, threshold, confidence, state, openOp,
}: {
  hasDirection: boolean; meetsThreshold: boolean; threshold: number;
  confidence: number; state: BotState; openOp: Operation | null;
}) {
  let text = '';
  let color = T.textDim;

  if (openOp) {
    text = `Operação aberta às ${fmtTime(openOp.openedAt)} — aguardando expiração.`;
    color = T.accent;
  } else if (state.kind === 'idle' || state.kind === 'stopped') {
    text = 'Bot inativo. Inicie pelo painel à direita.';
  } else if (state.kind === 'placing_order') {
    text = 'Enviando ordem para a corretora...';
    color = T.accent;
  } else if (!hasDirection) {
    text = 'Sem direção clara. Mercado lateral ou indicadores divergentes.';
  } else if (!meetsThreshold) {
    text = `Sinal abaixo do limite (${confidence.toFixed(0)} < ${threshold}). Aguardando confirmação.`;
    color = T.warn;
  } else {
    text = 'Pronto para entrar na próxima oportunidade.';
    color = T.accent;
  }

  return (
    <div style={{
      padding: '10px 12px',
      background: T.bg,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      marginBottom: 18,
      fontSize: 12,
      color, lineHeight: 1.5,
      display: 'flex', alignItems: 'flex-start', gap: 8,
    }}>
      <Activity size={13} style={{ marginTop: 2, flexShrink: 0 }} />
      <span>{text}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{
        margin: '0 0 8px',
        fontSize: 10, letterSpacing: '0.12em',
        color: T.textMute, fontWeight: 600,
      }}>
        {title.toUpperCase()}
      </h4>
      {children}
    </div>
  );
}

function Metrics({ signal }: { signal: Signal }) {
  const m = signal.metrics;
  const items: { label: string; value: string }[] = [];
  if (m.rsi !== undefined)     items.push({ label: 'RSI(14)',  value: m.rsi.toFixed(1) });
  if (m.emaShort !== undefined) items.push({ label: 'EMA 5',    value: m.emaShort.toFixed(4) });
  if (m.emaLong !== undefined)  items.push({ label: 'EMA 21',   value: m.emaLong.toFixed(4) });
  if (m.atr !== undefined)      items.push({ label: 'ATR(14)',  value: m.atr.toFixed(4) });
  if (m.momentum !== undefined) items.push({ label: 'Momentum', value: m.momentum.toFixed(4) });

  if (items.length === 0) {
    return <div style={{ color: T.textMute, fontSize: 11 }}>—</div>;
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr',
      gap: 6,
      fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
    }}>
      {items.map(i => (
        <div key={i.label} style={{
          display: 'flex', justifyContent: 'space-between',
          padding: '4px 8px',
          background: T.panel,
          borderRadius: 4,
        }}>
          <span style={{ color: T.textMute }}>{i.label}</span>
          <span style={{ color: T.text }}>{i.value}</span>
        </div>
      ))}
    </div>
  );
}

function Reasons({ signal }: { signal: Signal }) {
  if (signal.reasons.length === 0) {
    return <div style={{ color: T.textMute, fontSize: 11 }}>—</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {signal.reasons.map((r, i) => {
        const color =
          r.side === 'CALL'    ? T.long :
          r.side === 'PUT'     ? T.short :
                                  T.textMute;
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 11,
            padding: '6px 8px',
            background: r.weight > 0 ? color + '0F' : 'transparent',
            border: `1px solid ${r.weight > 0 ? color + '33' : T.border}`,
            borderRadius: 6,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: color, flexShrink: 0,
            }} />
            <span style={{ flex: 1, color: T.text }}>{r.label}</span>
            {r.weight > 0 && (
              <span style={{
                color: T.textMute, fontSize: 10,
                fontFamily: '"JetBrains Mono", monospace',
              }}>
                +{(r.weight * 100).toFixed(0)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExpirationExplain({ signal }: { signal: Signal }) {
  const atr = signal.metrics.atr;
  const ema = signal.metrics.emaLong;
  const volPct = atr && ema ? (atr / ema) * 100 : null;

  const label =
    signal.expiration === 5  ? 'alta volatilidade' :
    signal.expiration === 10 ? 'volatilidade moderada' :
                                'baixa volatilidade';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      background: T.panel,
      border: `1px solid ${T.border}`,
      borderRadius: 6,
    }}>
      <div style={{
        fontSize: 22, fontWeight: 800,
        color: T.accent, fontFamily: '"JetBrains Mono", monospace',
      }}>
        {signal.expiration}s
      </div>
      <div style={{ flex: 1, fontSize: 11, color: T.textDim, lineHeight: 1.5 }}>
        Mercado em <b style={{ color: T.text }}>{label}</b>
        {volPct !== null && <> (ATR ≈ {volPct.toFixed(2)}% do preço)</>}.
      </div>
    </div>
  );
}

function fmtTime(epoch: number): string {
  const d = new Date(epoch);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
