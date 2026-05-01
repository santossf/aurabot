import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { CallbackPage } from './pages/CallbackPage';
import { ScalperApp } from './ScalperApp'; // o app que já fizemos antes

/**
 * Roteamento minimalista por pathname (sem react-router pra manter leve).
 * Para um app maior, vale trocar por react-router-dom.
 */
function Routes() {
  const { state } = useAuth();
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Callback do OAuth — sempre renderiza, independente do estado de auth
  if (path.startsWith('/oauth')) {
    return <CallbackPage />;
  }

  if (state.status === 'loading') {
    return <Splash />;
  }

  if (state.status === 'guest') {
    return <LoginPage />;
  }

  // Autenticado — renderiza o app principal
  return <ScalperApp />;
}

function Splash() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0A0E14',
        display: 'grid',
        placeItems: 'center',
        color: '#8B97A8',
        fontSize: 12,
        letterSpacing: '0.1em',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      INICIALIZANDO SCALPER.AI
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}
