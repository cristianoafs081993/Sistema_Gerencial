import { formatCurrency } from '@/lib/utils';
import { formatCompactCurrency, getReadableTextColor, truncateTreemapLabel } from './utils';

export function ExecutionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color?: string; name?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[210px] rounded-2xl border border-border-default/70 bg-white/95 px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm">
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
        {label}
      </p>
      <div className="mt-2 space-y-2">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color || '#94a3b8' }} />
              <span className="font-ui text-sm font-medium text-text-secondary">{item.name}</span>
            </div>
            <span className="font-ui text-sm font-semibold text-text-primary">
              {formatCurrency(item.value || 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BudgetHierarchyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { name?: string; value?: number; nodeType?: string; parentName?: string } }>;
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;

  return (
    <div className="min-w-[220px] rounded-2xl border border-border-default/70 bg-white/95 px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm">
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
        {item.nodeType === 'componente' ? 'Componente funcional' : 'Dimensao'}
      </p>
      <p className="mt-1 font-ui text-sm font-semibold text-text-primary">{item.name}</p>
      {item.parentName ? (
        <p className="mt-1 font-ui text-xs text-text-muted">{item.parentName}</p>
      ) : null}
      <p className="mt-3 font-ui text-sm font-bold text-text-primary">{formatCurrency(item.value || 0)}</p>
    </div>
  );
}

export function BudgetTreemapContent(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
  name?: string;
  value?: number;
  fill?: string;
  textColor?: string;
  nodeType?: string;
  parentName?: string;
  root?: { x?: number; y?: number; width?: number; height?: number };
  highlightedDimension?: string | null;
}) {
  const {
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    depth = 1,
    name = '',
    value = 0,
    fill,
    textColor,
    nodeType,
    parentName,
    highlightedDimension,
  } = props;

  if (depth === 0) return null;
  if (width < 10 || height < 10) return null;

  const nodeFill = fill || '#2563eb';
  const nodeTextColor = textColor || getReadableTextColor(nodeFill);
  const textStroke = nodeTextColor === '#ffffff' ? 'rgba(15,23,42,0.42)' : 'rgba(255,255,255,0.92)';
  const isPrimary = depth === 1;
  const nodeDimension = nodeType === 'dimensao' ? name : parentName;
  const isHighlighted = !highlightedDimension || nodeDimension === highlightedDimension;
  const showLabel = width > (isPrimary ? 120 : 82) && height > (isPrimary ? 56 : 36);
  const showValue = width > (isPrimary ? 148 : 108) && height > (isPrimary ? 84 : 54);
  const label = truncateTreemapLabel(name, width, depth);

  return (
    <g opacity={isHighlighted ? 1 : 0.18}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={0}
        ry={0}
        fill={nodeFill}
        stroke={isHighlighted ? '#ffffff' : 'rgba(255,255,255,0.55)'}
        strokeWidth={isHighlighted ? (isPrimary ? 3 : 2) : 1.2}
      />
      {showLabel ? (
        <text
          x={x + 12}
          y={y + (isPrimary ? 24 : 20)}
          fill={nodeTextColor}
          fontSize={isPrimary ? 12 : 11}
          fontWeight={isPrimary ? 800 : 700}
          stroke={textStroke}
          strokeWidth={isPrimary ? 2.6 : 2.2}
          strokeLinejoin="round"
          paintOrder="stroke fill"
        >
          {label}
        </text>
      ) : null}
      {showValue ? (
        <text
          x={x + 12}
          y={y + (isPrimary ? 46 : 38)}
          fill={nodeTextColor}
          fontSize={isPrimary ? 14 : 12}
          fontWeight={800}
          stroke={textStroke}
          strokeWidth={isPrimary ? 3 : 2.4}
          strokeLinejoin="round"
          paintOrder="stroke fill"
        >
          {formatCompactCurrency(value)}
        </text>
      ) : null}
    </g>
  );
}
