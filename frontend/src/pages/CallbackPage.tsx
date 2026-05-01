import { useEffect, useRef, useState } from 'react';
import { exchangeCodeForToken, consumeStoredVerifier } from '../lib/avalonClient';
import { useAuth } from '../hooks/useAuth';

export function CallbackPage() {
  const { onTokenIssued } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const oauthError = params.get('error');

      if (oauthError) {
        setError('Erro da Avalon: ' + oauthError);
        return;
      }

      if (!code) {
        setError('Resposta inválida da corretora (sem code).');
        return;
      }

      const codeVerifier = consumeStoredVerifier();
      if (!codeVerifier) {
        setError('Sessão de login expirou. Tente novamente.');
        return;
      }

      try {
        const tokens = await exchangeCodeForToken(code, codeVerifier);
        await onTokenIssued(tokens);
        window.history.replaceState({}, '', '/');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Falha desconhecida';
        console.error('[callback] falha na troca:', err);
        setError('Não foi possível validar com a corretora: ' + msg);
      }
    })();
  }, [onTokenIssued]);

  if (error) {
    return (
      <div style={errorContainer}>
        <div style={errorCard}>
          <h2 style={errorTitle}>Falha na autenticação</h2>
          <p style={errorText}>{error}</p>
          <a href="/" style={errorButton}>VOLTAR AO LOGIN</a>
        </div>
      </div>
    );
  }

  return (
    <div style={errorContainer}>
      <div style={errorCard}>
        <h2 style={errorTitle}>Conectando à Avalon</h2>
        <p style={errorText}>Validando suas credenciais...</p>
      </div>
    </div>
  );
}

const errorContainer = {
  minHeight: '100vh',
  background: '#0A0E14',
  color: '#E6EDF3',
  display: 'grid',
  placeItems: 'center',
  fontFamily: 'Inter, sans-serif',
  padding: 24,
} as const;

const errorCard = {
  background: '#121821',
  border: '1px solid #1F2733',
  borderRadius: 16,
  padding: 36,
  maxWidth: 420,
  width: '100%',
  textAlign: 'center' as const,
};

const errorTitle = {
  margin: '0 0 8px',
  fontSize: 20,
  fontWeight: 700,
};

const errorText = {
  margin: '0 0 24px',
  color: '#8B97A8',
  fontSize: 13,
  lineHeight: 1.5,
};

const errorButton = {
  display: 'inline-block',
  padding: '10px 20px',
  background: '#00E0B8',
  color: '#0A0E14',
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: '0.04em',
  borderRadius: 8,
  textDecoration: 'none',
};
