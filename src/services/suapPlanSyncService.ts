import { supabase } from '@/lib/supabase';

export type SuapPlanSyncStatus = {
  id: string;
  status: 'running' | 'preview' | 'success' | 'failed' | 'reauth_required';
  mode: 'preview' | 'apply';
  source_count: number;
  inserted_count: number;
  updated_count: number;
  archived_count: number;
  started_at: string;
  finished_at?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  suap_unit_code?: string | null;
  batch_id?: string | null;
};

export type SuapPlanSyncResult = {
  status: 'preview' | 'success' | 'partial' | 'failed' | 'already_running' | 'reauth_required' | 'running';
  runId?: string;
  batchId?: string;
  units?: Array<{
    suapUnitCode: string;
    status: 'preview' | 'success' | 'failed';
    runId?: string;
    sourceCount?: number;
    inserted?: number;
    updated?: number;
    archived?: number;
    error?: string;
  }>;
  sourceCount?: number;
  inserted?: number;
  updated?: number;
  archived?: number;
  error?: string;
};

export type SuapPlanSyncBatchStatus = {
  id: string;
  status: 'running' | 'preview' | 'success' | 'partial' | 'failed';
  requested_count: number;
  success_count: number;
  failed_count: number;
  preview_count: number;
  started_at: string;
  finished_at?: string | null;
};

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('sync-suap-plan', { body });
  if (error) {
    const context = (error as { context?: Response }).context;
    const payload = context ? await context.clone().json().catch(() => null) : null;
    throw new Error(payload?.error || error.message || 'Falha ao comunicar com o sincronizador SUAP.');
  }
  if (!data) throw new Error('O sincronizador SUAP nao retornou dados.');
  return data as T;
}
export const suapPlanSyncService = {
  connect(username: string, password: string) {
    return invoke<{ status: 'connected'; connectionId: string; expiresAt: string }>({
      action: 'connect',
      username,
      password,
    });
  },

  connectCookie(sessionId: string) {
    return invoke<{ status: 'connected'; connectionId: string; expiresAt: string }>({
      action: 'connect-cookie',
      sessionId,
    });
  },

  sync(mode?: 'preview' | 'apply', campusUasg?: string) {
    return invoke<SuapPlanSyncResult>({ action: 'sync', mode, campusUasg });
  },

  syncAll(mode?: 'preview' | 'apply') {
    return invoke<SuapPlanSyncResult>({ action: 'sync-all', mode });
  },

  syncHtml(html: string, sourceUrl: string, mode?: 'preview' | 'apply') {
    return invoke<SuapPlanSyncResult>({ action: 'sync-html', html, sourceUrl, mode });
  },

  apply(runId: string) {
    return invoke<SuapPlanSyncResult>({ action: 'apply', runId });
  },

  applyBatch(batchId: string) {
    return invoke<SuapPlanSyncResult>({ action: 'apply-batch', batchId });
  },

  status() {
    return invoke<{ run: SuapPlanSyncStatus | null; batch: SuapPlanSyncBatchStatus | null }>({ action: 'status' });
  },

  disconnect() {
    return invoke<{ status: 'disconnected' }>({ action: 'disconnect' });
  },
};
