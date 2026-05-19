/**
 * ScalperApp — root da área autenticada.
 * Sidebar persistente + páginas roteadas: Painel / Scalping / Aprender / Perfil.
 */
import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { Sidebar, type NavKey } from './components/Sidebar';
import { PainelPage } from './pages/PainelPage';
import { AprenderPage } from './pages/AprenderPage';
import { PerfilPage } from './pages/PerfilPage';
import { BotScreen } from './pages/BotScreen';
import { theme as T } from './lib/theme';

export function ScalperApp() {
  const { state, logout } = useAuth();
  const [active, setActive] = useState<NavKey>('painel');

  if (state.status !== 'authenticated') return null;

  return (
    <div style={layoutStyle}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse {
          0%   { opacity: 0.4; transform: scale(0.95); }
          50%  { opacity: 1;   transform: scale(1); }
          100% { opacity: 0.4; transform: scale(0.95); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: ${T.bgElev}; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: ${T.borderHi}; }

        /* Mobile: reserva espaço para o bottom nav */
        @media (max-width: 768px) {
          .auraa-main { padding-bottom: 80px !important; }
        }
      `}</style>

      <Sidebar
        active={active}
        onChange={setActive}
        onLogout={logout}
      />

      <main style={mainStyle} className="auraa-main">
        {active === 'painel' && (
          <PainelPage
            user={state.user}
            sdk={state.sdk}
            onOpenScalping={() => setActive('scalping')}
            onOpenAprender={() => setActive('aprender')}
          />
        )}

        {active === 'scalping' && (
          <BotScreen sdk={state.sdk} onBack={() => setActive('painel')} />
        )}

        {active === 'aprender' && <AprenderPage />}

        {active === 'perfil' && (
          <PerfilPage user={state.user} onLogout={logout} />
        )}
      </main>
    </div>
  );
}

const layoutStyle = {
  display: 'flex',
  minHeight: '100vh',
  background: T.bg,
  color: T.text,
  fontFamily: '"Inter", "SF Pro Text", -apple-system, sans-serif',
};

const mainStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column' as const,
  minWidth: 0,
};
