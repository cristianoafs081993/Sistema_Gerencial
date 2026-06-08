import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  ClipboardList,
  ExternalLink,
  Plus,
  Printer,
  QrCode,
  Search,
  Trash2,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import { HeaderActions, HeaderSubtitle } from '@/components/HeaderParts';
import { StatCard } from '@/components/StatCard';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  type Ambiente,
  type Checkin,
  manutencaoService,
  type Ocorrencia,
} from '@/services/manutencao';

const formatDateTime = (isoString?: string | null) => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString('pt-BR');
};

const mapAcaoLabel: Record<string, string> = {
  limpeza_padrao: 'Limpeza Padrão',
  reposicao_insumos: 'Reposição de Insumos',
  inspecao: 'Inspeção Sanitária',
  manutencao_corretiva: 'Manutenção Corretiva',
};

const mapAcaoBadge: Record<string, string> = {
  limpeza_padrao: 'border-blue-200 bg-blue-50 text-blue-700',
  reposicao_insumos: 'border-purple-200 bg-purple-50 text-purple-700',
  inspecao: 'border-amber-200 bg-amber-50 text-amber-700',
  manutencao_corretiva: 'border-red-200 bg-red-50 text-red-700',
};

export default function ManutencaoAdmin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('ocorrencias');
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Modals
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);
  const [newRoom, setNewRoom] = useState({
    codigo: '',
    nome: '',
    bloco: '',
    tipo: 'sala' as Ambiente['tipo'],
  });

  const [qrCodeData, setQrCodeData] = useState<{ codigo: string; nome: string } | null>(null);
  const [qrBaseUrl, setQrBaseUrl] = useState(() => {
    return localStorage.getItem('manutencao:qr_base_url') || window.location.origin;
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ambList, ocList, chList] = await Promise.all([
        manutencaoService.getAmbientes(),
        manutencaoService.getOcorrencias(),
        manutencaoService.getCheckins(),
      ]);
      setAmbientes(ambList);
      setOcorrencias(ocList);
      setCheckins(chList);
    } catch (error) {
      console.error('Erro ao carregar dados de manutenção:', error);
      toast.error('Não foi possível carregar as informações do servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoom.codigo || !newRoom.nome) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }

    try {
      await manutencaoService.createAmbiente({
        codigo: newRoom.codigo.toUpperCase().trim().replace(/\s+/g, '-'),
        nome: newRoom.nome.trim(),
        bloco: newRoom.bloco.trim() || null,
        tipo: newRoom.tipo,
        status: 'ativo',
      });
      toast.success('Ambiente cadastrado com sucesso!');
      setIsAddRoomOpen(false);
      setNewRoom({ codigo: '', nome: '', bloco: '', tipo: 'sala' });
      void loadData();
    } catch (error) {
      console.error('Erro ao cadastrar ambiente:', error);
      toast.error('Código do ambiente já existe ou erro no cadastro.');
    }
  };

  const handleDeleteRoom = async (id: string) => {
    if (!confirm('Deseja realmente excluir este ambiente? Todas as ocorrências e check-ins serão apagados.')) return;
    try {
      await manutencaoService.deleteAmbiente(id);
      toast.success('Ambiente excluído.');
      void loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir ambiente.');
    }
  };

  const handleResolveOcorrencia = async (id: string) => {
    try {
      await manutencaoService.resolveOcorrencia(id, user?.id);
      toast.success('Ocorrência resolvida com sucesso!');
      void loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao marcar ocorrência como resolvida.');
    }
  };

  const printQrCode = () => {
    const printContent = document.getElementById('printable-qr-card');
    if (!printContent) return;

    const windowUrl = 'about:blank';
    const uniqueName = new Date().getTime();
    const windowName = `PrintWindow_${uniqueName}`;
    const printWindow = window.open(windowUrl, windowName, 'left=50,top=50,width=800,height=600');

    if (!printWindow) {
      toast.error('Bloqueador de popup ativo. Permita popups para imprimir.');
      return;
    }

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
      qrBaseUrl + '/feedback-ambiente/' + qrCodeData?.codigo
    )}`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir QR Code - ${qrCodeData?.nome}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background-color: #ffffff;
            }
            .qr-card {
              border: 3px solid #0f172a;
              border-radius: 16px;
              padding: 40px;
              text-align: center;
              max-width: 400px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            }
            .logo {
              font-size: 24px;
              font-weight: 800;
              color: #10b981;
              margin-bottom: 5px;
            }
            .title {
              font-size: 18px;
              font-weight: 700;
              color: #1e293b;
              margin-top: 0;
              margin-bottom: 8px;
            }
            .subtitle {
              font-size: 13px;
              color: #64748b;
              margin-bottom: 25px;
              line-height: 1.4;
            }
            .qr-image {
              margin: 15px auto;
              display: block;
              border: 1px solid #e2e8f0;
              padding: 10px;
              border-radius: 8px;
            }
            .room-info {
              margin-top: 20px;
              background: #f1f5f9;
              padding: 12px;
              border-radius: 8px;
              font-family: monospace;
              font-size: 14px;
              font-weight: bold;
              color: #0f172a;
            }
            .footer {
              margin-top: 25px;
              font-size: 11px;
              color: #94a3b8;
            }
            @media print {
              body { background: none; }
              .qr-card { border-width: 3px; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="qr-card">
            <div class="logo">GovAnalytics</div>
            <div class="title">Controle de Limpeza & Manutenção</div>
            <div class="subtitle">Escaneie o QR Code abaixo para relatar problemas ou registrar passagem de limpeza.</div>
            <img class="qr-image" src="${qrCodeUrl}" width="230" height="230" alt="QR Code" />
            <div class="room-info">${qrCodeData?.nome}<br/>[ ${qrCodeData?.codigo} ]</div>
            <div class="footer">IFRN Campus Central</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter calculations
  const filteredOcorrencias = ocorrencias.filter((oc) => {
    const matchesSearch =
      !searchQuery ||
      oc.ambiente?.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      oc.ambiente?.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      oc.observacao?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'todos' ||
      (statusFilter === 'pendente' && oc.status === 'pendente') ||
      (statusFilter === 'resolvido' && oc.status === 'resolvido');

    return matchesSearch && matchesStatus;
  });

  const filteredCheckins = checkins.filter((ch) => {
    return (
      !searchQuery ||
      ch.ambiente?.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ch.ambiente?.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ch.responsavel_nome.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const filteredAmbientes = ambientes.filter((amb) => {
    return (
      !searchQuery ||
      amb.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      amb.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      amb.bloco?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const kpis = {
    totalPendentes: ocorrencias.filter((oc) => oc.status === 'pendente').length,
    limpezasHoje: checkins.filter((ch) => {
      const today = new Date().toDateString();
      return new Date(ch.created_at).toDateString() === today;
    }).length,
    totalSalas: ambientes.length,
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-gradient-dark">Limpeza e Manutenção</h1>
        <HeaderSubtitle>Painel administrativo para controle e inspeção de ambientes via QR Code.</HeaderSubtitle>
      </div>

      <HeaderActions>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsAddRoomOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            Cadastrar Ambiente
          </Button>
        </div>
      </HeaderActions>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Ocorrências Pendentes" value={kpis.totalPendentes} subtitle="Relatadas por usuários aguardando resolução" icon={AlertCircle} stitchColor={kpis.totalPendentes > 0 ? 'red-500' : 'emerald-green'} isLoading={isLoading} />
        <StatCard title="Limpezas Hoje" value={kpis.limpezasHoje} subtitle="Registradas pela equipe de conservação" icon={Check} stitchColor="vibrant-blue" isLoading={isLoading} />
        <StatCard title="Ambientes Monitorados" value={kpis.totalSalas} subtitle="Salas e banheiros com QR Code ativo" icon={Building2} stitchColor="purple" isLoading={isLoading} />
      </div>

      {/* Search and filter header */}
      <FilterPanel title="Filtros e Busca" actions={<Button type="button" variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setStatusFilter('todos'); }}>Limpar</Button>}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Pesquisar por ambiente, código, bloco..." className="h-10 pl-9 input-system" />
          </div>
          {activeTab === 'ocorrencias' && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 input-system">
                <SelectValue placeholder="Filtrar por Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="resolvido">Resolvidos</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </FilterPanel>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-100/80 p-1 border rounded-lg">
          <TabsTrigger value="ocorrencias" className="px-4 py-2 font-medium transition-all rounded-md data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
            Ocorrências ({filteredOcorrencias.length})
          </TabsTrigger>
          <TabsTrigger value="checkins" className="px-4 py-2 font-medium transition-all rounded-md data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
            Histórico de Limpezas ({filteredCheckins.length})
          </TabsTrigger>
          <TabsTrigger value="ambientes" className="px-4 py-2 font-medium transition-all rounded-md data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
            Salas e Ambientes ({filteredAmbientes.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Ocorrencias */}
        <TabsContent value="ocorrencias">
          <DataTablePanel title="Relatos de Problemas" description="Feed de feedbacks recebidos dos usuários em tempo real.">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="w-1/4">Ambiente</TableHead>
                  <TableHead className="w-12">Avaliação</TableHead>
                  <TableHead className="w-1/4">Problemas Relatados</TableHead>
                  <TableHead>Detalhes</TableHead>
                  <TableHead className="w-40">Data de Envio</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-24 text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="h-28 text-center italic text-muted-foreground">Carregando dados...</TableCell></TableRow>
                ) : filteredOcorrencias.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-28 text-center italic text-muted-foreground">Nenhuma ocorrência encontrada.</TableCell></TableRow>
                ) : (
                  filteredOcorrencias.map((oc) => (
                    <TableRow key={oc.id} className={cn('hover:bg-slate-50/50', oc.status === 'pendente' && 'bg-red-50/20')}>
                      <TableCell className="align-top">
                        <div className="font-semibold text-slate-900">{oc.ambiente?.nome}</div>
                        <div className="text-xs font-mono text-slate-500">{oc.ambiente?.codigo}</div>
                      </TableCell>
                      <TableCell className="align-top font-bold text-center">
                        <span className={cn(
                          'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs text-white',
                          oc.avaliacao <= 2 ? 'bg-red-500' : oc.avaliacao === 3 ? 'bg-amber-500' : 'bg-emerald-500'
                        )}>
                          {oc.avaliacao}
                        </span>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-1">
                          {oc.problemas.length > 0 ? (
                            oc.problemas.map((prob) => (
                              <Badge key={prob} variant="secondary" className="bg-slate-100 text-slate-700 capitalize border-none text-[10px]">
                                {prob.replace('_', ' ')}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-emerald-600 font-medium">Tudo certo/Limpo</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-xs text-slate-600 max-w-xs truncate">
                        {oc.observacao || <span className="italic text-slate-400">Sem observações</span>}
                      </TableCell>
                      <TableCell className="align-top text-xs text-slate-500">
                        {formatDateTime(oc.created_at)}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="secondary" className={cn(
                          'text-[10px] border font-medium px-2 py-0.5',
                          oc.status === 'pendente' && 'border-red-200 bg-red-50 text-red-700',
                          oc.status === 'resolvido' && 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        )}>
                          {oc.status === 'pendente' ? 'Pendente' : 'Resolvido'}
                        </Badge>
                        {oc.status === 'resolvido' && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            em {formatDateTime(oc.resolvido_em)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-right">
                        {oc.status === 'pendente' ? (
                          <Button onClick={() => void handleResolveOcorrencia(oc.id)} size="sm" variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-8 px-3">
                            Resolver
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Tratada</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </DataTablePanel>
        </TabsContent>

        {/* Tab 2: Checkins */}
        <TabsContent value="checkins">
          <DataTablePanel title="Diário de Conservação" description="Logs de passagens registrados pelas equipes de limpeza do campus.">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="w-1/4">Ambiente</TableHead>
                  <TableHead className="w-1/4">Responsável</TableHead>
                  <TableHead className="w-1/4">Ação Realizada</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="w-40 text-right">Data/Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="h-28 text-center italic text-muted-foreground">Carregando dados...</TableCell></TableRow>
                ) : filteredCheckins.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-28 text-center italic text-muted-foreground">Nenhum check-in registrado.</TableCell></TableRow>
                ) : (
                  filteredCheckins.map((ch) => (
                    <TableRow key={ch.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="font-semibold text-slate-900">{ch.ambiente?.nome}</div>
                        <div className="text-xs font-mono text-slate-500">{ch.ambiente?.codigo}</div>
                      </TableCell>
                      <TableCell className="font-medium text-slate-800 flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        {ch.responsavel_nome}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn('text-[10px] border font-medium px-2 py-0.5', mapAcaoBadge[ch.acao_realizada])}>
                          {mapAcaoLabel[ch.acao_realizada] || ch.acao_realizada}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 max-w-xs truncate">
                        {ch.observacao || <span className="italic text-slate-400">Nenhuma observação</span>}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 text-right">
                        {formatDateTime(ch.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </DataTablePanel>
        </TabsContent>

        {/* Tab 3: Ambientes */}
        <TabsContent value="ambientes">
          <DataTablePanel title="Ambientes Monitorados" description="Lista de todos os espaços físicos que possuem QR Code de identificação.">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="w-1/4">Código</TableHead>
                  <TableHead className="w-1/4">Nome do Espaço</TableHead>
                  <TableHead className="w-1/6">Bloco</TableHead>
                  <TableHead className="w-1/6">Tipo de Espaço</TableHead>
                  <TableHead className="w-1/6">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="h-28 text-center italic text-muted-foreground">Carregando dados...</TableCell></TableRow>
                ) : filteredAmbientes.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-28 text-center italic text-muted-foreground">Nenhum ambiente encontrado.</TableCell></TableRow>
                ) : (
                  filteredAmbientes.map((amb) => (
                    <TableRow key={amb.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono font-semibold text-slate-700">{amb.codigo}</TableCell>
                      <TableCell className="font-medium text-slate-900">{amb.nome}</TableCell>
                      <TableCell>{amb.bloco || '-'}</TableCell>
                      <TableCell className="capitalize text-slate-600">{amb.tipo}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2 py-0.5">
                          Ativo
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button onClick={() => setQrCodeData({ codigo: amb.codigo, nome: amb.nome })} size="sm" variant="outline" className="h-8 gap-1.5 text-slate-700">
                            <QrCode className="h-3.5 w-3.5" />
                            QR Code
                          </Button>
                          <Button onClick={() => void handleDeleteRoom(amb.id)} size="sm" variant="ghost" className="h-8 text-red-500 hover:text-red-700 hover:bg-red-50 p-2">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </DataTablePanel>
        </TabsContent>
      </Tabs>

      {/* Modal: Add Room */}
      <Dialog open={isAddRoomOpen} onOpenChange={setIsAddRoomOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white rounded-2xl shadow-lifted">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900">Cadastrar Novo Ambiente</DialogTitle>
            <DialogDescription>Crie o cadastro de um espaço do campus para gerar seu QR Code de controle.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreateRoom(e)} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Código Único (ex: SALA-101, BANHEIRO-A)</label>
              <Input required value={newRoom.codigo} onChange={(e) => setNewRoom({ ...newRoom, codigo: e.target.value })} placeholder="SALA-101" className="h-10 input-system" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Nome do Ambiente (ex: Sala de Aula 101)</label>
              <Input required value={newRoom.nome} onChange={(e) => setNewRoom({ ...newRoom, nome: e.target.value })} placeholder="Sala de Aula 101" className="h-10 input-system" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Bloco (ex: Bloco A)</label>
                <Input value={newRoom.bloco} onChange={(e) => setNewRoom({ ...newRoom, bloco: e.target.value })} placeholder="Bloco A" className="h-10 input-system" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Tipo</label>
                <Select value={newRoom.tipo} onValueChange={(value) => setNewRoom({ ...newRoom, tipo: value as Ambiente['tipo'] })}>
                  <SelectTrigger className="h-10 input-system">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sala">Sala de Aula</SelectItem>
                    <SelectItem value="banheiro">Banheiro</SelectItem>
                    <SelectItem value="laboratorio">Laboratório</SelectItem>
                    <SelectItem value="corredor">Corredor/Hall</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsAddRoomOpen(false)} className="h-10">
                Cancelar
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-5 shadow-sm">
                Cadastrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: QR Code Preview & Print */}
      <Dialog open={qrCodeData !== null} onOpenChange={(open) => { if (!open) setQrCodeData(null); }}>
        <DialogContent className="sm:max-w-[450px] bg-white rounded-2xl shadow-lifted">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900">QR Code do Ambiente</DialogTitle>
            <DialogDescription>Imprima a etiqueta e cole na entrada do ambiente correspondente.</DialogDescription>
          </DialogHeader>

          {/* Configuration for phone testing */}
          <div className="space-y-1 my-2">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">URL Base do QR Code (para celular)</label>
            <Input
              value={qrBaseUrl}
              onChange={(e) => {
                const val = e.target.value;
                setQrBaseUrl(val);
                localStorage.setItem('manutencao:qr_base_url', val);
              }}
              placeholder="Ex: http://192.168.1.15:5180"
              className="h-9 text-xs input-system"
            />
            <p className="text-[10px] text-muted-foreground leading-normal mt-1">
              Se for ler com o celular, substitua <strong>localhost</strong> pelo IP da rede do seu computador (ex: <strong>http://10.50.6.5:5180</strong>). Dispositivos na mesma rede Wi-Fi conseguirão carregar a página.
            </p>
          </div>

          {/* QR Card Container */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border rounded-2xl my-2" id="printable-qr-card">
            <div className="text-[#10b981] font-black text-xl tracking-tight mb-0.5">GovAnalytics</div>
            <div className="text-slate-800 font-extrabold text-sm text-center mb-1">Controle de Limpeza e Manutenção</div>
            <div className="text-slate-400 text-[10px] text-center max-w-xs leading-normal mb-4">
              Aponte a câmera do celular para este QR Code para relatar problemas ou registrar limpeza.
            </div>

            {qrCodeData && (
              <div className="bg-white p-3 border rounded-xl shadow-sm mb-4">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                    qrBaseUrl + '/feedback-ambiente/' + qrCodeData.codigo
                  )}`}
                  width="200"
                  height="200"
                  alt="QR Code"
                  className="rounded-lg"
                />
              </div>
            )}

            <div className="w-full bg-slate-200/60 p-3 rounded-xl text-center">
              <div className="text-slate-900 font-extrabold text-sm">{qrCodeData?.nome}</div>
              <div className="text-slate-500 font-mono text-[11px] mt-0.5">{qrCodeData?.codigo}</div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            {qrCodeData && (
              <a
                href={`${qrBaseUrl}/feedback-ambiente/${qrCodeData.codigo}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#10b981] hover:underline font-semibold mr-auto pl-2"
              >
                Testar link público
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <Button type="button" variant="ghost" onClick={() => setQrCodeData(null)} className="h-10">
              Fechar
            </Button>
            <Button onClick={printQrCode} className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-5 gap-2 shadow-sm">
              <Printer className="h-4 w-4" />
              Imprimir Etiqueta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
