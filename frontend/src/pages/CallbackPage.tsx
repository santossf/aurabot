import { useEffect, useRef, useState } from 'react';
import { Bot, AlertCircle } from 'lucide-react';
import { exchangeCodeForToken, consumeStoredVerifier } from '../lib/avalonClient';
import { useAuth } from '../hooks/useAuth';

const T = {
  bg: '#0A0E14',
  panel: '#121821',
  border: '#1F2733',
  text: '#E6EDF3',
  textDim: '#8B97A8',
  accent: '#00E0B8',
  accentDim: '#00E0B833',
  short: '#F0506E',
};

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
        setError(decodeOauthError(oauthError));
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
      } catch (err: any) {
        console.error('[callback] falha na troca:', err);
        setError(err?.message ?? 'Não foi possível validar com a corretora.');
      }
    })();
  }, [onTokenIssued]);

  const containerStyle = {
    minHeight: '100vh',
    background: T.bg,
    color: T.text,
    display: 'grid',
    placeItems: 'center',
    fontFamily: '"Inter", "SF Pro Text", -apple-system, sans-serif',
    padding: 24,
  } as const;

  const cardStyle = {
    background: T.panel,
    border: '1px solid ' + T.border,
    borderRadius: 16,
    padding: 36,
    maxWidth: 420,
    width: '100%',
    textAlign: 'center' as const,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  };

  const iconWrapStyle = {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: error
      ? T.short + '14'
      : 'linear-gradient(135deg, ' + T.accent + ', ' + T.accent + '55)',
    display: 'grid',
    placeItems: 'center',
    margin: '0 auto 20px',
    boxShadow: error ? 'none' : '0 0 30px ' + T.accentDim,
    animation: error ? 'none' : 'pulse 1.6s ease-in-out infinite',
  } as const;

  return (
    <div style={containerStyle}>
      <style>{'@keyframes pulse { 0% { opacity: 0.4; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1); } 100% { opacity: 0.4; transform: scale(0.95); } }'}</style>

      <div style={cardStyle}>
        <div style={iconWrapStyle}>
          {error ? (
            <AlertCircle size={26} color={T.short} />
          ) : (
            <Bot size={26} color={T.bg} strokeWidth={2.5} />
          )}
        </div>

        {error ? (
          <div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>
              Falha na autenticação
            </h2>
            <p style={{ margin: '0 0 24px', color: T.textDim, fontSize: 13, lineHeight: 1.5 }}>
              {error}
            </p>
            
              href="/"
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                background: T.accent,
                color: T.bg,
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.04em',
                borderRadius: 8,
                textDecoration: 'none',
              }}
            >
              VOLTAR AO LOGIN
            </a>
          </div>
        ) : (
          <div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>
              Conectando à Avalon
            </h2>
            <p style={{ margin: 0, color: T.textDim, fontSize: 13, lineHeight: 1.5 }}>
              Validando suas credenciais e iniciando a sessão...
            </p>
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 8 }}>
              <span style={dotStyle(0)} />
              <span style={dotStyle(1)} />
              <span style={dotStyle(2)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function dotStyle(i: number) {
  return {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: T.accent,
    animation: 'pulse 1.4s ease-in-out ' + (i * 0.2) + 's infinite',
    display: 'inline-block',
  } as const;
}

function decodeOauthError(code: string): string {
  switch (code) {
    case 'access_denied': return 'Você cancelou o login na Avalon.';
    case 'invalid_request': return 'Requisição inválida para a Avalon.';
    case 'unauthorized_client': return 'Cliente não autorizado.';
    case 'unsupported_response_type': return 'Configuração inválida.';
    case 'server_error': return 'A Avalon está com instabilidade. Tente novamente em instantes.';
    case 'temporarily_unavailable': return 'Serviço temporariamente indisponível.';
    default: return 'Erro: ' + code;
  }
}
