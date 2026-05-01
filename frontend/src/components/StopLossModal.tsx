import { ShieldAlert, RotateCcw, X } from 'lucide-react';

const T = {
  bg: '#0A0E14', bgElev: '#0F141C', panel: '#121821',
  border: '#1F2733', text: '#E6EDF3', textDim: '#8B97A8', textMute: '#5C677A',
  short: '#F0506E', accent: '#00E0B8', long: '#26D782',
};

interface Props {
  open: boolean;
  detail?: string;
  accumulatedLoss: number;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function StopLossModal({ open, detail, accumulatedLoss, onConfirm, onDismiss }: Props) {
  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(5, 8, 12, 0.78)',
      backdropFilter: 'blur(6px)',
      display: 'grid', placeItems: 'center',
      padding: 24,
    }}>
      <div style={{
        background: T.panel,
        border: `1px solid ${T.short}55`,
        borderRadius: 14,
        maxWidth: 460, width: '100%',
        padding: 28,
        boxShadow: `0 30px 80px -20px ${T.short}66`,
        position: 'relative',
      }}>
        <button onClick={onDismiss} style={{
          all: 'unset', cursor: 'pointer',
          position: 'absolute', top: 14, right: 14,
          color: T.textMute, padding: 4,
        }}>
          <X size={16} />
        </button>

        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: T.short + '14',
          border: `1px solid ${T.short}55`,
          display: 'grid', placeItems: 'center',
          color: T.short,
          marginBottom: 16,
        }}>
          <ShieldAlert size={24} />
        </div>

        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>
          Stop loss atingido
        </h2>
        <p style={{ margin: 0, color: T.textDim, fontSize: 13, lineHeight: 1.6 }}>
          O bot foi pausado automaticamente após atingir o limite de perdas consecutivas.
          A sequência foi interrompida para proteger sua banca.
        </p>

        {detail && (
          <div style={{
            marginTop: 14,
            padding: '10px 12px',
            background: T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            fontSize: 12,
            color: T.textDim,
            lineHeight: 1.5,
          }}>
            {detail}
          </div>
        )}

        <div style={{
          marginTop: 16,
          padding: '12px 14px',
          background: T.short + '0F',
          borderRadius: 8,
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        }}>
          <span style={{ fontSize: 12, color: T.textDim }}>Prejuízo na sequência</span>
          <span style={{
            fontSize: 18, fontWeight: 700, color: T.short,
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            $ {accumulatedLoss.toFixed(2)}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onDismiss} style={{
            all: 'unset', cursor: 'pointer',
            flex: 1,
            padding: '12px 0', textAlign: 'center',
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            color: T.textDim,
            fontSize: 12, fontWeight: 600,
            letterSpacing: '0.05em',
          }}>
            FECHAR
          </button>
          <button onClick={onConfirm} style={{
            all: 'unset', cursor: 'pointer',
            flex: 1.4,
            padding: '12px 0', textAlign: 'center',
            background: `linear-gradient(135deg, ${T.accent}, ${T.long})`,
            color: T.bg,
            borderRadius: 8,
            fontSize: 12, fontWeight: 700,
            letterSpacing: '0.05em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <RotateCcw size={13} /> REINICIAR SEQUÊNCIA
          </button>
        </div>
      </div>
    </div>
  );
}
