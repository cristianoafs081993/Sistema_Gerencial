import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { SiafiChecklist } from './SiafiChecklist';
import { siafiLiquidacaoService as service, downloadSiafiJson, type SiafiSelection, type SiafiOptions, type SiafiReview } from '@/services/siafiLiquidacao';

export function SiafiLiquidacaoPanel({processoId}:{processoId:string}) {
  const queryClient=useQueryClient(),file=useRef<HTMLInputElement>(null);
  const {session}=useAuth(),owner=session?.user?.id;
  const [capture,setCapture]=useState<unknown>(),[selection,setSelection]=useState<SiafiSelection>(),[options,setOptions]=useState<SiafiOptions>({});
  const [selectedId,setSelectedId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const history=useQuery({queryKey:['siafi-liquidacao',owner,processoId],queryFn:()=>service.history(processoId),enabled:!!owner,refetchInterval:query=>query.state.data?.some(run=>run.status==='queued'||run.status==='processing')?3000:15000});
  const selectedMeta=selectedId?history.data?.find(run=>run.id===selectedId):history.data?.[0];
  const activeId=selectedId || selectedMeta?.id;
  const detail=useQuery({queryKey:['siafi-run',owner,activeId],queryFn:async()=>(await service.status(activeId!)).run,enabled:!!owner&&!!activeId,refetchInterval:query=>['processing','queued'].includes(query.state.data?.status || '')||['processing','queued'].includes(selectedMeta?.status || '')?3000:false});
  const selected=detail.data || selectedMeta;
  const reviews=useQuery({queryKey:['siafi-revisoes',owner,selected?.id],queryFn:()=>service.reviews(selected!.id),enabled:!!owner&&!!selected&&selected.status==='completed'});
  async function loadCapture(file:File) {
    setBusy(true);setError('');
    try {
      if(file.size>6*1024*1024) throw new Error('O JSON excede 6 MB.');
      const value=JSON.parse(await file.text()),prepared=await service.prepare(value,processoId);
      setCapture(value);setSelection(prepared.selection);setOptions({notaKeys:prepared.selection.notaKeys,listaId:prepared.selection.listaId,tipoPagamento:prepared.selection.tipoPagamento});
    } catch(e) {setError(e instanceof Error?e.message:'Falha ao ler a captura.');setCapture(undefined);setSelection(undefined);} finally {setBusy(false);}
  }
  async function start() {
    setBusy(true);setError('');
    try {
      const result=await service.start(capture,processoId,{...options,listaAusente:options.tipoPagamento==='estudantes' && !options.listaId});
      if(result.selection) {setSelection(result.selection);setError('Selecione o tipo de pagamento, notas ou lista necessários.');return;}
      setSelectedId(result.runId!);setSelection(undefined);setCapture(undefined);await history.refetch();
    } catch(e) {setError(e instanceof Error?e.message:'Falha ao iniciar.');} finally {setBusy(false);}
  }
  async function review(itemId:string,checked:boolean,feedback?:SiafiReview['feedback'],reason?:string) {
    await service.review(selected!.id,itemId,checked,feedback,reason);
    await queryClient.invalidateQueries({queryKey:['siafi-revisoes',owner,selected!.id]});
  }
  return <section className="space-y-4 rounded-xl border bg-card p-4" aria-label="Conferência da liquidação">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Conferência da liquidação</h3><Button size="sm" variant="outline" disabled={busy} onClick={()=>file.current?.click()}>Conferir JSON do SIAFI</Button></div>
    <input ref={file} type="file" accept=".json,application/json" hidden onChange={event=>{const value=event.target.files?.[0];if(value)void loadCapture(value);event.target.value='';}}/>
    <p className="text-xs text-muted-foreground">Execute print no SIAFI e use Conferir com IA, ou selecione o JSON aqui. A conferência pode ser feita antes do registro do DH.</p>
    {busy?<p role="status">Preparando conferência…</p>:null}
    {error || history.error || detail.error?<p role="alert" className="text-sm text-destructive">{error || history.error?.message || detail.error?.message}</p>:null}
    {selection?<div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-semibold">Documentos desta liquidação — {selection.numProcesso}</p>
      {selection.avisos.map(warning=><p key={warning} className="text-sm">{warning}</p>)}
      <label className="block text-sm">Tipo de pagamento<select className="ml-2 rounded border bg-background p-2" value={options.tipoPagamento} onChange={e=>setOptions({...options,tipoPagamento:e.target.value as SiafiOptions['tipoPagamento']})}><option value="indefinido">Selecione</option><option value="fornecedor_pj">Fornecedor pessoa jurídica</option><option value="estudantes">Bolsas e auxílios de estudantes</option></select></label>
      {selection.notas.map(note=><label key={note.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.notaKeys?.includes(note.key) || false} onChange={e=>setOptions({...options,notaKeys:e.target.checked?[...(options.notaKeys || []),note.key]:(options.notaKeys || []).filter(key=>key!==note.key)})}/> NF {note.numero} · {note.data_emissao} · {note.valor}</label>)}
      <label className="block text-sm">Lista de trabalho<select className="ml-2 max-w-full rounded border bg-background p-2" value={options.listaId || ''} onChange={e=>setOptions({...options,listaId:e.target.value})}><option value="">Sem lista — conferência ficará pendente</option>{selection.listas.map(list=><option key={list.id} value={list.id}>{list.nome} ({list.quantidade})</option>)}</select></label>
      <details><summary className="cursor-pointer text-sm">Documentos de referência</summary>{selection.documentos.map(document=><label className="flex gap-2 text-sm" key={document.id}><input type="checkbox" checked={!options.documentoIds || options.documentoIds.includes(document.id)} onChange={e=>{const ids=options.documentoIds || selection.documentos.map(d=>d.id);setOptions({...options,documentoIds:e.target.checked?[...ids,document.id]:ids.filter(id=>id!==document.id)});}}/>{document.titulo}</label>)}</details>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={options.pagamentoParcial || false} onChange={e=>setOptions({...options,pagamentoParcial:e.target.checked})}/> Pagamento parcial</label>
      <Input aria-label="Competência da liquidação" placeholder="Competência, se necessária (AAAA-MM)" value={options.competencia || ''} onChange={e=>setOptions({...options,competencia:e.target.value})}/>
      <Input aria-label="Justificativa do escopo" placeholder="Parcela, glosa ou justificativa da seleção" value={options.justificativa || ''} onChange={e=>setOptions({...options,justificativa:e.target.value})}/>
      <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={()=>void start()}>Conferir com IA</Button><Button size="sm" variant="outline" onClick={()=>setSelection(undefined)}>Cancelar</Button></div>
    </div>:null}
    {history.isLoading?<p role="status">Carregando histórico…</p>:null}
    {history.data?.length?<label className="block text-sm">Histórico (últimas 50 análises)<select className="ml-2 max-w-full rounded border bg-background p-2" value={selected?.id || ''} onChange={e=>setSelectedId(e.target.value)}>{history.data.map(run=><option key={run.id} value={run.id}>{new Date(run.created_at).toLocaleString('pt-BR')} · {{queued:'Aguardando',processing:'Em análise',completed:'Concluída',failed:'Interrompida'}[run.status]}</option>)}</select></label>:null}
    {selected && selected.status!=='completed'?<div className="space-y-2"><p role="status">{selected.progresso}</p>{selected.error_message?<p role="alert">{selected.error_message}</p>:null}<Button size="sm" variant="outline" disabled={busy || selected.attempts>=3} onClick={()=>{setBusy(true);void service.retry(selected.id).then(async()=>{await detail.refetch();await history.refetch();}).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>Retomar análise</Button></div>:null}
    {selected?.result_snapshot?<>
      {selected.result_snapshot.ambiguidades?.length?<div className="rounded border border-warning p-3 text-sm">{selected.result_snapshot.ambiguidades.map((a,index)=><p key={index}>{a.descricao} {a.opcoes.join(' · ')}</p>)}<Button size="sm" variant="outline" disabled={busy} onClick={()=>{setBusy(true);void service.status(selected.id).then(async({run})=>{const input=run.input_snapshot as {captura:unknown;escopo:SiafiOptions};const prepared=await service.prepare(input.captura,processoId,input.escopo);setCapture(input.captura);setOptions(input.escopo);setSelection(prepared.selection);}).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>Completar seleção</Button></div>:null}
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm">{selected.result_snapshot.resumo}</p><Button size="sm" variant="outline" onClick={()=>void service.status(selected.id).then(({run})=>downloadSiafiJson({analise:run,revisoes:reviews.data || []},`conferencia-siafi-${run.id}.json`)).catch(e=>setError(e.message))}>Baixar análise estruturada</Button></div>
      {reviews.error?<p role="alert">Não foi possível carregar suas revisões: {reviews.error.message}</p>:null}
      <SiafiChecklist key={selected.id} items={selected.result_snapshot.checklist} reviews={reviews.data} disabled={reviews.isLoading||reviews.isError} onReview={review} onEvidence={async evidence=>{const source=selected.result_snapshot!.fontes.find(s=>s.id===evidence.sourceId);if(source){const url=await service.evidenceUrl(source,evidence.pagina);if(url)window.open(url,'_blank','noopener,noreferrer');}}}/>
    </>:null}
  </section>;
}
