export type TabType = 'dashboard' | 'empenhos' | 'contratos';

export type EmpenhoFilter = 'all' | 'liquidar' | 'pagar' | 'pago';
export type ContratoFilter = 'all' | 'vigente' | 'vencer';

export interface EmpenhoItem {
  id: string;
  name: string;
  desc: string;
  value: number;
  paid: number;
  status: 'liquidar' | 'pagar' | 'pago';
  label: string;
  badge: 'blue' | 'amber' | '';
  date: string;
  nd: string;
}

export interface ContratoItem {
  id: string;
  title: string;
  name: string;
  value: number;
  campus: number;
  end: string;
  remaining: string;
  pct: number;
  warning: boolean;
  docs: number;
  invoices: number;
  icon: 'shield' | 'building' | 'doc';
}

export interface ChartMonthData {
  month: string;
  liquidado: number;
  pago: number;
  liquidadoHeight: number;
  pagoHeight: number;
  liquidadoY: number;
  pagoY: number;
  xBlue: number;
  xLight: number;
}
