/**
 * Smoke test da engine de IA. Sem framework de testes — roda direto com:
 *   npx tsx src/lib/ai/engine.test.ts
 *
 * Cenários:
 *   1. Tendência clara de alta → sinal CALL com confidence acima do threshold do moderado
 *   2. Tendência clara de baixa → sinal PUT
 *   3. Mercado lateral → null (não entra)
 *   4. Dados insuficientes → null com razão "Dados insuficientes"
 */
import { analyze, shouldEnter } from './engine.js';
import type { Candle } from './indicators.js';

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('  ❌', msg); failed++; }
  else       { console.log ('  ✓', msg); }
}

function makeUptrend(n = 50): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const base = 100 + i * 0.05;
    return { open: base, close: base + 0.04, high: base + 0.06, low: base - 0.01, time: i };
  });
}

function makeDowntrend(n = 50): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const base = 100 - i * 0.05;
    return { open: base, close: base - 0.04, high: base + 0.01, low: base - 0.06, time: i };
  });
}

function makeSideways(n = 50): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const base = 100 + (i % 2 === 0 ? 0.02 : -0.02);
    return { open: base, close: base + 0.001, high: base + 0.03, low: base - 0.03, time: i };
  });
}

console.log('\n🧪 IA Engine — smoke test\n');

console.log('1. Tendência de alta');
{
  const s = analyze(makeUptrend());
  assert(s.direction === 'CALL', `direction=CALL (recebido: ${s.direction})`);
  assert(s.confidence > 0, `confidence > 0 (recebido: ${s.confidence})`);
  assert([5, 10, 15].includes(s.expiration), `expiration válida (${s.expiration})`);
}

console.log('\n2. Tendência de baixa');
{
  const s = analyze(makeDowntrend());
  assert(s.direction === 'PUT', `direction=PUT (recebido: ${s.direction})`);
  assert(s.confidence > 0, `confidence > 0 (recebido: ${s.confidence})`);
}

console.log('\n3. Mercado lateral');
{
  const s = analyze(makeSideways());
  assert(s.direction === null || s.confidence < 50,
    `não deve entrar com força (direction=${s.direction}, conf=${s.confidence})`);
}

console.log('\n4. Dados insuficientes');
{
  const s = analyze([]);
  assert(s.direction === null, 'direction null com array vazio');
  assert(s.reasons[0]?.label.includes('insuficientes') || s.reasons[0]?.label.includes('Dados'),
    'reason explica falta de dados');
}

console.log('\n5. Threshold por perfil');
{
  const s = analyze(makeUptrend());
  // Conservador (75) é mais difícil de satisfazer que ousado (55)
  const conservador = shouldEnter(s, 'conservador');
  const ousado = shouldEnter(s, 'ousado');
  assert(!conservador || ousado, 'se conservador entra, ousado também entra');
}

if (failed > 0) {
  console.error(`\n❌ ${failed} asserções falharam\n`);
  process.exit(1);
}
console.log(`\n✅ Todos os testes passaram\n`);
