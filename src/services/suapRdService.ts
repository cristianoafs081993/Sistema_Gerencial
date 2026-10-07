import { supabase } from '@/lib/supabase';
import type { SuapRdDetail } from '@/services/suapRdParser';

export type RdMovement = {
  org_id: string; campus_uasg: string; suap_unit_code: string; run_id: string; suap_rd_id: string;
  rd_numero: string; tipo: 'dotacao' | 'reforco' | 'anulacao' | null; rd_situacao: string;
  source_url: string; atividade_nome: string; processo: string; line_index: number;
  natureza_despesa: string; valor: number; empenho_numero: string | null; empenho_completo: string | null;
  gestao: string | null; ro: string | null; linha_situacao: string; captured_at: string;
  data_cadastro: string | null;
  suap_activity_id: string | null; suap_plan_id: number | null; atividade_id: string | null;
  empenho_id: string | null; resolution: string; confirmed: boolean;
};
export type RdLink = Pick<RdMovement, 'org_id' | 'campus_uasg' | 'suap_unit_code' | 'suap_plan_id' | 'suap_activity_id' | 'atividade_id' | 'empenho_id' | 'empenho_numero'> & {
  valor_rd: number; rds: string[]; resolved: boolean; captured_at: string;
};
export type RdSyncRun = {
  syncMode?: 'full' | 'incremental'; reusedDetails?: number; refreshedDetails?: number; reusedActivities?: number; canceledReuseMaxAgeDays?: number;
  snapshotCount?: number; appliedSnapshots?: number;
  id: string; runId: string; status: string; complete: boolean; summary: Record<string, number>;
  phase: string; sourceCount: number; processed: number; activitiesProcessed: number; activitiesTotal: number;
  busy?: boolean; error?: string;
  captureMode?: 'extension' | 'backend'; nextUrl?: string | null;
};
export type RdCaptureStatus = { hasApplied: boolean; latest: { status: string; processed: number; sourceCount: number } | null };

export const suapRdService = {
  async captureStatus(org: string, campus: string, unit: string): Promise<RdCaptureStatus> {
    const scoped = () => supabase.from('suap_rd_sync_runs').select('status,source_count,processed:state->>detailCursor,reused:state->reuse->>reusedDetails,refreshed:state->reuse->>refreshedDetails')
      .eq('org_id',org).eq('campus_uasg',campus).eq('suap_unit_code',unit);
    const [latest,applied] = await Promise.all([
      scoped().order('started_at',{ascending:false}).limit(1).maybeSingle(),
      scoped().eq('status','applied').eq('complete',true).limit(1).maybeSingle(),
    ]);
    if (latest.error) throw latest.error;
    if (applied.error) throw applied.error;
    const data = latest.data as { status: string; source_count: number; processed: string | null; reused: string | null; refreshed: string | null } | null;
    return {hasApplied:!!applied.data,latest:data ? {status:data.status,sourceCount:data.source_count,
      processed:Math.min(data.source_count,data.refreshed !== null ? Number(data.refreshed)+Number(data.reused) : Number(data.processed))} : null};
  },
  async preview(runId: string, org: string, campus: string, unit: string) {
    const rows: Array<{ payload: SuapRdDetail & { sources: Array<{ activityId: string; planId: number }> } }> = [];
    for (let offset = 0; ; offset += 500) {
      const {data,error} = await supabase.from('suap_rd_snapshots').select('payload').eq('run_id',runId)
        .eq('org_id',org).eq('campus_uasg',campus).eq('suap_unit_code',unit).order('suap_rd_id').range(offset,offset+499);
      if (error) throw error; rows.push(...data as typeof rows); if (data.length < 500) return rows;
    }
  },
  async read<T>(table: 'suap_rd_movimentacoes' | 'atividade_empenho_vinculos', org: string, campus: string, unit: string): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 500) {
      let query = supabase.from(table).select('*').eq('org_id', org).eq('campus_uasg', campus)
        .eq('suap_unit_code', unit).order(table === 'suap_rd_movimentacoes' ? 'suap_rd_id' : 'suap_activity_id')
        .order(table === 'suap_rd_movimentacoes' ? 'line_index' : 'empenho_numero');
      if (table === 'suap_rd_movimentacoes') query = query.order('suap_activity_id');
      const { data, error } = await query.range(offset, offset + 499);
      if (error) throw error;
      rows.push(...data as T[]);
      if (data.length < 500) return rows;
    }
  },
  async action(action: 'sync' | 'status' | 'apply' | 'apply-partial' | 'discard' | 'revert' | 'revert-partial', unit: string, campus: string, runId?: string) {
    const { data, error } = await supabase.functions.invoke('sync-suap-rds', { body: { action, suapUnitCode: unit, campusUasg: campus, ...(runId ? { runId } : {}) } });
    if (error) {
      const response = (error as { context?: Response }).context;
      const payload = response ? await response.clone().json().catch(() => null) : null;
      throw new Error(payload?.error ?? error.message);
    }
    return data as RdSyncRun & { run?: RdSyncRun | null; appliedRun?: RdSyncRun | null;
      appliedNow?: number; appliedSnapshots?: number; pendingSnapshots?: number; snapshotCount?: number; automaticallyApplied?: boolean };
  },
};

export const rdResolutionLabel = (value: string) => ({
  resolvido: 'Vínculo oficial', historica_ou_sem_atividade: 'Sem atividade oficial no Plano 8',
  atividade_ausente: 'Atividade ainda não importada', empenho_ausente: 'Empenho ainda não importado',
  ne_ambigua: 'NE duplicada no SIAGES', conflito_manual: 'Conflito com vínculo manual',
  conflito_atividade: 'RD associada a mais de uma atividade',
}[value] ?? 'Pendente de conferência');

/** One row per expense line even when the source exposes conflicting activities. */
export function uniqueRdMovements(rows: RdMovement[]) {
  return [...new Map(rows.map(row => [`${row.run_id}:${row.suap_rd_id}:${row.line_index}`, { ...row, valor: Number(row.valor) }])).values()];
}
