import { useEffect, useState, useRef } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Play, 
  RefreshCw, 
  Terminal, 
  KeyRound,
  Info,
  ChevronDown,
  ChevronUp,
  LogOut
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { suapScraperService } from '@/services/suapScraperService';

interface SuapSyncPanelProps {
  onSyncComplete?: () => void;
}

export function SuapSyncPanel({ onSyncComplete }: SuapSyncPanelProps) {
  const { session } = useAuth();
  const [caixaUrl, setCaixaUrl] = useState('https://suap.ifrn.edu.br/processo_eletronico/caixa_processos/');
  
  // Credenciais do SUAP
  const [suapUser, setSuapUser] = useState('');
  const [suapPass, setSuapPass] = useState('');
  const [suapSessionId, setSuapSessionId] = useState<string | null>(null);
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Carregar sessão do localStorage
  useEffect(() => {
    const savedSession = localStorage.getItem('suap_session_id');
    const savedUrl = localStorage.getItem('suap_caixa_url');

    if (savedUrl) {
      setCaixaUrl(savedUrl);
    }
    if (savedSession) {
      setSuapSessionId(savedSession);
    }
  }, []);

  // Rolar logs para o final
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleConnectSuap = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!suapUser || !suapPass) {
      toast.error('Informe a matrícula e senha do SUAP.');
      return;
    }

    setIsLoggingIn(true);
    const loadingToast = toast.loading('Autenticando no SUAP...');

    try {
      const sessionId = await suapScraperService.loginSuap(suapUser.trim(), suapPass);
      localStorage.setItem('suap_session_id', sessionId);
      setSuapSessionId(sessionId);
      setSuapPass('');
      toast.success('Conectado ao SUAP com sucesso!', { id: loadingToast });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Falha na autenticação do SUAP. Verifique usuário e senha.', { id: loadingToast });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem('suap_session_id');
    setSuapSessionId(null);
    toast.success('Sessão do SUAP encerrada.');
  };

  const handleStartSync = async () => {
    if (!suapSessionId) {
      toast.error('É necessário conectar ao SUAP primeiro.');
      return;
    }

    if (!session?.user?.id) {
      toast.error('Usuário não autenticado no Sistema.');
      return;
    }

    localStorage.setItem('suap_caixa_url', caixaUrl);
    setSyncStatus('running');
    setIsCollapsed(false);
    setLogs([]);
    addLog('Iniciando sincronização nativa com o SUAP...');

    try {
      // 1. Fetch e Scraping da caixa
      addLog(`Lendo processos da caixa em: ${caixaUrl}`);
      const scraped = await suapScraperService.fetchAndScrapeCaixa(caixaUrl, suapSessionId);
      addLog(`Scraping finalizado. ${scraped.length} processos encontrados na página.`);

      if (scraped.length === 0) {
        throw new Error('Nenhum processo foi encontrado na página informada. Certifique-se de que a URL é uma Caixa de Processos válida.');
      }

      // 2. Sync básico no Supabase
      addLog('Enviando lista básica de processos para o Supabase...');
      const syncedProcesses = await suapScraperService.syncProcessListInSupabase(scraped, session.user.id);
      addLog(`Sincronização básica concluída. ${syncedProcesses.length} processos persistidos.`);

      let completed = 0;
      let skipped = 0;
      let errors = 0;

      // 3. Processamento individual de cada processo
      for (let i = 0; i < syncedProcesses.length; i++) {
        const proc = syncedProcesses[i];
        const displayId = proc.numProcesso || proc.suapId;

        addLog(`--- Processando ${i + 1}/${syncedProcesses.length}: ${displayId} ---`);

        try {
          if (proc.already_exists) {
            addLog(`[${displayId}] Dados já extraídos anteriormente. Pulando.`);
            skipped++;
            continue;
          }

          // Garantir que temos o número do processo enriquecido
          if (!proc.numProcesso) {
            const num = await suapScraperService.enrichProcessNumber(proc, suapSessionId, addLog);
            if (num) proc.numProcesso = num;
          }

          // Executar download e IA
          await suapScraperService.processAndSyncSingle(proc, suapSessionId, session.user.id, addLog);
          completed++;
        } catch (procErr: any) {
          addLog(`[${displayId}] ERRO: ${procErr.message}`);
          console.error(procErr);
          
          if (procErr.message?.includes('Sessão expirada') || procErr.message?.includes('não autenticada')) {
            // Sessão caiu no meio do caminho, encerra o loop
            handleDisconnect();
            throw procErr;
          }
          errors++;
        }
      }

      // Finalização
      addLog('======================================');
      addLog(`Sincronização concluída: ${completed} novos, ${skipped} pulados, ${errors} erros.`);
      setSyncStatus(errors === 0 ? 'success' : 'error');
      
      if (errors === 0) {
        toast.success('Sincronização concluída com sucesso!');
      } else {
        toast.warning(`Sincronização concluída com ${errors} erros.`);
      }

      if (onSyncComplete) {
        onSyncComplete();
      }

    } catch (err: any) {
      addLog(`FATAL: ${err.message}`);
      console.error(err);
      setSyncStatus('error');
      toast.error(`Falha na sincronização: ${err.message}`);
    }
  };

  return (
    <Card className="border-border-default/70 bg-surface-card shadow-soft overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-3 pointer-events-none select-none">
        <div className="space-y-1">
          <CardTitle className="font-ui text-md flex items-center gap-2 text-text-primary">
            <RefreshCw className={`h-5 w-5 text-emerald-600 ${syncStatus === 'running' ? 'animate-spin' : ''}`} />
            Sincronizar Processos do SUAP
          </CardTitle>
          <CardDescription className="text-xs text-text-secondary">
            Entre com suas credenciais do SUAP para importar processos e extrair PDFs nativamente.
          </CardDescription>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="pointer-events-auto h-8 w-8 p-0"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="space-y-4 pt-0 border-t border-border-default/30">
          
          {/* Seção 1: Formulário de Autenticação */}
          {!suapSessionId ? (
            <form onSubmit={handleConnectSuap} className="grid gap-3 p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl md:grid-cols-12 md:items-end">
              <div className="md:col-span-12 font-ui text-xs font-bold text-slate-700 flex items-center gap-1">
                <KeyRound className="h-4 w-4 text-emerald-600" />
                AUTENTICAÇÃO INSTITUCIONAL DO SUAP
              </div>
              
              <div className="md:col-span-5 space-y-1">
                <label htmlFor="suap-user" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Matrícula / Usuário
                </label>
                <Input
                  id="suap-user"
                  value={suapUser}
                  onChange={(e) => setSuapUser(e.target.value)}
                  placeholder="Ex: 304806"
                  className="text-xs h-9 bg-white"
                  disabled={isLoggingIn}
                />
              </div>

              <div className="md:col-span-5 space-y-1">
                <label htmlFor="suap-pass" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Senha do SUAP
                </label>
                <Input
                  id="suap-pass"
                  type="password"
                  value={suapPass}
                  onChange={(e) => setSuapPass(e.target.value)}
                  placeholder="Sua senha do SUAP"
                  className="text-xs h-9 bg-white"
                  disabled={isLoggingIn}
                />
              </div>

              <div className="md:col-span-2">
                <Button 
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full bg-[#1b5e20] hover:bg-[#1b5e20]/90 text-white font-bold h-9 text-xs shadow-sm gap-1"
                >
                  {isLoggingIn ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                  Conectar
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-ui">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-emerald-800 font-semibold">Sessão conectada com o SUAP</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={syncStatus === 'running'}
                className="h-8 border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-[11px] gap-1 shrink-0 shadow-xs"
              >
                <LogOut className="h-3 w-3" />
                Desconectar SUAP
              </Button>
            </div>
          )}

          {/* Seção 2: URL e Sincronização */}
          <div className="grid gap-3 md:grid-cols-12 md:items-end">
            <div className="md:col-span-9 space-y-1.5">
              <label htmlFor="caixa-url" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                URL da Caixa de Processos
              </label>
              <Input
                id="caixa-url"
                value={caixaUrl}
                onChange={(e) => setCaixaUrl(e.target.value)}
                placeholder="https://suap.ifrn.edu.br/processo_eletronico/caixa_processos/..."
                className="text-xs h-9 bg-white"
                disabled={syncStatus === 'running'}
              />
            </div>

            <div className="md:col-span-3">
              <Button 
                onClick={handleStartSync} 
                disabled={syncStatus === 'running' || !suapSessionId}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 gap-1.5 text-xs shadow-sm"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Iniciar Sincronização
              </Button>
            </div>
          </div>

          {/* Alerta de manter aba aberta */}
          {syncStatus === 'running' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 flex gap-3 text-amber-800 text-xs">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="space-y-1">
                <span className="font-bold">Aviso Crítico: Mantenha esta aba aberta!</span>
                <p className="text-amber-700 leading-normal">
                  A geração e download dos PDFs do SUAP é feita de forma assíncrona. Se você fechar esta aba ou navegar para fora do aplicativo, a sincronização será interrompida.
                </p>
              </div>
            </div>
          )}

          {/* Logs estilo Terminal */}
          {(logs.length > 0 || syncStatus === 'running') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5" />
                  Log de Sincronização
                </span>
                {syncStatus === 'running' && (
                  <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Sincronizando...
                  </span>
                )}
              </div>
              
              <div 
                ref={logContainerRef}
                className="h-40 bg-slate-950 text-slate-300 font-mono text-[10px] p-3 rounded-xl border border-slate-800 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-800"
              >
                {logs.length === 0 ? (
                  <span className="text-slate-500 italic font-sans">Aguardando início...</span>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="leading-5 whitespace-pre-wrap">
                      {log.includes('ERRO') || log.includes('FATAL') ? (
                        <span className="text-rose-400">{log}</span>
                      ) : log.includes('Passo') ? (
                        <span className="text-cyan-400">{log}</span>
                      ) : log.includes('OK') || log.includes('concluída') || log.includes('sucesso') ? (
                        <span className="text-emerald-400">{log}</span>
                      ) : (
                        log
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
