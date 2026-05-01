/**
 * Profile Suggester
 * ----------------------------------------------------------------------------
 * Recebe a banca atual e sugere um perfil de risco com parâmetros otimizados.
 * Lógica pura — fácil de testar e ajustar.
 *
 * Filosofia:
 *   - Banca pequena → conservador (proteger capital)
 *   - Banca média   → moderado    (equilíbrio)
 *   - Banca grande  → ousado      (potencial maior, com gestão)
 *
 * O usuário sempre pode sobrescrever os valores sugeridos.
 */
import type { Profile } from './ai/engine';

export interface SuggestedConfig {
  profile: Profile;
  /** Valor de entrada inicial em $ (não em %) */
  entryAmount: number;
  /** % da banca que isso representa */
  entryPercent: number;
  /** Quantas perdas consecutivas antes de parar */
  maxConsecutiveLosses: number;
  /** Multiplicador aplicado após cada loss (gale) */
  lossMultiplier: number;
  /** Take profit em $ */
  takeProfit: number;
  /** % da banca que o TP representa */
  takeProfitPercent: number;
  /** Stop loss calculado (consequência de entry × mult^losses) em $ */
  stopLoss: number;
  /** % da banca que o SL representa */
  stopLossPercent: number;
  /** Justificativa textual da sugestão */
  reasoning: string;
}

/**
 * Tabela de presets por perfil.
 * Os valores em % são aplicados sobre a banca atual.
 */
const PRESETS: Record<Profile, {
  entryPercent: number;
  maxConsecutiveLosses: number;
  lossMultiplier: number;
  takeProfitPercent: number;
}> = {
  conservador: {
    entryPercent:         1.0,   // 1% da banca
    maxConsecutiveLosses: 1,     // só 1 gale
    lossMultiplier:       2.0,   // 2x após loss
    takeProfitPercent:    3.0,   // 3% da banca
  },
  moderado: {
    entryPercent:         2.5,
    maxConsecutiveLosses: 2,
    lossMultiplier:       2.2,
    takeProfitPercent:    5.0,
  },
  ousado: {
    entryPercent:         5.0,
    maxConsecutiveLosses: 3,
    lossMultiplier:       2.5,
    takeProfitPercent:    8.0,
  },
};

/**
 * Decide o perfil baseado na banca.
 *   < $200    → conservador (banca pequena, prioriza preservação)
 *   < $1000   → moderado    (espaço para crescer com gestão)
 *   >= $1000  → ousado      (capital suficiente para suportar drawdown)
 */
export function suggestProfileForBalance(balance: number): Profile {
  if (balance < 200)  return 'conservador';
  if (balance < 1000) return 'moderado';
  return 'ousado';
}

/**
 * Gera config completa baseada em perfil + banca.
 */
export function buildConfig(profile: Profile, balance: number): SuggestedConfig {
  const preset = PRESETS[profile];

  const entryAmount = round2(balance * (preset.entryPercent / 100));

  // Stop loss = soma da sequência geométrica de gales
  // SL = entry × (1 + mult + mult² + ... + mult^maxLosses)
  let slMultiplier = 0;
  for (let i = 0; i <= preset.maxConsecutiveLosses; i++) {
    slMultiplier += Math.pow(preset.lossMultiplier, i);
  }
  const stopLoss = round2(entryAmount * slMultiplier);
  const stopLossPercent = round2((stopLoss / balance) * 100);

  const takeProfit = round2(balance * (preset.takeProfitPercent / 100));

  return {
    profile,
    entryAmount,
    entryPercent: preset.entryPercent,
    maxConsecutiveLosses: preset.maxConsecutiveLosses,
    lossMultiplier: preset.lossMultiplier,
    takeProfit,
    takeProfitPercent: preset.takeProfitPercent,
    stopLoss,
    stopLossPercent,
    reasoning: buildReasoning(profile, balance, stopLossPercent, preset.takeProfitPercent),
  };
}

/**
 * Gera config sugerida automaticamente para a banca dada.
 * Atalho para suggestProfileForBalance + buildConfig.
 */
export function suggestConfigForBalance(balance: number): SuggestedConfig {
  const profile = suggestProfileForBalance(balance);
  return buildConfig(profile, balance);
}

/* ============================================================
 * Helpers
 * ============================================================ */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildReasoning(
  profile: Profile,
  balance: number,
  slPercent: number,
  tpPercent: number,
): string {
  const balanceTier =
    balance < 200  ? 'inicial' :
    balance < 1000 ? 'em construção' :
                     'consolidada';

  const profileLabels: Record<Profile, string> = {
    conservador: 'Conservador',
    moderado:    'Moderado',
    ousado:      'Ousado',
  };

  const reasons: Record<Profile, string> = {
    conservador:
      `Sua banca está em fase ${balanceTier}. Recomendamos o perfil ${profileLabels[profile]} ` +
      `para preservar capital: entradas baixas e apenas 1 gale. ` +
      `Risco máximo de ${slPercent}% por sequência, com meta de ${tpPercent}% por dia.`,
    moderado:
      `Sua banca está ${balanceTier}. O perfil ${profileLabels[profile]} balanceia ` +
      `crescimento e proteção: entradas médias e até 2 gales. ` +
      `Risco controlado em ${slPercent}% por sequência, meta de ${tpPercent}% por dia.`,
    ousado:
      `Sua banca está ${balanceTier} — espaço pra acelerar. Perfil ${profileLabels[profile]} ` +
      `permite até 3 gales com entradas maiores. ` +
      `Risco de ${slPercent}% por sequência, meta agressiva de ${tpPercent}% por dia.`,
  };

  return reasons[profile];
}
