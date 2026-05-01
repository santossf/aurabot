/**
 * OperationsLog — lista de operações (abertas + fechadas).
 *
 * Formato de cada linha:
 *   STATUS | ATIVO | Direção | Valor | Countdown ou Resultado
 *
 * Operações abertas aparecem no topo com countdown.
 * Operações fechadas aparecem embaixo com WIN/LOSS e PnL.
 */
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { theme as T } from '../lib/theme';
import type { Operation } from '../lib/bot/types';

interface OperationsLogProps {
  operations: Operation[];
}

export function OperationsLog({ operations }: OperationsLogProps) {
  // Ordena: abertas primeiro (mais recente em cima), fechadas depois
  const sorted = [...operations].sort((a, b) => {
    const aOpen = isOpenStatus(a.status);
    const bOpen = isOpenStatus(b.status);
    if (aOpen && !bOpen) return -1;
    if (!aOpen && bOpen) return 1;
    return b.openedAt - a.openedAt;
  });

  const winRate = computeWinRate(operations);
  const totalPnl = operations
    .filter(o => o.pnl !== undefined)
    .reduce((acc, o) => acc + (o.pnl ?? 0), 0);

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: 11,
            letterSpacing: '0.12em',
            color: T.textMute,
            fontWeight: 700,
          }}>
            ÚLTIMAS OPERAÇÕES
          </span>
          <span style={countBadgeStyle}>{operations.length}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Stat label="WIN RATE" value={`${winRate}%`} tone={winRate >= 50 ? 'long' : 'short'} />
          <Stat
            label="P&L"
            value={`${totalPnl >= 0 ? '+' : ''}$ ${totalPnl.toFixed(2)}`}
            tone={totalPnl >= 0 ? 'long' : 'short'}
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <div style={emptyStateStyle}>
          <Clock size={20} color={T.textMute} />
          <span style={{ marginLeft: 12 }}>
            Nenhuma operação ainda. Inicie o bot para começar.
          </span>
        </div>
      ) : (
        <div style={tableWrapStyle}>
          {sorted.map(op => <OperationRow key={op.id} op={op} />)}
        </div>
      )}
    </div>
  );
}

function OperationRow({ op }: { op: Operation }) {
  const isCall = op.direction === 'CALL';
  const sideColor = isCall ? T.long : T.short;
  const isOpen = isOpenStatus(op.status);
  const isWin = op.status === 'win';
  const isLoss = op.status === 'loss';

  return (
    <div style={{
      ...rowStyle,
      borderLeftColor:
        isWin    ? T.long :
        isLoss   ? T.short :
        isOpen   ? T.accent :
                   T.border,
    }}>
      {/* STATUS */}
      <div style={{ width: 130, flexShrink: 0 }}>
        <StatusBadge op={op} />
      </div>

      {/* ATIVO */}
      <div style={{ width: 100, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
          {op.asset}
        </div>
        <div style={{ fontSize: 10, color: T.textMute, letterSpacing: '0.06em' }}>
          BLITZ {op.expiration}s
        </div>
      </div>

      {/* DIREÇÃO */}
      <div style={{ width: 100, flexShrink: 0 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          background: sideColor + '22',
          color: sideColor,
          borderRadius: 5,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.04em',
        }}>
          {isCall ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {isCall ? 'COMPRA' : 'VENDA'}
        </div>
      </div>

      {/* VALOR */}
      <div style={{ width: 90, flexShrink: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: T.text,
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          ${op.amount.toFixed(2)}
        </div>
        {op.galeLevel > 0 && (
          <div style={{ fontSize: 9, color: T.warn, letterSpacing: '0.06em' }}>
            GALE {op.galeLevel}
          </div>
        )}
      </div>

      {/* COUNTDOWN ou RESULTADO */}
      <div style={{ flex: 1, textAlign: 'right' }}>
        {isOpen ? (
          <LiveCountdown expiresAt={op.expiresAt} />
        ) : op.status === 'error' ? (
          <span style={{ fontSize: 11, color: T.short }}>
            {op.errorMessage ?? 'Erro'}
          </span>
        ) : op.pnl !== undefined ? (
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: op.pnl >= 0 ? T.long : T.short,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {op.pnl >= 0 ? '+' : ''}${op.pnl.toFixed(2)}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: T.textMute }}>—</span>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ op }: { op: Operation }) {
  const config = getStatusConfig(op);

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 10px',
      background: config.bg,
      color: config.color,
      borderRadius: 5,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.08em',
    }}>
      {config.dot && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: config.color,
          marginRight: 6,
          display: 'inline-block',
          boxShadow: `0 0 6px currentColor`,
          animation: config.pulse ? 'pulse 1.4s ease-in-out infinite' : 'none',
        }} />
      )}
      {config.label}
    </div>
  );
}

function LiveCountdown({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, expiresAt - Date.now()));

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining(Math.max(0, expiresAt - Date.now()));
    }, 100);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  const seconds = Math.ceil(remaining / 1000);
  const isUrgent = seconds <= 3;

  return (
    <div style={{
      fontSize: 16,
      fontWeight: 700,
      color: isUrgent ? T.warn : T.text,
      fontFamily: 'JetBrains Mono, monospace',
      letterSpacing: '-0.02em',
    }}>
      00:{seconds.toString().padStart(2, '0')}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'long' | 'short' }) {
  return (
    <div>
      <span style={{
        fontSize: 10,
        letterSpacing: '0.1em',
        color: T.textMute,
        marginRight: 6,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 12,
        fontWeight: 700,
        color: tone === 'long' ? T.long : tone === 'short' ? T.short : T.text,
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        {value}
      </span>
    </div>
  );
}

/* ============================================================
 * Helpers
 * ============================================================ */

function isOpenStatus(status: Operation['status']): boolean {
  return status === 'analyzing' || status === 'pending' || status === 'open' || status === 'expiring';
}

function getStatusConfig(op: Operation) {
  switch (op.status) {
    case 'analyzing':
      return { label: 'EM ANÁLISE', bg: T.accentSoft, color: T.accent, dot: true, pulse: true };
    case 'pending':
      return { label: 'ENVIANDO', bg: T.accentSoft, color: T.accent, dot: true, pulse: true };
    case 'open':
      return { label: 'ABERTA', bg: T.accentSoft, color: T.accent, dot: true, pulse: true };
    case 'expiring':
      return { label: 'EXPIRANDO', bg: T.warn + '22', color: T.warn, dot: true, pulse: true };
    case 'win':
      return { label: 'WIN', bg: T.longSoft, color: T.long, dot: false, pulse: false };
    case 'loss':
      return { label: 'LOSS', bg: T.shortSoft, color: T.short, dot: false, pulse: false };
    case 'error':
      return { label: 'ERRO', bg: T.shortSoft, color: T.short, dot: false, pulse: false };
  }
}

function computeWinRate(ops: Operation[]): number {
  const closed = ops.filter(o => o.status === 'win' || o.status === 'loss');
  if (closed.length === 0) return 0;
  const wins = closed.filter(o => o.status === 'win').length;
  return Math.round((wins / closed.length) * 100);
}

/* ============================================================
 * Styles
 * ============================================================ */

const containerStyle = {
  background: T.panel,
  border: `1px solid ${T.border}`,
  borderRadius: 14,
  padding: 20,
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingBottom: 16,
  borderBottom: `1px solid ${T.border}`,
  marginBottom: 4,
};

const countBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  background: T.bgElev,
  color: T.textDim,
  fontSize: 10,
  fontWeight: 700,
  borderRadius: 4,
  fontFamily: 'JetBrains Mono, monospace',
};

const tableWrapStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 4,
};

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: '12px 14px',
  background: T.bgElev,
  borderRadius: 8,
  borderLeft: `3px solid ${T.border}`,
  transition: 'background 120ms',
};

const emptyStateStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 24px',
  color: T.textMute,
  fontSize: 13,
};
