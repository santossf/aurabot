/**
 * ScalperApp — root da área autenticada.
 * Mostra a home (4 banners) e abre o BotScreen quando o usuário clica
 * em "Inteligência para Operar em Scalping".
 */
import { useState } from 'react';
import {
  GraduationCap, MessagesSquare, Bot, Sparkles, Activity, Wallet, LogOut,
} from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { BotScreen } from './pages/BotScreen';

const T = {
  bg: '#0A0E14', bgElev: '#0F141C', panel: '#121821', panelHi: '#171E29',
  border: '#1F2733', text: '#E6EDF3', textDim: '#8B97A8', textMute: '#5C677A',
  accent: '#00E0B8', accentDim: '#00E0B833', long: '#26D782',
};

export function ScalperApp() {
  const { state, logout } = useAuth();
  const [screen, setScreen] = useState<'home' | 'bot'>('home');

  if (state.status !== 'authenticated') return null;

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      color: T.text,
      fontFamily: '"Inter", "SF Pro Text", -apple-system, sans-serif',
    }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes pulse {
          0%   { transform: scale(1);   opacity: 0.7; }
          70%  { transform: scale(2.5); opacity: 0; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: ${T.bgElev}; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
      `}</style>

      {screen === 'home' ? (
        <Home
          user={state.user}
          onOpenBot={() => setScreen('bot')}
          onLogout={logout}
        />
      ) : (
        <BotScreen sdk={state.sdk} onBack={() => setScreen('home')} />
      )}
    </div>
  );
}

function Home({ user, onOpenBot, onLogout }: any) {
  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px 48px' }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 48,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: `linear-gradient(135deg, ${T.accent}, ${T.accent}55)`,
            display: 'grid', placeItems: 'center',
            boxShadow: `0 0 24px ${T.accentDim}`,
          }}>
            <Bot size={20} color={T.bg} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontWeight: 700, letterSpacing: '-0.02em', fontSize: 18 }}>
              AURAA<span style={{ color: T.accent }}>.BOT</span>
            </div>
            <div style={{ fontSize: 11, color: T.textMute, letterSpacing: '0.08em' }}>
              AUTOMATED TRADING SYSTEM
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <PulseIndicator />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 14px',
            background: T.panel,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            fontSize: 13,
          }}>
            <Wallet size={14} color={T.textDim} />
            <span style={{ color: T.textDim }}>
              {user.name ?? user.email ?? 'Usuário'}
            </span>
          </div>
          <button onClick={onLogout} style={{
            all: 'unset', cursor: 'pointer',
            padding: '8px 12px',
            color: T.textDim, fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 6,
            borderRadius: 6,
          }}>
            <LogOut size={13} /> Sair
          </button>
        </div>
      </header>

      <section style={{ marginBottom: 56 }}>
        <div style={{
          fontSize: 11, letterSpacing: '0.2em', color: T.accent,
          marginBottom: 14, fontWeight: 600,
        }}>
          ◢ INTELIGÊNCIA ARTIFICIAL EM TEMPO REAL
        </div>
        <h1 style={{
          fontSize: 'clamp(36px, 5vw, 56px)',
          fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05,
          margin: 0, maxWidth: 820,
        }}>
          Opere com a precisão de uma IA<br />
          <span style={{ color: T.textDim, fontWeight: 400 }}>treinada em milhões de candles.</span>
        </h1>
        <p style={{ color: T.textDim, fontSize: 16, maxWidth: 580, marginTop: 18, lineHeight: 1.6 }}>
          Estratégias de scalping automatizadas, ajustadas dinamicamente ao seu perfil de risco e
          tamanho de banca.
        </p>
      </section>

      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 16,
      }}>
        <BannerCard
          icon={<GraduationCap size={22} />}
          tag="MÓDULO 01"
          title="Aprendizado"
          subtitle="Da fundação à estratégia. Cursos, mentorias e trilhas práticas."
        />
        <BannerCard
          icon={<MessagesSquare size={22} />}
          tag="MÓDULO 02"
          title="Comunidade do WhatsApp"
          subtitle="Sinais, debates e suporte direto com traders ativos."
        />
        <BannerCard
          icon={<Sparkles size={22} />}
          tag="MÓDULO 03 · IA"
          title="Inteligência para Operar em Scalping"
          subtitle="Bot autônomo com gestão de risco adaptativa. Clique para abrir."
          highlight
          onClick={onOpenBot}
        />
        <BannerCard
          icon={<Activity size={22} />}
          tag="MÓDULO 04"
          title="Histórico & Performance"
          subtitle="Métricas detalhadas, drawdown, win-rate e relatórios."
        />
      </section>

      <footer style={{ marginTop: 56, color: T.textMute, fontSize: 12, letterSpacing: '0.05em' }}>
        AURAA.BOT · v1.0 · Operar mercados envolve risco. Resultados passados não garantem
        resultados futuros.
      </footer>
    </div>
  );
}

function BannerCard({ icon, tag, title, subtitle, highlight, onClick }: any) {
  const [hover, setHover] = useState(false);
  const isClickable = !!onClick;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={!isClickable}
      style={{
        all: 'unset',
        cursor: isClickable ? 'pointer' : 'default',
        position: 'relative',
        background: highlight
          ? `linear-gradient(160deg, ${T.panelHi}, ${T.panel})`
          : T.panel,
        border: `1px solid ${highlight ? T.accent + '55' : T.border}`,
        borderRadius: 14,
        padding: '24px 22px',
        minHeight: 200,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'all 200ms ease',
        transform: hover && isClickable ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: highlight
          ? `0 0 0 1px ${T.accent}22, 0 12px 40px -12px ${T.accent}33`
          : 'none',
        overflow: 'hidden',
      }}
    >
      {highlight && (
        <div style={{
          position: 'absolute', top: -60, right: -60,
          width: 180, height: 180,
          background: `radial-gradient(circle, ${T.accent}22, transparent 70%)`,
          pointerEvents: 'none',
        }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{
          width: 44, height: 44,
          borderRadius: 10,
          background: highlight ? T.accent + '1A' : T.panelHi,
          border: `1px solid ${highlight ? T.accent + '55' : '#2A3441'}`,
          display: 'grid', placeItems: 'center',
          color: highlight ? T.accent : T.text,
        }}>{icon}</div>
        <span style={{
          fontSize: 10, letterSpacing: '0.12em',
          color: highlight ? T.accent : T.textMute,
          fontWeight: 600,
        }}>{tag}</span>
      </div>

      <div>
        <h3 style={{
          margin: '20px 0 8px', fontSize: 19, fontWeight: 700,
          letterSpacing: '-0.01em', color: T.text, lineHeight: 1.25,
        }}>{title}</h3>
        <p style={{ margin: 0, color: T.textDim, fontSize: 13, lineHeight: 1.55 }}>{subtitle}</p>
        {isClickable && (
          <div style={{
            marginTop: 16, fontSize: 12, color: T.accent, fontWeight: 600,
            letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            ABRIR PAINEL <span style={{
              transform: hover ? 'translateX(4px)' : 'translateX(0)',
              transition: 'transform 200ms',
            }}>→</span>
          </div>
        )}
      </div>
    </button>
  );
}

function PulseIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ position: 'relative', width: 8, height: 8 }}>
        <span style={{
          position: 'absolute', inset: 0,
          background: T.long, borderRadius: '50%',
          animation: 'pulse 2s infinite',
        }} />
        <span style={{ position: 'absolute', inset: 0, background: T.long, borderRadius: '50%' }} />
      </span>
      <span style={{ fontSize: 11, color: T.textDim, letterSpacing: '0.08em' }}>MERCADO ABERTO</span>
    </div>
  );
}
