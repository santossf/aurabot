import { ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';
import { theme as T } from '../lib/theme';

interface Props {
  /** Valor de stop loss em $ (já calculado: soma da progressão geométrica) */
  stopLoss: number;
  /** Banca atual em $ */
  balance: number;
  /** % da banca que o stop loss representa */
  stopLossPercent: number;
  /** Quantidade total de operações até o stop (entrada + perdas máximas) */
  losses: number;
  /** Multiplicador aplicado entre operações */
  multiplier: number;
  /** Valor da entrada inicial */
  entry: number;
}

export function StopLossCard({ stopLoss, balance, stopLossPercent, losses, multiplier, entry }: Props) {
  // Severidade baseada em % da banca
  const severity: 'safe' | 'caution' | 'danger' =
    stopLossPercent < 5  ? 'safe'    :
    stopLossPercent < 15 ? 'caution' :
                           'danger';

  const palette =
    severity === 'safe'    ? { bg: T.long  + '0F', border: T.long  + '55', text: T.long,  icon: <ShieldCheck size={18} />,    label: 'RISCO BAIXO' } :
    severity === 'caution' ? { bg: T.warn  + '12', border: T.warn  + '55', text: T.warn,  icon: <AlertTriangle size={18} />,  label: 'ATENÇÃO' } :
                             { bg: T.short + '14', border: T.short + '55', text: T.short, icon: <ShieldAlert size={18} />,    label: 'RISCO ALTO' };

  // Banca após o stop loss
  const balanceAfter = Math.max(0, balance - stopLoss);

  return (
    <div
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 12,
        padding: 14,
        marginBottom: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ color: palette.text, display: 'inline-flex' }}>
          {palette.icon}
        </span>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: palette.text,
        }}>
          STOP LOSS · {palette.label}
        </span>
      </div>

      <div style={{ fontSize: 11, color: T.textDim, marginBottom: 4 }}>
        Você pode perder até
      </div>
      <div style={{
        fontSize: 28,
        fontWeight: 800,
        color: palette.text,
        fontFamily: 'JetBrains Mono, monospace',
        letterSpacing: '-0.02em',
        marginBottom: 4,
      }}>
        $ {stopLoss.toFixed(2)}
      </div>
      <div style={{ fontSize: 12, color: palette.text, fontWeight: 600, marginBottom: 12 }}>
        {stopLossPercent.toFixed(1)}% da sua banca
      </div>

      {/* Barra de progresso visual */}
      <div style={{
        height: 4,
        background: T.bgElev,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 14,
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(100, stopLossPercent)}%`,
          background: palette.text,
          transition: 'width 240ms ease-out',
        }} />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        paddingTop: 10,
        borderTop: `1px solid ${palette.border}`,
      }}>
        <div>
          <div style={{ fontSize: 9, color: T.textMute, letterSpacing: '0.1em' }}>
            PERDAS ATÉ STOP
          </div>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: T.text,
            fontFamily: 'JetBrains Mono, monospace',
            marginTop: 2,
          }}>
            {losses}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: T.textMute, letterSpacing: '0.1em' }}>
            MULTIPLICADOR
          </div>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: T.text,
            fontFamily: 'JetBrains Mono, monospace',
            marginTop: 2,
          }}>
            {multiplier.toFixed(1)}x
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 9, color: T.textMute, letterSpacing: '0.1em' }}>
          BANCA APÓS STOP
        </div>
        <div style={{
          fontSize: 14,
          fontWeight: 700,
          color: T.text,
          fontFamily: 'JetBrains Mono, monospace',
          marginTop: 2,
        }}>
          $ {balanceAfter.toFixed(2)}
        </div>
      </div>

      <details style={{ marginTop: 10, cursor: 'pointer' }}>
        <summary style={{
          fontSize: 10,
          color: palette.text,
          letterSpacing: '0.06em',
          listStyle: 'none',
        }}>
          ▸ ver sequência detalhada
        </summary>
        <div style={{
          marginTop: 8,
          padding: 8,
          background: T.bgElev,
          borderRadius: 6,
          fontSize: 11,
          color: T.textDim,
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {Array.from({ length: losses }).map((_, i) => {
            const amount = entry * Math.pow(multiplier, i);
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span>{i === 0 ? 'Entrada' : `Gale ${i}`}</span>
                <span style={{ color: T.text }}>${amount.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}
