import { Wallet, GraduationCap, Zap, ArrowRight, Sparkles, TrendingUp } from 'lucide-react';
import type { ClientSdk } from '@quadcode-tech/client-sdk-js';
import { theme as T } from '../lib/theme';
import { useBalances, type BalanceKind } from '../hooks/useBalances';

interface PainelPageProps {
  user: { id: string; name?: string };
  sdk: ClientSdk;
  onOpenScalping: () => void;
  onOpenAprender: () => void;
}

export function PainelPage({ user, sdk, onOpenScalping, onOpenAprender }: PainelPageProps) {
  const { balances, loading, error, selected, selectKind } = useBalances(sdk);

  return (
    <div style={containerStyle}>
      {/* Header com nome + saudação */}
      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.12em', color: T.textMute, marginBottom: 4 }}>
            BEM-VINDO DE VOLTA
          </div>
          <h1 style={greetingStyle}>
            Olá{user.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
        </div>

        {/* Toggle Real/Demo */}
        <BalanceToggle
          balances={balances}
          selected={selected}
          onSelect={selectKind}
          loading={loading}
        />
      </header>

      {/* Card patrimônio dominante */}
      <PatrimonioCard
        selected={selected}
        loading={loading}
        error={error}
      />

      {/* Linha com "Como usar" + métricas extras */}
      <div style={twoColRowStyle}>
        <EscolaCard onClick={onOpenAprender} />
        <CarteiraCard selected={selected} />
      </div>

      {/* IAs disponíveis */}
      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <Sparkles size={18} color={T.accent} />
          <h2 style={sectionTitleStyle}>IAs disponíveis para operar</h2>
        </div>
        <p style={sectionDescStyle}>
          Configure pelos cards abaixo. Cada IA opera de forma independente.
        </p>

        <ScalpingIACard onClick={onOpenScalping} />
      </section>

      {/* Footer */}
      <footer style={footerStyle}>
        AURAA.BOT · v1.0 · Operar mercados envolve risco. Resultados passados não garantem resultados futuros.
      </footer>
    </div>
  );
}

/* ============================================================
 * Toggle Real/Demo no header
 * ============================================================ */
function BalanceToggle({
  balances, selected, onSelect, loading,
}: {
  balances: ReturnType<typeof useBalances>['balances'];
  selected: ReturnType<typeof useBalances>['selected'];
  onSelect: (k: BalanceKind) => void;
  loading: boolean;
}) {
  if (loading || balances.length === 0) {
    return (
      <div style={{ ...toggleWrapStyle, opacity: 0.5 }}>
        <div style={toggleSegmentStyle}>...</div>
      </div>
    );
  }

  const hasReal = balances.some(b => b.kind === 'real');
  const hasDemo = balances.some(b => b.kind === 'demo');
  const currentKind: BalanceKind = selected?.kind ?? 'demo';

  return (
    <div style={toggleWrapStyle}>
      {hasReal && (
        <button
          onClick={() => onSelect('real')}
          style={{
            ...toggleSegmentStyle,
            ...(currentKind === 'real' ? toggleSegmentActiveStyle : null),
          }}
        >
          REAL
        </button>
      )}
      {hasDemo && (
        <button
          onClick={() => onSelect('demo')}
          style={{
            ...toggleSegmentStyle,
            ...(currentKind === 'demo' ? toggleSegmentActiveStyle : null),
          }}
        >
          DEMO
        </button>
      )}
    </div>
  );
}

/* ============================================================
 * Card patrimônio (topo, dominante)
 * ============================================================ */
function PatrimonioCard({
  selected, loading, error,
}: {
  selected: ReturnType<typeof useBalances>['selected'];
  loading: boolean;
  error: string | null;
}) {
  return (
    <div style={patrimonioCardStyle}>
      {/* Glow decorativo */}
      <div style={{
        position: 'absolute',
        top: -100,
        right: -100,
        width: 300,
        height: 300,
        background: `radial-gradient(circle, ${T.accentDim}, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative' }}>
        <div style={{
          fontSize: 11,
          letterSpacing: '0.12em',
          color: T.textMute,
          marginBottom: 12,
        }}>
          SEU PATRIMÔNIO {selected ? `· ${selected.kind.toUpperCase()}` : ''}
        </div>

        {error ? (
          <div style={{ color: T.short, fontSize: 14, padding: '8px 0' }}>
            ⚠️ Não foi possível carregar a banca: {error}
          </div>
        ) : loading ? (
          <SkeletonValue />
        ) : selected ? (
          <>
            <div style={amountStyle}>
              <span style={{ color: T.textDim, fontSize: 22, fontWeight: 500 }}>
                {selected.currency === 'BRL' ? 'R$' : 'US$'}
              </span>
              <span style={{ marginLeft: 8 }}>
                {formatAmount(selected.amount).integer}
              </span>
              <span style={{ color: T.textDim, fontSize: 32 }}>
                ,{formatAmount(selected.amount).decimal}
              </span>
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: T.textDim }}>
              Banca {selected.kind === 'real' ? 'real' : 'de demonstração'} · ID #{selected.id}
            </div>
          </>
        ) : (
          <div style={{ color: T.textDim, fontSize: 14 }}>
            Nenhuma banca disponível
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
 * Card "Como usar a Auraa?"
 * ============================================================ */
function EscolaCard({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={escolaCardStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = T.accentDeep;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = T.border;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={cardIconWrapStyle}>
        <GraduationCap size={20} color={T.accent} />
      </div>
      <div style={{
        fontSize: 11,
        letterSpacing: '0.12em',
        color: T.textMute,
        marginBottom: 6,
        marginTop: 16,
      }}>
        ESCOLA AURAA
      </div>
      <h3 style={cardTitleStyle}>Como usar a Auraa?</h3>
      <p style={cardDescStyle}>
        Aulas curtas em português sobre como configurar seus bots, interpretar a IA
        e operar com gestão de risco.
      </p>
      <ul style={bulletsStyle}>
        <li>Primeiros passos com a corretora</li>
        <li>IA explicada do jeito simples</li>
        <li>Risco, gestão e psicologia</li>
      </ul>
      <button style={ctaButtonStyle}>
        Acessar escola <ArrowRight size={14} />
      </button>
    </div>
  );
}

/* ============================================================
 * Card "Carteira"
 * ============================================================ */
function CarteiraCard({ selected }: { selected: ReturnType<typeof useBalances>['selected'] }) {
  const total = selected?.amount ?? 0;
  const margemOp = 0; // TODO: pegar do SDK quando houver positions abertas
  const margemDisp = total - margemOp;

  return (
    <div style={carteiraCardStyle}>
      <div style={cardIconWrapStyle}>
        <Wallet size={20} color={T.accent} />
      </div>

      <div style={{
        fontSize: 11,
        letterSpacing: '0.12em',
        color: T.textMute,
        marginBottom: 6,
        marginTop: 16,
      }}>
        CARTEIRA
      </div>
      <h3 style={cardTitleStyle}>Patrimônio total</h3>

      <div style={{
        fontSize: 28,
        fontWeight: 700,
        color: T.text,
        margin: '12px 0 8px',
        letterSpacing: '-0.02em',
      }}>
        {selected?.currency === 'BRL' ? 'R$' : 'US$'} {formatAmount(total).full}
      </div>

      <div style={{ marginTop: 20 }}>
        <Row label="Margem disponível" value={`US$ ${formatAmount(margemDisp).full}`} />
        <div style={{ height: 1, background: T.border, margin: '12px 0' }} />
        <Row label="Margem em operação" value={`US$ ${formatAmount(margemOp).full}`} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      fontSize: 13,
    }}>
      <span style={{ color: T.textDim }}>{label}</span>
      <span style={{ color: T.text, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
        {value}
      </span>
    </div>
  );
}

/* ============================================================
 * Card IA Scalping
 * ============================================================ */
function ScalpingIACard({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={scalpingCardStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = T.accent;
        e.currentTarget.style.boxShadow = `0 0 32px ${T.accentDim}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = T.borderHi;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            ...cardIconWrapStyle,
            background: T.accentSoft,
            margin: 0,
          }}>
            <Zap size={20} color={T.accent} fill={T.accent} />
          </div>
          <div>
            <h3 style={{
              ...cardTitleStyle,
              margin: 0,
            }}>
              IA Scalping
            </h3>
            <div style={{ fontSize: 11, color: T.textMute, marginTop: 2 }}>
              Blitz Options · 5s/10s/15s
            </div>
          </div>
        </div>

        <span style={badgeStyle}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: T.long, marginRight: 6,
            display: 'inline-block',
            boxShadow: `0 0 8px ${T.long}`,
          }} />
          PRONTA
        </span>
      </div>

      {/* Métricas */}
      <div style={metricsRowStyle}>
        <Metric label="GANHO 7D"     value="+US$ 0,00" tone="long" />
        <Metric label="OPERAÇÕES 7D" value="0" />
        <Metric label="META DIÁRIA"  value="—" />
      </div>

      <div style={lastOpStyle}>
        <span style={{ fontSize: 11, color: T.textMute, letterSpacing: '0.08em' }}>
          ÚLTIMA OP
        </span>
        <span style={{ fontSize: 13, color: T.textDim }}>
          Nenhuma operação ainda
        </span>
      </div>

      <button style={detailsButtonStyle}>
        Abrir painel de Scalping <ArrowRight size={14} />
      </button>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'long' | 'short' }) {
  return (
    <div>
      <div style={{
        fontSize: 10,
        letterSpacing: '0.1em',
        color: T.textMute,
        marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 18,
        fontWeight: 700,
        color: tone === 'long' ? T.long : tone === 'short' ? T.short : T.text,
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        {value}
      </div>
    </div>
  );
}

/* ============================================================
 * Helpers
 * ============================================================ */

function formatAmount(n: number): { integer: string; decimal: string; full: string } {
  const abs = Math.abs(n);
  const integer = Math.floor(abs).toLocaleString('pt-BR');
  const decimal = abs.toFixed(2).split('.')[1] ?? '00';
  const full = abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { integer, decimal, full };
}

function SkeletonValue() {
  return (
    <div style={{
      width: 280,
      height: 48,
      background: `linear-gradient(90deg, ${T.panel}, ${T.panelHi}, ${T.panel})`,
      backgroundSize: '200% 100%',
      borderRadius: 8,
      animation: 'shimmer 1.4s ease-in-out infinite',
    }} />
  );
}

/* ============================================================
 * Styles
 * ============================================================ */

const containerStyle = {
  flex: 1,
  padding: '32px 40px 48px',
  maxWidth: 1280,
  margin: '0 auto',
  width: '100%',
};

const headerStyle = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  marginBottom: 32,
  flexWrap: 'wrap' as const,
  gap: 16,
};

const greetingStyle = {
  fontSize: 32,
  fontWeight: 700,
  margin: 0,
  letterSpacing: '-0.02em',
  color: T.text,
};

const toggleWrapStyle = {
  display: 'inline-flex',
  background: T.bgElev,
  border: `1px solid ${T.border}`,
  borderRadius: 10,
  padding: 4,
  gap: 2,
};

const toggleSegmentStyle = {
  padding: '8px 16px',
  background: 'transparent',
  border: 'none',
  borderRadius: 6,
  color: T.textDim,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 120ms',
};

const toggleSegmentActiveStyle = {
  background: T.accent,
  color: T.bg,
  boxShadow: `0 0 12px ${T.accentDim}`,
};

const patrimonioCardStyle = {
  background: T.panel,
  border: `1px solid ${T.border}`,
  borderRadius: 16,
  padding: 32,
  marginBottom: 16,
  position: 'relative' as const,
  overflow: 'hidden' as const,
};

const amountStyle = {
  fontSize: 56,
  fontWeight: 700,
  letterSpacing: '-0.03em',
  color: T.text,
  fontFamily: 'JetBrains Mono, monospace',
  lineHeight: 1,
};

const twoColRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 16,
  marginBottom: 32,
};

const escolaCardStyle = {
  background: T.panel,
  border: `1px solid ${T.border}`,
  borderRadius: 16,
  padding: 24,
  cursor: 'pointer',
  transition: 'all 200ms',
  display: 'flex',
  flexDirection: 'column' as const,
};

const carteiraCardStyle = {
  background: T.panel,
  border: `1px solid ${T.border}`,
  borderRadius: 16,
  padding: 24,
};

const cardIconWrapStyle = {
  width: 40,
  height: 40,
  borderRadius: 10,
  background: T.accentSoft,
  display: 'grid',
  placeItems: 'center',
  marginBottom: 0,
} as const;

const cardTitleStyle = {
  fontSize: 18,
  fontWeight: 700,
  color: T.text,
  margin: '0 0 8px',
  letterSpacing: '-0.01em',
};

const cardDescStyle = {
  fontSize: 13,
  color: T.textDim,
  lineHeight: 1.6,
  margin: '0 0 16px',
};

const bulletsStyle = {
  margin: '0 0 20px',
  paddingLeft: 20,
  fontSize: 13,
  color: T.textDim,
  lineHeight: 1.8,
};

const ctaButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '10px 16px',
  background: 'transparent',
  border: `1px solid ${T.borderHi}`,
  color: T.accent,
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.04em',
  cursor: 'pointer',
  fontFamily: 'inherit',
  marginTop: 'auto',
  alignSelf: 'flex-start',
  transition: 'all 120ms',
};

const sectionStyle = {
  marginTop: 16,
};

const sectionHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 4,
};

const sectionTitleStyle = {
  fontSize: 20,
  fontWeight: 700,
  color: T.text,
  margin: 0,
  letterSpacing: '-0.01em',
};

const sectionDescStyle = {
  fontSize: 13,
  color: T.textDim,
  margin: '0 0 20px',
};

const scalpingCardStyle = {
  background: `linear-gradient(135deg, ${T.panel}, ${T.panelHi})`,
  border: `1px solid ${T.borderHi}`,
  borderRadius: 16,
  padding: 28,
  cursor: 'pointer',
  transition: 'all 240ms',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 24,
};

const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '5px 10px',
  background: T.longSoft,
  color: T.long,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  borderRadius: 6,
};

const metricsRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 16,
  paddingTop: 8,
  borderTop: `1px solid ${T.border}`,
  paddingBottom: 4,
};

const lastOpStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 16px',
  background: T.bgElev,
  borderRadius: 8,
  marginTop: -8,
};

const detailsButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '12px 16px',
  background: T.accent,
  border: 'none',
  color: T.bg,
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.04em',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 120ms',
  boxShadow: `0 0 24px ${T.accentDim}`,
};

const footerStyle = {
  marginTop: 48,
  paddingTop: 24,
  borderTop: `1px solid ${T.border}`,
  fontSize: 11,
  color: T.textMute,
  letterSpacing: '0.04em',
};
