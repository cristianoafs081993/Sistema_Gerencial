export type ModuloBuscaAtas = 'adesao' | 'pesquisa_precos';

export type TipoItemAta = 'material' | 'servico' | 'nao_classificado';
export type ClassificacaoOrgaoAdesaoAtas =
  | 'nao_classificado'
  | 'administracao_publica'
  | 'empresa_publica'
  | 'sociedade_economia_mista'
  | 'outra_entidade';
export type AtaAdesaoStatus = 'revisar_documentos' | 'somente_pesquisa_precos' | 'sem_indicativo_adesao';

export type StatusVigenciaAta = 'vigente' | 'a_vencer' | 'encerrada' | 'desconhecida';
export type StatusSessaoBatchAtas = 'em_andamento' | 'concluida' | 'pausada';
export type StatusItemBatchAtas = 'pendente' | 'em_foco' | 'concluido' | 'erro';

export interface AtaRegistroPreco {
  id: string;
  identificador_fonte?: string | null;
  numero_ata: string;
  ano_ata?: number | null;
  objeto: string;
  objeto_normalizado?: string | null;
  orgao_gerenciador?: string | null;
  orgao_gerenciador_normalizado?: string | null;
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
  status_vigencia: StatusVigenciaAta;
  fonte: string;
  raw_payload?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrgaoAtaClassificacao {
  cnpj: string;
  razao_social?: string | null;
  classificacao: ClassificacaoOrgaoAdesaoAtas;
  natureza_juridica?: string | null;
  permite_adesao_ifrn?: boolean | null;
  usar_somente_pesquisa_precos: boolean;
  observacoes?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AtaAdesaoAnalysis {
  status: AtaAdesaoStatus;
  blockedForAdesao: boolean;
  onlyPriceResearch: boolean;
  message: string;
  orgaoCnpj?: string | null;
  classificacaoOrgao?: ClassificacaoOrgaoAdesaoAtas | null;
  naturezaJuridica?: string | null;
  hasMaximoAdesaoSignal: boolean;
  maximoAdesaoTotal?: number | null;
  itensComIndicativo: number;
}

export interface ItemAta {
  id: string;
  ata_id: string;
  numero_item?: string | null;
  descricao: string;
  descricao_normalizada?: string | null;
  tipo_item: TipoItemAta;
  unidade_fornecimento?: string | null;
  quantidade?: number | null;
  codigo_catmat_catser?: string | null;
  valor_unitario?: number | null;
  valor_total?: number | null;
  quantidade_homologada_fornecedor?: number | null;
  maximo_adesao?: number | null;
  fornecedor_documento?: string | null;
  fornecedor_nome?: string | null;
  codigo_pdm?: string | null;
  nome_pdm?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DocumentoAta {
  id: string;
  ata_id: string;
  tipo_documento: string;
  url_origem?: string | null;
  texto_extraido?: string | null;
  status_extracao: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SessaoBuscaAta {
  id: string;
  usuario_id?: string | null;
  modulo: ModuloBuscaAtas;
  consulta_original: string;
  consulta_normalizada?: string | null;
  contexto?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ResultadoBuscaAta {
  id: string;
  sessao_busca_id: string;
  ata_id: string;
  item_ata_id?: string | null;
  posicao: number;
  justificativa_curta?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ResultadoBuscaAtaPersistido extends ResultadoBuscaAta {
  ata?: Pick<AtaRegistroPreco, 'id' | 'numero_ata' | 'objeto' | 'status_vigencia'> | null;
}

export interface ResultadoBuscaAtaPersistidoDetalhado extends ResultadoBuscaAta {
  ata?: AtaRegistroPreco | null;
  item?: ItemAta | null;
}

export interface EventoUsoAta {
  id: string;
  usuario_id?: string | null;
  modulo?: ModuloBuscaAtas | null;
  tipo_evento: string;
  referencia_tipo?: string | null;
  referencia_id?: string | null;
  payload?: Record<string, unknown>;
  created_at: string;
}

export interface AtasObservabilityMetric {
  totalSearchSessions: number;
  totalBatchSessions: number;
  totalCompletedBatchSessions: number;
  totalRefinements: number;
  totalDetailOpens: number;
  totalProcessedBatchItems: number;
}

export interface AtasObservabilityOverview {
  totals: AtasObservabilityMetric;
  byModule: Record<ModuloBuscaAtas, AtasObservabilityMetric>;
  recentSessions: Record<ModuloBuscaAtas, AtaSearchSessionSummary[]>;
  recentBatchSessions: SessaoBatchAtaResumo[];
  recentEvents: EventoUsoAta[];
}

export interface AtaDetalhe {
  ata: AtaRegistroPreco;
  itens: ItemAta[];
  documentos: DocumentoAta[];
}

export interface AtasModuleStatus {
  module: ModuloBuscaAtas;
  enabled: boolean;
  sourceName: string;
  sourceConfigured: boolean;
  searchReady: boolean;
  detailReady: boolean;
  sessionReady: boolean;
  featureFlag: string;
}

export interface AtasModuleDefinition {
  module: ModuloBuscaAtas;
  title: string;
  summary: string;
  focusLabel: string;
  outputLabel: string;
  nextMilestone: string;
  queryPlaceholder: string;
  emptyPrompt: string;
}

export interface AtaSearchIntent {
  normalizedQuery: string;
  tokens: string[];
  inferredTipoItem: TipoItemAta | null;
  understanding: string;
}

export interface AtaSearchResult {
  position: number;
  score: number;
  ata: AtaRegistroPreco;
  primaryItem: ItemAta | null;
  matchedItems: ItemAta[];
  justification: string;
  matchSource: 'ata' | 'item';
  adesaoAnalysis: AtaAdesaoAnalysis;
}

export interface AtaSearchResponse {
  module: ModuloBuscaAtas;
  query: string;
  intent: AtaSearchIntent;
  results: AtaSearchResult[];
  nextStep: string;
  sessionId: string | null;
  refinementSuggestions: string[];
  previousQuery: string | null;
  filters: AtaSearchFilters;
}

export interface AtaConversationalReply {
  text: string;
  provider: 'gemini' | 'fallback';
  model?: string | null;
}

export interface AtaSearchFilters {
  statusVigencia: 'todas' | StatusVigenciaAta;
  tipoItem: 'todos' | Exclude<TipoItemAta, 'nao_classificado'>;
  requireCatalog: boolean;
  catalogCode: string;
}

export interface AtaSearchOptions {
  previousQuery?: string | null;
  filters?: AtaSearchFilters;
}

export interface AtaSearchSessionSummary {
  id: string;
  module: ModuloBuscaAtas;
  query: string;
  createdAt: string;
  previousQuery: string | null;
  resultCount: number;
  topResult: ResultadoBuscaAtaPersistido | null;
  filters: AtaSearchFilters | null;
}

export interface SessaoBuscaAtaPersistida {
  id: string;
  modulo: ModuloBuscaAtas;
  consulta_original: string;
  contexto?: Record<string, unknown>;
  created_at: string;
  resultados_busca_atas: ResultadoBuscaAtaPersistidoDetalhado[];
}

export interface SessaoBatchAta {
  id: string;
  modulo: ModuloBuscaAtas;
  titulo: string;
  filtros: AtaSearchFilters;
  status: StatusSessaoBatchAtas;
  total_itens: number;
  total_concluidos: number;
  item_atual_ordem?: number | null;
  created_at: string;
  updated_at: string;
}

export interface ItemSessaoBatchAta {
  id: string;
  sessao_batch_id: string;
  ordem: number;
  consulta_item: string;
  status: StatusItemBatchAtas;
  sessao_busca_id?: string | null;
  resumo?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SessaoBatchAtaResumo {
  id: string;
  titulo: string;
  status: StatusSessaoBatchAtas;
  totalItens: number;
  totalConcluidos: number;
  itemAtualOrdem: number | null;
  createdAt: string;
  filters: AtaSearchFilters;
  itens: ItemSessaoBatchAta[];
}
