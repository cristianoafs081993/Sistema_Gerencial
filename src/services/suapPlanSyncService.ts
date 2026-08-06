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
};

export type SuapPlanSyncResult = {
  status: 'preview' | 'success' | 'already_running' | 'reauth_required';
  runId?: string;
  sourceCount?: number;
  inserted?: number;
  updated?: number;
  archived?: number;
  error?: string;
};

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('sync-suap-plan', { body });
  if (error) throw new Error(error.message || 'Falha ao comunicar com o sincronizador SUAP.');
  if (!data) throw new Error('O sincronizador SUAP não retornou dados.');
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

  sync(mode?: 'preview' | 'apply') {
    return invoke<SuapPlanSyncResult>({ action: 'sync', mode });
  },

  apply(runId: string) {
    return invoke<SuapPlanSyncResult>({ action: 'apply', runId });
  },

  status() {
    return invoke<{ run: SuapPlanSyncStatus | null }>({ action: 'status' });
  },

  disconnect() {
    return invoke<{ status: 'disconnected' }>({ action: 'disconnect' });
  },
};
