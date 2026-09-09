import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: invokeMock } },
}));

import { suapPlanSyncService } from '@/services/suapPlanSyncService';

describe('suapPlanSyncService', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ data: { status: 'success' }, error: null });
  });

  it('mantém a sincronização individual vinculada à UASG atual', async () => {
    await suapPlanSyncService.sync(undefined, '158366');
    expect(invokeMock).toHaveBeenCalledWith('sync-suap-plan', {
      body: { action: 'sync', mode: undefined, campusUasg: '158366' },
    });
  });

  it('expõe uma ação separada para o lote completo', async () => {
    await suapPlanSyncService.syncAll();
    expect(invokeMock).toHaveBeenCalledWith('sync-suap-plan', {
      body: { action: 'sync-all', mode: undefined },
    });
  });

  it('preserva o modo de prévia no lote completo', async () => {
    await suapPlanSyncService.syncAll('preview');
    expect(invokeMock).toHaveBeenCalledWith('sync-suap-plan', {
      body: { action: 'sync-all', mode: 'preview' },
    });
  });

  it('aplica lote e execução individual por endpoints distintos', async () => {
    await suapPlanSyncService.apply('run-currais');
    await suapPlanSyncService.applyBatch('batch-all');

    expect(invokeMock).toHaveBeenNthCalledWith(1, 'sync-suap-plan', { body: { action: 'apply', runId: 'run-currais' } });
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'sync-suap-plan', { body: { action: 'apply-batch', batchId: 'batch-all' } });
  });

  it('continua enviando a URL capturada para o fluxo legado da extensão', async () => {
    await suapPlanSyncService.syncHtml('<html />', 'https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/');
    expect(invokeMock).toHaveBeenCalledWith('sync-suap-plan', {
      body: {
        action: 'sync-html',
        html: '<html />',
        sourceUrl: 'https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/',
        mode: undefined,
      },
    });
  });

  it('mantém o caminho legado de Currais Novos associado à UASG 158366', async () => {
    await suapPlanSyncService.sync('preview', '158366');
    expect(invokeMock).toHaveBeenCalledWith('sync-suap-plan', {
      body: { action: 'sync', mode: 'preview', campusUasg: '158366' },
    });
  });
});
