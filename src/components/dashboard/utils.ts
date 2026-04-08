import { formatCurrency } from '@/lib/utils';

export const getRapALiquidar = (rapALiquidar?: number) => rapALiquidar || 0;

export const getRapAPagar = (
  saldoRapOficial?: number,
  rapInscrito?: number,
  rapALiquidar?: number,
  rapPago?: number,
) => {
  if (saldoRapOficial != null) return saldoRapOficial;
  return Math.max(0, (rapInscrito || 0) - (rapALiquidar || 0) - (rapPago || 0));
};

export const getRapSaldo = (rapALiquidar?: number, saldoRapOficial?: number) => {
  const aLiq = getRapALiquidar(rapALiquidar);
  if (aLiq > 0) return aLiq;
  return saldoRapOficial || 0;
};

export const formatCompactCurrency = (value: number) => {
  if (Math.abs(value) >= 1000000) return `R$${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `R$${(value / 1000).toFixed(0)}k`;
  return formatCurrency(value);
};

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const mixHexColors = (baseColor: string, targetColor: string, amount: number) => {
  const safeAmount = clamp(amount, 0, 1);
  const normalize = (color: string) => color.replace('#', '');
  const base = normalize(baseColor);
  const target = normalize(targetColor);

  const baseRgb = {
    r: parseInt(base.slice(0, 2), 16),
    g: parseInt(base.slice(2, 4), 16),
    b: parseInt(base.slice(4, 6), 16),
  };

  const targetRgb = {
    r: parseInt(target.slice(0, 2), 16),
    g: parseInt(target.slice(2, 4), 16),
    b: parseInt(target.slice(4, 6), 16),
  };

  const toHex = (value: number) => Math.round(value).toString(16).padStart(2, '0');

  return `#${toHex(baseRgb.r + (targetRgb.r - baseRgb.r) * safeAmount)}${toHex(
    baseRgb.g + (targetRgb.g - baseRgb.g) * safeAmount,
  )}${toHex(baseRgb.b + (targetRgb.b - baseRgb.b) * safeAmount)}`;
};

export const getReadableTextColor = (hexColor: string) => {
  const normalized = hexColor.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.56 ? '#0f172a' : '#ffffff';
};

export const truncateTreemapLabel = (label: string, width: number, depth: number) => {
  const charWidth = depth === 1 ? 7.1 : 6.3;
  const maxChars = Math.max(8, Math.floor((width - 18) / charWidth));

  return label.length > maxChars ? `${label.slice(0, maxChars - 1)}...` : label;
};
