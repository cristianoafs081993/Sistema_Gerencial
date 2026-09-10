export type TabType = 'dashboard' | 'empenhos' | 'contratos' | 'licitacoes';

export type EmpenhoFilter = 'all' | 'exercicio' | 'rap';
export type ContratoFilter = 'all' | 'vigente' | 'vencer';
export type LicitacaoSubTab = 'pregoes' | 'atas';
export type PregaoFilter = 'all' | 'abertas' | 'encerradas' | 'srp';
export type AtaFilter = 'all' | 'vigentes' | 'vencer' | 'campus';

export interface PregaoItem {
  id: string;
  numero: string;
  objeto: string;
  modalidade: string;
  uasgCodigo: string;
  uasgNome: string;
  valor: number;
  tipoValor: 'homologado' | 'estimado';
  statusProposta: 'Aberta' | 'Futura' | 'Encerrada' | 'Em andamento';
  badgeColor: 'green' | 'blue' | 'amber' | 'muted';
  dataAbertura?: string;
  dataPublicacao?: string;
  srp: boolean;
  link?: string;
  processo?: string;
}

export interface AtaItem {
  id: string;
  numeroAta: string;
  numeroCompra?: string;
  objeto: string;
  unidadeGerenciadoraCodigo: string;
  unidadeGerenciadoraNome: string;
  vinculo: 'gerenciadora' | 'participante' | 'aderente' | 'outro';
  vigenciaInicio: string;
  vigenciaFim: string;
  statusVigencia: 'vigente' | 'vencer' | 'expirada';
  diasRestantes: number;
  totalItens: number;
  totalAdesoes: number;
  badgeVigencia: 'green' | 'amber' | 'muted';
}

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
  tipo?: 'exercicio' | 'rap';
  saldo?: number;
  inscrito?: number;
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

export type NotificationType = 'empenho' | 'descentralizacao' | 'requisicao';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  date: Date;
  documentDate?: Date;
  title: string;
  subtitle: string;
  description: string;
  valor: number;
  dimensao?: string;
  status?: string;
  numeroDocumento?: string;
}

