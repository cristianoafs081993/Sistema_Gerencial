import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOptionalAuth } from '@/contexts/AuthContext';
import { suapRdService } from '@/services/suapRdService';

/** Capture alone does not publish associations: explain incomplete/unapplied data at the point of use. */
export function SuapRdCaptureNotice({campus,unit,enabled=true,fallback=null}:{campus:string;unit:string;enabled?:boolean;fallback?:ReactNode}) {
  const org = useOptionalAuth()?.userOrg?.id;
  const query = useQuery({queryKey:['suap-rds','capture-status',org,campus,unit],
    queryFn:()=>suapRdService.captureStatus(org!,campus,unit),enabled:enabled && !!org,staleTime:60000,retry:false});
  if (!org || !enabled) return fallback;
  if (query.isLoading) return <p role="status" className="text-sm text-muted-foreground">Consultando a sincronização das RDs…</p>;
  if (query.isError) return <p role="alert" className="text-sm text-status-warning">Não foi possível consultar o estado da sincronização de RDs.</p>;
  if (!query.data || query.data.hasApplied) return fallback;
  const latest = query.data.latest;
  return <p role="status" className="text-sm text-status-warning">
    {latest?.status==='preview' ? 'As RDs foram coletadas, mas a conferência ainda não foi aplicada.'
      : latest && ['collecting','partial','awaiting_auth'].includes(latest.status) ? `Coleta de RDs incompleta: ${latest.processed}/${latest.sourceCount} RDs conferidas. Retome pela extensão Suape.`
      : 'Nenhuma conferência de RDs foi aplicada nesta unidade.'}
    {' '}Conclua e aplique a conferência em Importação de dados para disponibilizar os vínculos e as movimentações.
  </p>;
}
