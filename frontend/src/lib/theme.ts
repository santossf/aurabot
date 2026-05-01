/**
 * Design tokens — Auraa.bot
 * Paleta roxa premium para contexto trading.
 * Para mudar cores globalmente, basta editar este arquivo.
 */
export const theme = {
  // Backgrounds (escuro premium)
  bg:        '#0A0E14',
  bgElev:    '#0F141C',
  panel:     '#121821',
  panelHi:   '#171E29',

  // Borders
  border:    '#1F2733',
  borderHi:  '#2A3441',

  // Text
  text:      '#E6EDF3',
  textDim:   '#8B97A8',
  textMute:  '#5C677A',

  // Accent — roxo violeta premium
  accent:        '#8B5CF6',  // violet-500
  accentBright:  '#A78BFA',  // violet-400 (hover/glow)
  accentDeep:    '#7C3AED',  // violet-600 (pressed)
  accentDim:     '#8B5CF633', // 20% opacity overlay
  accentSoft:    '#8B5CF614', // 8% opacity (bg sutil)
  accentGlow:    '#8B5CF666', // 40% opacity (sombra)

  // Trading specific
  long:      '#26D782',  // verde compra
  short:     '#F0506E',  // vermelho venda
  warn:      '#F5B53A',  // amarelo alerta
  longSoft:  '#26D78222',
  shortSoft: '#F0506E22',
} as const;

export type Theme = typeof theme;
