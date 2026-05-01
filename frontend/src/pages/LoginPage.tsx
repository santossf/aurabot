import { useEffect, useState } from 'react';
import { Bot, Sparkles, Shield, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { startAvalonLogin } from '../lib/avalonClient';

const T = {
  bg:        '#0A0E14',
  bgElev:    '#0F141C',
  panel:     '#121821',
  panelHi:   '#171E29',
  border:    '#1F2733',
  borderHi:  '#2A3441',
  text:      '#E6EDF3',
  textDim:   '#8B97A8',
  textMute:  '#5C677A',
  accent:    '#00E0B8',
  accentDim: '#00E0B833',
  long:      '#26D782',
  short:     '#F0506E',
  warn:      '#F5A524',
};

const ERROR_LABELS: Record<string, string> = {
  oauth_init_failed:    'Não foi possível iniciar o login. Tente novamente.',
  missing_code:         'Resposta inválida da corretora.',
  state_mismatch:       'Sessão expirada por segurança. Tente de novo.',
  missing_verifier:     'Sessão expirada. Reinicie o login.',
  token_exchange_failed:'Falha ao validar com a corretora.',
  access_denied:        'Você cancelou o login na Avalon.',
};

export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Captura erros vindos do callback via ?error=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) {
      setError(ERROR_LABELS[err] ?? 'Não foi possível autenticar. Tente novamente.');
      // limpa a URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const startLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = await startAvalonLogin();
      window.location.href = url;
    } catch (err) {
      console.error(err);
      setError('Não foi possível iniciar o login. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: T.bg,
        color: T.text,
        fontFamily: '"Inter", "SF Pro Text", -apple-system, sans-serif',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
      }}
    >
      <style>{globalCSS}</style>

      {/* COLUNA ESQUERDA — Marca + benefícios */}
      <aside
        style={{
          padding: '48px 56px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: `radial-gradient(ellipse at top left, ${T.accent}0F, transparent 60%), ${T.bg}`,
          borderRight: `1px solid ${T.border}`,
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38, height: 38, borderRadius: 10,
              background: `linear-gradient(135deg, ${T.accent}, ${T.accent}55)`,
              display: 'grid', placeItems: 'center',
              boxShadow: `0 0 24px ${T.accentDim}`,
            }}
          >
            <Bot size={20} color={T.bg} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontWeight: 700, letterSpacing: '-0.02em', fontSize: 18 }}>
              SCALPER<span style={{ color: T.accent }}>.AI</span>
            </div>
            <div style={{ fontSize: 11, color: T.textMute, letterSpacing: '0.08em' }}>
              AUTOMATED TRADING SYSTEM
            </div>
          </div>
        </div>

        {/* Hero */}
        <div>
          <div
            style={{
              fontSize: 11, letterSpacing: '0.2em', color: T.accent,
              marginBottom: 14, fontWeight: 600,
            }}
          >
            ◢ ACESSO RESTRITO
          </div>
          <h1
            style={{
              fontSize: 'clamp(32px, 3.5vw, 48px)',
              fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05,
              margin: 0, maxWidth: 480,
            }}
          >
            Sua conta na Avalon,<br />
            <span style={{ color: T.textDim, fontWeight: 400 }}>
              integrada à nossa IA.
            </span>
          </h1>
          <p style={{ color: T.textDim, fontSize: 15, maxWidth: 460, marginTop: 18, lineHeight: 1.6 }}>
            Faça login com sua conta da Avalon Broker para autorizar o robô a operar
            por você. Suas credenciais nunca passam pelos nossos servidores.
          </p>
        </div>

        {/* Bullets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Bullet icon={<Shield size={14} />}>
            Autenticação via OAuth — nós nunca vemos sua senha.
          </Bullet>
          <Bullet icon={<Lock size={14} />}>
            Tokens criptografados em sessão httpOnly.
          </Bullet>
          <Bullet icon={<Sparkles size={14} />}>
            Acesso à IA, comunidade e materiais de aprendizado.
          </Bullet>
        </div>
      </aside>

      {/* COLUNA DIREITA — Card de login */}
      <main
        style={{
          display: 'grid',
          placeItems: 'center',
          padding: '40px',
          background: T.bgElev,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            background: T.panel,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            padding: 36,
            boxShadow: `0 20px 60px -20px ${T.accent}1A`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* glow */}
          <div
            style={{
              position: 'absolute',
              top: -80, right: -80,
              width: 200, height: 200,
              background: `radial-gradient(circle, ${T.accent}22, transparent 70%)`,
              pointerEvents: 'none',
            }}
          />

          <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Entrar na plataforma
          </h2>
          <p style={{ margin: '0 0 28px', color: T.textDim, fontSize: 13, lineHeight: 1.55 }}>
            Use sua conta da <b style={{ color: T.text }}>Avalon Broker</b>. Se ainda não
            tiver, você poderá criar uma na próxima tela.
          </p>

          {error && (
            <div
              style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                background: T.short + '14',
                border: `1px solid ${T.short}55`,
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 18,
                fontSize: 12,
                color: T.short,
              }}
            >
              <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={startLogin}
            disabled={loading}
            style={{
              all: 'unset',
              cursor: loading ? 'wait' : 'pointer',
              width: '100%',
              boxSizing: 'border-box',
              padding: '14px 20px',
              background: loading
                ? T.panelHi
                : `linear-gradient(135deg, ${T.accent}, ${T.long})`,
              color: loading ? T.textDim : T.bg,
              fontWeight: 700,
              letterSpacing: '0.04em',
              fontSize: 13,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'all 150ms',
              boxShadow: loading ? 'none' : `0 0 24px ${T.accentDim}`,
            }}
          >
            {loading ? (
              <>
                <Spinner /> REDIRECIONANDO...
              </>
            ) : (
              <>
                ENTRAR COM AVALON
                <ArrowRight size={14} />
              </>
            )}
          </button>

          <div
            style={{
              marginTop: 22,
              padding: '12px 14px',
              background: T.bgElev,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              fontSize: 11,
              color: T.textMute,
              lineHeight: 1.6,
              letterSpacing: '0.02em',
            }}
          >
            Ao continuar, você será redirecionado para
            <b style={{ color: T.textDim }}> trade.avalonbroker.com</b> para autorizar
            o acesso. Você pode revogar a qualquer momento na corretora.
          </div>

          <div style={{ marginTop: 24, fontSize: 11, color: T.textMute, textAlign: 'center' }}>
            Problemas para entrar?{' '}
            <a href="#" style={{ color: T.accent, textDecoration: 'none' }}>Fale com o suporte</a>
          </div>
        </div>
      </main>
    </div>
  );
}

function Bullet({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.textDim, fontSize: 13 }}>
      <span
        style={{
          width: 26, height: 26, borderRadius: 7,
          background: T.panel, border: `1px solid ${T.border}`,
          display: 'grid', placeItems: 'center', color: T.accent,
        }}
      >
        {icon}
      </span>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <span
      style={{
        width: 14, height: 14,
        border: `2px solid ${T.textMute}`,
        borderTopColor: 'transparent',
        borderRadius: '50%',
        display: 'inline-block',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  );
}

const globalCSS = `
  * { box-sizing: border-box; }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
