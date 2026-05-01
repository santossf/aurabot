import { useEffect, useRef, useState } from 'react';
import { exchangeCodeForToken, consumeStoredVerifier } from '../lib/avalonClient';
import { useAuth } from '../hooks/useAuth';
import { theme as T } from '../lib/theme';

type Step = 'pending' | 'active' | 'done' | 'error';

interface StepState {
  exchanging: Step;
  authenticating: Step;
  loading: Step;
}

export function CallbackPage() {
  const { onTokenIssued } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepState>({
    exchanging: 'active',
    authenticating: 'pending',
    loading: 'pending',
  });
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
        setSteps(s => ({ ...s, exchanging: 'error' }));
        return;
      }

      if (!code) {
        setError('Resposta inválida da corretora (sem code).');
        setSteps(s => ({ ...s, exchanging: 'error' }));
        return;
      }

      const codeVerifier = consumeStoredVerifier();
      if (!codeVerifier) {
        setError('Sessão de login expirou. Tente novamente.');
        setSteps(s => ({ ...s, exchanging: 'error' }));
        return;
      }

      try {
        // Etapa 1: Trocar code por token
        const tokens = await exchangeCodeForToken(code, codeVerifier);
        setSteps(s => ({ ...s, exchanging: 'done', authenticating: 'active' }));

        // Etapa 2 + 3: criar SDK (autentica + busca profile)
        // Pequena pausa para o usuário ver o check da etapa 1
        await sleep(200);
        setSteps(s => ({ ...s, authenticating: 'done', loading: 'active' }));

        await onTokenIssued(tokens);
        setSteps(s => ({ ...s, loading: 'done' }));

        // Pequena pausa para ver "tudo pronto" antes de redirecionar
        await sleep(400);
        window.history.replaceState({}, '', '/');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Falha desconhecida';
        console.error('[callback] falha:', err);
        setError('Não foi possível validar com a corretora: ' + msg);
        setSteps(s => {
          // marca a etapa atualmente ativa como erro
          if (s.exchanging === 'active') return { ...s, exchanging: 'error' };
          if (s.authenticating === 'active') return { ...s, authenticating: 'error' };
          return { ...s, loading: 'error' };
        });
      }
    })();
  }, [onTokenIssued]);

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <Glow />
          <div style={{ ...iconWrapStyle, background: T.shortSoft }}>
            <ErrorIcon />
          </div>
          <h2 style={titleStyle}>Falha na autenticação</h2>
          <p style={textStyle}>{error}</p>
          <a href="/" style={buttonStyle}>VOLTAR AO LOGIN</a>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <Glow />
        <div style={{
          ...iconWrapStyle,
          background: `linear-gradient(135deg, ${T.accent}, ${T.accentDeep})`,
          boxShadow: `0 0 30px ${T.accentGlow}`,
        }}>
          <BotIcon />
        </div>
        <h2 style={titleStyle}>Conectando à Avalon</h2>
        <p style={textStyle}>Validando suas credenciais e preparando seu dashboard...</p>

        <div style={stepsListStyle}>
          <StepRow status={steps.exchanging}     label="Trocando código por token" />
          <StepRow status={steps.authenticating} label="Autenticando sessão" />
          <StepRow status={steps.loading}        label="Carregando seu perfil" />
        </div>
      </div>
    </div>
  );
}

function StepRow({ status, label }: { status: Step; label: string }) {
  return (
    <div style={stepRowStyle}>
      <div style={{
        ...stepIconStyle,
        background:
          status === 'done'   ? T.long :
          status === 'active' ? T.accent :
          status === 'error'  ? T.short :
          T.bgElev,
        boxShadow:
          status === 'active' ? `0 0 12px ${T.accentDim}` :
          status === 'done'   ? `0 0 8px ${T.long}66` :
          'none',
      }}>
        {status === 'done'   && <CheckMark />}
        {status === 'active' && <Spinner />}
        {status === 'error'  && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>!</span>}
      </div>
      <span style={{
        fontSize: 13,
        color:
          status === 'done'   ? T.text :
          status === 'active' ? T.text :
          status === 'error'  ? T.short :
          T.textMute,
        fontWeight: status === 'active' ? 600 : 400,
      }}>
        {label}
      </span>
    </div>
  );
}

function CheckMark() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
      <path d="M2 6 L5 9 L10 3" stroke={T.bg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 10,
      height: 10,
      border: `2px solid ${T.bg}33`,
      borderTopColor: T.bg,
      borderRadius: '50%',
      animation: 'spin 0.6s linear infinite',
    }} />
  );
}

function BotIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M12 2v3m-7 4h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2v-9a2 2 0 012-2zm4 6h.01M14 14h.01M9 18h6"
        stroke={T.bg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={T.short} strokeWidth="2" />
      <line x1="12" y1="8" x2="12" y2="12" stroke={T.short} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1" fill={T.short} />
    </svg>
  );
}

function Glow() {
  return (
    <div style={{
      position: 'absolute',
      top: -100,
      right: -100,
      width: 240,
      height: 240,
      background: `radial-gradient(circle, ${T.accentDim}, transparent 70%)`,
      pointerEvents: 'none',
    }} />
  );
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function decodeOauthError(code: string): string {
  switch (code) {
    case 'access_denied':         return 'Você cancelou o login na Avalon.';
    case 'invalid_request':       return 'Requisição inválida para a Avalon.';
    case 'unauthorized_client':   return 'Cliente não autorizado.';
    case 'server_error':          return 'A Avalon está com instabilidade. Tente novamente em instantes.';
    case 'temporarily_unavailable': return 'Serviço temporariamente indisponível.';
    default: return 'Erro: ' + code;
  }
}

const containerStyle = {
  minHeight: '100vh',
  background: T.bg,
  color: T.text,
  display: 'grid',
  placeItems: 'center',
  fontFamily: '"Inter", "SF Pro Text", -apple-system, sans-serif',
  padding: 24,
};

const cardStyle = {
  background: T.panel,
  border: `1px solid ${T.border}`,
  borderRadius: 16,
  padding: 36,
  maxWidth: 440,
  width: '100%',
  textAlign: 'center' as const,
  position: 'relative' as const,
  overflow: 'hidden' as const,
};

const iconWrapStyle = {
  width: 56,
  height: 56,
  borderRadius: 14,
  display: 'grid',
  placeItems: 'center',
  margin: '0 auto 20px',
  position: 'relative' as const,
};

const titleStyle = {
  margin: '0 0 8px',
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: '-0.01em',
  color: T.text,
};

const textStyle = {
  margin: '0 0 24px',
  color: T.textDim,
  fontSize: 13,
  lineHeight: 1.5,
};

const stepsListStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 12,
  alignItems: 'flex-start',
  marginTop: 24,
  padding: '20px 0 0',
  borderTop: `1px solid ${T.border}`,
};

const stepRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  textAlign: 'left' as const,
};

const stepIconStyle = {
  width: 22,
  height: 22,
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
  transition: 'all 240ms',
};

const buttonStyle = {
  display: 'inline-block',
  padding: '10px 20px',
  background: T.accent,
  color: T.bg,
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: '0.04em',
  borderRadius: 8,
  textDecoration: 'none',
  position: 'relative' as const,
};
