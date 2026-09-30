export type TabType = 'dashboard' | 'empenhos' | 'contratos' | 'licitacoes' | 'infraestrutura';

export type EmpenhoFilter = 'all' | 'exercicio' | 'rap';
export type ContratoFilter = 'all' | 'vigente' | 'vencer' | 'pendentes';
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

export type ContratoStatus = 'vigente' | 'a_vencer' | 'expirado';

export interface ContratoItem {
  /** contratos_api.id (UUID) — chave única; o número do contrato pode se repetir. */
  uuid: string;
  numero: string;
  fornecedor: string;
  objeto: string;
  categoria: string | null;
  processo: string | null;
  unidadeOrigem: string | null;
  valorGlobal: number;
  empenhado: number;
  aLiquidar: number;
  liquidado: number;
  pago: number;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  status: ContratoStatus;
  dias: number | null;
  vigenciaTexto: string;
  percentualDecorrido: number;
  faturasPendentes: number;
  icon: 'shield' | 'building' | 'doc';
}

export interface ContratoEmpenhoLinha {
  id: string;
  numero: string;
  credor: string | null;
  dataEmissao: string | null;
  naturezaDespesa: string | null;
  empenhado: number;
  aLiquidar: number;
  liquidado: number;
  pago: number;
}

export interface ContratoFaturaLinha {
  id: string;
  numero: string;
  referencia: string;
  situacao: string;
  pendente: boolean;
  valorBruto: number;
  valorLiquido: number;
  vencimento: string | null;
  pagamento: string | null;
}

export interface ContratoItemLinha {
  id: string;
  descricao: string;
  numeroItem: string | null;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface ContratoTermoLinha {
  id: string;
  tipo: string;
  numero: string | null;
  assinatura: string | null;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  valor: number;
  observacao: string | null;
}

export interface ContratoDetalhe {
  empenhos: ContratoEmpenhoLinha[];
  faturas: ContratoFaturaLinha[];
  itens: ContratoItemLinha[];
  termos: ContratoTermoLinha[];
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

