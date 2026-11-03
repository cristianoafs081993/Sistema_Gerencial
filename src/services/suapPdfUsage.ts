import type {SupabaseClient} from '@supabase/supabase-js';

/** Called on actual detail/PDF use, never by the background process listing. */
export async function touchSuapPdfUsage(client: SupabaseClient, input: {processId?: string; path?: string; suapId?: string}) {
  const {error} = await client.rpc('touch_suap_process_pdf', {
    p_processo_id: input.processId || null,
    p_storage_path: input.path || null,
    p_suap_id: input.suapId || null,
  });
  if (error) throw new Error(error.message || 'Não foi possível registrar o uso do PDF. Tente novamente.');
}
