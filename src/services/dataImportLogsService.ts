import { supabase } from '@/lib/supabase';

export type PipelineSourceType = 'manual_upload' | 'email_csv' | 'api_sync';
export type PipelineRunStatus = 'processing' | 'success' | 'warning' | 'failed' | 'skipped';
export type PipelineModule = 'orcamentario' | 'financeiro' | 'contratos' | 'integracoes';

export type DataImportRun = {
  id: string;
  orgId: string;
  userId?: string | null;
  userEmail?: string | null;
  pipeline: string;
  pipelineName: string;
  sourceType: PipelineSourceType;
  sourceName?: string | null;
  status: PipelineRunStatus;
  rowsDetected: number;
  rowsWritten: number;
  rowsSkipped: number;
  rowsUpdated: number;
  errorMessage?: string | null;
  metadata: Record<string, unknown>;
  startedAt: string;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UnifiedLogEntry = {
  id: string;
  timestamp: string;
  pipelineKey: string;
  pipelineLabel: string;
  module: PipelineModule;
  sourceType: PipelineSourceType;
  sourceName: string;
  status: PipelineRunStatus;
  rowsDetected: number;
  rowsWritten: number;
  rowsSkipped: number;
  rowsUpdated: number;
  errorMessage?: string | null;
  metadata: Record<string, unknown>;
  durationMs?: number;
  userEmail?: string | null;
};

export type DatasetDefinition = {
  key: string;
  name: string;
  module: PipelineModule;
  description: string;
  supportedSources: PipelineSourceType[];
};

export type DatasetStatus = {
  key: string;
  name: string;
  module: PipelineModule;
  description: string;
  supportedSources: PipelineSourceType[];
  lastUpdatedAt: string | null;
  lastStatus: 'success' | 'warning' | 'failed' | 'stale' | 'no_data' | 'processing';
  lastSourceType: PipelineSourceType | null;
  lastSourceName: string | null;
  lastErrorMessage: string | null;
  lastRowsCount: number;
  hasRecentError: boolean;
  totalRunsCount: number;
};

export type ObservabilityStats = {
  totalRuns: number;
  successCount: number;
  failedCount: number;
  warningCount: number;
  skippedCount: number;
  manualUploadsCount: number;
  emailIngestionsCount: number;
  apiSyncsCount: number;
  healthyDatasetsCount: number;
  unhealthyDatasetsCount: number;
  lastActivityTimestamp: string | null;
};

export const DATASET_CATALOG: DatasetDefinition[] = [
  {
    key: 'descentralizacoes',
    name: 'Descentralizações de Crédito',
    module: 'orcamentario',
    description: 'Notas de Crédito (NC), histórico e reconciliação automática por PI e dimensão.',
    supportedSources: ['manual_upload', 'email_csv'],
  },
  {
    key: 'descentralizacoes_devolucoes',
    name: 'Devoluções de Descentralização',
    module: 'orcamentario',
    description: 'Lançamentos negativos de devolução de créditos descentralizados.',
    supportedSources: ['manual_upload'],
  },
  {
    key: 'descentralizacoes_conta_saldos',
    name: 'Conta Contábil de Descentralizações',
    module: 'orcamentario',
    description: 'Saldos agregados da conta contábil por PTRES.',
    supportedSources: ['manual_upload', 'email_csv'],
  },
  {
    key: 'creditos_disponiveis',
    name: 'Crédito Disponível',
    module: 'orcamentario',
    description: 'Saldos disponíveis por PTRES, Plano Interno e descrição.',
    supportedSources: ['manual_upload', 'email_csv'],
  },
  {
    key: 'empenhos_siafi',
    name: 'Empenhos SIAFI',
    module: 'orcamentario',
    description: 'Execução do exercício corrente, empenhado, liquidado e pago.',
    supportedSources: ['manual_upload', 'email_csv'],
  },
  {
    key: 'rap_saldo',
    name: 'Saldos Restos a Pagar (RAP)',
    module: 'orcamentario',
    description: 'Saldos oficiais de Restos a Pagar inscritos e a pagar por empenho.',
    supportedSources: ['manual_upload', 'email_csv'],
  },
  {
    key: 'rap_historico',
    name: 'Histórico Anual de RAP',
    module: 'orcamentario',
    description: 'Séries anuais consolidadas de RAP por UG Executora e item de informação.',
    supportedSources: ['manual_upload'],
  },
  {
    key: 'atividades_planejamento',
    name: 'Atividades do Planejamento',
    module: 'orcamentario',
    description: 'Atividades planejadas e sincronização de espelho do Plano 8 SUAP.',
    supportedSources: ['manual_upload', 'api_sync'],
  },
  {
    key: 'financeiro_fontes',
    name: 'Financeiro por Fontes',
    module: 'financeiro',
    description: 'Saldos por fonte de recurso e vinculação orçamentária.',
    supportedSources: ['manual_upload', 'email_csv'],
  },
  {
    key: 'lc_credores',
    name: 'Lista de Credores (LC)',
    module: 'financeiro',
    description: 'Cronologia de exigibilidades, credores e vinculações bancárias.',
    supportedSources: ['manual_upload', 'email_csv'],
  },
  {
    key: 'retencoes_efd_reinf',
    name: 'Retenções EFD-Reinf',
    module: 'financeiro',
    description: 'Auditoria tributária de notas fiscais e retenções federais.',
    supportedSources: ['manual_upload', 'email_csv'],
  },
  {
    key: 'pfs_rastreabilidade',
    name: 'Rastreabilidade de PFs',
    module: 'financeiro',
    description: 'Cruzamento de solicitações, aprovações e liberações de recursos (PFs).',
    supportedSources: ['manual_upload', 'email_csv'],
  },
  {
    key: 'documentos_habeis',
    name: 'Documentos Hábeis e Liquidações',
    module: 'financeiro',
    description: 'Documentos Hábeis (DH), vínculo com Fonte SOF, Ordens Bancárias e Situações.',
    supportedSources: ['manual_upload', 'email_csv'],
  },
  {
    key: 'contratos_comprasnet',
    name: 'Contratos Comprasnet',
    module: 'contratos',
    description: 'Contratos vigentes, empenhos vinculados, faturas e sincronização via API Comprasnet.',
    supportedSources: ['manual_upload', 'api_sync'],
  },
  {
    key: 'energia_campus',
    name: 'Consumo de Energia Campus',
    module: 'contratos',
    description: 'Planilha de medições de concessionária (COSERN/Neoenergia), faturas e usinas solares.',
    supportedSources: ['manual_upload'],
  },
  {
    key: 'licitacoes_pncp',
    name: 'Licitações PNCP',
    module: 'integracoes',
    description: 'Editais, pregões e avisos de contratação pública sincronizados do PNCP.',
    supportedSources: ['api_sync'],
  },
  {
    key: 'atas_registro_precos',
    name: 'Atas de Registro de Preços',
    module: 'integracoes',
    description: 'Atas vigentes e itens homologados consultados no catálogo do PNCP.',
    supportedSources: ['api_sync'],
  },
];

const PIPELINE_TO_DATASET_MAP: Record<string, string> = {
  descentralizacoes: 'descentralizacoes',
  descentralizacoes_devolucoes: 'descentralizacoes_devolucoes',
  descentralizacoes_conta_saldos: 'descentralizacoes_conta_saldos',
  creditos_disponiveis: 'creditos_disponiveis',
  credito_disponivel: 'creditos_disponiveis',
  empenhos_siafi: 'empenhos_siafi',
  siafi_empenhos: 'empenhos_siafi',
  rap_saldo: 'rap_saldo',
  rap_historico: 'rap_historico',
  atividades: 'atividades_planejamento',
  atividades_planejamento: 'atividades_planejamento',
  suap_plan_sync: 'atividades_planejamento',
  financeiro: 'financeiro_fontes',
  financeiro_fontes: 'financeiro_fontes',
  lc: 'lc_credores',
  lc_credores: 'lc_credores',
  retencoes_efd_reinf: 'retencoes_efd_reinf',
  reinf: 'retencoes_efd_reinf',
  pfs: 'pfs_rastreabilidade',
  pf_solicitacoes: 'pfs_rastreabilidade',
  pf_aprovacoes: 'pfs_rastreabilidade',
  doc_habeis: 'documentos_habeis',
  documentos_habeis: 'documentos_habeis',
  liquidacoes: 'documentos_habeis',
  liquidacoes_sof: 'documentos_habeis',
  ordens_bancarias: 'documentos_habeis',
  situacoes: 'documentos_habeis',
  situacoes_documentos: 'documentos_habeis',
  contratos_planilha: 'contratos_comprasnet',
  contratos_sync: 'contratos_comprasnet',
  contratos_comprasnet: 'contratos_comprasnet',
  energia: 'energia_campus',
  energia_campus: 'energia_campus',
  licitacoes_pncp: 'licitacoes_pncp',
  atas_registro_precos: 'atas_registro_precos',
};

export const dataImportLogsService = {
  async recordImportRunStart(params: {
    pipeline: string;
    pipelineName: string;
    sourceType?: PipelineSourceType;
    sourceName?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string | null> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('data_import_runs')
        .insert({
          user_id: user?.id || null,
          user_email: user?.email || null,
          pipeline: params.pipeline,
          pipeline_name: params.pipelineName,
          source_type: params.sourceType || 'manual_upload',
          source_name: params.sourceName || null,
          status: 'processing',
          metadata: params.metadata || {},
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.warn('dataImportLogsService.recordImportRunStart:', error.message);
        return null;
      }
      return data?.id ? String(data.id) : null;
    } catch (err) {
      console.warn('dataImportLogsService.recordImportRunStart exception:', err);
      return null;
    }
  },

  async recordImportRunSuccess(
    runId: string | null,
    params: {
      rowsDetected?: number;
      rowsWritten?: number;
      rowsSkipped?: number;
      rowsUpdated?: number;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    if (!runId) return;
    try {
      const isWarning = (params.rowsSkipped ?? 0) > 0 && (params.rowsWritten ?? 0) === 0;
      await supabase
        .from('data_import_runs')
        .update({
          status: isWarning ? 'warning' : 'success',
          rows_detected: params.rowsDetected ?? 0,
          rows_written: params.rowsWritten ?? 0,
          rows_skipped: params.rowsSkipped ?? 0,
          rows_updated: params.rowsUpdated ?? 0,
          metadata: params.metadata || {},
          finished_at: new Date().toISOString(),
        })
        .eq('id', runId);
    } catch (err) {
      console.warn('dataImportLogsService.recordImportRunSuccess error:', err);
    }
  },

  async recordImportRunFailure(
    runId: string | null,
    params: {
      errorMessage: string;
      rowsDetected?: number;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    if (!runId) return;
    try {
      await supabase
        .from('data_import_runs')
        .update({
          status: 'failed',
          error_message: params.errorMessage,
          rows_detected: params.rowsDetected ?? 0,
          metadata: params.metadata || {},
          finished_at: new Date().toISOString(),
        })
        .eq('id', runId);
    } catch (err) {
      console.warn('dataImportLogsService.recordImportRunFailure error:', err);
    }
  },

  async fetchUnifiedObservabilityLogs(filters?: {
    sourceType?: string;
    status?: string;
    module?: string;
    pipeline?: string;
    search?: string;
    limit?: number;
  }): Promise<UnifiedLogEntry[]> {
    const limit = filters?.limit ?? 250;
    const entries: UnifiedLogEntry[] = [];

    // 1. Fetch from data_import_runs (Manual uploads)
    try {
      let query = supabase
        .from('data_import_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (filters?.pipeline) {
        query = query.eq('pipeline', filters.pipeline);
      }
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.sourceType && filters.sourceType !== 'all') {
        query = query.eq('source_type', filters.sourceType);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const datasetKey = PIPELINE_TO_DATASET_MAP[row.pipeline] || row.pipeline;
          const def = DATASET_CATALOG.find((d) => d.key === datasetKey);
          const duration =
            row.finished_at && row.started_at
              ? Math.max(0, new Date(row.finished_at).getTime() - new Date(row.started_at).getTime())
              : undefined;

          entries.push({
            id: `manual_${row.id}`,
            timestamp: row.started_at || row.created_at,
            pipelineKey: row.pipeline,
            pipelineLabel: row.pipeline_name || def?.name || row.pipeline,
            module: def?.module || 'orcamentario',
            sourceType: (row.source_type as PipelineSourceType) || 'manual_upload',
            sourceName: row.source_name || 'Upload no navegador',
            status: (row.status as PipelineRunStatus) || 'success',
            rowsDetected: Number(row.rows_detected || 0),
            rowsWritten: Number(row.rows_written || 0),
            rowsSkipped: Number(row.rows_skipped || 0),
            rowsUpdated: Number(row.rows_updated || 0),
            errorMessage: row.error_message || null,
            metadata: (row.metadata as Record<string, unknown>) || {},
            durationMs: duration,
            userEmail: row.user_email || null,
          });
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar data_import_runs:', err);
    }

    // 2. Fetch from email_csv_ingestion_runs (Email automations)
    if (!filters?.sourceType || filters.sourceType === 'all' || filters.sourceType === 'email_csv') {
      try {
        let emailQuery = supabase
          .from('email_csv_ingestion_runs')
          .select('*')
          .order('received_at', { ascending: false })
          .limit(limit);

        if (filters?.pipeline) {
          emailQuery = emailQuery.eq('pipeline', filters.pipeline);
        }

        const { data: emailRuns, error: emailError } = await emailQuery;
        if (!emailError && Array.isArray(emailRuns)) {
          for (const row of emailRuns) {
            const pipelineKey = row.pipeline || 'email_csv';
            const datasetKey = PIPELINE_TO_DATASET_MAP[pipelineKey] || pipelineKey;
            const def = DATASET_CATALOG.find((d) => d.key === datasetKey);

            let mappedStatus: PipelineRunStatus = 'success';
            if (row.status === 'failed') mappedStatus = 'failed';
            else if (row.status === 'skipped') mappedStatus = 'skipped';
            else if (row.status === 'processing') mappedStatus = 'processing';
            else if (row.status === 'succeeded') mappedStatus = 'success';

            if (filters?.status && filters.status !== 'all' && mappedStatus !== filters.status) {
              continue;
            }

            const sender = row.sender_email ? `De: ${row.sender_email}` : '';
            const subject = row.subject ? ` | Assunto: ${row.subject}` : '';
            const sourceName = `${row.attachment_name || 'Anexo CSV'}${sender ? ` (${sender}${subject})` : ''}`;

            entries.push({
              id: `email_${row.id}`,
              timestamp: row.processed_at || row.received_at || row.created_at,
              pipelineKey,
              pipelineLabel: def?.name ? `${def.name} (E-mail)` : `Ingestão por E-mail (${pipelineKey})`,
              module: def?.module || 'orcamentario',
              sourceType: 'email_csv',
              sourceName,
              status: mappedStatus,
              rowsDetected: Number(row.rows_detected || 0),
              rowsWritten: Number(row.rows_written || 0),
              rowsSkipped: 0,
              rowsUpdated: 0,
              errorMessage: row.error_message || null,
              metadata: (row.metadata as Record<string, unknown>) || {},
              userEmail: row.sender_email || null,
            });
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar email_csv_ingestion_runs:', err);
      }
    }

    // 3. Fetch from API Sync Runs (Contratos Comprasnet, SUAP Plan, PNCP, Atas)
    if (!filters?.sourceType || filters.sourceType === 'all' || filters.sourceType === 'api_sync') {
      // Contratos API Sync Runs
      try {
        const { data: contratosRuns } = await supabase
          .from('contratos_api_sync_runs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(limit);

        if (Array.isArray(contratosRuns)) {
          for (const row of contratosRuns) {
            let mappedStatus: PipelineRunStatus = 'success';
            if (row.status === 'error' || row.status === 'failed') mappedStatus = 'failed';
            else if (row.status === 'running') mappedStatus = 'processing';
            else if (row.status === 'warning') mappedStatus = 'warning';

            if (filters?.status && filters.status !== 'all' && mappedStatus !== filters.status) {
              continue;
            }

            const duration =
              row.finished_at && row.started_at
                ? Math.max(0, new Date(row.finished_at).getTime() - new Date(row.started_at).getTime())
                : undefined;

            entries.push({
              id: `contratos_api_${row.id}`,
              timestamp: row.started_at,
              pipelineKey: 'contratos_comprasnet',
              pipelineLabel: 'Contratos Comprasnet (API Sync)',
              module: 'contratos',
              sourceType: 'api_sync',
              sourceName: `API Comprasnet UG ${row.unidade_codigo || 'Geral'}`,
              status: mappedStatus,
              rowsDetected: Number(row.contratos_ativos || 0) + Number(row.contratos_inativos || 0),
              rowsWritten: Number(row.contratos_upserted || 0),
              rowsSkipped: 0,
              rowsUpdated: Number(row.empenhos_upserted || 0) + Number(row.faturas_upserted || 0),
              errorMessage: row.error_message || null,
              metadata: (row.details as Record<string, unknown>) || {},
              durationMs: duration,
            });
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar contratos_api_sync_runs:', err);
      }

      // SUAP Plan Sync Runs
      try {
        const { data: suapRuns } = await supabase
          .from('suap_plan_sync_runs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(limit);

        if (Array.isArray(suapRuns)) {
          for (const row of suapRuns) {
            let mappedStatus: PipelineRunStatus = 'success';
            if (row.status === 'failed' || row.status === 'reauth_required') mappedStatus = 'failed';
            else if (row.status === 'running') mappedStatus = 'processing';
            else if (row.status === 'preview') mappedStatus = 'warning';

            if (filters?.status && filters.status !== 'all' && mappedStatus !== filters.status) {
              continue;
            }

            const duration =
              row.finished_at && row.started_at
                ? Math.max(0, new Date(row.finished_at).getTime() - new Date(row.started_at).getTime())
                : undefined;

            entries.push({
              id: `suap_plan_${row.id}`,
              timestamp: row.started_at,
              pipelineKey: 'atividades_planejamento',
              pipelineLabel: 'Plano 8 SUAP (API Sync)',
              module: 'orcamentario',
              sourceType: 'api_sync',
              sourceName: `SUAP Plano 8 (${row.scope || 'campus'}) [${row.mode || 'apply'}]`,
              status: mappedStatus,
              rowsDetected: Number(row.source_count || 0),
              rowsWritten: Number(row.inserted_count || 0),
              rowsSkipped: Number(row.archived_count || 0),
              rowsUpdated: Number(row.updated_count || 0),
              errorMessage: row.error_message || null,
              metadata: (row.metadata as Record<string, unknown>) || {},
              durationMs: duration,
            });
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar suap_plan_sync_runs:', err);
      }

      // Licitações PNCP Sync Runs
      try {
        const { data: pncpRuns } = await supabase
          .from('licitacoes_pncp_sync_runs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(limit);

        if (Array.isArray(pncpRuns)) {
          for (const row of pncpRuns) {
            let mappedStatus: PipelineRunStatus = 'success';
            if (row.status === 'error' || row.status === 'failed') mappedStatus = 'failed';
            else if (row.status === 'running') mappedStatus = 'processing';
            else if (row.status === 'warning') mappedStatus = 'warning';

            if (filters?.status && filters.status !== 'all' && mappedStatus !== filters.status) {
              continue;
            }

            entries.push({
              id: `pncp_${row.id}`,
              timestamp: row.started_at,
              pipelineKey: 'licitacoes_pncp',
              pipelineLabel: 'Licitações PNCP (API Sync)',
              module: 'integracoes',
              sourceType: 'api_sync',
              sourceName: `API PNCP (${row.data_inicial || ''} a ${row.data_final || ''})`,
              status: mappedStatus,
              rowsDetected: Number(row.total_fetched || 0),
              rowsWritten: Number(row.total_upserted || 0),
              rowsSkipped: 0,
              rowsUpdated: 0,
              errorMessage: row.error_message || null,
              metadata: (row.details as Record<string, unknown>) || {},
            });
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar licitacoes_pncp_sync_runs:', err);
      }

      // Atas PNCP Sync Runs
      try {
        const { data: atasRuns } = await supabase
          .from('atas_registro_precos_sync_runs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(limit);

        if (Array.isArray(atasRuns)) {
          for (const row of atasRuns) {
            let mappedStatus: PipelineRunStatus = 'success';
            if (row.status === 'error' || row.status === 'failed') mappedStatus = 'failed';
            else if (row.status === 'running') mappedStatus = 'processing';
            else if (row.status === 'warning') mappedStatus = 'warning';

            if (filters?.status && filters.status !== 'all' && mappedStatus !== filters.status) {
              continue;
            }

            entries.push({
              id: `atas_${row.id}`,
              timestamp: row.started_at,
              pipelineKey: 'atas_registro_precos',
              pipelineLabel: 'Atas de Registro de Preços (API Sync)',
              module: 'integracoes',
              sourceType: 'api_sync',
              sourceName: `Catálogo de Atas PNCP`,
              status: mappedStatus,
              rowsDetected: Number(row.total_fetched || 0),
              rowsWritten: Number(row.total_upserted || 0),
              rowsSkipped: 0,
              rowsUpdated: 0,
              errorMessage: row.error_message || null,
              metadata: (row.details as Record<string, unknown>) || {},
            });
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar atas_registro_precos_sync_runs:', err);
      }
    }

    // Sort chronologically descending
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply client-side filters for search and module
    let filtered = entries;

    if (filters?.module && filters.module !== 'all') {
      filtered = filtered.filter((e) => e.module === filters.module);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      filtered = filtered.filter(
        (e) =>
          e.pipelineLabel.toLowerCase().includes(q) ||
          e.sourceName.toLowerCase().includes(q) ||
          (e.errorMessage && e.errorMessage.toLowerCase().includes(q)) ||
          (e.userEmail && e.userEmail.toLowerCase().includes(q)),
      );
    }

    return filtered.slice(0, limit);
  },

  async fetchDatasetStatusMatrix(): Promise<DatasetStatus[]> {
    const logs = await this.fetchUnifiedObservabilityLogs({ limit: 500 });
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    return DATASET_CATALOG.map((def) => {
      const matchingLogs = logs.filter((log) => {
        const datasetKey = PIPELINE_TO_DATASET_MAP[log.pipelineKey] || log.pipelineKey;
        return datasetKey === def.key || log.pipelineKey === def.key;
      });

      const totalRunsCount = matchingLogs.length;
      const latestLog = matchingLogs[0] || null;
      const recentLogs = matchingLogs.slice(0, 5);
      const hasRecentError = recentLogs.some((l) => l.status === 'failed');

      let lastStatus: DatasetStatus['lastStatus'] = 'no_data';
      if (latestLog) {
        if (latestLog.status === 'failed') {
          lastStatus = 'failed';
        } else if (latestLog.status === 'warning') {
          lastStatus = 'warning';
        } else if (latestLog.status === 'processing') {
          lastStatus = 'processing';
        } else {
          const logAge = now - new Date(latestLog.timestamp).getTime();
          lastStatus = logAge > SEVEN_DAYS_MS ? 'stale' : 'success';
        }
      }

      return {
        key: def.key,
        name: def.name,
        module: def.module,
        description: def.description,
        supportedSources: def.supportedSources,
        lastUpdatedAt: latestLog ? latestLog.timestamp : null,
        lastStatus,
        lastSourceType: latestLog ? latestLog.sourceType : null,
        lastSourceName: latestLog ? latestLog.sourceName : null,
        lastErrorMessage: latestLog?.errorMessage || null,
        lastRowsCount: latestLog ? latestLog.rowsWritten || latestLog.rowsDetected : 0,
        hasRecentError,
        totalRunsCount,
      };
    });
  },

  async fetchObservabilityStats(): Promise<ObservabilityStats> {
    const [logs, datasetMatrix] = await Promise.all([
      this.fetchUnifiedObservabilityLogs({ limit: 1000 }),
      this.fetchDatasetStatusMatrix(),
    ]);

    const stats: ObservabilityStats = {
      totalRuns: logs.length,
      successCount: logs.filter((l) => l.status === 'success').length,
      failedCount: logs.filter((l) => l.status === 'failed').length,
      warningCount: logs.filter((l) => l.status === 'warning').length,
      skippedCount: logs.filter((l) => l.status === 'skipped').length,
      manualUploadsCount: logs.filter((l) => l.sourceType === 'manual_upload').length,
      emailIngestionsCount: logs.filter((l) => l.sourceType === 'email_csv').length,
      apiSyncsCount: logs.filter((l) => l.sourceType === 'api_sync').length,
      healthyDatasetsCount: datasetMatrix.filter((d) => d.lastStatus === 'success').length,
      unhealthyDatasetsCount: datasetMatrix.filter((d) => d.lastStatus === 'failed' || d.hasRecentError).length,
      lastActivityTimestamp: logs[0]?.timestamp || null,
    };

    return stats;
  },
};
