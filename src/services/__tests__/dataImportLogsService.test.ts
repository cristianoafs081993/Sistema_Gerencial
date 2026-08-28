import { beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '@/lib/supabase';
import { dataImportLogsService, DATASET_CATALOG } from '@/services/dataImportLogsService';

vi.mock('@/lib/supabase', () => {
  const queryMock: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };

  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'admin@ifrn.edu.br' } },
        }),
      },
      from: vi.fn(() => queryMock),
    },
  };
});

describe('dataImportLogsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('possui o catálogo de datasets configurado com 17 bases de dados', () => {
    expect(DATASET_CATALOG.length).toBe(17);
    const keys = DATASET_CATALOG.map((d) => d.key);
    expect(keys).toContain('descentralizacoes');
    expect(keys).toContain('empenhos_siafi');
    expect(keys).toContain('creditos_disponiveis');
    expect(keys).toContain('financeiro_fontes');
    expect(keys).toContain('lc_credores');
    expect(keys).toContain('retencoes_efd_reinf');
    expect(keys).toContain('contratos_comprasnet');
    expect(keys).toContain('energia_campus');
    expect(keys).toContain('licitacoes_pncp');
    expect(keys).toContain('atas_registro_precos');
  });

  it('inicia o registro de importação e retorna o ID da execução', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: { id: 'run-uuid-123' },
      error: null,
    });
    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: singleMock,
        }),
      }),
    } as any);

    const runId = await dataImportLogsService.recordImportRunStart({
      pipeline: 'descentralizacoes',
      pipelineName: 'Descentralizações de Crédito (CSV)',
      sourceType: 'manual_upload',
      sourceName: 'NC-ATUALIZADA.csv',
      metadata: { totalRows: 50 },
    });

    expect(runId).toBe('run-uuid-123');
    expect(supabase.from).toHaveBeenCalledWith('data_import_runs');
  });

  it('atualiza o status de sucesso da importação', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    vi.mocked(supabase.from).mockReturnValue({ update: updateMock } as any);

    await dataImportLogsService.recordImportRunSuccess('run-uuid-123', {
      rowsDetected: 50,
      rowsWritten: 45,
      rowsSkipped: 5,
      rowsUpdated: 0,
    });

    expect(supabase.from).toHaveBeenCalledWith('data_import_runs');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        rows_detected: 50,
        rows_written: 45,
        rows_skipped: 5,
      }),
    );
    expect(eqMock).toHaveBeenCalledWith('id', 'run-uuid-123');
  });

  it('atualiza o status de falha com mensagem de erro detalhada', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    vi.mocked(supabase.from).mockReturnValue({ update: updateMock } as any);

    await dataImportLogsService.recordImportRunFailure('run-uuid-123', {
      errorMessage: 'Formato de data inválido na linha 12',
      rowsDetected: 50,
    });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error_message: 'Formato de data inválido na linha 12',
      }),
    );
    expect(eqMock).toHaveBeenCalledWith('id', 'run-uuid-123');
  });

  it('unifica e normaliza logs de uploads manuais, e-mail e APIs', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'data_import_runs') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: '1',
                pipeline: 'descentralizacoes',
                pipeline_name: 'Descentralizações (CSV)',
                source_type: 'manual_upload',
                source_name: 'teste.csv',
                status: 'success',
                rows_detected: 10,
                rows_written: 10,
                rows_skipped: 0,
                rows_updated: 0,
                started_at: '2026-08-28T10:00:00Z',
                created_at: '2026-08-28T10:00:00Z',
              },
            ],
            error: null,
          }),
        } as any;
      }
      if (table === 'email_csv_ingestion_runs') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: '2',
                pipeline: 'financeiro',
                status: 'succeeded',
                sender_email: 'siafi@tesouro.gov.br',
                attachment_name: 'financeiro.csv',
                rows_detected: 25,
                rows_written: 25,
                received_at: '2026-08-28T09:00:00Z',
              },
            ],
            error: null,
          }),
        } as any;
      }
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any;
    });

    const unifiedLogs = await dataImportLogsService.fetchUnifiedObservabilityLogs();

    expect(unifiedLogs.length).toBe(2);
    expect(unifiedLogs[0].sourceType).toBe('manual_upload');
    expect(unifiedLogs[0].pipelineKey).toBe('descentralizacoes');
    expect(unifiedLogs[1].sourceType).toBe('email_csv');
    expect(unifiedLogs[1].pipelineKey).toBe('financeiro');
  });
});
