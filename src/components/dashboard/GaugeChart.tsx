import { useEffect, useMemo, useRef } from 'react';

type GaugeChartProps = {
  value: number;
  total: number;
  label: string;
  sublabel: string;
  isLoading?: boolean;
};

export function GaugeChart({ value, total, label, isLoading = false }: GaugeChartProps) {
  const filledArcRef = useRef<SVGPathElement>(null);

  const pct = total > 0 ? Math.min(value / total, 1) : 0;
  const pctDisplay = (pct * 100).toFixed(1);
  const gradientId = useMemo(() => `gaugeGrad-${label.replace(/\W+/g, '-')}`, [label]);
  const maskId = useMemo(() => `gaugeMask-${label.replace(/\W+/g, '-')}`, [label]);

  const cx = 120;
  const cy = 118;
  const R = 96;
  const r = 66;
  const totalAngle = 180;

  function toXY(angleDeg: number, radius: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy - radius * Math.sin(rad),
    };
  }

  function arcPath(fromDeg: number, toDeg: number, outerR: number, innerR: number) {
    const o1 = toXY(fromDeg, outerR);
    const o2 = toXY(toDeg, outerR);
    const i1 = toXY(toDeg, innerR);
    const i2 = toXY(fromDeg, innerR);
    const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;

    return [
      `M ${o1.x} ${o1.y}`,
      `A ${outerR} ${outerR} 0 ${large} 1 ${o2.x} ${o2.y}`,
      `L ${i1.x} ${i1.y}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${i2.x} ${i2.y}`,
      'Z',
    ].join(' ');
  }

  const midR = (R + r) / 2;
  const arcLen = Math.PI * midR;
  const targetDashOffset = arcLen * (1 - pct);
  const needleAngleDeg = 180 - pct * totalAngle;
  const needleTip = toXY(needleAngleDeg, R - 6);
  const tickMarks = [0, 0.25, 0.5, 0.75, 1];

  useEffect(() => {
    if (isLoading) return;

    const el = filledArcRef.current;
    if (!el) return;

    el.style.strokeDasharray = `${arcLen}`;
    el.style.strokeDashoffset = `${arcLen}`;
    el.style.transition = 'none';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(0.34, 1.4, 0.64, 1)';
        el.style.strokeDashoffset = `${targetDashOffset}`;
      });
    });
  }, [arcLen, targetDashOffset, isLoading]);

  if (isLoading) {
    return (
      <div className="flex min-h-[178px] w-full flex-col items-center justify-center gap-3">
        <div className="h-[160px] w-full animate-pulse rounded-2xl bg-muted" />
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[178px] w-full flex-col items-center justify-end">
      <svg viewBox="0 -8 240 136" className="block h-[178px] w-full max-w-[390px]" aria-label={`${label}: ${pctDisplay}%`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="18%" stopColor="#f97316" />
            <stop offset="56%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>

          <mask id={maskId}>
            <path
              ref={filledArcRef}
              d={`M ${toXY(180, midR).x} ${toXY(180, midR).y} A ${midR} ${midR} 0 0 1 ${toXY(0, midR).x} ${toXY(0, midR).y}`}
              fill="none"
              stroke="white"
              strokeWidth={R - r + 2}
              strokeLinecap="butt"
              style={{
                strokeDasharray: arcLen,
                strokeDashoffset: targetDashOffset,
              }}
            />
          </mask>
        </defs>

        <path d={arcPath(180, 0, R, r)} fill="hsl(var(--muted))" />
        <path d={arcPath(180, 0, R, r)} fill={`url(#${gradientId})`} mask={`url(#${maskId})`} />

        {[0.25, 0.5, 0.75].map((t) => {
          const angleDeg = 180 - t * 180;
          const outer = toXY(angleDeg, R + 2);
          const inner = toXY(angleDeg, r - 2);

          return (
            <line
              key={t}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke="hsl(var(--card))"
              strokeWidth={1.5}
            />
          );
        })}

        {tickMarks.map((t) => {
          const angleDeg = 180 - t * 180;
          const outer = toXY(angleDeg, R + 4);
          const inner = toXY(angleDeg, R + 10);

          return (
            <line
              key={t}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke="currentColor"
              className="text-muted-foreground/60"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          );
        })}

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
              fill="currentColor"
              className="text-muted-foreground font-medium"
            >
              {`${(t * 100).toFixed(0)}%`}
            </text>
          );
        })}

        <line
          x1={cx}
          y1={cy}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke="currentColor"
          className="text-foreground"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={6} fill="currentColor" className="text-foreground" />
        <circle cx={cx} cy={cy} r={3} fill="currentColor" className="text-card" />

        <text
          x={cx}
          y={cy - 18}
          textAnchor="middle"
          fontSize="20"
          fontWeight="800"
          fill="currentColor"
          className="text-foreground"
          letterSpacing="-0.5"
        >
          {pctDisplay}%
        </text>
      </svg>
    </div>
  );
}
