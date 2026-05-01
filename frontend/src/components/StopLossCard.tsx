import { ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';
import { computeStopLoss } from '../lib/bot/stopLoss';

const T = {
  bg: '#0A0E14', panel: '#121821', panelHi: '#171E29',
  border: '#1F2733', text: '#E6EDF3', textDim: '#8B97A8', textMute: '#5C677A',
  accent: '#00E0B8', long: '#26D782', warn: '#F5A524', short: '#F0506E',
};

interface Props {
  entryValue: number;
  multiplier: number;
  maxGales: number;
  balance: number;
}

export function StopLossCard({ entryValue, multiplier, maxGales, balance }: Props) {
  const sl = computeStopLoss({ entryValue, multiplier, maxGales, balance });

  const palette =
    sl.severity === 'safe'    ? { bg: T.long  + '0F', border: T.long  + '55', text: T.long,  icon: <ShieldCheck size={18} />, label: 'RISCO BAIXO' } :
    sl.severity === 'caution' ? { bg: T.warn  + '12', border: T.warn  + '55', text: T.warn,  icon: <AlertTriangle size={18} />, label: 'ATENÇÃO' } :
                                { bg: T.short + '14', border: T.short + '55', text: T.short, icon: <ShieldAlert size={18} />, label: 'RISCO ALTO' };

  return (
    <div
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 12,
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header: severity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ color: palette.text, display: 'flex' }}>{palette.icon}</span>
        <span style={{
          fontSize: 10, letterSpacing: '0.12em', fontWeight: 700, color: palette.text,
        }}>
          STOP LOSS · {palette.label}
        </span>
      </div>

      {/* Valor principal */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: T.textDim, letterSpacing: '0.05em', marginBottom: 4 }}>
          Você pode perder até
        </div>
        <div style={{
          fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em',
          color: palette.text, fontFamily: '"JetBrains Mono", monospace',
          lineHeight: 1,
        }}>
          $ {sl.maxLoss.toFixed(2)}
        </div>
        <div style={{ fontSize: 12, color: T.textDim, marginTop: 6 }}>
          <span style={{ color: palette.text, fontWeight: 600 }}>{sl.maxLossPct.toFixed(1)}%</span>
          {' '}da sua banca
        </div>
      </div>

      {/* Barra visual */}
      <div style={{
        height: 4, background: T.bg, borderRadius: 2, overflow: 'hidden',
        marginBottom: 14,
      }}>
        <div style={{
          width: `${Math.min(100, sl.maxLossPct)}%`,
          height: '100%',
          background: palette.text,
          transition: 'width 200ms ease',
        }} />
      </div>

      {/* Detalhes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <Detail label="Perdas até stop" value={`${sl.lossesAcceptable}`} />
        <Detail label="Multiplicador" value={`${sl.multiplier.toFixed(1)}x`} />
        <Detail label="Banca após stop" value={`$ ${sl.balanceAfterStop.toFixed(2)}`} dim />
      </div>

      {/* Sequência expandida */}
      <details style={{ marginTop: 4 }}>
        <summary style={{
          cursor: 'pointer', fontSize: 11, color: T.textMute,
          letterSpacing: '0.05em', listStyle: 'none', userSelect: 'none',
        }}>
          ▸ ver sequência detalhada
        </summary>
        <div style={{
          marginTop: 8,
          background: T.bg,
          border: `1px solid ${T.border}`,
          borderRadius: 6,
          padding: '8px 10px',
          fontSize: 11,
          fontFamily: '"JetBrains Mono", monospace',
        }}>
          {sl.sequence.map(s => (
            <div key={s.galeLevel} style={{
              display: 'grid', gridTemplateColumns: '90px 1fr 1fr',
              gap: 8, color: T.textDim, padding: '2px 0',
            }}>
              <span>{s.galeLevel === 0 ? 'entrada' : `gale ${s.galeLevel}`}</span>
              <span style={{ color: T.text }}>$ {s.amount.toFixed(2)}</span>
              <span style={{ textAlign: 'right' }}>acum. $ {s.cumulative.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function Detail({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: T.textMute, letterSpacing: '0.05em', marginBottom: 2 }}>
        {label.toUpperCase()}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 600,
        color: dim ? T.textDim : T.text,
        fontFamily: '"JetBrains Mono", monospace',
      }}>
        {value}
      </div>
    </div>
  );
}
