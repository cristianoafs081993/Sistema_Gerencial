import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getSuapPlanUnitForCampus } from '@/lib/suapPlanUnits';
import { suapRdService, uniqueRdMovements, type RdMovement } from '@/services/suapRdService';
import type { Empenho } from '@/types';

export function SuapRdMovementBadge({ empenho, onOpen }: { empenho: Empenho; onOpen: () => void }) {
  const auth = useAuth();
  const org = auth.userOrg?.id;
  const campus = auth.userCampus?.codigo ?? '158366';
  const unit = getSuapPlanUnitForCampus(campus).value;
  const query = useQuery({ queryKey:['suap-rds','movements',org,campus,unit],
    queryFn:()=>suapRdService.read<RdMovement>('suap_rd_movimentacoes',org!,campus,unit),enabled:!!org,staleTime:60000,retry:false });
  const rows=uniqueRdMovements(query.data ?? []).filter(row=>row.confirmed && (row.empenho_id===empenho.id || row.empenho_numero===empenho.numero.trim().toUpperCase() || row.empenho_completo===empenho.numero.trim().toUpperCase()));
  const count = (tipo: string) => new Set(rows.filter(row=>row.tipo===tipo).map(row=>`${row.suap_rd_id}:${row.ro || ''}`)).size;
  const reforcos=count('reforco');
  const anulacoes=count('anulacao');
  if (!reforcos && !anulacoes) return null;
  return <button type="button" className="w-fit text-xs text-primary underline-offset-2 hover:underline" title="Consultar movimentações nas RDs SUAP" onClick={event=>{event.stopPropagation();onOpen();}}>
    {reforcos} {reforcos===1?'reforço':'reforços'} · {anulacoes} {anulacoes===1?'anulação':'anulações'} (RD)
  </button>;
}
