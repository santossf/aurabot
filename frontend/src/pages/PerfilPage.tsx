import { User, Mail, Shield, LogOut, ExternalLink } from 'lucide-react';
import { theme as T } from '../lib/theme';

interface PerfilPageProps {
  user: { id: string; name?: string; email?: string };
  onLogout: () => void;
}

export function PerfilPage({ user, onLogout }: PerfilPageProps) {
  const initials = user.name
    ? user.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : '?';

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div style={{ fontSize: 11, letterSpacing: '0.12em', color: T.textMute, marginBottom: 4 }}>
          MINHA CONTA
        </div>
        <h1 style={titleStyle}>Perfil</h1>
      </header>

      {/* Card principal: identidade */}
      <div style={identityCardStyle}>
        <div style={avatarStyle}>{initials}</div>
        <div style={{ flex: 1 }}>
          <div style={nameStyle}>
            {user.name ?? 'Usuário Avalon'}
          </div>
          <div style={subInfoStyle}>
            ID #{user.id} · Conectado via Avalon Broker
          </div>
        </div>
        <div style={{
          padding: '6px 12px',
          background: T.longSoft,
          color: T.long,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          borderRadius: 6,
        }}>
          ATIVO
        </div>
      </div>

      {/* Seções: dados / segurança / suporte */}
      <div style={sectionsGridStyle}>
        <Section
          title="Dados da conta"
          icon={<User size={18} color={T.accent} />}
          rows={[
            { label: 'Nome', value: user.name ?? '—' },
            { label: 'ID Avalon', value: '#' + user.id },
            { label: 'Conexão', value: 'OAuth (Avalon Broker)' },
          ]}
        />

        <Section
          title="Segurança"
          icon={<Shield size={18} color={T.accent} />}
          rows={[
            { label: 'Autenticação', value: 'PKCE OAuth 2.0' },
            { label: 'Tokens', value: 'Sessão (não persistem ao fechar aba)' },
          ]}
        />
      </div>

      {/* Suporte */}
      <div style={supportCardStyle}>
        <Mail size={20} color={T.accent} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>
            Precisa de ajuda?
          </div>
          <div style={{ fontSize: 13, color: T.textDim }}>
            Entre em contato com o suporte da Avalon ou da Auraa.
          </div>
        </div>
        <a
          href="https://trade.avalonbroker.com"
          target="_blank"
          rel="noopener noreferrer"
          style={supportLinkStyle}
        >
          Avalon <ExternalLink size={12} />
        </a>
      </div>

      {/* Botão logout */}
      <button
        onClick={onLogout}
        style={logoutButtonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = T.short;
          e.currentTarget.style.color = T.short;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = T.border;
          e.currentTarget.style.color = T.textDim;
        }}
      >
        <LogOut size={14} />
        Sair da conta
      </button>
    </div>
  );
}

function Section({
  title, icon, rows,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { label: string; value: string }[];
}) {
  return (
    <div style={sectionCardStyle}>
      <div style={sectionHeaderStyle}>
        {icon}
        <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{title}</span>
      </div>
      <div>
        {rows.map((row, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0',
              borderTop: i === 0 ? 'none' : `1px solid ${T.border}`,
              fontSize: 13,
            }}
          >
            <span style={{ color: T.textDim }}>{row.label}</span>
            <span style={{ color: T.text, fontWeight: 500 }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const containerStyle = {
  flex: 1,
  padding: '32px 40px 48px',
  maxWidth: 1024,
  margin: '0 auto',
  width: '100%',
};

const headerStyle = {
  marginBottom: 24,
};

const titleStyle = {
  fontSize: 32,
  fontWeight: 700,
  color: T.text,
  margin: 0,
  letterSpacing: '-0.02em',
};

const identityCardStyle = {
  background: T.panel,
  border: `1px solid ${T.border}`,
  borderRadius: 16,
  padding: 24,
  display: 'flex',
  alignItems: 'center',
  gap: 20,
  marginBottom: 24,
};

const avatarStyle = {
  width: 64,
  height: 64,
  borderRadius: 16,
  background: `linear-gradient(135deg, ${T.accent}, ${T.accentDeep})`,
  color: T.bg,
  display: 'grid',
  placeItems: 'center',
  fontSize: 24,
  fontWeight: 700,
  boxShadow: `0 0 24px ${T.accentDim}`,
};

const nameStyle = {
  fontSize: 20,
  fontWeight: 700,
  color: T.text,
  marginBottom: 4,
  letterSpacing: '-0.01em',
};

const subInfoStyle = {
  fontSize: 12,
  color: T.textDim,
};

const sectionsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 16,
  marginBottom: 24,
};

const sectionCardStyle = {
  background: T.panel,
  border: `1px solid ${T.border}`,
  borderRadius: 14,
  padding: 20,
};

const sectionHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 16,
  paddingBottom: 12,
  borderBottom: `1px solid ${T.border}`,
};

const supportCardStyle = {
  background: T.panel,
  border: `1px solid ${T.border}`,
  borderRadius: 14,
  padding: 20,
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  marginBottom: 24,
};

const supportLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  background: 'transparent',
  border: `1px solid ${T.borderHi}`,
  color: T.accent,
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textDecoration: 'none',
};

const logoutButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 20px',
  background: 'transparent',
  border: `1px solid ${T.border}`,
  color: T.textDim,
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 120ms',
};
