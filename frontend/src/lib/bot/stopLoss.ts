/**
 * ============================================================================
 * STOP LOSS — cálculo matemático
 * ----------------------------------------------------------------------------
 * O stop loss não é um campo escolhido pelo usuário; é a CONSEQUÊNCIA dos
 * parâmetros (entrada, multiplicador, qtd. de gales).
 *
 *   entrada inicial = E
 *   após loss aplica multiplicador M, então:
 *     gale_n = E * M^n
 *
 *   perda máxima = E + E*M + E*M² + ... + E*M^maxGales
 *                = E * (M^(maxGales+1) - 1) / (M - 1)   se M ≠ 1
 *
 * O usuário VÊ esse valor em tela. O bot RESPEITA esse valor: se atingir
 * a quantidade máxima de gales sem recuperar, ele para e exige confirmação.
 * ============================================================================
 */

export interface StopLossInputs {
  entryValue: number;
  multiplier: number;
  maxGales: number;
  balance: number;
}

export interface StopLossResult {
  maxLoss: number;
  maxLossPct: number;            // % da banca
  lossesAcceptable: number;      // número de losses consecutivos que zera o stop
  balanceAfterStop: number;
  multiplier: number;
  /** Severity para color-coding na UI: 'safe' < 'caution' < 'danger' */
  severity: 'safe' | 'caution' | 'danger';
  /** Sequência detalhada — útil pra mostrar no tooltip */
  sequence: { galeLevel: number; amount: number; cumulative: number }[];
}

export function computeStopLoss({ entryValue, multiplier, maxGales, balance }: StopLossInputs): StopLossResult {
  const sequence: { galeLevel: number; amount: number; cumulative: number }[] = [];
  let cumulative = 0;

  for (let n = 0; n <= maxGales; n++) {
    const amount = entryValue * Math.pow(multiplier, n);
    cumulative += amount;
    sequence.push({ galeLevel: n, amount, cumulative });
  }

  const maxLoss = cumulative;
  const maxLossPct = balance > 0 ? (maxLoss / balance) * 100 : 0;
  const balanceAfterStop = Math.max(0, balance - maxLoss);

  let severity: StopLossResult['severity'] = 'safe';
  if (maxLossPct > 8) severity = 'danger';
  else if (maxLossPct > 3) severity = 'caution';

  return {
    maxLoss,
    maxLossPct,
    lossesAcceptable: maxGales + 1,
    balanceAfterStop,
    multiplier,
    severity,
    sequence,
  };
}
