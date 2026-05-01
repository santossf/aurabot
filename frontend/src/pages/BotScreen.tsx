/**
 * BotScreen — tela do bot de scalping.
 *
 * Layout:
 *   Topbar (voltar, ativo, banca)
 *   ┌──────────────────────────────┬─────────────────────┐
 *   │                              │                     │
 *   │  Gráfico (lightweight-charts)│  IntelligenceReport │
 *   │  + ScannerOverlay quando ana │                     │
 *   │                              │                     │
 *   ├──────────────────────────────┤                     │
 *   │  OperationsLog                                      │
 *   └─────────────────────────────────────────────────────┘
 *   + Controles do bot (sidebar direita ou modal)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClientSdk } from '@quadcode-tech/client-sdk-js';
import { ArrowLeft, Wallet, Play, Square, ChevronDown, Sparkles } from 'lucide-react';

import { theme as T } from '../lib/theme';
import { Chart, type ChartMarker } from '../components/Chart';
import { ScannerOverlay } from '../components/ScannerOverlay';
import { IntelligenceReport } from '../components/IntelligenceReport';
import { OperationsLog } from '../components/OperationsLog';
import { StopLossCard } from '../components/StopLossCard';

import { useChartCandles } from '../hooks/useChartCandles';
import { useAvailableActives } from '../hooks/useAvailableActives';
import { useBalances } from '../hooks/useBalances';

import { BotEngine, type BotConfig } from '../lib/bot/engine';
import type {
  Operation,
  BotState,
  SequenceState,
  SessionStats,
  TakeProfitConfig,
  TakeProfitMode,
} from '../lib/bot/types';
import type { Profile, Signal } from '../lib/ai/engine';
import {
  buildConfig,
  suggestProfileForBalance,
} from '../lib/profile-suggester';

interface BotScreenProps {
  sdk: ClientSdk;
  onBack: () => void;
}

export function BotScreen({ sdk, onBack }: BotScreenProps) {
  const { actives, loading: activesLoading } = useAvailableActives(sdk);
  const { balances, selected: selectedBalance, selectKind } = useBalances(sdk);

  const [activeId, setActiveId] = useState<number | null>(null);
  useEffect(() => {
    // Seleciona o primeiro ativo disponível (não suspenso) ao carregar
    if (!activeId && actives.length > 0) {
      const first = actives.find(a => !a.isSuspended) ?? actives[0];
      if (first) setActiveId(first.id);
    }
  }, [actives, activeId]);

  const activeInfo = activeId ? actives.find(a => a.id === activeId) : null;

  // Candles do gráfico
  const { candles, lastCandle, loading: chartLoading } = useChartCandles(sdk, activeId, 1);

  // Estado do bot
  const [botState, setBotState] = useState<BotState>({ kind: 'idle' });
  const [signal, setSignal] = useState<Signal | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [, setSequence] = useState<SequenceState>({ operations: [], lossesInRow: 0, accumulatedLoss: 0 });
  const [, setSession] = useState<SessionStats>({ greensCount: 0, totalPnl: 0, startBalance: 0 });

  const engineRef = useRef<BotEngine | null>(null);

  // Configuração — começa com sugestão da IA baseada na banca
  const balanceAmount = selectedBalance?.amount ?? 0;
  const suggested = useMemo(
    () => buildConfig(suggestProfileForBalance(balanceAmount), balanceAmount || 1000),
    [balanceAmount],
  );

  const [profile, setProfile] = useState<Profile>(suggested.profile);
  const [entryValue, setEntryValue] = useState<number>(suggested.entryAmount);
  const [maxLosses, setMaxLosses] = useState<number>(suggested.maxConsecutiveLosses);
  const [multiplier, setMultiplier] = useState<number>(suggested.lossMultiplier);
  const [tpMode, setTpMode] = useState<TakeProfitMode>('absolute');
  const [tpValue, setTpValue] = useState<number>(suggested.takeProfit);

  // Quando a banca muda, atualiza sugestão (mas só se usuário ainda não personalizou)
  const userTouchedRef = useRef(false);
  useEffect(() => {
    if (userTouchedRef.current) return;
    setProfile(suggested.profile);
    setEntryValue(suggested.entryAmount);
    setMaxLosses(suggested.maxConsecutiveLosses);
    setMultiplier(suggested.lossMultiplier);
    setTpValue(suggested.takeProfit);
  }, [suggested]);

  // Quando muda perfil manualmente, recalcula valores sugeridos pra esse perfil
  const onProfileChange = (newProfile: Profile) => {
    userTouchedRef.current = true;
    setProfile(newProfile);
    if (balanceAmount > 0) {
      const cfg = buildConfig(newProfile, balanceAmount);
      setEntryValue(cfg.entryAmount);
      setMaxLosses(cfg.maxConsecutiveLosses);
      setMultiplier(cfg.lossMultiplier);
      setTpValue(cfg.takeProfit);
    }
  };

  // Markers do gráfico (entradas do bot)
  const markers: ChartMarker[] = useMemo(() => operations.map(op => ({
    time: Math.floor(op.openedAt / 1000),
    position: op.direction === 'CALL' ? 'belowBar' : 'aboveBar',
    side: op.direction === 'CALL' ? 'long' : 'short',
    text: `${op.direction === 'CALL' ? '↑' : '↓'} $${op.amount.toFixed(0)}`,
  })), [operations]);

  // Operação ativa atualmente (para painel da direita)
  const activeOperation = useMemo(() => {
    return operations.find(o =>
      o.status === 'analyzing' || o.status === 'pending' ||
      o.status === 'open' || o.status === 'expiring',
    ) ?? null;
  }, [operations]);

  // Stop loss calculado (consequência matemática)
  const stopLossAmount = useMemo(() => {
    let total = 0;
    for (let i = 0; i <= maxLosses; i++) {
      total += entryValue * Math.pow(multiplier, i);
    }
    return total;
  }, [entryValue, maxLosses, multiplier]);

  const stopLossPercent = balanceAmount > 0 ? (stopLossAmount / balanceAmount) * 100 : 0;

  // Iniciar/parar bot
  const handleStart = () => {
    if (!activeId || !activeInfo || !selectedBalance) return;

    const config: BotConfig = {
      profile,
      entryValue,
      maxConsecutiveLosses: maxLosses,
      multiplier,
      takeProfit: { mode: tpMode, value: tpValue },
    };

    const tpConfig: TakeProfitConfig = config.takeProfit;
    void tpConfig;

    const engine = new BotEngine(
      {
        sdk,
        activeId,
        assetSymbol: cleanTicker(activeInfo.ticker),
        config,
        balanceId: selectedBalance.id,
        balance: selectedBalance.amount,
      },
      {
        onStateChange: setBotState,
        onSignalUpdate: setSignal,
        onOperationCreate: (op) => setOperations(prev => [...prev, op]),
        onOperationUpdate: (op) => setOperations(prev => prev.map(p => p.id === op.id ? op : p)),
        onSequenceUpdate: setSequence,
        onSessionUpdate: setSession,
        onError: (err) => console.error('[bot]', err),
      },
    );

    engineRef.current = engine;
    engine.start().catch(err => console.error('[bot] start falhou:', err));
  };

  const handleStop = () => {
    engineRef.current?.stop('manual');
  };

  const handleReset = () => {
    engineRef.current?.acknowledgeStopAndReset();
  };

  const isRunning =
    botState.kind === 'analyzing' ||
    botState.kind === 'waiting_signal' ||
    botState.kind === 'placing_order' ||
    botState.kind === 'in_position';

  return (
    <div style={pageStyle}>
      <style>{`
        @keyframes pulse {
          0%   { opacity: 0.4; }
          50%  { opacity: 1; }
          100% { opacity: 0.4; }
        }

        /* Layout principal — desktop */
        .bot-main-grid {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 320px 360px;
          gap: 16px;
          padding: 16px;
          min-height: 0;
        }
        .bot-left-col {
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-width: 0;
        }
        .bot-controls-col {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 20px;
          background: ${T.panel};
          border: 1px solid ${T.border};
          border-radius: 14px;
          height: fit-content;
          position: sticky;
          top: 16px;
        }
        .bot-report-col {
          position: sticky;
          top: 16px;
          height: fit-content;
        }

        /* Tablets — 2 colunas */
        @media (max-width: 1280px) {
          .bot-main-grid {
            grid-template-columns: 1fr 320px;
          }
          .bot-report-col {
            grid-column: 1 / -1;
            position: static;
          }
        }

        /* Mobile — empilhado */
        @media (max-width: 768px) {
          .bot-main-grid {
            grid-template-columns: 1fr;
            gap: 12px;
            padding: 12px;
          }
          .bot-controls-col,
          .bot-report-col {
            position: static;
            grid-column: 1;
          }
        }
      `}</style>

      {/* Topbar */}
      <header style={topbarStyle}>
        <button onClick={onBack} style={backButtonStyle}>
          <ArrowLeft size={16} />
          <span>Voltar</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, marginLeft: 24 }}>
          <AssetSelector
            actives={actives}
            activeId={activeId}
            onSelect={setActiveId}
            loading={activesLoading}
          />
        </div>

        <BalanceToggle
          balances={balances}
          selected={selectedBalance}
          onSelect={selectKind}
        />
      </header>

      {/* Layout principal */}
      <div className="bot-main-grid">
        {/* Coluna esquerda: gráfico + log */}
        <div className="bot-left-col">
          <div style={chartWrapStyle}>
            <Chart
              candles={candles}
              lastCandle={lastCandle}
              markers={markers}
              loading={chartLoading}
              ticker={cleanTicker(activeInfo?.ticker)}
              assetName={activeInfo ? `BLITZ · ${activeInfo.incomePercent}% retorno` : undefined}
              balance={selectedBalance?.amount}
              balanceKind={selectedBalance?.kind}
              botStatus={<BotStatusPill state={botState} isRunning={isRunning} />}
            />
            <ScannerOverlay active={isRunning && !activeOperation} />
          </div>

          <OperationsLog operations={operations} />
        </div>

        {/* Coluna do meio: controles do bot */}
        <div className="bot-controls-col">
          <div style={panelTitleStyle}>CONTROLE DO BOT</div>

          {/* Bloco de recomendação da IA */}
          {balanceAmount > 0 && (
            <div style={aiRecommendStyle}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
              }}>
                <Sparkles size={14} color={T.accent} />
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: T.accent,
                }}>
                  RECOMENDAÇÃO DA IA
                </span>
              </div>
              <div style={{
                fontSize: 13,
                color: T.text,
                lineHeight: 1.5,
                marginBottom: 10,
              }}>
                Com base na sua banca de <strong style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  color: T.accent,
                }}>${balanceAmount.toFixed(2)}</strong>, o perfil ideal é{' '}
                <strong style={{ color: T.accent }}>
                  {suggested.profile[0].toUpperCase() + suggested.profile.slice(1)}
                </strong>.
              </div>
              <div style={{
                fontSize: 11,
                color: T.textDim,
                lineHeight: 1.5,
                marginBottom: 12,
              }}>
                {suggested.reasoning}
              </div>
              {profile !== suggested.profile && (
                <button
                  onClick={() => onProfileChange(suggested.profile)}
                  style={applyRecommendButtonStyle}
                >
                  <Sparkles size={12} />
                  Aplicar sugestão da IA
                </button>
              )}
              {profile === suggested.profile && (
                <div style={{
                  fontSize: 10,
                  color: T.long,
                  letterSpacing: '0.06em',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  ✓ Perfil recomendado em uso
                </div>
              )}
            </div>
          )}

          <StopLossCard
            stopLoss={stopLossAmount}
            balance={balanceAmount}
            stopLossPercent={stopLossPercent}
            losses={maxLosses + 1}
            multiplier={multiplier}
            entry={entryValue}
          />

          {/* Perfil */}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Perfil de Risco</label>
            <div style={profileButtonsStyle}>
              {(['conservador', 'moderado', 'ousado'] as Profile[]).map(p => (
                <button
                  key={p}
                  onClick={() => onProfileChange(p)}
                  style={{
                    ...profileButtonStyle,
                    ...(profile === p ? profileButtonActiveStyle : null),
                  }}
                >
                  {p[0].toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            {profile === suggested.profile && (
              <div style={hintStyle}>
                ✨ Sugerido pela IA com base na sua banca
              </div>
            )}
          </div>

          {/* Valor de entrada */}
          <NumberField
            label="Valor de entrada"
            value={entryValue}
            unit="$"
            onChange={(v) => { userTouchedRef.current = true; setEntryValue(v); }}
            step={0.5}
            min={0}
          />

          {/* Quantidade máxima de perdas consecutivas */}
          <NumberField
            label="Quantidade máxima de perdas consecutivas"
            value={maxLosses}
            onChange={(v) => { userTouchedRef.current = true; setMaxLosses(Math.max(0, Math.floor(v))); }}
            step={1}
            min={0}
          />

          {/* Multiplicador */}
          <NumberField
            label="Multiplicador pós loss"
            value={multiplier}
            unit="x"
            onChange={(v) => { userTouchedRef.current = true; setMultiplier(Math.max(1, v)); }}
            step={0.1}
            min={1}
            decimals={1}
          />

          {/* Take Profit */}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Take Profit</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {([
                { mode: 'absolute', label: '$' },
                { mode: 'percent',  label: '%' },
                { mode: 'greens',   label: 'WINS' },
              ] as { mode: TakeProfitMode; label: string }[]).map(opt => (
                <button
                  key={opt.mode}
                  onClick={() => { userTouchedRef.current = true; setTpMode(opt.mode); }}
                  style={{
                    ...tpModeButtonStyle,
                    ...(tpMode === opt.mode ? tpModeButtonActiveStyle : null),
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <NumberField
              label=""
              value={tpValue}
              unit={tpMode === 'absolute' ? '$' : tpMode === 'percent' ? '%' : 'wins'}
              onChange={(v) => { userTouchedRef.current = true; setTpValue(Math.max(0, v)); }}
              step={tpMode === 'greens' ? 1 : 1}
              min={0}
              decimals={tpMode === 'greens' ? 0 : 2}
            />
            <div style={hintStyle}>
              ✨ Sugerido: {tpMode === 'absolute' ? `$${suggested.takeProfit.toFixed(2)}` :
                            tpMode === 'percent'  ? `${suggested.takeProfitPercent.toFixed(1)}%` :
                                                    '5 wins'}
            </div>
          </div>

          {/* Botões de ação */}
          {botState.kind === 'stopped' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              <div style={{
                padding: '10px 12px',
                background: botState.reason === 'take_profit_hit' ? T.longSoft : T.shortSoft,
                color: botState.reason === 'take_profit_hit' ? T.long : T.short,
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                textAlign: 'center',
              }}>
                {botState.reason === 'take_profit_hit' ? '🎯 Meta atingida' : '⚠️ Bot parado'}
                {botState.detail && (
                  <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2, opacity: 0.8 }}>
                    {botState.detail}
                  </div>
                )}
              </div>
              <button onClick={handleReset} style={primaryButtonStyle}>
                <Play size={14} fill={T.bg} />
                REINICIAR BOT
              </button>
            </div>
          ) : isRunning ? (
            <button onClick={handleStop} style={dangerButtonStyle}>
              <Square size={14} fill={T.text} />
              PARAR BOT
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={!activeId || !selectedBalance}
              style={{
                ...primaryButtonStyle,
                opacity: (!activeId || !selectedBalance) ? 0.5 : 1,
                cursor: (!activeId || !selectedBalance) ? 'not-allowed' : 'pointer',
              }}
            >
              <Play size={14} fill={T.bg} />
              INICIAR OPERAÇÕES
            </button>
          )}
        </div>

        {/* Coluna direita: relatório de inteligência */}
        <div className="bot-report-col">
          <IntelligenceReport
            state={botState}
            signal={signal}
            activeOperation={activeOperation}
          />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Componentes auxiliares
 * ============================================================ */

function BotStatusPill({ state, isRunning }: { state: BotState; isRunning: boolean }) {
  const label =
    state.kind === 'idle'           ? 'BOT INATIVO' :
    state.kind === 'analyzing'      ? 'ANALISANDO' :
    state.kind === 'waiting_signal' ? 'AGUARDANDO SINAL' :
    state.kind === 'placing_order'  ? 'ENVIANDO ORDEM' :
    state.kind === 'in_position'    ? 'EM POSIÇÃO' :
    state.kind === 'stopped'        ? (state.reason === 'take_profit_hit' ? 'META BATIDA' : 'PARADO') :
                                       'BOT';

  const color = isRunning ? T.accent : state.kind === 'stopped' ? T.short : T.textMute;

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '5px 10px',
      background: T.bgElev,
      border: `1px solid ${T.border}`,
      borderRadius: 6,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.08em',
      color,
      flexShrink: 0,
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: color,
        marginRight: 6,
        boxShadow: isRunning ? `0 0 6px ${color}` : 'none',
        animation: isRunning ? 'pulse 1.4s ease-in-out infinite' : 'none',
      }} />
      {label}
    </div>
  );
}

function AssetSelector({
  actives, activeId, onSelect, loading,
}: {
  actives: ReturnType<typeof useAvailableActives>['actives'];
  activeId: number | null;
  onSelect: (id: number) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = actives.find(a => a.id === activeId);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 14px',
          background: T.bgElev,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `linear-gradient(135deg, ${T.accent}, ${T.accentDeep})`,
          display: 'grid', placeItems: 'center',
          color: T.bg,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '-0.02em',
        }}>
          {cleanTicker(current?.ticker)?.slice(0, 3) ?? '...'}
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
            {cleanTicker(current?.ticker) ?? (loading ? 'Carregando...' : 'Selecionar ativo')}
          </div>
          <div style={{ fontSize: 10, color: T.textMute, letterSpacing: '0.06em' }}>
            BLITZ OPTIONS {current ? `· ${current.incomePercent}%` : ''}
          </div>
        </div>
        <ChevronDown size={14} color={T.textDim} style={{
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 200ms',
        }} />
      </button>

      {open && (
        <div style={dropdownStyle}>
          {actives.map(a => (
            <button
              key={a.id}
              disabled={a.isSuspended}
              onClick={() => { onSelect(a.id); setOpen(false); }}
              style={{
                ...dropdownItemStyle,
                opacity: a.isSuspended ? 0.4 : 1,
                cursor: a.isSuspended ? 'not-allowed' : 'pointer',
                background: a.id === activeId ? T.accentSoft : 'transparent',
              }}
            >
              <span style={{ fontWeight: 600, color: T.text }}>{cleanTicker(a.ticker)}</span>
              <span style={{ fontSize: 10, color: T.textMute }}>
                {a.isSuspended ? 'SUSPENSO' : `${a.incomePercent}%`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BalanceToggle({
  balances, selected, onSelect,
}: {
  balances: ReturnType<typeof useBalances>['balances'];
  selected: ReturnType<typeof useBalances>['selected'];
  onSelect: (kind: 'real' | 'demo') => void;
}) {
  if (!selected) return null;

  const real = balances.find(b => b.kind === 'real');
  const demo = balances.find(b => b.kind === 'demo');

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: 4,
      background: T.bgElev,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
    }}>
      {real && (
        <button
          onClick={() => onSelect('real')}
          style={{
            ...segmentStyle,
            ...(selected.kind === 'real' ? segmentActiveStyle : null),
          }}
        >
          <Wallet size={12} />
          <div style={{ textAlign: 'left' }}>
            <div style={{
              fontSize: 9,
              letterSpacing: '0.1em',
              color: selected.kind === 'real' ? T.bg : T.textMute,
              fontWeight: 700,
              opacity: selected.kind === 'real' ? 0.7 : 1,
            }}>
              REAL
            </div>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'JetBrains Mono, monospace',
              color: selected.kind === 'real' ? T.bg : T.text,
            }}>
              ${real.amount.toFixed(2)}
            </div>
          </div>
        </button>
      )}
      {demo && (
        <button
          onClick={() => onSelect('demo')}
          style={{
            ...segmentStyle,
            ...(selected.kind === 'demo' ? segmentActiveStyle : null),
          }}
        >
          <Wallet size={12} />
          <div style={{ textAlign: 'left' }}>
            <div style={{
              fontSize: 9,
              letterSpacing: '0.1em',
              color: selected.kind === 'demo' ? T.bg : T.textMute,
              fontWeight: 700,
              opacity: selected.kind === 'demo' ? 0.7 : 1,
            }}>
              DEMO
            </div>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'JetBrains Mono, monospace',
              color: selected.kind === 'demo' ? T.bg : T.text,
            }}>
              ${demo.amount.toFixed(2)}
            </div>
          </div>
        </button>
      )}
    </div>
  );
}

const segmentStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  background: 'transparent',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  color: T.textDim,
  fontFamily: 'inherit',
  transition: 'all 120ms',
};

const segmentActiveStyle = {
  background: T.accent,
  color: T.bg,
  boxShadow: `0 0 12px ${T.accentDim}`,
};

function NumberField({
  label, value, unit, onChange, step, min, decimals,
}: {
  label: string;
  value: number;
  unit?: string;
  onChange: (v: number) => void;
  step: number;
  min?: number;
  decimals?: number;
}) {
  return (
    <div style={fieldGroupStyle}>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={numberInputWrapStyle}>
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={numberInputStyle}
        />
        {unit && <span style={unitStyle}>{unit}</span>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button
            onClick={() => onChange(parseFloat((value + step).toFixed(decimals ?? 2)))}
            style={stepButtonStyle}
          >
            +
          </button>
          <button
            onClick={() => {
              const next = value - step;
              onChange(parseFloat((min !== undefined ? Math.max(min, next) : next).toFixed(decimals ?? 2)));
            }}
            style={stepButtonStyle}
          >
            −
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Styles
 * ============================================================ */

const pageStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column' as const,
  background: T.bg,
  minHeight: '100vh',
};

const topbarStyle = {
  display: 'flex',
  alignItems: 'center',
  padding: '14px 24px',
  borderBottom: `1px solid ${T.border}`,
  background: T.bg,
  gap: 12,
};

const backButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  background: 'transparent',
  border: 'none',
  color: T.textDim,
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'inherit',
};

const chartWrapStyle = {
  position: 'relative' as const,
  background: T.panel,
  border: `1px solid ${T.border}`,
  borderRadius: 14,
  height: 480,
  overflow: 'hidden' as const,
  padding: 0,
  display: 'flex',
  flexDirection: 'column' as const,
};

const panelTitleStyle = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.12em',
  color: T.textMute,
  paddingBottom: 12,
  borderBottom: `1px solid ${T.border}`,
  marginBottom: 4,
};

const fieldGroupStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 6,
};

const labelStyle = {
  fontSize: 11,
  color: T.textDim,
  fontWeight: 500,
};

const profileButtonsStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 6,
};

const profileButtonStyle = {
  padding: '8px 6px',
  background: T.bgElev,
  border: `1px solid ${T.border}`,
  color: T.textDim,
  borderRadius: 8,
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 120ms',
};

const profileButtonActiveStyle = {
  background: T.accent,
  color: T.bg,
  borderColor: T.accent,
  boxShadow: `0 0 12px ${T.accentDim}`,
};

const tpModeButtonStyle = {
  flex: 1,
  padding: '6px',
  background: T.bgElev,
  border: `1px solid ${T.border}`,
  color: T.textDim,
  borderRadius: 6,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 120ms',
};

const tpModeButtonActiveStyle = {
  background: T.accent,
  color: T.bg,
  borderColor: T.accent,
};

const numberInputWrapStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  background: T.bgElev,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
};

const numberInputStyle = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: T.text,
  fontSize: 14,
  fontWeight: 600,
  fontFamily: 'JetBrains Mono, monospace',
  width: '100%',
};

const unitStyle = {
  fontSize: 12,
  color: T.textMute,
  fontFamily: 'JetBrains Mono, monospace',
};

const stepButtonStyle = {
  width: 18,
  height: 14,
  background: T.panel,
  border: `1px solid ${T.border}`,
  color: T.textDim,
  borderRadius: 4,
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'grid',
  placeItems: 'center',
  padding: 0,
};

const hintStyle = {
  fontSize: 10,
  color: T.accent,
  marginTop: 4,
  opacity: 0.85,
};

const aiRecommendStyle = {
  background: `linear-gradient(135deg, ${T.accentSoft}, ${T.accent}08)`,
  border: `1px solid ${T.accent}44`,
  borderRadius: 12,
  padding: 14,
  marginBottom: 4,
};

const applyRecommendButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  background: T.accent,
  border: 'none',
  color: T.bg,
  borderRadius: 8,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.04em',
  cursor: 'pointer',
  fontFamily: 'inherit',
  boxShadow: `0 0 12px ${T.accentDim}`,
};

const primaryButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '12px 16px',
  background: T.accent,
  border: 'none',
  color: T.bg,
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.04em',
  cursor: 'pointer',
  fontFamily: 'inherit',
  marginTop: 12,
  boxShadow: `0 0 24px ${T.accentDim}`,
  transition: 'all 120ms',
};

const dangerButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '12px 16px',
  background: T.short,
  border: 'none',
  color: T.text,
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.04em',
  cursor: 'pointer',
  fontFamily: 'inherit',
  marginTop: 12,
};

const dropdownStyle = {
  position: 'absolute' as const,
  top: 'calc(100% + 4px)',
  left: 0,
  minWidth: 220,
  maxHeight: 320,
  overflowY: 'auto' as const,
  background: T.panel,
  border: `1px solid ${T.borderHi}`,
  borderRadius: 10,
  padding: 4,
  zIndex: 50,
  boxShadow: `0 8px 24px ${T.bg}AA`,
};

const dropdownItemStyle = {
  width: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 12px',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  fontFamily: 'inherit',
  textAlign: 'left' as const,
};

/**
 * Remove sufixos OTC do ticker para exibição.
 * Ex: "EURUSD-OTC" → "EURUSD", "EUR/USD (OTC)" → "EUR/USD"
 */
function cleanTicker(ticker: string | null | undefined): string | undefined {
  if (!ticker) return undefined;
  return ticker
    .replace(/-OTC\b/g, '')
    .replace(/\s*\(OTC\)\s*/gi, '')
    .replace(/\s*OTC\s*/gi, ' ')
    .trim();
}
