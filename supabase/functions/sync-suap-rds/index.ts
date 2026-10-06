import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { DOMParser } from 'npm:linkedom@0.18.13';
import { getSuapPlanUnit, SUAP_PLAN_UNITS } from '../../../src/lib/suapPlanUnits.ts';
import { collectCapturedRdPage, collectRdChunk, fetchSuapRdHtml, initialRdState, nextRdCaptureUrl, summarizeRdPreview, type RdRun } from '../_shared/suap_rd_sync.ts';
import { RD_CANCELED_REUSE_MAX_AGE_DAYS, seedRdReuse } from '../_shared/suap_rd_reuse.ts';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
const env = (key: string) => { const value = Deno.env.get(key); if (!value) throw new Error('Configuração do sincronizador indisponível.'); return value; };

// Same AES-GCM wire format as sync-suap-plan; the ciphertext never leaves the server.
async function decryptSession(value: string) {
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(Deno.env.get('SUAP_SESSION_ENCRYPTION_KEY') ?? env('SUPABASE_SERVICE_ROLE_KEY')));
  const key = await crypto.subtle.importKey('raw',digest,{ name:'AES-GCM' },false,['decrypt']);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name:'AES-GCM',iv:bytes.slice(0,12) },key,bytes.slice(12)));
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok',{ headers });
  if (request.method !== 'POST') return reply({ error:'Método não permitido.' },405);
  let run: RdRun | null = null;
  let lease: string | null = null;
  const service = createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{ auth:{ persistSession:false,autoRefreshToken:false } });
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return reply({ error:'Autenticação necessária.' },401);
    const client = createClient(env('SUPABASE_URL'),env('SUPABASE_ANON_KEY'),{ global:{ headers:{ Authorization:authorization } },auth:{ persistSession:false } });
    const { data:{ user },error:authError } = await client.auth.getUser();
    if (authError || !user) return reply({ error:'Sessão SIAGES inválida.' },401);
    const { data:membership,error:orgError } = await service.from('org_users').select('org_id').eq('user_id',user.id).maybeSingle();
    if (orgError || !membership) return reply({ error:'Órgão não identificado.' },403);
    const { data:admin,error:roleError } = await client.rpc('is_superadmin_jwt');
    if (roleError || !admin) return reply({ error:'Somente o superadministrador pode sincronizar RDs.' },403);
    const body = await request.json();
    const action = body.action ?? 'sync';
    if (body.forceFull !== undefined && typeof body.forceFull !== 'boolean') return reply({ error:'Opção de coleta completa inválida.' },400);
    if (action === 'units') return reply({ units: SUAP_PLAN_UNITS });
    const unit = getSuapPlanUnit(body.suapUnitCode ?? '19');
    if (!unit || body.campusUasg && body.campusUasg !== unit.parentUasg) return reply({ error:'Campus e unidade SUAP incompatíveis.' },400);
    if (!['sync','sync-extension','sync-html','status','apply','discard','revert'].includes(action)) return reply({ error:'Ação inválida.' },400);
    if (action === 'sync-html' && !body.runId) return reply({ error:'Informe a execução da captura.' },400);
    let query = service.from('suap_rd_sync_runs').select('*').eq('org_id',membership.org_id).eq('suap_unit_code',unit.value).eq('campus_uasg',unit.parentUasg).eq('user_id',user.id);
    if (body.runId) query = query.eq('id',body.runId);
    else query = query.order('started_at',{ ascending:false }).limit(1);
    const found = await query.maybeSingle();
    if (found.error) throw found.error;
    run = found.data;
    if (body.runId && !run) return reply({ error:'Execução não encontrada neste campus/unidade.' },404);
    if (action === 'status') {
      const applied = await service.from('suap_rd_sync_runs').select('*').eq('org_id',membership.org_id)
        .eq('user_id',user.id).eq('suap_unit_code',unit.value).eq('campus_uasg',unit.parentUasg)
        .eq('status','applied').order('applied_at',{ ascending:false }).limit(1).maybeSingle();
      if (applied.error) throw applied.error;
      return reply({ run:run ? publicRun(run) : null,appliedRun:applied.data ? publicRun(applied.data) : null });
    }
    if (action === 'discard') {
      if (!run || !['collecting','partial','awaiting_auth','preview'].includes(run.status)) return reply({ error:'Prévia não disponível para descartar.' },409);
      if (found.data.lease_until && new Date(found.data.lease_until).getTime()>Date.now()) return reply({ error:'Coleta em andamento.' },409);
      const { error } = await service.from('suap_rd_sync_runs').update({ status:'failed',error_message:'Conferência descartada pelo administrador.' }).eq('id',run.id);
      if (error) throw error; return reply({ status:'failed',runId:run.id });
    }
    if (action === 'apply') {
      if (!run) return reply({ error:'Execução não encontrada.' },404);
      const { data,error } = await service.rpc('apply_suap_rd_snapshot',{ p_run_id:run.id,p_user_id:user.id });
      if (error) throw error; return reply({ status:'applied',runId:run.id,summary:data });
    }
    if (action === 'revert') {
      if (!run) return reply({ error:'Execução não encontrada.' },404);
      const { data,error } = await service.rpc('revert_suap_rd_snapshot',{ p_run_id:run.id,p_user_id:user.id });
      if (error) throw error; return reply({ status:'reverted',runId:run.id,summary:data });
    }
    if (run?.status === 'preview') {
      if (body.forceFull) return reply({ error:'Aplique ou descarte a conferência pronta antes de iniciar uma coleta completa.' },409);
      return reply(publicRun(run));
    }
    if (action === 'sync-html' && (!run || ['applied','failed','reverted'].includes(run.status))) return reply({ error:'Captura encerrada; inicie outra conferência.' },409);
    if (!run || ['applied','failed','reverted'].includes(run.status)) {
      const state = initialRdState(unit.value);
      let base: RdRun | null = null;
      if (!body.forceFull) {
        const previous = await service.from('suap_rd_sync_runs').select('*').eq('org_id',membership.org_id)
          .eq('user_id',user.id).eq('campus_uasg',unit.parentUasg).eq('suap_unit_code',unit.value)
          .eq('status','applied').eq('complete',true).order('applied_at',{ ascending:false }).limit(1).maybeSingle();
        if (previous.error) throw previous.error;
        base = previous.data;
      }
      seedRdReuse(state,{org_id:membership.org_id,user_id:user.id,campus_uasg:unit.parentUasg,suap_unit_code:unit.value},base,body.forceFull === true);
      const created = await service.from('suap_rd_sync_runs').insert({ org_id:membership.org_id,user_id:user.id,
        campus_uasg:unit.parentUasg,suap_unit_code:unit.value,state }).select('*').single();
      if (created.error) throw created.error; run = created.data;
    }
    if (!run) throw new Error('Execução RD não iniciada.');
    if (body.forceFull && run.state.reuse?.mode === 'incremental') return reply({ error:'Descarte a coleta incremental antes de iniciar uma coleta completa.' },409);
    lease = crypto.randomUUID();
    const claimed = await service.from('suap_rd_sync_runs').update({ lease_token:lease,lease_until:new Date(Date.now()+120000).toISOString(),status:'collecting' })
      .eq('id',run.id).or(`lease_until.is.null,lease_until.lt.${new Date().toISOString()}`).select('id').maybeSingle();
    if (claimed.error) throw claimed.error;
    if (!claimed.data) { lease=null; return reply({ ...publicRun(run),busy:true }); }
    if (action === 'sync-extension' || action === 'sync-html') {
      run.state.captureMode = 'extension';
      if (action === 'sync-html') await collectCapturedRdPage(service,run,body.html,body.sourceUrl,DOMParser as unknown as new()=>globalThis.DOMParser);
      nextRdCaptureUrl(run);
    } else {
    if (run.state.captureMode === 'extension') throw new Error('Retome a captura pela extensão na aba autenticada do SUAP.');
    const { data:connection,error } = await service.from('suap_connections').select('session_ciphertext')
      .eq('user_id',user.id).eq('org_id',membership.org_id).is('revoked_at',null).gt('expires_at',new Date().toISOString()).order('expires_at',{ ascending:false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!connection) throw new Error('Sessão do SUAP expirada. Conecte-se pelo cartão de planejamento.');
    const cookie = await decryptSession(connection.session_ciphertext);
    await collectRdChunk(service,run,url=>fetchSuapRdHtml(url,cookie),DOMParser as unknown as new()=>globalThis.DOMParser);
    }
    const ready = run.state.phase === 'ready';
    const summary = ready ? await summarizeRdPreview(service,run) : run.summary;
    const saved = await service.from('suap_rd_sync_runs').update({ state:run.state,summary,source_count:run.state.inventory.length,
      complete:ready,status:ready?'preview':'collecting',error_message:null,lease_token:null,lease_until:null,updated_at:new Date().toISOString() })
      .eq('id',run.id).eq('lease_token',lease).select('id').maybeSingle();
    if (saved.error) throw saved.error;
    if (!saved.data) throw new Error('A execução foi retomada por outra chamada; consulte o estado atual.');
    return reply(publicRun({ ...run,status:ready?'preview':'collecting',complete:ready,summary,error_message:null }));
  } catch (error) {
    const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Falha na sincronização de RDs.';
    const reauth = message.includes('Sessão do SUAP');
    if (run && lease) await service.from('suap_rd_sync_runs').update({ state:run.state,status:reauth?'awaiting_auth':'partial',error_message:message,
      lease_until:null,lease_token:null,updated_at:new Date().toISOString() }).eq('id',run.id).eq('lease_token',lease);
    return reply({ error:message,status:reauth?'awaiting_auth':'partial',runId:run?.id },reauth?401:400);
  }
});

function publicRun(run: RdRun) {
  return { id:run.id,runId:run.id,status:run.status,complete:run.complete,summary:run.summary,
    error:run.error_message,startedAt:run.started_at,updatedAt:run.updated_at,
    phase:run.state.phase,sourceCount:run.state.inventory.length,
    processed:run.state.reuse ? run.state.reuse.refreshedDetails + run.state.reuse.reusedDetails : run.state.detailCursor,
    captureMode:run.state.captureMode ?? 'backend',nextUrl:nextRdCaptureUrl(structuredClone(run)),
    activitiesProcessed:run.state.activityCursor,activitiesTotal:run.state.activities.length,
    syncMode:run.state.reuse?.mode ?? 'full',reusedDetails:run.state.reuse?.reusedDetails ?? 0,
    refreshedDetails:run.state.reuse?.refreshedDetails ?? run.state.detailCursor,
    reusedActivities:run.state.reuse?.reusedActivities ?? 0,canceledReuseMaxAgeDays:RD_CANCELED_REUSE_MAX_AGE_DAYS };
}
