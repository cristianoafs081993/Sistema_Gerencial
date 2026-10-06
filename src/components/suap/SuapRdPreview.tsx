import { useQuery } from '@tanstack/react-query';
import { useOptionalAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { suapRdService } from '@/services/suapRdService';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function SuapRdPreview({ runId, campus, unit }: { runId: string; campus: string; unit: string }) {
  const org = useOptionalAuth()?.userOrg?.id;
  const [page,setPage] = useState(0);
  const query = useQuery({ queryKey:['suap-rds','preview',org,campus,unit,runId],queryFn:()=>suapRdService.preview(runId,org!,campus,unit),enabled:!!org,retry:false });
  if (query.isLoading) return <p role="status">Carregando prévia das RDs…</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar os detalhes da prévia.</p>;
  const rows = query.data ?? [];
  return <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-medium">Conferir as {rows.length} RDs capturadas antes de aplicar</summary>
    <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{['RD','Situação / tipo','Atividade oficial','NE / RO / valor'].map(label=><th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{rows.slice(page*20,(page+1)*20).map(({payload:rd})=><tr key={rd.rdId} className="border-t border-border">
      <td className="p-2"><a href={rd.sourceUrl} target="_blank" rel="noreferrer" className="text-primary underline">{rd.numero}</a></td>
      <td className="p-2">{rd.situacao}<p>{rd.tipoRaw}</p></td><td className="p-2">{rd.activityName}<p>{rd.sources.length === 1 ? `Plano ${rd.sources[0].planId} · atividade ${rd.sources[0].activityId}` : rd.sources.length > 1 ? 'Conflito de atividades' : 'Sem ID oficial no Plano 8'}</p></td>
      <td className="p-2">{rd.linhas.map((line,index)=><p key={index}>{line.empenhoNumero || 'Sem NE'} · {line.ro || 'Sem RO'} · {formatCurrency(line.valor)} · {line.situacao || 'Não confirmada'}</p>)}</td>
    </tr>)}</tbody></table></div><div className="mt-2 flex items-center gap-3"><Button size="sm" variant="outline" disabled={page===0} onClick={()=>setPage(page-1)}>Anterior</Button><span className="text-xs">Página {page+1} de {Math.max(1,Math.ceil(rows.length/20))}</span><Button size="sm" variant="outline" disabled={(page+1)*20>=rows.length} onClick={()=>setPage(page+1)}>Próxima</Button></div>
  </details>;
}
