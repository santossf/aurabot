import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, CheckCircle2, XCircle, Loader2, AlertCircle, Clock } from 'lucide-react';
import type { Operation } from '../lib/bot/types';

const T = {
  bg: '#0A0E14', bgElev: '#0F141C', panel: '#121821', panelHi: '#171E29',
  border: '#1F2733', text: '#E6EDF3', textDim: '#8B97A8', textMute: '#5C677A',
  accent: '#00E0B8', long: '#26D782', warn: '#F5A524', short: '#F0506E',
};

interface Props {
  operations: Operation[];
}

export function OperationsLog({ operations }: Props) {
  return (
    <div style={{
      background: T.bgElev,
      borderTop: `1px solid ${T.border}`,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      flex: 1,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{
            margin: 0, fontSize: 11, letterSpacing: '0.12em',
            color: T.textDim, fontWeight: 600,
          }}>
            ÚLTIMAS OPERAÇÕES
          </h3>
          <span style={{
            fontSize: 10, color: T.textMute,
            background: T.panel, padding: '2px 6px', borderRadius: 4,
          }}>
            {operations.length}
          </span>
        </div>

        <Summary operations={operations} />
      </div>

      {/* Tabela */}
      {operations.length === 0 ? (
        <div style={{
          padding: 20, color: T.textMute, fontSize: 12, textAlign: 'center',
        }}>
          Nenhuma operação ainda. Inicie o bot para começar.
        </div>
      ) : (
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.bg }}>
                <Th>Hora</Th>
                <Th>Ativo</Th>
                <Th>Direção</Th>
                <Th>Gale</Th>
                <Th align="right">Valor</Th>
                <Th align="center">Exp.</Th>
                <Th align="center">Status</Th>
                <Th align="right">P&amp;L</Th>
              </tr>
            </thead>
            <tbody>
              {operations.map(op => <OpRow key={op.id} op={op} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Summary({ operations }: { operations: Operation[] }) {
  const closed = operations.filter(o => o.status === 'win' || o.status === 'loss');
  const wins = closed.filter(o => o.status === 'win').length;
  const totalPnl = closed.reduce((acc, o) => acc + (o.pnl ?? 0), 0);
  const winRate = closed.length === 0 ? 0 : (wins / closed.length) * 100;

  return (
    <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
      <SummaryStat label="Win rate" value={`${winRate.toFixed(0)}%`} accent={winRate >= 50 ? T.long : T.short} />
      <SummaryStat label="P&L" value={`${totalPnl >= 0 ? '+' : ''}$ ${totalPnl.toFixed(2)}`} accent={totalPnl >= 0 ? T.long : T.short} />
    </div>
  );
}

function SummaryStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <span style={{ color: T.textMute, marginRight: 6, letterSpacing: '0.05em' }}>{label.toUpperCase()}</span>
      <span style={{ color: accent, fontWeight: 600, fontFamily: '"JetBrains Mono", monospace' }}>{value}</span>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <th style={{
      textAlign: align ?? 'left',
      padding: '8px 12px',
      fontSize: 10,
      color: T.textMute,
      letterSpacing: '0.08em',
      fontWeight: 600,
      borderBottom: `1px solid ${T.border}`,
      position: 'sticky',
      top: 0,
      background: T.bg,
      zIndex: 1,
    }}>{typeof children === 'string' ? children.toUpperCase() : children}</th>
  );
}

function Td({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <td style={{
      textAlign: align ?? 'left',
      padding: '10px 12px',
      borderBottom: `1px solid ${T.border}`,
    }}>{children}</td>
  );
}

function OpRow({ op }: { op: Operation }) {
  const isUp = op.direction === 'CALL';

  return (
    <tr>
      <Td>
        <span style={{ color: T.textDim, fontFamily: '"JetBrains Mono", monospace', fontSize: 11 }}>
          {fmtTime(op.openedAt)}
        </span>
      </Td>
      <Td>
        <span style={{ fontWeight: 600 }}>{op.asset}</span>
      </Td>
      <Td>
        <DirectionBadge direction={op.direction} />
      </Td>
      <Td>
        {op.galeLevel === 0
          ? <span style={{ color: T.textMute }}>—</span>
          : <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
              color: T.warn, background: T.warn + '1A',
              padding: '2px 6px', borderRadius: 4,
            }}>G{op.galeLevel}</span>
        }
      </Td>
      <Td align="right">
        <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>
          $ {op.amount.toFixed(2)}
        </span>
      </Td>
      <Td align="center">
        <span style={{ color: T.textDim, fontFamily: '"JetBrains Mono", monospace' }}>
          {op.expiration}s
        </span>
      </Td>
      <Td align="center">
        <StatusBadge op={op} />
      </Td>
      <Td align="right">
        {op.pnl !== undefined ? (
          <span style={{
            color: op.pnl >= 0 ? T.long : T.short,
            fontWeight: 600,
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            {op.pnl >= 0 ? '+' : ''}{op.pnl.toFixed(2)}
          </span>
        ) : (
          <span style={{ color: T.textMute }}>—</span>
        )}
      </Td>
    </tr>
  );
}

function DirectionBadge({ direction }: { direction: 'CALL' | 'PUT' }) {
  const isUp = direction === 'CALL';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      color: isUp ? T.long : T.short,
      fontWeight: 700, fontSize: 11, letterSpacing: '0.05em',
    }}>
      {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {direction}
    </span>
  );
}

function StatusBadge({ op }: { op: Operation }) {
  if (op.status === 'open' || op.status === 'pending') {
    return <OpenStatusCountdown op={op} />;
  }
  if (op.status === 'win') {
    return <Pill color={T.long} icon={<CheckCircle2 size={11} />}>WIN</Pill>;
  }
  if (op.status === 'loss') {
    return <Pill color={T.short} icon={<XCircle size={11} />}>LOSS</Pill>;
  }
  return <Pill color={T.warn} icon={<AlertCircle size={11} />}>ERRO</Pill>;
}

function OpenStatusCountdown({ op }: { op: Operation }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick(t => t + 1), 250);
    return () => window.clearInterval(id);
  }, []);
  const remainingMs = Math.max(0, op.expiresAt - Date.now());
  const remaining = (remainingMs / 1000).toFixed(1);
  return (
    <Pill color={T.accent} icon={<Loader2 size={11} className="spin" />}>
      <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{remaining}s</span>
    </Pill>
  );
}

function Pill({ color, icon, children }: { color: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      color, fontWeight: 700, fontSize: 10, letterSpacing: '0.08em',
      background: color + '1A', padding: '3px 8px', borderRadius: 4,
    }}>
      {icon}{children}
    </span>
  );
}

function fmtTime(epoch: number): string {
  const d = new Date(epoch);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
