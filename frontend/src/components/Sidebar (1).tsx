/**
 * Sidebar — navegação principal.
 * Desktop (≥768px): painel lateral esquerdo
 * Mobile (<768px):  bottom nav bar fixa com ícones + label curto
 */
import { LayoutDashboard, Zap, BookOpen, User, Bot, LogOut } from 'lucide-react';
import { theme as T } from '../lib/theme';

export type NavKey = 'painel' | 'scalping' | 'aprender' | 'perfil';

interface SidebarProps {
  active: NavKey;
  onChange: (key: NavKey) => void;
  marketOpen?: boolean;
  onLogout: () => void;
}

const ITEMS: { key: NavKey; label: string; icon: typeof Bot; section: string }[] = [
  { key: 'painel',   label: 'Painel',   icon: LayoutDashboard, section: 'PLATAFORMA' },
  { key: 'scalping', label: 'Scalping', icon: Zap,             section: 'PLATAFORMA' },
  { key: 'aprender', label: 'Aprender', icon: BookOpen,        section: 'APRENDER' },
  { key: 'perfil',   label: 'Perfil',   icon: User,            section: 'PERFIL' },
];

export function Sidebar({ active, onChange, marketOpen = true, onLogout }: SidebarProps) {
  const sections: { name: string; items: typeof ITEMS }[] = [];
  for (const item of ITEMS) {
    const last = sections[sections.length - 1];
    if (last && last.name === item.section) {
      last.items.push(item);
    } else {
      sections.push({ name: item.section, items: [item] });
    }
  }

  return (
    <>
      <style>{`
        .auraa-sidebar {
          width: 240px;
          min-height: 100vh;
          height: 100vh;
          background: ${T.bgElev};
          border-right: 1px solid ${T.border};
          display: flex;
          flex-direction: column;
          padding: 24px 16px;
          position: sticky;
          top: 0;
          flex-shrink: 0;
          overflow-y: auto;
        }
        .auraa-bottom-nav { display: none; }

        @media (max-width: 768px) {
          .auraa-sidebar { display: none; }
          .auraa-bottom-nav {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 100;
            background: ${T.bgElev};
            border-top: 1px solid ${T.border};
            height: 64px;
            align-items: stretch;
            backdrop-filter: blur(12px);
          }
        }
      `}</style>

      {/* Desktop sidebar */}
      <aside className="auraa-sidebar">
        <div style={logoBlockStyle}>
          <div style={logoIconStyle}>
            <Bot size={18} color={T.bg} strokeWidth={2.5} />
          </div>
          <div>
            <div style={logoTextStyle}>
              AURA <span style={{ color: T.accent }}>BOT</span>
            </div>
            <div style={logoSubStyle}>AUTOMATED TRADING</div>
          </div>
        </div>

        <nav style={navStyle}>
          {sections.map(section => (
            <div key={section.name} style={{ marginBottom: 24 }}>
              <div style={sectionLabelStyle}>{section.name}</div>
              {section.items.map(item => {
                const Icon = item.icon;
                const isActive = active === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => onChange(item.key)}
                    style={{
                      ...navItemStyle,
                      ...(isActive ? navItemActiveStyle : null),
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = T.panelHi;
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Icon size={16} color={isActive ? T.accent : T.textDim} strokeWidth={2} />
                    <span style={{ color: isActive ? T.text : T.textDim }}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={footerStyle}>
          <div style={marketStatusStyle}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: marketOpen ? T.long : T.textMute,
              boxShadow: marketOpen ? `0 0 8px ${T.long}` : 'none',
              display: 'inline-block',
            }} />
            <span style={{ fontSize: 11, letterSpacing: '0.06em', color: T.textDim }}>
              {marketOpen ? 'MERCADO ABERTO' : 'MERCADO FECHADO'}
            </span>
          </div>
          <button
            onClick={onLogout}
            style={logoutBtnStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = T.panelHi;
              e.currentTarget.style.color = T.short;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = T.textDim;
            }}
          >
            <LogOut size={14} strokeWidth={2} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="auraa-bottom-nav">
        {ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px 4px',
                fontFamily: 'inherit',
                borderTop: isActive ? `2px solid ${T.accent}` : '2px solid transparent',
              }}
            >
              <Icon size={20} color={isActive ? T.accent : T.textDim} strokeWidth={2} />
              <span style={{
                fontSize: 10,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? T.accent : T.textDim,
                letterSpacing: '0.04em',
              }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

const logoBlockStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '0 8px 24px',
  marginBottom: 8,
  borderBottom: `1px solid ${T.border}`,
};

const logoIconStyle = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: `linear-gradient(135deg, ${T.accent}, ${T.accentDeep})`,
  display: 'grid',
  placeItems: 'center',
  boxShadow: `0 0 20px ${T.accentGlow}`,
} as const;

const logoTextStyle = {
  fontWeight: 700,
  letterSpacing: '-0.02em',
  fontSize: 15,
  color: T.text,
  lineHeight: 1.1,
};

const logoSubStyle = {
  fontSize: 9,
  color: T.textMute,
  letterSpacing: '0.1em',
  marginTop: 3,
};

const navStyle = { flex: 1, marginTop: 8 };

const sectionLabelStyle = {
  fontSize: 10,
  letterSpacing: '0.12em',
  color: T.textMute,
  fontWeight: 600,
  padding: '0 8px 8px',
};

const navItemStyle = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 12px',
  background: 'transparent',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'inherit',
  textAlign: 'left' as const,
  marginBottom: 2,
  transition: 'background 120ms',
};

const navItemActiveStyle = {
  background: T.accentSoft,
  borderLeft: `2px solid ${T.accent}`,
  paddingLeft: 10,
};

const footerStyle = {
  paddingTop: 16,
  borderTop: `1px solid ${T.border}`,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 12,
};

const marketStatusStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
};

const logoutBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  background: 'transparent',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  color: T.textDim,
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'inherit',
  transition: 'all 120ms',
};
