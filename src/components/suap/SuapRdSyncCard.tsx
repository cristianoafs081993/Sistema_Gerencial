import { useEffect, useRef, useState } from 'react';
import { useOptionalAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSuapPlanUnitForCampus, SUAP_PLAN_UNITS } from '@/lib/suapPlanUnits';
import { suapRdService, type RdSyncRun } from '@/services/suapRdService';
import { SuapRdPreview } from './SuapRdPreview';
import { formatCurrency } from '@/lib/utils';

const labels: Record<string, string> = { collecting: 'Captura em andamento ou aguardando retomada', partial: 'Coleta incompleta', awaiting_auth: 'Entre novamente no SUAP e retome pela extensão', preview: 'Conferência pronta', applied: 'Aplicada', reverted: 'Revertida', failed: 'Descartada ou falhou' };
const phases: Record<string, string> = { inventory: 'Inventário de RDs', plan: 'Plano de atividades da unidade', activities: 'Relações oficiais de atividades', details: 'Detalhes das RDs', verify: 'Conferência final do inventário', ready: 'Conferência completa' };
export function SuapRdSyncCard({ campusUasg = '158366', onSynced }: { campusUasg?: string; onSynced: () => void }) {
  const auth = useOptionalAuth();
  const [unit, setUnit] = useState(getSuapPlanUnitForCampus(campusUasg).value);
  const [run, setRun] = useState<RdSyncRun | null>(null);
  const [appliedRun, setAppliedRun] = useState<RdSyncRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const scope = useRef('');
  scope.current = `${campusUasg}:${unit}`;
  useEffect(() => { setUnit(getSuapPlanUnitForCampus(campusUasg).value); }, [campusUasg]);
  useEffect(() => {
    let live = true; setRun(null); setAppliedRun(null); setMessage('');
    if (auth?.isSuperAdmin) suapRdService.action('status', unit, campusUasg).then(result => { if (live) { setRun(result.run ?? null); setAppliedRun(result.appliedRun ?? (result.run?.status === 'applied' ? result.run : null)); } })
      .catch(error => { if (live) setMessage(error.message); });
    return () => { live = false; };
  }, [auth?.isSuperAdmin, unit, campusUasg]);
  if (!auth?.isSuperAdmin) return null;
  const perform = async (action: 'status' | 'apply' | 'discard' | 'revert') => {
    const currentScope = scope.current;
    setBusy(true); setMessage('');
    try {
      if (action !== 'status') await suapRdService.action(action, unit, campusUasg, action === 'revert' ? appliedRun?.id : run?.id);
      const status = await suapRdService.action('status', unit, campusUasg);
      if (scope.current !== currentScope) return;
      setRun(status.run ?? null);
      setAppliedRun(status.appliedRun ?? (status.run?.status === 'applied' ? status.run : null));
      if (action === 'apply' || action === 'revert' || action === 'status' && status.run?.status === 'applied') onSynced();
    } catch (error) {
      if (scope.current !== currentScope) return;
      setMessage(error instanceof Error ? error.message : 'Falha ao coletar RDs.');
      const latest = await suapRdService.action('status', unit, campusUasg).catch(() => null);
      if (latest && scope.current === currentScope) { setRun(latest.run ?? null); setAppliedRun(latest.appliedRun ?? (latest.run?.status === 'applied' ? latest.run : null)); }
    } finally { setBusy(false); }
  };
  return <Card><CardHeader><CardTitle>Requisições de despesas — atividades e movimentações</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">Na extensão Suape, abra o SUAP autenticado e use o bloco RDs — Requisições de despesas para coletar esta unidade ou todas as unidades. Atividades e RDs têm controles independentes. A coleta utiliza a sessão da aba e pode ser retomada pela extensão. Depois, atualize esta conferência para revisar e aplicar as RDs de cada unidade.</p>
    <p className="text-sm text-muted-foreground">A coleta confere o inventário de todas as situações. Após a primeira aplicação, reaproveita permanentemente RDs concluídas e seus vínculos, busca RDs novas e relê as pendentes. Canceladas passam por conferência periódica. Para reconferir tudo imediatamente, marque Revalidar tudo na extensão. Somente RDs concluídas com linhas confirmadas compõem os valores; a aplicação pode ser revertida.</p>
    <label className="block text-sm">Unidade SUAP / campus
      <select className="mt-1 block w-full rounded-md border border-input bg-background p-2" disabled={busy} value={unit} onChange={e => setUnit(e.target.value)}>
        {SUAP_PLAN_UNITS.filter(item => item.parentUasg === campusUasg).map(item => <option key={item.value} value={item.value}>{item.code} — {item.label} · UASG {item.parentUasg}</option>)}
      </select>
    </label>
    {run && <div className="space-y-1 text-sm" role="status"><p className="font-semibold">{labels[run.status] ?? run.status} · {phases[run.phase] ?? run.phase}</p><p>RDs conferidas: {run.processed}/{run.sourceCount} · relações de atividades verificadas: {run.activitiesProcessed}/{run.activitiesTotal}</p>
      {run.syncMode === 'incremental' && <p>{run.reusedDetails ?? 0} RDs reaproveitadas · {run.refreshedDetails ?? 0} relidas · {run.reusedActivities ?? 0} relações de atividades reaproveitadas.</p>}
      {run.complete && <p>{run.summary.rds ?? 0} RDs · {run.summary.movimentos ?? 0} linhas confirmadas · {run.summary.canceladasOuPendentes ?? 0} canceladas ou pendentes · {run.summary.historicas ?? 0} sem atividade no Plano 8 · {run.summary.semNe ?? 0} sem NE · {run.summary.conflitos ?? 0} conflitos de atividades.</p>}
      {run.status === 'preview' && <p>A aplicação disponibiliza as RDs para conferência. Empenhos e atividades ausentes e conflitos manuais permanecem pendentes; os saldos SIAFI e os vínculos manuais são preservados.</p>}
      {run.complete && <><p>Dotação: {formatCurrency(run.summary.totalDotacao ?? 0)} · reforços: {formatCurrency(run.summary.totalReforco ?? 0)} · anulações: {formatCurrency(run.summary.totalAnulacao ?? 0)}</p><p>Linhas com pendências no SIAGES: {run.summary.atividadesAusentes ?? 0} sem atividade · {run.summary.empenhosAusentes ?? 0} sem empenho · {run.summary.conflitosManuais ?? 0} com conflito manual · {run.summary.neAmbiguas ?? 0} com NE ambígua.</p></>}
    </div>}
    {run?.error && <p role="alert" className="text-sm text-status-warning">{run.error}</p>}
    {run?.status === 'preview' && <SuapRdPreview key={run.id} runId={run.id} campus={campusUasg} unit={unit} />}
    {message && <p role="alert" className="text-sm text-status-warning">{message}</p>}
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy} onClick={() => perform('status')}>Atualizar conferência das RDs</Button>
      {run?.status === 'preview' && <Button disabled={busy || !run.complete} onClick={() => perform('apply')}>Aplicar conferência das RDs</Button>}
      {run && ['collecting','partial','awaiting_auth','preview'].includes(run.status) && <Button variant="outline" disabled={busy} onClick={() => perform('discard')}>Descartar conferência</Button>}
      {appliedRun && <Button variant="outline" disabled={busy} onClick={() => perform('revert')}>Reverter última aplicação</Button>}
    </div>
  </CardContent></Card>;
}
