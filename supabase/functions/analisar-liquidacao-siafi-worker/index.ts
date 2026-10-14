import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { adminClient, hashBytes, invoiceKey, responseJson } from '../_shared/siafi_analysis_backend.ts';
import { arr, obj, str, authorizedPdfPath, finalizeChecklist, sortChecklist, checklistResult, NORM_REFERENCES, type SourceDescriptor, type PaymentKind, type ChecklistItem } from '../_shared/siafi_checklist.ts';
import { buildStructuredPrompt } from '../_shared/siafi_analysis_prompt.ts';
import { pdfPageTexts } from '../_shared/siafi_pdf_text.ts';
declare const EdgeRuntime: { waitUntil(task:Promise<unknown>):void };

const MAX_PDF_BYTES=40*1024*1024;
const base64 = (bytes: Uint8Array) => { let result=''; for(let i=0;i<bytes.length;i+=8192) result+=String.fromCharCode(...bytes.subarray(i,i+8192)); return btoa(result); };
function htmlText(html: string) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
    .replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/\s+/g,' ').trim();
}
async function fetchNorms(): Promise<SourceDescriptor[]> {
  const outcomes=await Promise.allSettled(NORM_REFERENCES.filter(n=>'url' in n).map(async norm=>{
    const response=await fetch(norm.url!,{signal:AbortSignal.timeout(10000)});
    if (!response.ok) return null;
    const text=htmlText(await response.text());
    if (text.length<100 || text.length>1500000) return null;
    // Keep relevant excerpts, explicitly marking them as excerpts, not a full law.
    const starts=[...text.matchAll(/art\.\s*26|2\.3\.20|2\.3\.23|2\.3\.24|17031|17032|17099|anexo\s*i\b/gi)].map(m=>m.index || 0);
    const excerpt=starts.length ? starts.slice(0,10).map(index=>text.slice(Math.max(0,index-150),index+5000)).join('\n[…]\n') : text.slice(0,18000);
    return {id:norm.id,titulo:norm.titulo,tipo:'norma_oficial',conteudo:excerpt,sha256:await hashBytes(new TextEncoder().encode(text)),url:norm.url,consultadoEm:new Date().toISOString(),parcial:true};
  }));
  return outcomes.flatMap(outcome=>outcome.status==='fulfilled' && outcome.value ? [outcome.value] : []);
}
async function gemini(prompt: string, parts: unknown[], deadline:number) {
  const key=Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY') || Deno.env.get('GOOGLE_API_KEY');
  if (!key) throw new Error('Configure a chave Gemini da análise no Supabase.');
  const models=[...new Set([Deno.env.get('GEMINI_LIQUIDACAO_MODEL') || Deno.env.get('GEMINI_VISION_MODEL') || 'gemini-2.5-flash-lite','gemini-2.5-flash-lite','gemini-2.5-flash'])];
  const failures:string[]=[];
  for (const [index,model] of models.entries()) {
    try {
      const remaining=Math.min(105000,deadline-Date.now());
      if(remaining<5000)throw new Error('A análise excedeu o prazo. Retome a análise ou restrinja o escopo.');
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt},...parts]}],generationConfig:{temperature:0.1,responseMimeType:'application/json',maxOutputTokens:32768,...(/^gemini-2\.5-flash/.test(model)?{thinkingConfig:{thinkingBudget:0}}:{})}}),signal:AbortSignal.timeout(remaining)});
      if (!response.ok) throw new Error(`Gemini indisponível (HTTP ${response.status}).`);
      const data=await response.json(), candidate=obj(arr(data.candidates)[0]);
      if (candidate.finishReason==='MAX_TOKENS') throw new Error('A resposta excedeu o limite. Restrinja os documentos/competência e tente novamente.');
      const text=arr(obj(candidate.content).parts).map(part=>str(obj(part).text)).join('').replace(/^```(?:json)?\s*|\s*```$/g,'').trim();
      const raw=JSON.parse(text);
      if (!Array.isArray(raw.checklist)) throw new Error('A IA não retornou um checklist válido.');
      return {raw,model};
    } catch(error) {
      failures.push(`${model}: ${error instanceof Error ? error.message.replaceAll(key,'[redigido]').slice(0,200) : 'falha de comunicação'}`);
      if(index===models.length-1)throw new Error(`Não foi possível concluir a conferência. ${failures.join(' | ')}`);
    }
  }
  throw new Error('Nenhum modelo disponível.');
}
async function execute(runId: string) {
  const deadline=Date.now()+130000;
  const admin=adminClient();
  const {data:claimed,error:claimError}=await admin.rpc('claim_siafi_analysis',{p_id:runId});
  if (claimError) throw claimError;
  const run=arr(claimed).map(obj)[0];
  if (!run) return;
  try {
    const input=obj(run.input_snapshot), sources: SourceDescriptor[]=[], parts: unknown[]=[];
    let total=0;
    for (const candidate of arr(input.fontes)) {
      const source=obj(candidate), path=str(source.storagePath);
      if (!authorizedPdfPath(path,str(run.tenant_id))) throw new Error('Documento não autorizado.');
      const frozenPath=`${run.tenant_id}/siafi-analises/${runId}/${str(source.id).replace(/[^a-zA-Z0-9-]/g,'_')}.pdf`;
      const frozen=await admin.storage.from('suap-pdfs').download(frozenPath);
      const {data:blob,error}=frozen.data ? frozen : await admin.storage.from('suap-pdfs').download(path);
      if (error || !blob) throw new Error('Não foi possível ler um dos PDFs originais. Atualize os documentos e retome a análise.');
      const bytes=new Uint8Array(await blob.arrayBuffer()); total+=bytes.length;
      if (total>MAX_PDF_BYTES) throw new Error('Os PDFs excedem 40 MB. Selecione os documentos da liquidação e tente novamente.');
      const pdf=await PDFDocument.load(bytes,{updateMetadata:false});
      if(!frozen.data) {
        const {error:freezeError}=await admin.storage.from('suap-pdfs').upload(frozenPath,bytes,{contentType:'application/pdf',upsert:false});
        if(freezeError)throw new Error('Não foi possível preservar a versão do PDF utilizada na análise. Retome a análise.');
      }
      const descriptor={id:`D${String(sources.length+1).padStart(3,'0')}`,documentoId:str(source.id),titulo:str(source.titulo),storagePath:frozenPath,originalStoragePath:path,paginas:pdf.getPageCount(),sha256:await hashBytes(bytes),tipo:str(source.tipo),paginasTexto:await pdfPageTexts(bytes,pdf.getPageCount())};
      sources.push(descriptor);
      parts.push({text:`PDF ORIGINAL sourceId=${descriptor.id}; título=${descriptor.titulo}; ${descriptor.paginas} páginas. Citações usam a numeração original deste PDF.`},{inlineData:{mimeType:'application/pdf',data:base64(bytes)}});
    }
    sources.push(...await fetchNorms());
    const {error:progressError}=await admin.from('siafi_liquidacao_analises').update({progresso:'Conferindo documentos, valores e pré-docs'}).eq('id',runId).eq('status','processing').eq('attempts',run.attempts);
    if (progressError) throw progressError;
    const {raw,model}=await gemini(buildStructuredPrompt(input,sources),parts,deadline);
    const {data:previous,error:previousError}=await admin.from('siafi_liquidacao_analises').select('id,result_snapshot').eq('tenant_id',run.tenant_id).eq('processo_id',run.processo_id).eq('status','completed').lt('created_at',run.created_at).order('created_at',{ascending:false});
    if (previousError) throw previousError;
    // Match the same DH and scope; another invoice/competence is not a correction.
    const sameScope=(previous || []).find(old=>{
      const r=obj(old.result_snapshot);
      const identity=obj(obj(input.captura).document), scope=obj(input.escopo);
      const identifiable=str(identity.number)!=='-' && str(identity.number)!=='' || arr(scope.notaKeys).length>0 || str(scope.competencia)!=='';
      return identifiable && JSON.stringify(r.documento)===JSON.stringify(identity) && JSON.stringify(r.escopo)===JSON.stringify(scope);
    });
    const selectedInvoices=arr(obj(obj(input.processo).dados_completos).notas_fiscais).filter(invoice=>arr(obj(input.escopo).notaKeys).includes(invoiceKey(invoice)));
    const checklist=finalizeChecklist(raw,{capture:input.captura,sources,lists:input.listas,kind:str(obj(input.escopo).tipoPagamento) as PaymentKind,selectedInvoices,previous:arr(obj(sameScope?.result_snapshot).checklist) as ChecklistItem[]});
    const ambiguidades=arr(raw.ambiguidades).map(value=>obj(value)).filter(value=>['nota','competencia','parcela'].includes(str(value.tipo))).map(value=>({tipo:str(value.tipo),descricao:str(value.descricao),opcoes:arr(value.opcoes).map(str)}));
    if(ambiguidades.length)for(const item of checklist.filter(item=>['C03','C04','B01','B04'].includes(item.regraId)&&item.status!=='nao_aplicavel')) {item.status='nao_verificavel';item.observacao='Seleção de notas, competência ou parcela pendente. '+item.observacao;item.evolucao='nao_verificavel';}
    const result={...checklistResult(sortChecklist(checklist),model),respostaModelo:raw,ambiguidades,runId,processoId:run.processo_id,captureId:obj(input.captura).captureId,inputHash:run.input_hash,documento:obj(input.captura).document,escopo:input.escopo,fontes:sources,listas:input.listas,extractionRunId:obj(input.extraction).id || null,analiseAnteriorId:sameScope?.id || null};
    const {error:updateError}=await admin.from('siafi_liquidacao_analises').update({status:'completed',progresso:'Checklist disponível',result_snapshot:result,error_message:null,lease_expires_at:null,finished_at:new Date().toISOString()}).eq('id',runId).eq('status','processing').eq('attempts',run.attempts);
    if (updateError) throw updateError;
  } catch(error) {
    const message=error instanceof Error ? error.message : 'Falha na análise.';
    await admin.from('siafi_liquidacao_analises').update({status:'failed',progresso:'Análise interrompida',error_message:message.slice(0,1000),lease_expires_at:null}).eq('id',runId).eq('status','processing').eq('attempts',run.attempts);
  }
}
Deno.serve(async request=>{
  if (request.method!=='POST') return responseJson({error:'Method not allowed'},405);
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key || request.headers.get('Authorization')!==`Bearer ${key}`) return responseJson({error:'Unauthorized'},401);
  const body=await request.json().catch(()=>({}));
  if (!/^[0-9a-f-]{36}$/i.test(str(body.runId))) return responseJson({error:'runId inválido'},400);
  EdgeRuntime.waitUntil(execute(body.runId).catch(()=>undefined));
  return responseJson({accepted:true},202);
});
