import { useEffect, useRef } from 'react';
import { formatCurrency } from '@/lib/utils';

type GaugeChartProps = {
  value: number;       // valor atual (numerador)
  total: number;       // valor de referência (denominador = descentralizado)
  label: string;       // ex: "Empenhado"
  sublabel: string;    // ex: "sobre Descentralizado"
  color: string;       // cor principal do arco (hex ou hsl)
  trackColor?: string; // cor do trilho (padrão: cinza claro)
  isLoading?: boolean;
};

/**
 * Velocímetro (gauge) semi-circular desenhado em SVG puro.
 * Não requer dependências externas além do React.
 */
export function GaugeChart({
  value,
  total,
  label,
  sublabel,
  color,
  trackColor = '#e2e8f0',
  isLoading = false,
}: GaugeChartProps) {
  const arcRef = useRef<SVGPathElement>(null);
  const needleRef = useRef<SVGLineElement>(null);

  const pct = total > 0 ? Math.min(value / total, 1) : 0;
  const pctDisplay = (pct * 100).toFixed(1);

  // Geometria do gauge
  const cx = 110;
  const cy = 110;
  const r = 80;
  const strokeWidth = 16;
  const startAngle = -210; // graus (sentido horário a partir do eixo x)
  const endAngle = 30;
  const totalAngle = endAngle - startAngle; // 240°

  function polarToCartesian(angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  function describeArc(from: number, to: number) {
    const start = polarToCartesian(from);
    const end = polarToCartesian(to);
    const largeArc = to - from > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  }

  // Comprimento total do arco (para stroke-dasharray)
  const arcLength = (Math.abs(totalAngle) / 360) * 2 * Math.PI * r;

  // Ângulo da agulha
  const needleAngle = startAngle + pct * totalAngle;
  const needleTip = polarToCartesian(needleAngle);
  const needleBase = { x: cx, y: cy };

  // Animação da agulha e do arco ao montar
  useEffect(() => {
    if (isLoading) return;
    const arc = arcRef.current;
    const needle = needleRef.current;
    if (!arc || !needle) return;

    // Animação do arco via stroke-dashoffset
    const filled = pct * arcLength;
    arc.style.strokeDasharray = `${arcLength}`;
    arc.style.strokeDashoffset = `${arcLength}`;
    arc.style.transition = 'none';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        arc.style.transition = 'stroke-dashoffset 1s cubic-bezier(0.34, 1.56, 0.64, 1)';
        arc.style.strokeDashoffset = `${arcLength - filled}`;
      });
    });
  }, [pct, arcLength, isLoading]);

  // Zonas de cor para as marcações do arco
  const zones = [
    { from: startAngle, to: startAngle + totalAngle * 0.33, color: '#ef4444' },   // vermelho 0-33%
    { from: startAngle + totalAngle * 0.33, to: startAngle + totalAngle * 0.66, color: '#f59e0b' }, // amarelo 33-66%
    { from: startAngle + totalAngle * 0.66, to: endAngle, color: '#22c55e' },      // verde 66-100%
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 p-4">
        <div className="h-[140px] w-[220px] animate-pulse rounded-2xl bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 220 140" className="w-full max-w-[260px]" aria-label={`${label}: ${pctDisplay}%`}>
        {/* Trilho (arco de fundo) */}
        <path
          d={describeArc(startAngle, endAngle)}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Arco colorido animado */}
        <path
          ref={arcRef}
          d={describeArc(startAngle, endAngle)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{
            strokeDasharray: arcLength,
            strokeDashoffset: arcLength - pct * arcLength,
          }}
        />

        {/* Marcações de zona (pequenos ticks) */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const tickAngle = startAngle + t * totalAngle;
          const inner = polarToCartesian(tickAngle);
          const outerR = r + strokeWidth / 2 + 4;
          const rad = ((tickAngle - 90) * Math.PI) / 180;
          const outer = {
            x: cx + outerR * Math.cos(rad),
            y: cy + outerR * Math.sin(rad),
          };
          return (
            <line
              key={t}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          );
        })}

        {/* Rótulos de escala: 0%, 50%, 100% */}
        {[0, 0.5, 1].map((t) => {
          const tickAngle = startAngle + t * totalAngle;
          const labelR = r + strokeWidth / 2 + 14;
          const rad = ((tickAngle - 90) * Math.PI) / 180;
          const lx = cx + labelR * Math.cos(rad);
          const ly = cy + labelR * Math.sin(rad);
          return (
            <text
              key={t}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              fontWeight="600"
              fill="#94a3b8"
            >
              {`${(t * 100).toFixed(0)}%`}
            </text>
          );
        })}

        {/* Agulha */}
        <line
          ref={needleRef}
          x1={needleBase.x}
          y1={needleBase.y}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke="#1e293b"
          strokeWidth={2.5}
          strokeLinecap="round"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
          }}
        />

        {/* Pivô da agulha */}
        <circle cx={cx} cy={cy} r={5} fill="#1e293b" />
        <circle cx={cx} cy={cy} r={2.5} fill="white" />

        {/* Percentual central */}
        <text
          x={cx}
          y={cy + 22}
          textAnchor="middle"
          fontSize="18"
          fontWeight="800"
          fill="#0f172a"
          letterSpacing="-0.5"
        >
          {pctDisplay}%
        </text>
      </svg>

      {/* Legenda abaixo do gauge */}
      <div className="text-center">
        <p className="text-sm font-bold text-text-primary">{label}</p>
        <p className="text-xs text-text-muted">{sublabel}</p>
        <div className="mt-1.5 flex items-center justify-center gap-1.5">
          <span className="text-xs font-semibold" style={{ color }}>
            {formatCurrency(value)}
          </span>
          <span className="text-xs text-text-muted">/</span>
          <span className="text-xs text-text-muted">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}
