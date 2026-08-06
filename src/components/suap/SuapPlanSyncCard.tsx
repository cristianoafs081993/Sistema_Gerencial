import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CloudDownload, KeyRound, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { suapPlanSyncService, type SuapPlanSyncStatus, type SuapPlanSyncResult } from '@/services/suapPlanSyncService';

type Props = { onSynced: () => void };

function statusLabel(status: SuapPlanSyncStatus['status'] | null) {
  if (status === 'running') return 'Sincronizando...';
  if (status === 'preview') return 'ConferÃƒÆ’Ã‚Âªncia pendente';
  if (status === 'success') return 'Sincronizado';
  if (status === 'failed') return 'Falha na sincronizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o';
  if (status === 'reauth_required') return 'Conecte-se ao SUAP';
  return 'Aguardando conexÃƒÆ’Ã‚Â£o';
}

function syncResultMessage(result: SuapPlanSyncResult) {
  if (result.status === 'preview') {
    return `${result.sourceCount ?? 0} atividades encontradas. ${result.inserted ?? 0} novas, ${result.updated ?? 0} atualizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes e ${result.archived ?? 0} serÃƒÆ’Ã‚Â£o arquivadas.`;
  }
  if (result.status === 'success') return 'Dados do SUAP aplicados ao planejamento Campus.';
  if (result.status === 'already_running') return 'JÃƒÆ’Ã‚Â¡ existe uma sincronizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o em andamento.';
  return result.error ?? 'ÃƒÆ’Ã¢â‚¬Â° necessÃƒÆ’Ã‚Â¡rio conectar-se ao SUAP.';
}

export function SuapPlanSyncCard({ onSynced }: Props) {
  const [status, setStatus] = useState<SuapPlanSyncStatus | null>(null);
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [authMode, setAuthMode] = useState<'credentials' | 'cookie'>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [showConnection, setShowConnection] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const response = await suapPlanSyncService.status();
      setStatus(response.run);
      if (response.run?.status === 'success') setMessage('ÃƒÆ’Ã…Â¡ltima execuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o concluÃƒÆ’Ã‚Â­da com sucesso.');
    } catch {
      // A consulta de status nÃƒÆ’Ã‚Â£o deve impedir a tabela de abrir.
    }
  }, []);

  const runSync = useCallback(async () => {
    setIsBusy(true);
    setStatus((previous) => previous ? { ...previous, status: 'running' } : null);
    try {
      const result = await suapPlanSyncService.sync();
      setMessage(syncResultMessage(result));
      if (result.status === 'preview') {
        setStatus((previous) => previous ? { ...previous, status: 'preview', id: result.runId ?? previous.id } : null);
      } else if (result.status === 'success') {
        setStatus((previous) => previous ? { ...previous, status: 'success' } : null);
        onSynced();
      } else if (result.status === 'reauth_required') {
        setShowConnection(true);
      }
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha na sincronizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o.');
      setShowConnection(true);
    } finally {
      setIsBusy(false);
    }
  }, [onSynced, refreshStatus]);

  useEffect(() => {
    const receiveExtensionRequest = (event: MessageEvent) => {
      const payload = event.data?.payload;
      if (event.origin !== window.location.origin || event.source !== window ||
          event.data?.source !== 'siages-suap-extension' ||
          event.data?.type !== 'siages:suap-plan-sync-request' ||
          event.data?.version !== 1 || payload?.planId !== 8 || payload?.scope !== 'campus') return;
      void runSync();
    };
    window.addEventListener('message', receiveExtensionRequest);
    return () => window.removeEventListener('message', receiveExtensionRequest);
  }, [runSync]);

  useEffect(() => {
    let active = true;
    void refreshStatus().then(() => {
      if (active) void runSync();
    });
    return () => { active = false; };
  }, [refreshStatus, runSync]);

  const connect = async () => {
    if (!username.trim() || !password) return;
    setIsBusy(true);
    try {
      if (authMode === 'credentials') {
        await suapPlanSyncService.connect(username.trim(), password);
        setPassword('');
      } else {
        await suapPlanSyncService.connectCookie(sessionId.trim());
        setSessionId('');
      }
      setShowConnection(false);
      setMessage('ConexÃƒÆ’Ã‚Â£o SUAP validada. Iniciando conferÃƒÆ’Ã‚Âªncia...');
      await runSync();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'NÃƒÆ’Ã‚Â£o foi possÃƒÆ’Ã‚Â­vel conectar ao SUAP.');
    } finally {
      setIsBusy(false);
    }
  };

  const applyPreview = async () => {
    if (!status?.id) return;
    setIsBusy(true);
    try {
      const result = await suapPlanSyncService.apply(status.id);
      setMessage(syncResultMessage(result));
      setStatus((previous) => previous ? { ...previous, status: 'success' } : null);
      onSynced();
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'NÃƒÆ’Ã‚Â£o foi possÃƒÆ’Ã‚Â­vel aplicar a conferÃƒÆ’Ã‚Âªncia.');
    } finally {
      setIsBusy(false);
    }
  };

  const isPreview = status?.status === 'preview';
  const needsConnection = showConnection || status?.status === 'reauth_required' || (!status && Boolean(message));

  return (
    <Card className="border-border-default/60 bg-surface-card shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2">
          <CloudDownload className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-bold">SincronizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o SUAP ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Campus</CardTitle>
        </div>
        <Badge variant="outline" className="gap-1 text-[10px] uppercase tracking-wide">
          {status?.status === 'running' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {statusLabel(status?.status ?? null)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 pt-0 text-xs text-muted-foreground">
        <p>{message || 'Os dados atuais permanecem visÃƒÆ’Ã‚Â­veis enquanto o Plano 8 ÃƒÆ’Ã‚Â© consultado em segundo plano.'}</p>

        {isPreview ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span className="flex-1">Revise a conferÃƒÆ’Ã‚Âªncia antes de aplicar o primeiro espelho.</span>
            <Button type="button" size="sm" onClick={() => void applyPreview()} disabled={isBusy}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Aplicar conferÃƒÆ’Ã‚Âªncia
            </Button>
          </div>
        ) : null}

        {needsConnection ? (
          <div className="space-y-2 rounded-md border border-border-default/60 bg-background p-3">
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={authMode === 'credentials' ? 'secondary' : 'ghost'} onClick={() => setAuthMode('credentials')}>Matrícula e senha</Button>
              <Button type="button" size="sm" variant={authMode === 'cookie' ? 'secondary' : 'ghost'} onClick={() => setAuthMode('cookie')}>Cookie sessionid</Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              {authMode === 'credentials' ? <>
                <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Matrícula SUAP" autoComplete="username" />
                <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha SUAP" type="password" autoComplete="current-password" />
              </> : <Input className="sm:col-span-2" value={sessionId} onChange={(event) => setSessionId(event.target.value)} placeholder="Valor do cookie sessionid" autoComplete="off" />}
              <Button type="button" onClick={() => void connect()} disabled={isBusy || (authMode === 'credentials' ? !username.trim() || !password : !sessionId.trim())}>
                <KeyRound className="mr-1 h-3.5 w-3.5" /> Conectar
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void runSync()} disabled={isBusy}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`} /> Sincronizar agora
          </Button>
          {!needsConnection && status?.status !== 'success' ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowConnection(true)}>
              Conectar ao SUAP
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}






