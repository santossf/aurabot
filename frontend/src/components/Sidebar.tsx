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
  { key: 'painel',    label: 'Painel',    icon: LayoutDashboard, section: 'PLATAFORMA' },
  { key: 'scalping',  label: 'Scalping',  icon: Zap,             section: 'PLATAFORMA' },
  { key: 'aprender',  label: 'Aprender',  icon: BookOpen,        section: 'APRENDER' },
  { key: 'perfil',    label: 'Perfil',    icon: User,            section: 'PERFIL' },
];

export function Sidebar({ active, onChange, marketOpen = true, onLogout }: SidebarProps) {
  // Agrupa por section, preservando ordem
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
    <aside style={asideStyle}>
      {/* Logo */}
      <div style={logoBlockStyle}>
        <div style={logoIconStyle}>
          <Bot size={18} color={T.bg} strokeWidth={2.5} />
        </div>
        <div>
          <div style={logoTextStyle}>
            AURAA<span style={{ color: T.accent }}>.BOT</span>
          </div>
          <div style={logoSubStyle}>AUTOMATED TRADING</div>
        </div>
      </div>

      {/* Nav sections */}
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
                  <Icon
                    size={16}
                    color={isActive ? T.accent : T.textDim}
                    strokeWidth={2}
                  />
                  <span style={{ color: isActive ? T.text : T.textDim }}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer: status + logout */}
      <div style={footerStyle}>
        <div style={marketStatusStyle}>
          <span style={{
            ...marketDotStyle,
            background: marketOpen ? T.long : T.textMute,
            boxShadow: marketOpen ? `0 0 8px ${T.long}` : 'none',
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
  );
}

const asideStyle = {
  width: 240,
  minHeight: '100vh',
  background: T.bgElev,
  borderRight: `1px solid ${T.border}`,
  display: 'flex',
  flexDirection: 'column' as const,
  padding: '24px 16px',
  position: 'sticky' as const,
  top: 0,
  flexShrink: 0,
};

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

const navStyle = {
  flex: 1,
  marginTop: 8,
};

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

const marketDotStyle = {
  width: 8,
  height: 8,
  borderRadius: '50%',
} as const;

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
