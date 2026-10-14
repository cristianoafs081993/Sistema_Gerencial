import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ChecklistItem, Evidence, SiafiReview } from '@/services/siafiLiquidacao';

const labels={divergente:'Divergente',nao_verificavel:'Não verificável',conforme:'Conforme',nao_aplicavel:'Não aplicável'} as const;
const variants={divergente:'danger',nao_verificavel:'warning',conforme:'success',nao_aplicavel:'outline'} as const;
export function SiafiChecklist({items,reviews=[],onReview,onEvidence,disabled=false}:{items:ChecklistItem[];reviews?:SiafiReview[];onReview:(itemId:string,conferido:boolean,feedback?:SiafiReview['feedback'],motivo?:string)=>Promise<void>;onEvidence?:(e:Evidence)=>Promise<void>;disabled?:boolean}) {
  const [showAll,setShowAll]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState('');
  const [reasons,setReasons]=useState<Record<string,string>>({});
  const latest=new Map(reviews.map(review=>[review.item_id,review]));
  const counts=Object.fromEntries(Object.keys(labels).map(key=>[key,items.filter(item=>item.status===key).length]));
  const visible=showAll ? items : items.filter(item=>['divergente','nao_verificavel'].includes(item.status));
  async function review(item:ChecklistItem,checked:boolean,feedback?:SiafiReview['feedback']) {
    setBusy(item.id);setError('');
    try {await onReview(item.id,checked,feedback,reasons[item.id]);} catch(e) {setError(e instanceof Error?e.message:'Falha ao salvar a revisão.');} finally {setBusy('');}
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2" aria-label="Contadores da conferência">
      {Object.entries(labels).map(([key,label])=><Badge key={key} variant={variants[key]}>{counts[key]} {label}</Badge>)}
      <span className="text-xs text-muted-foreground">{items.filter(item=>latest.get(item.id)?.conferido).length} conferidos</span>
      <Button size="sm" variant="outline" onClick={()=>setShowAll(!showAll)}>{showAll?'Mostrar pendências':'Mostrar todos'}</Button>
    </div>
    <p className="text-xs text-muted-foreground">Conferido registra sua revisão e mantém o resultado da IA. Após corrigir, execute print novamente para comparar as análises.</p>
    {error?<p role="alert" className="text-sm text-destructive">{error}</p>:null}
    {!visible.length?<p className="text-sm text-muted-foreground">Nenhuma divergência ou pendência neste checklist. Os demais itens estão em Mostrar todos.</p>:null}
    {visible.map(item=><details key={item.id} className="rounded-lg border border-border bg-card p-3" data-status={item.status}>
      <summary className="cursor-pointer space-y-2">
        <div className="flex flex-wrap items-center gap-2"><Badge variant={variants[item.status]}>{labels[item.status]}</Badge><span className="text-sm font-semibold">{item.regraId} — {item.descricao}</span>{item.evolucao?<Badge variant="outline">{item.evolucao==='nao_verificavel'?'Não verificável':item.evolucao}</Badge>:null}{latest.get(item.id)?.conferido?<Badge variant="info">Conferido</Badge>:null}</div>
        <p className="break-words text-xs text-muted-foreground">{item.entidade}</p>
        <div className="grid gap-1 text-sm sm:grid-cols-2"><span>Esperado: {item.esperado || 'Não identificado'}</span><span>Encontrado: {item.encontrado || 'Não identificado'}</span></div>
        {item.diferenca!==undefined?<p className="font-mono text-sm">Diferença: {item.diferenca}</p>:null}
      </summary>
      <div className="mt-3 space-y-3 border-t pt-3 text-sm">
        <p>{item.observacao}</p>{item.acao?<p><strong>Ação: </strong>{item.acao}</p>:null}
        {item.calculo?<p className="break-words rounded bg-muted p-2 font-mono text-xs">{item.calculo.memoria}</p>:null}
        <ul className="space-y-2">{item.evidencias.map((e,index)=><li key={index} className="break-words text-xs"><strong>{e.fonte} · {e.sourceId}{e.pagina?` · página ${e.pagina}`:''}{e.caminho?` · ${e.caminho}`:''}</strong><p>“{e.trecho}”</p>{onEvidence && e.fonte==='processo'?<Button size="sm" variant="link" onClick={()=>void onEvidence(e).catch(err=>setError(err.message))}>Abrir documento nesta página</Button>:null}</li>)}</ul>
        <label className="flex items-center gap-2"><input type="checkbox" checked={latest.get(item.id)?.conferido || false} disabled={disabled||busy===item.id} onChange={event=>void review(item,event.target.checked)}/> Conferido</label>
        <Input aria-label={`Motivo da revisão ${item.id}`} placeholder="Motivo ou observação da revisão" value={reasons[item.id] ?? ''} onChange={event=>setReasons({...reasons,[item.id]:event.target.value})}/>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={disabled||busy===item.id} onClick={()=>void review(item,true,'confirmo_divergencia')}>Confirmar apontamento</Button><Button size="sm" variant="outline" disabled={disabled||busy===item.id} onClick={()=>void review(item,true,'falso_positivo')}>Indicar falso positivo</Button><Button size="sm" variant="outline" disabled={disabled||busy===item.id} onClick={()=>void review(item,true,'falta_de_dados')}>Registrar falta de dados</Button></div>
        {latest.get(item.id)?.feedback?<p className="text-xs text-muted-foreground">Última revisão: {{confirmo_divergencia:'Apontamento confirmado',falso_positivo:'Falso positivo',falta_de_dados:'Falta de dados'}[latest.get(item.id)!.feedback!]} — {latest.get(item.id)?.motivo}</p>:null}
      </div>
    </details>)}
  </div>;
}
