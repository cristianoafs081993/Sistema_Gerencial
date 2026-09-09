/**
 * GovFlow Core SDK - Types Definition
 * Tipagem completa para os módulos de Orçamento, Empenhos, Descentralizações, Contratos e Conciliação.
 */

// ==========================================
// 1. MÓDULO ORÇAMENTÁRIO & PLANEJAMENTO
// ==========================================

export interface OrcamentoFiltros {
  ano?: number;
  dimensao?: string;
  componenteFuncional?: string;
  origemRecurso?: string;
  tipoAtividade?: 'campus' | 'sistemico' | 'emendas-parlamentares' | 'todos';
}

export interface PainelExecucaoResult {
  totalPlanejado: number;
  totalDescentralizado: number;
  totalEmpenhado: number;
  totalLiquidado: number;
  totalPago: number;
  aDescentralizar: number;
  percentualExecutado: number;
  percentualLiquidado: number;
  percentualPago: number;
  quantidadeAtividades: number;
  quantidadeEmpenhos: number;
}

export interface PtresResumoResult {
  ptres: string;
  planejadoSuap: number;
  descentralizadoSiafi: number;
  empenhadoSiafi: number;
  liquidadoSiafi: number;
  pagoSiafi: number;
  saldoSuap: number; // planejado - empenhado
  saldoRealSiafi: number; // descentralizado - empenhado
  percentualExecucao: number;
  status: 'regular' | 'alerta_descompasso' | 'sem_planejamento' | 'deficit';
  alertas: string[];
}

export interface AtividadeDetalhada {
  id: string;
  atividade: string;
  descricao: string;
  dimensao: string;
  componenteFuncional: string;
  planoInterno: string;
  naturezaDespesa: string;
  origemRecurso: string;
  valorTotal: number;
  saldoDisponivelSuap: number;
  valorEmpenhadoCalculado: number;
  saldoCalculado: number;
  syncSource?: string;
  suapPlanId?: number;
  suapActivityId?: string;
}

export interface DimensaoDistribuicao {
  dimensao: string;
  planejado: number;
  empenhado: number;
  liquidado: number;
  saldo: number;
  percentual: number;
}

export interface NaturezaDespesaAgrupada {
  codigo: string;
  descricao?: string;
  empenhado: number;
  percentual: number;
}

// ==========================================
// 2. MÓDULO DE EMPENHOS & RESTOS A PAGAR
// ==========================================

export interface PesquisaEmpenhoParams {
  termoBusca?: string;
  ptres?: string;
  planoInterno?: string;
  naturezaDespesa?: string;
  favorecido?: string;
  processo?: string;
  tipo?: 'exercicio' | 'rap' | 'todos';
  status?: 'pendente' | 'liquidado' | 'pago' | 'cancelado' | 'todos';
  ano?: number;
  limit?: number;
  offset?: number;
}

export interface OperacaoEmpenhoDetalhe {
  data: string;
  operacao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface EmpenhoDetalhadoResult {
  id: string;
  numero: string;
  descricao: string;
  valor: number;
  status: string;
  tipo: 'exercicio' | 'rap';
  dataEmpenho: string;
  processo?: string;
  favorecidoNome?: string;
  favorecidoDocumento?: string;
  origemRecurso: string; // PTRES
  planoInterno?: string;
  naturezaDespesa: string;
  dimensao?: string;
  componenteFuncional?: string;
  valorLiquidado: number;
  valorPago: number;
  saldoALiquidar: number;
  saldoAPagar: number;
  saldoRapOficial?: number;
  historicoOperacoes: OperacaoEmpenhoDetalhe[];
}

export interface RapConsolidadoResult {
  anoExercicio: number;
  rapInscritoTotal: number;
  rapALiquidarTotal: number;
  rapLiquidadoTotal: number;
  rapPagoTotal: number;
  rapSaldoAtualTotal: number;
  quantidadeEmpenhos: number;
}

// ==========================================
// 3. MÓDULO DE DESCENTRALIZAÇÕES
// ==========================================

export interface NotaCreditoDetalhe {
  id: string;
  notaCredito: string;
  operacaoTipo: 'DESCENTRALIZACAO DE CREDITO' | 'ANULACAO DE DESCENTRALIZACAO DE CREDITO' | string;
  origemRecurso: string;
  planoInterno: string;
  naturezaDespesa: string;
  dimensao: string;
  dataEmissao: string;
  descricao: string;
  valor: number;
  isCredito: boolean;
  isEstorno: boolean;
}

export interface ExtratoDescentralizacaoResult {
  ptres: string;
  totalCreditoRecebido: number;
  totalEstornadoOuDevolvido: number;
  totalLiquidoDescentralizado: number;
  quantidadeOperacoes: number;
  notasCredito: NotaCreditoDetalhe[];
}

// ==========================================
// 4. MÓDULO DE CONTRATOS & EXECUÇÃO
// ==========================================

export interface FichaContratoResult {
  id: string;
  numero: string;
  contratada: string;
  cnpj?: string;
  objeto: string;
  situacao: string;
  situacaoDerivada: 'ativo' | 'vencido' | 'rescindido' | 'desconhecido';
  situacaoDerivadaMotivo?: string;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  vigenciaFimDerivada: string | null;
  diasParaVencer: number | null;
  valorInicial: number;
  valorGlobal: number;
  origemUg: string; // 158366 (Campus) ou 158155 (Reitoria)
  isCampusCurraisNovos: boolean;
  totalEmpenhadoVinculado: number;
  saldoEmpenhosVinculados: number;
  totalFaturado: number;
  totalLiquidado: number;
  totalPago: number;
}

export interface TermoAditivoDetalhe {
  id: string;
  numero: string;
  tipo: string;
  qualificacaoTermo?: string;
  dataAssinatura?: string;
  vigenciaInicio?: string;
  vigenciaFim?: string;
  valorGlobal?: number;
  novoValorGlobal?: number;
  observacao?: string;
}

export interface ContratoEmpenhoVinculado {
  empenhoNumero: string;
  origemRecurso: string;
  planoInterno?: string;
  naturezaDespesa?: string;
  valorOriginal: number;
  valorLiquidado: number;
  valorPago: number;
  saldoDisponivel: number;
  tipo: 'exercicio' | 'rap';
}

export interface ContratoFaturaDetalhe {
  id: string | number;
  numeroInstrumento: string;
  dataEmissao: string;
  dataVencimento?: string;
  dataLiquidacao?: string;
  dataPagamento?: string;
  situacao: string;
  valorBruto: number;
  valorLiquido: number;
  processo?: string;
  empenhosUtilizados: string[];
}

export interface ProjecaoContratualResult {
  contratoId: string;
  contratoNumero: string;
  valorMensalMedio: number;
  mesesRestantesExercicio: number;
  mesesRestantesVigencia: number;
  necessidadeAteFimExercicio: number;
  necessidadeAteFimVigencia: number;
  saldoEmpenhosAtuais: number;
  deficitOuSuperavitExercicio: number;
  requerReforcoExercicio: boolean;
  valorReforcoEstimado: number;
  alertas: string[];
}

// ==========================================
// 5. MÓDULO DE CONCILIAÇÃO & AUDITORIA FORENSE
// ==========================================

export interface ConciliacaoPlanoInternoItem {
  planoInterno: string;
  planejadoSuap: number;
  descentralizadoSiafi: number;
  empenhadoSiafi: number;
  saldoSuap: number; // planejado - empenhado
  saldoRealSiafi: number; // descentralizado - empenhado
  status: 'equilibrado' | 'saldo_positivo_a_empenhar' | 'descompasso_planejamento_insuficiente' | 'sem_planejamento';
  observacoes: string[];
}

export interface ConciliacaoPtresResult {
  ptres: string;
  resumoGeral: {
    planejadoSuap: number;
    descentralizadoSiafi: number;
    empenhadoSiafi: number;
    saldoPlanejamentoSuap: number;
    saldoRealSiafi: number;
    situacaoGeral: 'REGULAR' | 'DESCOMPASSO_COM_SUAP' | 'DEFICIT_ORCAMENTARIO' | 'SUPERAVIT_SEM_EMPENHO';
  };
  planosInternos: ConciliacaoPlanoInternoItem[];
  atividadesComSaldo: Array<{
    id: string;
    atividade: string;
    planoInterno: string;
    planejado: number;
    saldoNaoEmpenhado: number;
  }>;
  empenhosSemAtividadePlanejada: Array<{
    numero: string;
    descricao: string;
    planoInterno: string;
    valor: number;
    processo?: string;
  }>;
  diagnosticoTextual: string;
  recomendacoes: string[];
}

export interface TrilhaDespesaResult {
  empenhoNumero: string;
  empenho: {
    valor: number;
    data: string;
    status: string;
    favorecido: string;
    ptres: string;
    planoInterno?: string;
  };
  creditoOrigem?: {
    notaCredito: string;
    data: string;
    valor: number;
  };
  atividadeOrigem?: {
    atividade: string;
    planejado: number;
    suapPlanId?: number;
  };
  contratoVinculado?: {
    numero: string;
    objeto: string;
    vigenciaFim?: string;
  };
  faturasAssociadas: Array<{
    numero: string;
    valor: number;
    dataLiquidacao?: string;
    dataPagamento?: string;
  }>;
}

export interface AuditoriaSaudeResult {
  anoExercicio: number;
  geradoEm: string;
  totalPtresAnalisados: number;
  ptresComDescompasso: Array<{
    ptres: string;
    saldoSuap: number;
    saldoSiafi: number;
    motivo: string;
  }>;
  contratosCriticosSemSaldo: Array<{
    contratoNumero: string;
    fornecedor: string;
    saldoEmpenhos: number;
    necessidadeExercicio: number;
    deficitEstimado: number;
  }>;
  alertasUrgentes: string[];
}
