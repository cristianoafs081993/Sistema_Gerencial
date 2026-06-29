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
  LogOut,
  Plus,
  Trash2,
  Settings,
  FolderSync
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { suapScraperService, ScrapedProcesso } from '@/services/suapScraperService';
import { supabase } from '@/lib/supabase';

interface SuapSyncPanelProps {
  onSyncComplete?: () => void;
}

interface CaixasSUAP {
  id: string;
  nome: string;
  url: string;
  sync_automatica: boolean;
  last_sync_at?: string;
}

export function SuapSyncPanel({ onSyncComplete }: SuapSyncPanelProps) {
  const { session } = useAuth();
  
  // Credenciais e caixas cadastradas
  const [suapSessionId, setSuapSessionId] = useState<string | null>(null);
  const [suapUser, setSuapUser] = useState('');
  const [suapPass, setSuapPass] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [caixas, setCaixas] = useState<CaixasSUAP[]>([]);
  const [selectedBoxIds, setSelectedBoxIds] = useState<Set<string>>(new Set());
  const [isLoadingCaixas, setIsLoadingCaixas] = useState(false);

  // Form de nova caixa
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newSyncAuto, setNewSyncAuto] = useState(true);
  const [isAddingBox, setIsAddingBox] = useState(false);

  // Auto-sincronização
  const [nextAutoSyncTime, setNextAutoSyncTime] = useState<string>('Aguardando...');
  
  // Status de sync e terminal
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Carregar dados iniciais
  useEffect(() => {
    const savedSession = localStorage.getItem('suap_session_id');
    if (savedSession) {
      setSuapSessionId(savedSession);
    }
  }, []);

  // Buscar caixas do banco sempre que o usuário ou sessão SUAP mudar
  useEffect(() => {
    if (session?.user?.id && suapSessionId) {
      loadUserCaixas();
    }
  }, [session?.user?.id, suapSessionId]);

  // Loop de Sincronização Automática (de hora em hora)
  useEffect(() => {
    if (!suapSessionId || !session?.user?.id || caixas.length === 0) return;

    const checkAndRunAutoSync = async () => {
      const lastSyncStr = localStorage.getItem('suap_last_auto_sync_time');
      const now = Date.now();
      const oneHourMs = 60 * 60 * 1000;
      
      let lastSyncTime = lastSyncStr ? Number(lastSyncStr) : 0;
      const timeRemaining = oneHourMs - (now - lastSyncTime);

      if (timeRemaining <= 0) {
        addLog('Iniciando sincronização automática programada (de hora em hora)...');
        await handleStartSync({ onlyAutoActive: true });
      } else {
        const minutesLeft = Math.ceil(timeRemaining / 60000);
        setNextAutoSyncTime(`em ~${minutesLeft} min`);
      }
    };

    checkAndRunAutoSync();
    const interval = setInterval(checkAndRunAutoSync, 60000); // Checa a cada minuto
    return () => clearInterval(interval);
  }, [suapSessionId, caixas, session?.user?.id]);

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

  const loadUserCaixas = async () => {
    if (!session?.user?.id) return;
    setIsLoadingCaixas(true);
    try {
      const data = await suapScraperService.fetchCaixas(session.user.id);
      setCaixas(data);
      // Selecionar todas por padrão para sync manual
      setSelectedBoxIds(new Set(data.map(b => b.id)));
    } catch (err: any) {
      console.error('Falha ao carregar caixas:', err);
      toast.error('Erro ao obter caixas cadastradas.');
    } finally {
      setIsLoadingCaixas(false);
    }
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
    setCaixas([]);
    toast.success('Sessão do SUAP encerrada.');
  };

  // Auto-descoberta inicial de caixas a partir da página padrão do SUAP
  const handleDiscoverBoxes = async () => {
    if (!suapSessionId || !session?.user?.id) return;
    const loadingToast = toast.loading('Buscando caixas de processos no SUAP...');
    try {
      const rawRes = await supabase.functions.invoke('suap-proxy', {
        body: {
          path: '/processo_eletronico/caixa_processos/',
          method: 'GET',
          suapSessionId
        }
      });

      if (rawRes.data?.text) {
        const detected = suapScraperService.discoverCaixasProcessos(rawRes.data.text);
        let addedCount = 0;
        
        for (const item of detected) {
          const exists = caixas.some(c => c.url.trim() === item.url.trim());
          if (!exists) {
            await suapScraperService.addCaixa(session.user.id, item.nome, item.url, true);
            addedCount++;
          }
        }
        
        if (addedCount > 0) {
          toast.success(`${addedCount} nova(s) caixa(s) adicionada(s) automaticamente!`, { id: loadingToast });
          loadUserCaixas();
        } else {
          toast.info('Nenhuma nova caixa de processos localizada.', { id: loadingToast });
        }
      } else {
        throw new Error(rawRes.error || 'Resposta sem conteúdo.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Falha ao descobrir caixas: ' + err.message, { id: loadingToast });
    }
  };

  const handleAddBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNome || !newUrl) {
      toast.error('Informe o nome e a URL da caixa.');
      return;
    }
    if (!session?.user?.id) return;

    setIsAddingBox(true);
    try {
      await suapScraperService.addCaixa(session.user.id, newNome.trim(), newUrl.trim(), newSyncAuto);
      toast.success('Caixa cadastrada com sucesso!');
      setNewNome('');
      setNewUrl('');
      setShowAddForm(false);
      loadUserCaixas();
    } catch (err: any) {
      toast.error(err.message || 'Falha ao cadastrar caixa.');
    } finally {
      setIsAddingBox(false);
    }
  };

  const handleDeleteBox = async (id: string) => {
    if (!session?.user?.id) return;
    try {
      await suapScraperService.deleteCaixa(id, session.user.id);
      toast.success('Caixa de processos excluída.');
      loadUserCaixas();
    } catch (err: any) {
      toast.error('Falha ao excluir caixa.');
    }
  };

  const handleToggleSyncAuto = async (id: string, currentVal: boolean) => {
    if (!session?.user?.id) return;
    try {
      await suapScraperService.toggleSyncAutomatica(id, session.user.id, !currentVal);
      setCaixas(prev => prev.map(c => c.id === id ? { ...c, sync_automatica: !currentVal } : c));
      toast.success('Configuração de sincronização automática salva.');
    } catch (err: any) {
      toast.error('Erro ao atualizar configuração.');
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedBoxIds.size === caixas.length) {
      setSelectedBoxIds(new Set());
    } else {
      setSelectedBoxIds(new Set(caixas.map(b => b.id)));
    }
  };

  const handleToggleSelectBox = (id: string) => {
    const next = new Set(selectedBoxIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedBoxIds(next);
  };

  // Sincronização Geral
  const handleStartSync = async (options?: { onlyAutoActive?: boolean }) => {
    if (!suapSessionId) {
      toast.error('Sessão do SUAP não conectada.');
      return;
    }

    if (!session?.user?.id) {
      toast.error('Usuário não logado no Sistema.');
      return;
    }

    // Filtrar caixas a serem sincronizadas
    const boxesToSync = caixas.filter(b => {
      if (options?.onlyAutoActive) {
        return b.sync_automatica;
      }
      return selectedBoxIds.has(b.id);
    });

    if (boxesToSync.length === 0) {
      if (!options?.onlyAutoActive) {
        toast.warning('Selecione pelo menos uma caixa de processos para sincronizar.');
      }
      return;
    }

    setSyncStatus('running');
    setIsCollapsed(false);
    setLogs([]);
    addLog(`Iniciando sincronização nativa de ${boxesToSync.length} caixa(s)...`);

    try {
      const allScrapedProcesses: ScrapedProcesso[] = [];

      // 1. Scraping de todas as caixas
      for (const box of boxesToSync) {
        addLog(`[Caixa: ${box.nome}] Lendo processos de: ${box.url}`);
        try {
          const scraped = await suapScraperService.fetchAndScrapeCaixa(box.url, suapSessionId);
          addLog(`[Caixa: ${box.nome}] ${scraped.length} processo(s) encontrado(s).`);
          allScrapedProcesses.push(...scraped);
          
          // Registrar última sync bem sucedida para esta caixa
          await suapScraperService.updateLastSyncTime(box.id, session.user.id);
        } catch (boxErr: any) {
          addLog(`[Caixa: ${box.nome}] FALHA: ${boxErr.message}`);
          console.error(boxErr);
        }
      }

      // 2. Desduplicação inteligente dos processos
      const uniqueProcessesMap = new Map<string, ScrapedProcesso>();
      for (const proc of allScrapedProcesses) {
        uniqueProcessesMap.set(proc.suapId, proc);
      }
      const uniqueProcesses = Array.from(uniqueProcessesMap.values());
      addLog(`Consolidação completa: ${allScrapedProcesses.length} total, desduplicado para ${uniqueProcesses.length} únicos.`);

      if (uniqueProcesses.length === 0) {
        throw new Error('Nenhum processo foi localizado em nenhuma das caixas selecionadas.');
      }

      // 3. Sincronização básica no banco de dados
      addLog('Atualizando inventário de processos no Supabase...');
      const syncedProcesses = await suapScraperService.syncProcessListInSupabase(uniqueProcesses, session.user.id);
      addLog(`Inventário atualizado. Persistidos ${syncedProcesses.length} processo(s).`);

      let completed = 0;
      let skipped = 0;
      let errors = 0;

      // 4. Download do PDF e IA apenas para os novos
      for (let i = 0; i < syncedProcesses.length; i++) {
        const proc = syncedProcesses[i];
        const displayId = proc.numProcesso || proc.suapId;

        addLog(`--- Sincronizando ${i + 1}/${syncedProcesses.length}: ${displayId} ---`);

        try {
          if (proc.already_exists) {
            addLog(`[${displayId}] Processo já extraído com sucesso no banco. Pulando download para poupar recursos.`);
            skipped++;
            continue;
          }

          // Obter número formatado se necessário
          if (!proc.numProcesso) {
            const num = await suapScraperService.enrichProcessNumber(proc, suapSessionId, addLog);
            if (num) proc.numProcesso = num;
          }

          // Executar download nativo e IA
          await suapScraperService.processAndSyncSingle(proc, suapSessionId, session.user.id, addLog);
          completed++;
        } catch (procErr: any) {
          addLog(`[${displayId}] ERRO: ${procErr.message}`);
          console.error(procErr);
          
          if (procErr.message?.includes('Sessão expirada') || procErr.message?.includes('não autenticada')) {
            handleDisconnect();
            throw procErr;
          }
          errors++;
        }
      }

      // 5. Finalizar
      addLog('======================================');
      addLog(`Sincronização concluída: ${completed} novos, ${skipped} pulados/otimizados, ${errors} erros.`);
      setSyncStatus(errors === 0 ? 'success' : 'error');
      
      // Salvar timestamp da sync automática
      localStorage.setItem('suap_last_auto_sync_time', String(Date.now()));
      
      if (errors === 0) {
        toast.success('Sincronização concluída com sucesso!');
      } else {
        toast.warning(`Sincronização concluída com ${errors} falhas parciais.`);
      }

      // Recarregar caixas para atualizar last_sync_at
      loadUserCaixas();

      if (onSyncComplete) {
        onSyncComplete();
      }

    } catch (err: any) {
      addLog(`FATAL: ${err.message}`);
      console.error(err);
      setSyncStatus('error');
      toast.error(`Sincronização abortada: ${err.message}`);
    }
  };

  return (
    <Card className="border-border-default/70 bg-surface-card shadow-soft overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-3 pointer-events-none select-none">
        <div className="space-y-1">
          <CardTitle className="font-ui text-md flex items-center gap-2 text-text-primary">
            <FolderSync className={`h-5 w-5 text-emerald-600 ${syncStatus === 'running' ? 'animate-spin' : ''}`} />
            Importador Nativo de Processos (SUAP)
          </CardTitle>
          <CardDescription className="text-xs text-text-secondary">
            Gerencie caixas de processos e sincronize de forma manual ou automática (de hora em hora).
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
              <div className="md:col-span-12 font-ui text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <KeyRound className="h-4 w-4 text-emerald-600" />
                CONEXÃO INSTITUCIONAL DO SUAP
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
                <span className="text-[10px] text-slate-500 font-normal">
                  (Sync automática: <strong className="text-emerald-700">{nextAutoSyncTime}</strong>)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDiscoverBoxes}
                  disabled={syncStatus === 'running'}
                  className="h-8 border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-700 text-[11px] font-semibold shadow-xs"
                >
                  Auto-descobrir Caixas
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={syncStatus === 'running'}
                  className="h-8 border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-[11px] gap-1 shrink-0 shadow-xs"
                >
                  <LogOut className="h-3 w-3" />
                  Desconectar
                </Button>
              </div>
            </div>
          )}

          {/* Seção 2: Gerenciador de Caixas de Processo */}
          {suapSessionId && (
            <div className="space-y-2 border border-slate-100 rounded-xl p-3 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Settings className="h-4 w-4 text-slate-500" />
                  CAIXAS DE PROCESSOS CADASTRADAS
                </span>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="h-7 text-xs text-emerald-700 hover:text-emerald-800 font-semibold gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Cadastrar Caixa
                </Button>
              </div>

              {/* Form Cadastro Inline */}
              {showAddForm && (
                <form onSubmit={handleAddBox} className="grid gap-3 p-3 bg-slate-50 border border-slate-200/50 rounded-lg md:grid-cols-12 md:items-end">
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nome Amigável</label>
                    <Input
                      value={newNome}
                      onChange={(e) => setNewNome(e.target.value)}
                      placeholder="Ex: Minha Caixa de Entrada"
                      className="text-xs h-8 bg-white"
                      required
                    />
                  </div>
                  <div className="md:col-span-5 space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Endereço (URL do SUAP)</label>
                    <Input
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="https://suap.ifrn.edu.br/processo_eletronico/..."
                      className="text-xs h-8 bg-white"
                      required
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2 pb-2 justify-center">
                    <Switch
                      id="new-sync-auto"
                      checked={newSyncAuto}
                      onCheckedChange={setNewSyncAuto}
                    />
                    <label htmlFor="new-sync-auto" className="text-[11px] font-semibold text-slate-600">Sync auto (1h)</label>
                  </div>
                  <div className="md:col-span-1">
                    <Button
                      type="submit"
                      disabled={isAddingBox}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-xs shadow-xs"
                    >
                      Salvar
                    </Button>
                  </div>
                </form>
              )}

              {/* Grid / Tabela de Caixas */}
              {isLoadingCaixas ? (
                <div className="text-center py-6 text-xs text-slate-400 flex items-center justify-center gap-1.5">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Carregando caixas...
                </div>
              ) : caixas.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg text-xs text-slate-400">
                  Nenhuma caixa de processos cadastrada. 
                  <span onClick={handleDiscoverBoxes} className="text-emerald-600 font-bold hover:underline cursor-pointer block mt-1">
                    [Clique aqui para auto-descobrir no SUAP]
                  </span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs text-slate-600">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="p-2 w-8 text-center">
                          <input
                            type="checkbox"
                            checked={selectedBoxIds.size === caixas.length}
                            onChange={handleToggleSelectAll}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4"
                          />
                        </th>
                        <th className="p-2 font-bold text-slate-600">Nome</th>
                        <th className="p-2 font-bold text-slate-600 hidden md:table-cell">Endereço (URL)</th>
                        <th className="p-2 font-bold text-slate-600 text-center w-36">Sync Automática</th>
                        <th className="p-2 font-bold text-slate-600 text-center w-28">Última Sync</th>
                        <th className="p-2 w-10 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {caixas.map((box) => (
                        <tr key={box.id} className="border-b border-slate-100 hover:bg-slate-50/40">
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedBoxIds.has(box.id)}
                              onChange={() => handleToggleSelectBox(box.id)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4"
                            />
                          </td>
                          <td className="p-2 font-semibold text-slate-800">
                            {box.nome}
                          </td>
                          <td className="p-2 text-slate-500 hidden md:table-cell truncate max-w-xs">
                            <a href={box.url} target="_blank" rel="noreferrer" className="hover:underline hover:text-emerald-700">
                              {box.url}
                            </a>
                          </td>
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center">
                              <Switch
                                checked={box.sync_automatica}
                                onCheckedChange={() => handleToggleSyncAuto(box.id, box.sync_automatica)}
                              />
                            </div>
                          </td>
                          <td className="p-2 text-center text-slate-400 text-[11px]">
                            {box.last_sync_at ? new Date(box.last_sync_at).toLocaleTimeString() : 'Nunca'}
                          </td>
                          <td className="p-2 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteBox(box.id)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Seção 3: Executar Sincronização Manual */}
          {suapSessionId && caixas.length > 0 && (
            <div className="flex justify-end gap-3">
              <Button 
                onClick={() => handleStartSync()} 
                disabled={syncStatus === 'running' || selectedBoxIds.size === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 gap-1.5 text-xs shadow-sm px-6"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Sincronizar Caixas Selecionadas ({selectedBoxIds.size})
              </Button>
            </div>
          )}

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
                className="h-44 bg-slate-950 text-slate-300 font-mono text-[10px] p-3 rounded-xl border border-slate-800 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-800"
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
                      ) : log.includes('OK') || log.includes('concluída') || log.includes('sucesso') || log.includes('otimizados') ? (
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
