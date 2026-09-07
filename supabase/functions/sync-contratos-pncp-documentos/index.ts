import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { requestPncpJson, type JsonRow } from '../_shared/pncpContracts.ts';
import { syncPncpContract, type PncpRepository } from './core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) return json({ error: 'Configuração Supabase ausente.' }, 500);
  const supabase = createClient(url, key);
  // Do not accept anon JWTs as permission to write with service_role.
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const isScheduler = token === key;
  if (!isScheduler) {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return json({ error: 'Sessão inválida. Entre novamente no SIAGES.' }, 401);
  }
  try {
    const payload = await req.json();
    const id = payload.contratoApiId;
    if (id != null && (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) {
      return json({ error: 'Identificador do contrato inválido.' }, 400);
    }
    if (!isScheduler && !id) return json({ error: 'Informe um contrato para atualização manual.' }, 400);
    const uasg = payload.unidadeCodigo;
    if (uasg != null && !/^\d{6}$/.test(uasg)) return json({ error: 'UASG inválida.' }, 400);
    const limit = Math.max(1, Math.min(Number(payload.limit) || 5, 10));
    let query = supabase.from('contratos_api').select('*');
    if (id) query = query.eq('id', id);
    else {
      // No hardcoded campus: cover every contract already imported from Comprasnet.
      if (uasg) query = query.or(`unidade_codigo.eq.${uasg},unidade_origem_codigo.eq.${uasg}`);
      if (!payload.forceRefresh) {
        const dayAgo = new Date(Date.now() - 86400000).toISOString();
        const retryAt = new Date(Date.now() - 1800000).toISOString();
        query = query.or(`pncp_documentos_checked_at.is.null,pncp_documentos_checked_at.lt.${dayAgo},pncp_instrumentos_checked_at.is.null,pncp_instrumentos_checked_at.lt.${dayAgo}`)
          .or(`pncp_sync_attempted_at.is.null,pncp_sync_attempted_at.lt.${retryAt}`);
      }
    }
    const { data: contracts, error } = await query.order('pncp_sync_attempted_at', { ascending: true, nullsFirst: true })
      .order('id').limit(id ? 1 : limit);
    if (error) throw new Error(error.message);
    if (id && !contracts?.length) return json({ error: 'Contrato não encontrado.' }, 404);
    const repository: PncpRepository = {
      async updateContract(contractId, patch) {
        const { error } = await supabase.from('contratos_api').update(patch).eq('id', contractId);
        if (error) throw new Error(`Gravação do contrato: ${error.message}`);
      },
      async saveResource(table, contractId, rows, conflict) {
        if (rows.length) {
          const { error } = await supabase.from(table).upsert(rows, { onConflict: conflict });
          if (error) throw new Error(`Gravação de ${table}: ${error.message}`);
        }
        const result: JsonRow[] = [];
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await supabase.from(table).select('raw_data').eq('contrato_api_id', contractId)
            .order('id').range(offset, offset + 999);
          if (error) throw new Error(`Leitura de ${table}: ${error.message}`);
          result.push(...(data || []).map((row) => row.raw_data));
          if (!data || data.length < 1000) break;
        }
        return result;
      },
    };
    const deadline = Date.now() + 100000;
    const cache = new Map<string, JsonRow[]>();
    const results = [];
    for (const contract of contracts || []) {
      if (Date.now() >= deadline - 5000) break;
      try {
        results.push(await syncPncpContract(contract, repository, (url) => requestPncpJson(url, undefined, deadline), cache));
      } catch (error) {
        results.push({ id: contract.id, numero: contract.numero, status: 'error',
          errors: [error instanceof Error ? error.message : String(error)] });
      }
    }
    return json({ status: results.some((r) => r.status !== 'success') ? 'partial_error' : 'success',
      contratosProcessados: results.length, pending: (contracts?.length || 0) - results.length,
      resultados: results });
  } catch (error) {
    console.error('sync-contratos-pncp-documentos', error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
