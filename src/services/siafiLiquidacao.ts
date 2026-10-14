import { supabase } from '@/lib/supabase';
import type { ChecklistItem, PaymentKind, SourceDescriptor } from '../../supabase/functions/_shared/siafi_checklist';
export type { ChecklistItem, PaymentKind, Evidence, ChecklistStatus } from '../../supabase/functions/_shared/siafi_checklist';
export type SiafiSelection = {
  processoId: string; numProcesso: string; tipoPagamento: PaymentKind; needsSelection: boolean;
  notas: {key:string;numero?:string;data_emissao?:string;valor?:string}[]; notaKeys: string[];
  listas: {id:string;nome:string;quantidade:number}[]; listaId:string;
  documentos:{id:string;titulo:string}[]; avisos:string[];
};
export type SiafiResult = {
  schemaVersion:string; resumo:string; checklist:ChecklistItem[]; modelo:string; analisadoEm:string;
  fontes:SourceDescriptor[]; captureId:string; regrasVersao:string; analiseAnteriorId?:string;
  ambiguidades?:{tipo:string;descricao:string;opcoes:string[]}[];
};
export type SiafiRun = {
  id:string; processo_id:string; status:'queued'|'processing'|'completed'|'failed'; progresso:string;
  created_at:string; attempts:number; error_message?:string; result_snapshot?:SiafiResult; input_snapshot?:unknown;
};
export type SiafiReview = {id:string;analise_id:string;item_id:string;conferido:boolean;feedback?:'confirmo_divergencia'|'falso_positivo'|'falta_de_dados';motivo:string;created_at:string};
export type SiafiOptions = {notaKeys?:string[];listaId?:string;listaAusente?:boolean;tipoPagamento?:PaymentKind;documentoIds?:string[];competencia?:string;pagamentoParcial?:boolean;justificativa?:string};
async function invoke(body:unknown) {
  const {data,error}=await supabase.functions.invoke('analisar-liquidacao-siafi',{body});
  if (error) {
    const context=(error as {context?:Response}).context;
    const payload=context?.json ? await context.json().catch(()=>null) : null;
    throw new Error(payload?.error || error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const siafiLiquidacaoService = {
  prepare:(captura:unknown,processoId:string,options:SiafiOptions={})=>invoke({action:'prepare',captura,processoId,...options}) as Promise<{selection:SiafiSelection}>,
  start:(captura:unknown,processoId:string,options:SiafiOptions={})=>invoke({action:'start',captura,processoId,...options}) as Promise<{runId?:string;selection?:SiafiSelection}>,
  status:(runId:string)=>invoke({action:'status',runId}) as Promise<{run:SiafiRun}>,
  retry:(runId:string)=>invoke({action:'retry',runId}),
  async history(processoId:string):Promise<SiafiRun[]> {
    const {data,error}=await supabase.from('siafi_liquidacao_analises').select('id,processo_id,status,progresso,created_at,attempts,error_message').eq('processo_id',processoId).order('created_at',{ascending:false}).limit(50);
    if (error) throw error;
    return (data || []) as SiafiRun[];
  },
  async reviews(runId:string):Promise<SiafiReview[]> {
    const {data,error}=await supabase.from('siafi_liquidacao_revisoes').select('*').eq('analise_id',runId).order('created_at').order('id');
    if (error) throw error;
    return (data || []) as SiafiReview[];
  },
  async review(runId:string,itemId:string,conferido:boolean,feedback?:SiafiReview['feedback'],motivo='') {
    if (feedback==='falso_positivo' && motivo.trim().length<5) throw new Error('Explique o motivo do falso positivo.');
    const {error}=await supabase.from('siafi_liquidacao_revisoes').insert({analise_id:runId,item_id:itemId,conferido,feedback:feedback || null,motivo});
    if (error) throw error;
  },
  async evidenceUrl(source:SourceDescriptor,page?:number) {
    if (!source.storagePath) return undefined;
    const {data,error}=await supabase.storage.from('suap-pdfs').createSignedUrl(source.storagePath,120);
    if (error) throw error;
    return `${data.signedUrl}${page ? `#page=${page}` : ''}`;
  },
};
export function downloadSiafiJson(value:unknown,name:string) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'}));
  const a=document.createElement('a'); a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
