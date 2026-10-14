import { createClient } from 'npm:@supabase/supabase-js@2.94.1';
import { arr, obj, str, digits, authorizedPdfPath, assertCapture, captureProcessNumber, classifyPayment, selectInvoices, RULES_VERSION, type PaymentKind } from './siafi_checklist.ts';

export const analysisCors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS' };
export const responseJson = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers:{...analysisCors,'Content-Type':'application/json'}});
export const adminClient = () => createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
export async function authenticateAnalysis(request: Request) {
  const authorization = request.headers.get('Authorization') || '';
  if (!/^Bearer\s+\S+$/i.test(authorization)) throw new Error('401: Entre no SIAGES para conferir a liquidação.');
  const client = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error} = await client.auth.getUser();
  if (error || !data.user) throw new Error('401: Sessão inválida. Entre novamente no SIAGES.');
  return {client,user:data.user};
}
export const invoiceKey = (invoice: unknown) => JSON.stringify([str(obj(invoice).numero),str(obj(invoice).data_emissao),str(obj(invoice).valor)]);
export async function hashJson(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const hash = await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function hashBytes(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
type Auth = Awaited<ReturnType<typeof authenticateAnalysis>>;
export async function prepareAnalysis(auth: Auth, body: Record<string,unknown>) {
  const capture = assertCapture(body.captura), number = captureProcessNumber(capture);
  let query = auth.client.from('processos').select('*').eq('tenant_id',auth.user.id);
  query = body.processoId ? query.eq('id',str(body.processoId)) : query.in('num_processo',[number,digits(number)]);
  const {data:processes,error} = await query;
  if (error) throw error;
  if (!processes?.length) throw new Error('404: Processo não encontrado na sua conta SIAGES. Sincronize o processo antes da conferência.');
  if (processes.length !== 1) throw new Error('409: Mais de um processo corresponde à captura. Abra os detalhes do processo no SIAGES e importe o JSON.');
  const processo = processes[0];
  if (digits(processo.num_processo) !== digits(number)) throw new Error('409: O processo selecionado não corresponde à captura.');
  const dados = obj(processo.dados_completos), kind = classifyPayment(processo);
  const resolvedKind: PaymentKind = ['estudantes','fornecedor_pj'].includes(str(body.tipoPagamento)) ? body.tipoPagamento as PaymentKind : kind;
  const {data:documents,error:documentsError} = await auth.client.from('suap_processo_documentos')
    .select('id,titulo,ordem,storage_path,page_count,byte_size,downloaded_at').eq('processo_id',processo.id).eq('tenant_id',auth.user.id)
    .eq('classificacao','included').eq('download_status','downloaded').order('ordem');
  if (documentsError) throw documentsError;
  let sources = (documents || []).filter(d => d.storage_path && !/comprovante.*siafi|checklist|an[aá]lise.*liquida[cç][aã]o|relat[oó]rio.*\bia\b/i.test(d.titulo))
    .map(d=>({id:d.id,titulo:d.titulo,storagePath:d.storage_path,paginas:d.page_count,bytes:d.byte_size,downloadedAt:d.downloaded_at,tipo:'documento_original'}));
  if (!sources.length && processo.pdf_url) sources = [{id:`processo:${processo.id}`,titulo:'PDF original do processo',storagePath:processo.pdf_url,paginas:null,bytes:null,downloadedAt:processo.updated_at,tipo:'processo_completo'}];
  if (!sources.length) throw new Error('409: O processo não possui PDF disponível. Baixe os documentos no SIAGES antes de conferir.');
  if (sources.some(s=>!authorizedPdfPath(s.storagePath,auth.user.id))) throw new Error('403: Caminho de documento não autorizado.');
  const selectedSources = arr(body.documentoIds).map(str);
  if (Array.isArray(body.documentoIds) && !selectedSources.length) throw new Error('400: Selecione ao menos um documento original.');
  if (selectedSources.some(id=>!sources.some(s=>s.id===id))) throw new Error('409: A seleção de documentos mudou. Atualize a conferência.');
  if (selectedSources.length) sources = sources.filter(s=>selectedSources.includes(s.id));
  const invoiceSelection = selectInvoices(capture,arr(dados.notas_fiscais));
  const invoiceOptions = invoiceSelection.invoices.map(invoice=>({...invoice,key:invoiceKey(invoice)}));
  const suppliedKeys = arr(body.notaKeys).map(str);
  if (suppliedKeys.some(key=>!invoiceOptions.some(invoice=>invoice.key===key))) throw new Error('409: A seleção de notas mudou. Atualize a conferência.');
  const notaKeys = Array.isArray(body.notaKeys) ? suppliedKeys : invoiceSelection.selected.map(index=>invoiceOptions[index].key);
  const listNumbers = [...new Set(JSON.stringify(capture).match(/\b\d{4}L[CX]\d{6}\b/g) || [])];
  const lists: unknown[] = [];
  if (listNumbers.length) {
    const {data:lc,error:lcError} = await auth.client.from('lc_credores').select('*').in('ob_lista_credores',listNumbers).order('sequencial');
    if (lcError) throw lcError;
    for (const listNumber of listNumbers) {
      const rows = (lc || []).filter(row=>row.ob_lista_credores===listNumber);
      if (rows.length) lists.push({id:listNumber,tipo:'cadastro_lc_importado',numero:listNumber,rows});
    }
  }
  // Work lists remain work lists: never claim they prove actual SIAFI contents.
  const {data:saved,error:savedError} = resolvedKind==='estudantes' && body.listaAusente!==true
    ? await auth.client.from('lc_saved_lists').select('id,name,source_pdf_names,rows,updated_at').order('updated_at',{ascending:false})
    : {data:[],error:null};
  if (savedError) throw savedError;
  const savedOptions = saved || [];
  const byProcess = savedOptions.filter(list=>digits(list.name).includes(digits(number)));
  const selectedListId = body.listaAusente===true ? '' : str(body.listaId) || (byProcess.length===1 ? byProcess[0].id : '');
  const selectedList = selectedListId ? savedOptions.find(list=>list.id===selectedListId) : null;
  if (selectedListId && !selectedList) throw new Error('403: Lista não disponível na sua conta/órgão.');
  if (selectedList) lists.push({...selectedList,tipo:'lista_trabalho',numero:null});
  const runId = str(obj(dados.extraction_job).run_id);
  let extraction = null;
  if (runId) {
    const {data:run,error:runError} = await auth.client.from('process_extraction_runs').select('id,status,input_document_ids,result_snapshot,finished_at').eq('id',runId).eq('tenant_id',auth.user.id).maybeSingle();
    if (runError) throw runError;
    extraction=run;
  }
  const needsSelection = resolvedKind === 'indefinido' ||
    resolvedKind !== 'estudantes' && invoiceOptions.length>0 && notaKeys.length===0 ||
    resolvedKind === 'estudantes' && !selectedList && savedOptions.length>0 && body.listaAusente!==true;
  if (body.competencia && !/^\d{4}-(0[1-9]|1[0-2])$/.test(str(body.competencia))) throw new Error('400: Informe a competência como AAAA-MM.');
  if (body.pagamentoParcial===true && str(body.justificativa).trim().length<5) throw new Error('400: Identifique a parcela ou justificativa do pagamento parcial.');
  const input = {captura:capture,processo,extraction,fontes:sources,listas:lists,escopo:{tipoPagamento:resolvedKind,notaKeys,listaId:selectedListId,listaAusente:body.listaAusente===true,documentoIds:sources.map(s=>s.id),competencia:str(body.competencia),pagamentoParcial:body.pagamentoParcial===true,justificativa:str(body.justificativa)},regrasVersao:RULES_VERSION};
  return {
    input,
    selection: {processoId:processo.id,numProcesso:processo.num_processo,tipoPagamento:resolvedKind,needsSelection,
      notas:invoiceOptions,notaKeys,listas:savedOptions.map(list=>({id:list.id,nome:list.name,quantidade:arr(list.rows).length})),listaId:selectedListId,
      documentos:sources.map(s=>({id:s.id,titulo:s.titulo})),avisos:[...(kind==='indefinido'?['Confirme o tipo de pagamento.']:[]),...(lists.length===0 && resolvedKind==='estudantes'?['Nenhuma lista vinculada; a conferência de contas ficará pendente.']:[])]},
  };
}
export async function triggerAnalysisWorker(id: string) {
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const result=await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/analisar-liquidacao-siafi-worker`,{method:'POST',headers:{Authorization:`Bearer ${key}`,apikey:key,'Content-Type':'application/json'},body:JSON.stringify({runId:id}),signal:AbortSignal.timeout(15000)});
  if (!result.ok) throw new Error('Não foi possível iniciar a análise. Use Retomar análise.');
}
export async function handleStructuredAnalysis(auth: Auth, body: Record<string,unknown>) {
  const action=str(body.action);
  if (['status','retry','review'].includes(action)) {
    const {data:run,error}=await auth.client.from('siafi_liquidacao_analises').select('*').eq('id',str(body.runId)).eq('tenant_id',auth.user.id).single();
    if (error || !run) throw new Error('404: Análise não encontrada.');
    if (action==='review') {
      if (run.status!=='completed') throw new Error('409: Aguarde o checklist antes de revisar.');
      if (body.feedback==='falso_positivo' && str(body.motivo).trim().length<5) throw new Error('400: Explique o motivo do falso positivo.');
      const {error:reviewError}=await auth.client.from('siafi_liquidacao_revisoes').insert({analise_id:run.id,tenant_id:auth.user.id,item_id:str(body.itemId),conferido:body.conferido===true,feedback:body.feedback || null,motivo:str(body.motivo)});
      if (reviewError) throw new Error('400: Não foi possível registrar a revisão deste item.');
      return {saved:true};
    }
    if (action==='retry' && run.status!=='completed') {
      if (run.attempts>=3) throw new Error('409: Limite de tentativas atingido. Gere uma nova captura.');
      await triggerAnalysisWorker(run.id);
    }
    const {data:reviews,error:reviewsError}=await auth.client.from('siafi_liquidacao_revisoes').select('*').eq('analise_id',run.id).order('created_at').order('id');
    if (reviewsError) throw reviewsError;
    return {run,reviews};
  }
  const prepared=await prepareAnalysis(auth,body);
  if (action==='prepare' || prepared.selection.needsSelection) return {selection:prepared.selection};
  if (action!=='start') throw new Error('400: Operação de análise desconhecida.');
  const inputHash=await hashJson(prepared.input);
  const admin=adminClient();
  const {data:inserted,error}=await admin.from('siafi_liquidacao_analises').upsert({tenant_id:auth.user.id,processo_id:prepared.selection.processoId,capture_id:prepared.input.captura.captureId,input_snapshot:prepared.input,input_hash:inputHash,regras_versao:RULES_VERSION},{onConflict:'tenant_id,processo_id,capture_id,input_hash',ignoreDuplicates:true}).select('id,status').maybeSingle();
  if (error) throw error;
  const existing=inserted || (await auth.client.from('siafi_liquidacao_analises').select('id,status').eq('processo_id',prepared.selection.processoId).eq('capture_id',prepared.input.captura.captureId).eq('input_hash',inputHash).single()).data;
  if (!existing) throw new Error('A análise não foi persistida. Tente novamente.');
  if (existing.status==='queued') await triggerAnalysisWorker(existing.id);
  return {runId:existing.id,processoId:prepared.selection.processoId,status:existing.status};
}
