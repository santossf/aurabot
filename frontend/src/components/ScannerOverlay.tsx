/**
 * ScannerOverlay — animação de "linha de radar" varrendo o gráfico
 * horizontalmente. Sobreposta ao Chart, sem capturar eventos de mouse.
 *
 * Visual: linha vertical fina + fade gradient seguindo (rastro), em movimento
 * contínuo da esquerda pra direita. Loop a cada N segundos.
 */
import { theme as T } from '../lib/theme';

interface ScannerOverlayProps {
  active: boolean;
  durationMs?: number;
}

export function ScannerOverlay({ active, durationMs = 3000 }: ScannerOverlayProps) {
  if (!active) return null;

  return (
    <>
      <style>{`
        @keyframes scanner-sweep {
          0%   { transform: translateX(-100%); opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { transform: translateX(100vw); opacity: 0; }
        }
      `}</style>
      <div style={containerStyle}>
        <div style={{
          ...sweepLineStyle,
          animation: `scanner-sweep ${durationMs}ms linear infinite`,
        }}>
          <div style={glowStyle} />
        </div>
      </div>
    </>
  );
}

const containerStyle = {
  position: 'absolute' as const,
  inset: 0,
  pointerEvents: 'none' as const,
  overflow: 'hidden' as const,
  borderRadius: 12,
};

const sweepLineStyle = {
  position: 'absolute' as const,
  top: 0,
  bottom: 0,
  width: 2,
  background: T.accent,
  boxShadow: `0 0 16px ${T.accentBright}, 0 0 32px ${T.accentDim}`,
  opacity: 0,
};

const glowStyle = {
  position: 'absolute' as const,
  top: 0,
  bottom: 0,
  right: 0,
  width: 120,
  background: `linear-gradient(to right, ${T.accentSoft}, transparent)`,
  pointerEvents: 'none' as const,
};
