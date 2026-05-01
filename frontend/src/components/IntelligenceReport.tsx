/**
 * IntelligenceReport — painel direito da BotScreen.
 *
 * Mostra:
 *   - Bot inativo: aguardando dados
 *   - Bot ativo procurando sinal: scanner + status
 *   - Bot com operação aberta: bloco visual com:
 *     • Header (ATIVO + valor)
 *     • Score de confiança + barra
 *     • Lista de sinais usados
 *     • Countdown grande
 */
import { useEffect, useState } from 'react';
import { Sparkles, Activity, TrendingUp, TrendingDown, Loader } from 'lucide-react';
import { theme as T } from '../lib/theme';
import type { Operation, BotState } from '../lib/bot/types';
import type { Signal } from '../lib/ai/engine';

interface IntelligenceReportProps {
  state: BotState;
  signal: Signal | null;
  activeOperation: Operation | null;
}

export function IntelligenceReport({ state, signal, activeOperation }: IntelligenceReportProps) {
  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={iconWrapStyle}>
          <Sparkles size={16} color={T.accent} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.text, letterSpacing: '0.04em' }}>
            RELATÓRIO DE INTELIGÊNCIA
          </div>
          <div style={{ fontSize: 10, color: T.textMute, letterSpacing: '0.08em', marginTop: 2 }}>
            LEITURA AO VIVO
          </div>
        </div>
      </div>

      <div style={contentStyle}>
        {renderContent(state, signal, activeOperation)}
      </div>
    </div>
  );
}

function renderContent(state: BotState, signal: Signal | null, op: Operation | null) {
  if (op && (op.status === 'analyzing' || op.status === 'pending' || op.status === 'open' || op.status === 'expiring')) {
    return <OpenOperationBlock op={op} />;
  }

  if (state.kind === 'analyzing' || state.kind === 'waiting_signal') {
    return <ScanningBlock signal={signal} state={state} />;
  }

  if (state.kind === 'placing_order') {
    return (
      <CenteredMessage
        icon={<Loader size={20} color={T.accent} />}
        title="Enviando ordem"
        subtitle="Validando entrada com a corretora"
      />
    );
  }

  if (state.kind === 'stopped') {
    const isWin = state.reason === 'take_profit_hit';
    return (
      <CenteredMessage
        icon={isWin
          ? <TrendingUp size={20} color={T.long} />
          : <Activity size={20} color={T.short} />
        }
        title={isWin ? 'Meta atingida' : 'Bot parado'}
        subtitle={state.detail ?? 'Aguardando reinício manual'}
        tone={isWin ? 'long' : 'short'}
      />
    );
  }

  return (
    <CenteredMessage
      icon={<Activity size={20} color={T.textMute} />}
      title="Bot inativo"
      subtitle="Aguardando dados de mercado..."
    />
  );
}

function OpenOperationBlock({ op }: { op: Operation }) {
  const remaining = useCountdown(op.expiresAt);
  const isCall = op.direction === 'CALL';
  const sideColor = isCall ? T.long : T.short;
  const sideLabel = isCall ? 'COMPRA' : 'VENDA';

  const statusLabel =
    op.status === 'analyzing' ? 'EM ANÁLISE' :
    op.status === 'pending'   ? 'ENVIANDO' :
    op.status === 'expiring'  ? 'EXPIRANDO' :
                                'OPERAÇÃO ABERTA';

  return (
    <div style={openOpStyle}>
      <div style={{
        ...statusBadgeStyle,
        background: op.status === 'analyzing' ? T.accentSoft : sideColor + '22',
        color:      op.status === 'analyzing' ? T.accent     : sideColor,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: op.status === 'analyzing' ? T.accent : sideColor,
          marginRight: 8,
          display: 'inline-block',
          boxShadow: `0 0 8px currentColor`,
          animation: 'pulse 1.4s ease-in-out infinite',
        }} />
        {statusLabel}
      </div>

      <div style={opHeaderStyle}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: '-0.02em' }}>
            {op.asset}
          </div>
          <div style={{
            fontSize: 11,
            color: T.textMute,
            letterSpacing: '0.08em',
            marginTop: 4,
          }}>
            BLITZ · {op.expiration}s
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            background: sideColor + '22',
            color: sideColor,
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}>
            {isCall ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {sideLabel}
          </div>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: T.text,
            marginTop: 8,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            ${op.amount.toFixed(2)}
          </div>
        </div>
      </div>

      <div style={analysisBlockStyle}>
        <div style={{ marginBottom: 16 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 10, letterSpacing: '0.12em', color: T.textMute }}>
              CONFIANÇA DA IA
            </span>
            <span style={{
              fontSize: 22,
              fontWeight: 800,
              color: T.accent,
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {op.analysis.confidence}%
            </span>
          </div>

          <div style={confidenceBarBgStyle}>
            <div style={{
              ...confidenceBarFillStyle,
              width: `${op.analysis.confidence}%`,
            }} />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            color: T.textMute,
            marginBottom: 8,
          }}>
            SINAIS DETECTADOS · {op.analysis.signals.length}
          </div>
          {op.analysis.signals.slice(0, 5).map((s, i) => (
            <div key={i} style={signalRowStyle}>
              <span style={{
                width: 14, height: 14, borderRadius: '50%',
                background: T.accentSoft,
                display: 'grid', placeItems: 'center',
                flexShrink: 0,
              }}>
                <svg width="8" height="8" viewBox="0 0 12 12">
                  <path d="M2 6 L5 9 L10 3" stroke={T.accent} strokeWidth="2" fill="none" strokeLinecap="round" />
                </svg>
              </span>
              <span style={{ flex: 1, fontSize: 12, color: T.text }}>
                {s.label}
              </span>
              <span style={{
                fontSize: 10,
                color: T.textMute,
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {Math.round(s.weight * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={countdownBlockStyle}>
        <div style={{ fontSize: 10, letterSpacing: '0.12em', color: T.textMute, marginBottom: 8 }}>
          TEMPO RESTANTE
        </div>
        <div style={{
          fontSize: 40,
          fontWeight: 800,
          color: remaining < 3000 ? T.warn : T.text,
          fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}>
          {formatCountdown(remaining)}
        </div>
      </div>
    </div>
  );
}

function ScanningBlock({ signal, state }: { signal: Signal | null; state: BotState }) {
  const confidence = state.kind === 'waiting_signal' ? state.lastConfidence : (signal?.confidence ?? 0);

  return (
    <div style={scanningBlockStyle}>
      <style>{`
        @keyframes radar-pulse {
          0%   { transform: scale(0.4); opacity: 1; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
      <div style={radarWrapStyle}>
        <div style={radarRingStyle} />
        <div style={{ ...radarRingStyle, animationDelay: '0.5s' }} />
        <div style={radarCenterStyle}>
          <Sparkles size={14} color={T.bg} />
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginTop: 24 }}>
        Analisando o mercado
      </div>
      <div style={{ fontSize: 12, color: T.textDim, marginTop: 4, textAlign: 'center', maxWidth: 220 }}>
        IA processando indicadores em tempo real
      </div>

      {confidence > 0 && (
        <div style={{ width: '100%', marginTop: 24 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            letterSpacing: '0.1em',
            color: T.textMute,
            marginBottom: 6,
          }}>
            <span>CONFIANÇA ATUAL</span>
            <span>{Math.round(confidence)}%</span>
          </div>
          <div style={confidenceBarBgStyle}>
            <div style={{
              ...confidenceBarFillStyle,
              width: `${confidence}%`,
              background: confidence >= 60 ? T.accent : T.textMute,
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

function CenteredMessage({
  icon, title, subtitle, tone,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  tone?: 'long' | 'short';
}) {
  return (
    <div style={centeredMessageStyle}>
      <div style={{
        ...iconWrapLargeStyle,
        background:
          tone === 'long'  ? T.longSoft :
          tone === 'short' ? T.shortSoft :
                             T.bgElev,
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginTop: 16 }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, color: T.textDim, marginTop: 4, textAlign: 'center' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

function useCountdown(expiresAt: number): number {
  const [remaining, setRemaining] = useState(() => Math.max(0, expiresAt - Date.now()));

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining(Math.max(0, expiresAt - Date.now()));
    }, 100);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  return remaining;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const mm = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const ss = (totalSec % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

const containerStyle = {
  background: T.panel,
  border: `1px solid ${T.border}`,
  borderRadius: 14,
  padding: 20,
  display: 'flex',
  flexDirection: 'column' as const,
  height: '100%',
  minHeight: 360,
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  paddingBottom: 16,
  borderBottom: `1px solid ${T.border}`,
  marginBottom: 16,
};

const iconWrapStyle = {
  width: 32,
  height: 32,
  borderRadius: 8,
  background: T.accentSoft,
  display: 'grid',
  placeItems: 'center',
};

const contentStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column' as const,
};

const openOpStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 16,
};

const statusBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '5px 10px',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.1em',
  borderRadius: 6,
  alignSelf: 'flex-start',
};

const opHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
};

const analysisBlockStyle = {
  background: T.bgElev,
  border: `1px solid ${T.border}`,
  borderRadius: 10,
  padding: 16,
};

const confidenceBarBgStyle = {
  width: '100%',
  height: 6,
  background: T.bgElev,
  borderRadius: 3,
  overflow: 'hidden' as const,
  border: `1px solid ${T.border}`,
};

const confidenceBarFillStyle = {
  height: '100%',
  background: `linear-gradient(90deg, ${T.accentDeep}, ${T.accent}, ${T.accentBright})`,
  transition: 'width 240ms ease-out',
  boxShadow: `0 0 8px ${T.accentDim}`,
};

const signalRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 0',
};

const countdownBlockStyle = {
  background: T.bgElev,
  border: `1px solid ${T.border}`,
  borderRadius: 10,
  padding: 16,
  textAlign: 'center' as const,
};

const scanningBlockStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
};

const radarWrapStyle = {
  position: 'relative' as const,
  width: 80,
  height: 80,
  display: 'grid',
  placeItems: 'center',
};

const radarRingStyle = {
  position: 'absolute' as const,
  inset: 0,
  borderRadius: '50%',
  border: `2px solid ${T.accent}`,
  animation: 'radar-pulse 2s ease-out infinite',
} as const;

const radarCenterStyle = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  background: T.accent,
  display: 'grid',
  placeItems: 'center',
  boxShadow: `0 0 16px ${T.accentDim}`,
  zIndex: 1,
};

const centeredMessageStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
};

const iconWrapLargeStyle = {
  width: 48,
  height: 48,
  borderRadius: 12,
  display: 'grid',
  placeItems: 'center',
} as const;
