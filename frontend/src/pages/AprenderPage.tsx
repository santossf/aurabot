import { BookOpen, PlayCircle, Users, MessageCircle, ExternalLink } from 'lucide-react';
import { theme as T } from '../lib/theme';

export function AprenderPage() {
  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div style={{ fontSize: 11, letterSpacing: '0.12em', color: T.textMute, marginBottom: 4 }}>
          ESCOLA AURAA
        </div>
        <h1 style={titleStyle}>Aprender a operar com IA</h1>
        <p style={subtitleStyle}>
          Conteúdo em construção. Em breve: cursos completos sobre scalping com IA, gestão
          de risco, e psicologia de trader.
        </p>
      </header>

      <div style={gridStyle}>
        <Card
          icon={<PlayCircle size={22} color={T.accent} />}
          tag="VÍDEO-AULAS"
          title="Da fundação à estratégia"
          description="Cursos curtos e práticos sobre como configurar bots, interpretar sinais da IA e gerir banca."
          status="EM BREVE"
        />

        <Card
          icon={<MessageCircle size={22} color={T.accent} />}
          tag="COMUNIDADE"
          title="WhatsApp dos operadores"
          description="Sinais, debates e suporte direto com traders ativos. Tire dúvidas e aprenda na prática."
          status="EM BREVE"
        />

        <Card
          icon={<Users size={22} color={T.accent} />}
          tag="MENTORIA"
          title="Trilhas práticas"
          description="Mentorias 1:1 e em grupo para acelerar sua curva de aprendizado."
          status="EM BREVE"
        />

        <Card
          icon={<BookOpen size={22} color={T.accent} />}
          tag="DOCUMENTAÇÃO"
          title="Como funciona a IA da Auraa"
          description="Explicação técnica e em linguagem simples sobre os indicadores, perfis de risco e o motor de decisão."
          status="EM BREVE"
        />
      </div>
    </div>
  );
}

function Card({
  icon, tag, title, description, status,
}: {
  icon: React.ReactNode;
  tag: string;
  title: string;
  description: string;
  status?: string;
}) {
  return (
    <div style={cardStyle}>
      <div style={iconWrapStyle}>{icon}</div>
      <div style={{
        fontSize: 10,
        letterSpacing: '0.12em',
        color: T.textMute,
        marginTop: 16,
        marginBottom: 6,
      }}>
        {tag}
      </div>
      <h3 style={cardTitleStyle}>{title}</h3>
      <p style={cardDescStyle}>{description}</p>
      {status && (
        <div style={statusBadgeStyle}>
          {status}
        </div>
      )}
    </div>
  );
}

const containerStyle = {
  flex: 1,
  padding: '32px 40px 48px',
  maxWidth: 1280,
  margin: '0 auto',
  width: '100%',
};

const headerStyle = {
  marginBottom: 32,
};

const titleStyle = {
  fontSize: 32,
  fontWeight: 700,
  color: T.text,
  margin: '0 0 12px',
  letterSpacing: '-0.02em',
};

const subtitleStyle = {
  fontSize: 14,
  color: T.textDim,
  maxWidth: 600,
  lineHeight: 1.6,
  margin: 0,
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: 16,
};

const cardStyle = {
  background: T.panel,
  border: `1px solid ${T.border}`,
  borderRadius: 16,
  padding: 24,
};

const iconWrapStyle = {
  width: 44,
  height: 44,
  borderRadius: 10,
  background: T.accentSoft,
  display: 'grid',
  placeItems: 'center',
};

const cardTitleStyle = {
  fontSize: 17,
  fontWeight: 700,
  color: T.text,
  margin: '0 0 8px',
  letterSpacing: '-0.01em',
};

const cardDescStyle = {
  fontSize: 13,
  color: T.textDim,
  lineHeight: 1.6,
  margin: '0 0 16px',
};

const statusBadgeStyle = {
  display: 'inline-block',
  padding: '4px 10px',
  background: T.bgElev,
  border: `1px solid ${T.border}`,
  color: T.textMute,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  borderRadius: 4,
};
