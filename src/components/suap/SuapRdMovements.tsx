import { useQuery } from '@tanstack/react-query';
import { useOptionalAuth } from '@/contexts/AuthContext';
import { getSuapPlanUnitForCampus } from '@/lib/suapPlanUnits';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { suapRdService, rdResolutionLabel, uniqueRdMovements, type RdMovement } from '@/services/suapRdService';
import type { Empenho } from '@/types';
import { SuapRdCaptureNotice } from './SuapRdCaptureNotice';

export function SuapRdMovements({ empenho, enabled }: { empenho: Empenho; enabled: boolean }) {
  const auth = useOptionalAuth();
  const campus = auth?.userCampus.codigo ?? '158366';
  const org = auth?.userOrg?.id;
  const unit = getSuapPlanUnitForCampus(campus);
  const query = useQuery({
    queryKey: ['suap-rds', 'movements', org, campus, unit.value],
    queryFn: () => suapRdService.read<RdMovement>('suap_rd_movimentacoes', org!, campus, unit.value),
    enabled: enabled && !!org, staleTime: 60000, retry: false,
  });
  const rows = uniqueRdMovements(query.data ?? []).filter(row => row.empenho_id === empenho.id || row.empenho_numero === empenho.numero.trim().toUpperCase() || row.empenho_completo === empenho.numero.trim().toUpperCase());
  const confirmed = rows.filter(row => row.confirmed);
  const total = confirmed.reduce((sum, row) => sum + row.valor, 0);
  return <SectionPanel title="Movimentações do empenho — RDs do SUAP">
    <div className="space-y-3 p-4 text-sm">
      <p className="text-muted-foreground">{unit.code} · UASG {campus}. Valores das linhas confirmadas; datas de captura não representam datas contábeis.</p>
      {query.isLoading ? <p role="status">Consultando movimentações…</p> : query.isError ? <div role="alert">Não foi possível consultar as RDs. <Button variant="outline" size="sm" onClick={() => query.refetch()}>Tentar novamente</Button></div> : rows.length === 0 ? <SuapRdCaptureNotice campus={campus} unit={unit.value} enabled={enabled} fallback={<p>Nenhuma RD aplicada corresponde a este empenho nesta unidade.</p>} /> : <>
        <div className="flex flex-wrap gap-4">
          {(['dotacao', 'reforco', 'anulacao'] as const).map(tipo => <p key={tipo}>{({ dotacao: 'Dotação', reforco: 'Reforços', anulacao: 'Anulações' })[tipo]}: <strong>{formatCurrency(confirmed.filter(row => row.tipo === tipo).reduce((sum, row) => sum + row.valor, 0))}</strong></p>)}
          <p>Líquido das RDs: <strong>{formatCurrency(total)}</strong></p>
        </div>
        {Math.abs(total - empenho.valor) > 0.01 && <p className="text-status-warning">Diferença para o valor do empenho no SIAGES: {formatCurrency(total - empenho.valor)}. Os valores contábeis são preservados.</p>}
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>
          {['RD / origem', 'Movimento', 'RO / natureza', 'Atividade / conferência', 'Valor'].map(title => <th key={title} className="p-2">{title}</th>)}
        </tr></thead><tbody>{rows.sort((a,b) => a.rd_numero.localeCompare(b.rd_numero) || a.line_index-b.line_index).map(row => <tr key={`${row.suap_rd_id}:${row.line_index}`} className="border-t border-border">
          <td className="p-2"><a className="text-primary underline" href={row.source_url} target="_blank" rel="noreferrer">{row.rd_numero}</a><p className="text-muted-foreground">Captura: {new Date(row.captured_at).toLocaleString('pt-BR')}</p></td>
          <td className="p-2">{({ dotacao: 'Dotação', reforco: 'Reforço', anulacao: 'Anulação' })[row.tipo ?? ''] ?? 'Outro'}<p>{row.rd_situacao} · {row.linha_situacao}</p>{!row.confirmed && <p className="text-status-warning">Não contabilizada nas RDs</p>}</td>
          <td className="p-2 font-mono">{row.ro || 'Sem RO'}<p>{row.natureza_despesa}</p></td>
          <td className="p-2">{row.atividade_nome}<p className="text-muted-foreground">{rdResolutionLabel(row.resolution)}</p></td>
          <td className={`p-2 text-right font-medium ${row.valor < 0 ? 'text-status-error' : ''}`}>{formatCurrency(row.valor)}</td>
        </tr>)}</tbody></table></div>
      </>}
    </div>
  </SectionPanel>;
}
