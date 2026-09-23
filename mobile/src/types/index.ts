export type TabType = 'dashboard' | 'empenhos' | 'contratos' | 'licitacoes' | 'infraestrutura';

export type EmpenhoFilter = 'all' | 'exercicio' | 'rap';
export type ContratoFilter = 'all' | 'vigente' | 'vencer';
export type LicitacaoSubTab = 'pregoes' | 'atas';
export type PregaoFilter = 'all' | 'abertas' | 'encerradas' | 'srp';
export type AtaFilter = 'all' | 'vigentes' | 'vencer' | 'campus';

export type InfraSubTab = 'manutencao' | 'portaria' | 'energia';
export type ManutencaoFilter = 'all' | 'pendente' | 'em_andamento' | 'resolvido';
export type PortariaFilter = 'todos' | 'hoje' | 'futuros';
export type EnergiaFilter = 'all' | 'cosern' | 'mercatto' | 'solar';

export interface PortariaEventoItem {
  id: string;
  titulo: string;
  descricao?: string | null;
  local: string;
  ambienteId?: string | null;
  dataInicio: string;
  dataFim?: string | null;
  responsavelNome?: string | null;
  responsavelContato?: string | null;
  tipo: string;
  status: string;
  observacoesPortaria?: string | null;
  totalParticipantes: number;
  totalPresentes: number;
}

export interface PortariaParticipanteItem {
  id: string;
  eventoId: string;
  nome: string;
  documento?: string | null;
  instituicao?: string | null;
  tipo: string;
  presente: boolean;
  horarioEntrada?: string | null;
  veiculoPlaca?: string | null;
  observacao?: string | null;
}

export interface OcorrenciaItem {
  id: string;
  ambienteNome: string;
  ambienteCodigo: string;
  bloco: string | null;
  status: 'pendente' | 'em_andamento' | 'resolvido' | 'arquivado';
  avaliacao: number;
  problemas: string[];
  observacao: string | null;
  fotoUrl?: string | null;
  data: string;
  resolvidoEm?: string | null;
}

export interface EnergiaFaturaItem {
  id: string;
  fonte: 'cosern' | 'mercatto';
  competencia: string;
  ano: number;
  consumoKwh: number;
  valor: number;
  faturaNumero?: string;
  fornecedor?: string;
  leituraFim?: string;
}

export interface EnergiaSolarItem {
  id: string;
  ufvNome: string;
  dataReferencia: string;
  ano: number;
  mes: number;
  energiaGeradaKwh: number;
}

export interface PtresItem {
  code: string;
  name: string;
  shortLabel?: string;
}

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

