import { useEffect, useRef } from 'react';
import { formatCurrency } from '@/lib/utils';

type GaugeChartProps = {
  value: number;
  total: number;
  label: string;
  sublabel: string;
  isLoading?: boolean;
};

/**
 * Velocímetro semi-circular horizontal (base plana embaixo).
 * Arco com gradação vermelho → amarelo → verde.
 * SVG puro, sem dependências externas.
 */
export function GaugeChart({ value, total, label, sublabel, isLoading = false }: GaugeChartProps) {
  const filledArcRef = useRef<SVGPathElement>(null);

  const pct = total > 0 ? Math.min(value / total, 1) : 0;
  const pctDisplay = (pct * 100).toFixed(1);

  // Geometria: semi-círculo, de 180° (esquerda) a 0° (direita)
  // startAngle = 180° (esquerda), endAngle = 0° (direita)
  const cx = 120;
  const cy = 110;
  const R = 85;        // raio externo
  const r = 58;        // raio interno (espessura do arco = R - r = 27px)
  const totalAngle = 180; // graus

  // Converte ângulo (0° = direita, 180° = esquerda) para coordenadas SVG
  function toXY(angleDeg: number, radius: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx - radius * Math.cos(rad),
      y: cy - radius * Math.sin(rad),
    };
  }

  // Gera o path de um arco em forma de "fatia" (anel)
  function arcPath(fromDeg: number, toDeg: number, outerR: number, innerR: number) {
    const o1 = toXY(fromDeg, outerR);
    const o2 = toXY(toDeg, outerR);
    const i1 = toXY(toDeg, innerR);
    const i2 = toXY(fromDeg, innerR);
    const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
    return [
      `M ${o1.x} ${o1.y}`,
      `A ${outerR} ${outerR} 0 ${large} 0 ${o2.x} ${o2.y}`,
      `L ${i1.x} ${i1.y}`,
      `A ${innerR} ${innerR} 0 ${large} 1 ${i2.x} ${i2.y}`,
      'Z',
    ].join(' ');
  }

  // Segmentos de cor do arco de fundo (gradação visual)
  const segments = 60;
  const colorStops = Array.from({ length: segments }, (_, i) => {
    const t = i / (segments - 1); // 0 → 1
    // Interpolação HSL: vermelho (0°) → amarelo (60°) → verde (120°)
    const hue = Math.round(t * 120);
    return { from: 180 - (i / segments) * 180, to: 180 - ((i + 1) / segments) * 180, hue };
  });

  // Arco preenchido (máscara animada)
  const filledAngle = pct * totalAngle; // quantos graus preencher (de 180° para direita)

  // Comprimento do arco médio para animação
  const midR = (R + r) / 2;
  const arcLen = Math.PI * midR; // semicírculo completo

  useEffect(() => {
    if (isLoading) return;
    const el = filledArcRef.current;
    if (!el) return;
    const filled = (pct * arcLen);
    el.style.strokeDasharray = `${arcLen}`;
    el.style.strokeDashoffset = `${arcLen}`;
    el.style.transition = 'none';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(0.34, 1.4, 0.64, 1)';
        el.style.strokeDashoffset = `${arcLen - filled}`;
      });
    });
  }, [pct, arcLen, isLoading]);

  // Agulha
  const needleAngleDeg = 180 - pct * totalAngle; // 180° (esq) → 0° (dir)
  const needleTip = toXY(needleAngleDeg, R - 6);
  const needleBase = { x: cx, y: cy };

  // Ticks e rótulos
  const tickMarks = [0, 0.25, 0.5, 0.75, 1];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 p-4">
        <div className="h-[130px] w-full animate-pulse rounded-2xl bg-muted" />
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 20 240 120" className="w-full max-w-[320px]" aria-label={`${label}: ${pctDisplay}%`}>
        <defs>
          {/* Gradiente para o arco preenchido */}
          <linearGradient id={`gaugeGrad-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>

          {/* Máscara radial para revelar o arco preenchido */}
          <mask id={`gaugeMask-${label}`}>
            <path
              ref={filledArcRef}
              d={`M ${toXY(180, midR).x} ${toXY(180, midR).y} A ${midR} ${midR} 0 0 0 ${toXY(0, midR).x} ${toXY(0, midR).y}`}
              fill="none"
              stroke="white"
              strokeWidth={R - r + 2}
              strokeLinecap="butt"
              style={{
                strokeDasharray: arcLen,
                strokeDashoffset: arcLen - pct * arcLen,
              }}
            />
          </mask>
        </defs>

        {/* Arco de fundo (cinza claro) */}
        <path
          d={arcPath(180, 0, R, r)}
          fill="#e2e8f0"
        />

        {/* Arco colorido gradiente, revelado pela máscara */}
        <path
          d={arcPath(180, 0, R, r)}
          fill={`url(#gaugeGrad-${label})`}
          mask={`url(#gaugeMask-${label})`}
        />

        {/* Separadores sutis entre segmentos a cada 25% */}
        {[0.25, 0.5, 0.75].map((t) => {
          const angleDeg = 180 - t * 180;
          const outer = toXY(angleDeg, R + 2);
          const inner = toXY(angleDeg, r - 2);
          return (
            <line
              key={t}
              x1={outer.x} y1={outer.y}
              x2={inner.x} y2={inner.y}
              stroke="white"
              strokeWidth={1.5}
              opacity={0.6}
            />
          );
        })}

        {/* Ticks externos */}
        {tickMarks.map((t) => {
          const angleDeg = 180 - t * 180;
          const outer = toXY(angleDeg, R + 4);
          const inner = toXY(angleDeg, R + 10);
          return (
            <line
              key={t}
              x1={outer.x} y1={outer.y}
              x2={inner.x} y2={inner.y}
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          );
        })}

        {/* Rótulos de escala */}
        {tickMarks.map((t) => {
          const angleDeg = 180 - t * 180;
          const pos = toXY(angleDeg, R + 18);
          return (
            <text
              key={t}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="7.5"
              fontWeight="600"
              fill="#94a3b8"
            >
              {`${(t * 100).toFixed(0)}%`}
            </text>
          );
        })}

        {/* Agulha */}
        <line
          x1={needleBase.x} y1={needleBase.y}
          x2={needleTip.x} y2={needleTip.y}
          stroke="#1e293b"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={6} fill="#1e293b" />
        <circle cx={cx} cy={cy} r={3} fill="white" />

        {/* Percentual */}
        <text
          x={cx}
          y={cy - 18}
          textAnchor="middle"
          fontSize="20"
          fontWeight="800"
          fill="#0f172a"
          letterSpacing="-0.5"
        >
          {pctDisplay}%
        </text>
      </svg>

      {/* Legenda */}
      <div className="-mt-2 text-center">
        <p className="text-sm font-bold text-text-primary">{label}</p>
        <p className="text-xs text-text-muted">{sublabel}</p>
        <div className="mt-1 flex items-center justify-center gap-1.5">
          <span className="text-xs font-semibold text-text-secondary">{formatCurrency(value)}</span>
          <span className="text-xs text-text-muted">/</span>
          <span className="text-xs text-text-muted">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}
