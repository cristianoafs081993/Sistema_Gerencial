import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  Car,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  AlertTriangle,
  UserCheck,
  UserX,
  Phone,
  Trash2,
  Edit2,
  FileText,
  Building,
} from 'lucide-react';
import { toast } from 'sonner';

import { HeaderActions, HeaderSubtitle } from '@/components/HeaderParts';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { StatCard } from '@/components/StatCard';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import {
  portariaEventosService,
  type PortariaEvento,
  type PortariaParticipante,
  type CreateEventoPayload,
  type PortariaEventoTipo,
  type PortariaEventoStatus,
} from '@/services/portariaEventosService';

type DateFilterOption = 'hoje' | 'amanha' | 'semana' | 'todos';

const tipoLabels: Record<PortariaEventoTipo, string> = {
  academico: 'Acadêmico',
  cultural: 'Cultural',
  esportivo: 'Esportivo',
  reuniao: 'Reunião',
  palestra: 'Palestra',
  externo: 'Comunidade Externa',
  outro: 'Outro',
};

const statusLabels: Record<PortariaEventoStatus, { label: string; variant: 'default' | 'outline' | 'secondary' | 'destructive' }> = {
  confirmado: { label: 'Confirmado', variant: 'default' },
  em_andamento: { label: 'Em Andamento', variant: 'secondary' },
  concluido: { label: 'Concluído', variant: 'outline' },
  cancelado: { label: 'Cancelado', variant: 'destructive' },
};

function formatHorario(isoString: string) {
  try {
    const d = new Date(isoString);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} às ${hora}:${min}`;
  } catch {
    return isoString;
  }
}

function formatHoraSimples(isoString: string) {
  try {
    const d = new Date(isoString);
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${hora}:${min}`;
  } catch {
    return '';
  }
}

export default function PortariaEventos() {
  const { userCampus } = useAuth();
  const campusUasg = userCampus?.codigo || '158366';

  const [eventos, setEventos] = useState<PortariaEvento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('todos');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Modal Participantes
  const [selectedEvento, setSelectedEvento] = useState<PortariaEvento | null>(null);
  const [participantes, setParticipantes] = useState<PortariaParticipante[]>([]);
  const [isParticipantesModalOpen, setIsParticipantesModalOpen] = useState(false);
  const [isLoadingParticipantes, setIsLoadingParticipantes] = useState(false);
  const [searchParticipante, setSearchParticipante] = useState('');
  const [tabPresenca, setTabPresenca] = useState<'todos' | 'presentes' | 'ausentes'>('todos');

  // Novo participante form
  const [nomeNovoPart, setNomeNovoPart] = useState('');
  const [docNovoPart, setDocNovoPart] = useState('');
  const [instNovoPart, setInstNovoPart] = useState('');
  const [tipoNovoPart, setTipoNovoPart] = useState<'participante' | 'palestrante' | 'organizador' | 'autoridade' | 'convidado'>('participante');
  const [placaNovoPart, setPlacaNovoPart] = useState('');
  const [obsNovoPart, setObsNovoPart] = useState('');
  const [batchNomes, setBatchNomes] = useState('');
  const [isAddingBatch, setIsAddingBatch] = useState(false);

  // Modal Novo/Editar Evento
  const [isEventoDialogOpen, setIsEventoDialogOpen] = useState(false);
  const [editingEventoId, setEditingEventoId] = useState<string | null>(null);
  const [eventoForm, setEventoForm] = useState<CreateEventoPayload>({
    titulo: '',
    descricao: '',
    local: '',
    data_inicio: '',
    data_fim: '',
    responsavel_nome: '',
    responsavel_contato: '',
    tipo: 'academico',
    status: 'confirmado',
    observacoes_portaria: '',
  });
  const [isSubmittingEvento, setIsSubmittingEvento] = useState(false);

  // Carregar Eventos
  const loadEventos = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await portariaEventosService.listEventos(campusUasg);
      setEventos(data);
    } catch (error) {
      console.error('Erro ao carregar eventos da portaria:', error);
      toast.error('Não foi possível carregar os eventos da portaria.');
    } finally {
      setIsLoading(false);
    }
  }, [campusUasg]);

  useEffect(() => {
    loadEventos();
  }, [loadEventos]);

  // Carregar Participantes do evento selecionado
  const loadParticipantes = async (eventoId: string) => {
    setIsLoadingParticipantes(true);
    try {
      const data = await portariaEventosService.listParticipantes(eventoId);
      setParticipantes(data);
    } catch (error) {
      console.error('Erro ao carregar participantes:', error);
      toast.error('Erro ao carregar lista de participantes.');
    } finally {
      setIsLoadingParticipantes(false);
    }
  };

  const handleOpenParticipantes = (evento: PortariaEvento) => {
    setSelectedEvento(evento);
    setSearchParticipante('');
    setTabPresenca('todos');
    setIsParticipantesModalOpen(true);
    loadParticipantes(evento.id);
  };

  // Toggle de presença
  const handleTogglePresenca = async (participante: PortariaParticipante) => {
    const nextState = !participante.presente;
    // Otimista
    setParticipantes((prev) =>
      prev.map((p) =>
        p.id === participante.id
          ? {
              ...p,
              presente: nextState,
              horario_entrada: nextState ? new Date().toISOString() : null,
            }
          : p
      )
    );

    try {
      await portariaEventosService.togglePresenca(participante.id, nextState);
      toast.success(
        nextState
          ? `Entrada registrada para ${participante.nome}`
          : `Presença desmarcada para ${participante.nome}`
      );
      loadEventos();
    } catch (error) {
      toast.error('Erro ao atualizar presença.');
      if (selectedEvento) loadParticipantes(selectedEvento.id);
    }
  };

  // Adicionar participante individual
  const handleAddParticipante = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvento || !nomeNovoPart.trim()) {
      toast.error('Informe o nome do participante.');
      return;
    }

    try {
      await portariaEventosService.createParticipante({
        evento_id: selectedEvento.id,
        nome: nomeNovoPart,
        documento: docNovoPart || null,
        instituicao: instNovoPart || null,
        tipo: tipoNovoPart,
        veiculo_placa: placaNovoPart || null,
        observacao: obsNovoPart || null,
      });

      toast.success('Participante cadastrado com sucesso!');
      setNomeNovoPart('');
      setDocNovoPart('');
      setInstNovoPart('');
      setPlacaNovoPart('');
      setObsNovoPart('');
      loadParticipantes(selectedEvento.id);
      loadEventos();
    } catch (error) {
      toast.error('Erro ao cadastrar participante.');
    }
  };

  // Adicionar em lote
  const handleAddBatch = async () => {
    if (!selectedEvento || !batchNomes.trim()) {
      toast.error('Cole pelo menos um nome para adicionar.');
      return;
    }

    const lines = batchNomes
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const items = lines.map((line) => {
      // Suporta formato: "Nome; Documento; Instituição; Placa" ou apenas "Nome"
      const parts = line.split(';').map((p) => p.trim());
      return {
        nome: parts[0],
        documento: parts[1] || null,
        instituicao: parts[2] || null,
        veiculo_placa: parts[3] || null,
      };
    });

    try {
      const count = await portariaEventosService.batchCreateParticipantes(selectedEvento.id, items);
      toast.success(`${count} participantes adicionados com sucesso!`);
      setBatchNomes('');
      setIsAddingBatch(false);
      loadParticipantes(selectedEvento.id);
      loadEventos();
    } catch (error) {
      toast.error('Erro ao cadastrar lote de participantes.');
    }
  };

  // Excluir participante
  const handleDeleteParticipante = async (id: string) => {
    if (!confirm('Deseja realmente remover este participante?')) return;
    try {
      await portariaEventosService.deleteParticipante(id);
      setParticipantes((prev) => prev.filter((p) => p.id !== id));
      toast.success('Participante removido.');
      loadEventos();
    } catch (error) {
      toast.error('Erro ao remover participante.');
    }
  };

  // Salvar Evento (Criar ou Editar)
  const handleSaveEvento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventoForm.titulo || !eventoForm.local || !eventoForm.data_inicio) {
      toast.error('Preencha título, local e data de início.');
      return;
    }

    setIsSubmittingEvento(true);
    try {
      if (editingEventoId) {
        await portariaEventosService.updateEvento(editingEventoId, eventoForm);
        toast.success('Evento atualizado com sucesso!');
      } else {
        await portariaEventosService.createEvento({
          ...eventoForm,
          campus_uasg: campusUasg,
        });
        toast.success('Evento cadastrado com sucesso!');
      }
      setIsEventoDialogOpen(false);
      setEditingEventoId(null);
      loadEventos();
    } catch (error) {
      toast.error('Erro ao salvar evento.');
    } finally {
      setIsSubmittingEvento(false);
    }
  };

  const handleOpenEditEvento = (evento: PortariaEvento) => {
    setEditingEventoId(evento.id);
    setEventoForm({
      titulo: evento.titulo,
      descricao: evento.descricao || '',
      local: evento.local,
      data_inicio: evento.data_inicio ? evento.data_inicio.slice(0, 16) : '',
      data_fim: evento.data_fim ? evento.data_fim.slice(0, 16) : '',
      responsavel_nome: evento.responsavel_nome || '',
      responsavel_contato: evento.responsavel_contato || '',
      tipo: evento.tipo,
      status: evento.status,
      observacoes_portaria: evento.observacoes_portaria || '',
    });
    setIsEventoDialogOpen(true);
  };

  const handleDeleteEvento = async (id: string) => {
    if (!confirm('Deseja realmente excluir este evento e sua lista de participantes?')) return;
    try {
      await portariaEventosService.deleteEvento(id);
      toast.success('Evento excluído.');
      loadEventos();
    } catch (error) {
      toast.error('Erro ao excluir evento.');
    }
  };

  // Filtragem de Eventos
  const filteredEventos = useMemo(() => {
    const q = search.trim().toLowerCase();
    const hoje = new Date();
    const hojeDay = hoje.getDate();
    const hojeMonth = hoje.getMonth();
    const hojeYear = hoje.getFullYear();

    return eventos.filter((evento) => {
      // Busca texto
      const matchesSearch =
        !q ||
        evento.titulo.toLowerCase().includes(q) ||
        evento.local.toLowerCase().includes(q) ||
        (evento.responsavel_nome && evento.responsavel_nome.toLowerCase().includes(q)) ||
        (evento.observacoes_portaria && evento.observacoes_portaria.toLowerCase().includes(q));

      // Filtro de Data
      let matchesDate = true;
      try {
        const d = new Date(evento.data_inicio);
        if (dateFilter === 'hoje') {
          matchesDate =
            d.getDate() === hojeDay && d.getMonth() === hojeMonth && d.getFullYear() === hojeYear;
        } else if (dateFilter === 'amanha') {
          const amanha = new Date(hojeYear, hojeMonth, hojeDay + 1);
          matchesDate =
            d.getDate() === amanha.getDate() &&
            d.getMonth() === amanha.getMonth() &&
            d.getFullYear() === amanha.getFullYear();
        } else if (dateFilter === 'semana') {
          const fimSemana = new Date(hojeYear, hojeMonth, hojeDay + 7);
          matchesDate = d >= hoje && d <= fimSemana;
        }
      } catch {
        matchesDate = true;
      }

      // Filtro de Tipo
      const matchesTipo = tipoFilter === 'todos' || evento.tipo === tipoFilter;

      // Filtro de Status
      const matchesStatus = statusFilter === 'todos' || evento.status === statusFilter;

      return matchesSearch && matchesDate && matchesTipo && matchesStatus;
    });
  }, [eventos, search, dateFilter, tipoFilter, statusFilter]);

  // Estatísticas Rápidas
  const stats = useMemo(() => {
    const hoje = new Date();
    const hojeDay = hoje.getDate();
    const hojeMonth = hoje.getMonth();
    const hojeYear = hoje.getFullYear();

    const eventosHoje = eventos.filter((e) => {
      try {
        const d = new Date(e.data_inicio);
        return d.getDate() === hojeDay && d.getMonth() === hojeMonth && d.getFullYear() === hojeYear;
      } catch {
        return false;
      }
    });

    const totalParticipantes = eventos.reduce((acc, e) => acc + (e.total_participantes || 0), 0);
    const totalPresentes = eventos.reduce((acc, e) => acc + (e.total_presentes || 0), 0);
    const pctPresenca =
      totalParticipantes > 0 ? Math.round((totalPresentes / totalParticipantes) * 100) : 0;

    return {
      eventosHojeCount: eventosHoje.length,
      totalEventos: eventos.length,
      totalParticipantes,
      totalPresentes,
      pctPresenca,
    };
  }, [eventos]);

  // Filtragem interna de participantes no modal
  const filteredParticipantes = useMemo(() => {
    const q = searchParticipante.trim().toLowerCase();
    return participantes.filter((p) => {
      const matchesText =
        !q ||
        p.nome.toLowerCase().includes(q) ||
        (p.documento && p.documento.toLowerCase().includes(q)) ||
        (p.instituicao && p.instituicao.toLowerCase().includes(q)) ||
        (p.veiculo_placa && p.veiculo_placa.toLowerCase().includes(q));

      let matchesTab = true;
      if (tabPresenca === 'presentes') matchesTab = p.presente;
      if (tabPresenca === 'ausentes') matchesTab = !p.presente;

      return matchesText && matchesTab;
    });
  }, [participantes, searchParticipante, tabPresenca]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Building className="h-7 w-7 text-primary" />
            Portaria e Eventos
          </h1>
          <HeaderSubtitle>
            Acompanhamento diário de eventos e participantes para a equipe de portaria e segurança do campus.
          </HeaderSubtitle>
        </div>

        <HeaderActions>
          <Button variant="outline" size="sm" onClick={() => loadEventos()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingEventoId(null);
              setEventoForm({
                titulo: '',
                descricao: '',
                local: '',
                data_inicio: new Date().toISOString().slice(0, 16),
                data_fim: '',
                responsavel_nome: '',
                responsavel_contato: '',
                tipo: 'academico',
                status: 'confirmado',
                observacoes_portaria: '',
              });
              setIsEventoDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Novo Evento
          </Button>
        </HeaderActions>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Eventos Hoje"
          value={stats.eventosHojeCount}
          description="Agendados para o dia de hoje"
          icon={<CalendarDays className="h-5 w-5 text-primary" />}
        />
        <StatCard
          title="Total de Eventos"
          value={stats.totalEventos}
          description="Cadastrados no sistema"
          icon={<Building className="h-5 w-5 text-blue-600" />}
        />
        <StatCard
          title="Participantes Esperados"
          value={stats.totalParticipantes}
          description="Inscritos em eventos"
          icon={<Users className="h-5 w-5 text-purple-600" />}
        />
        <StatCard
          title="Presenças Registradas"
          value={`${stats.totalPresentes} (${stats.pctPresenca}%)`}
          description="Entradas confirmadas na portaria"
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
        />
      </div>

      {/* Filter Panel */}
      <FilterPanel title="Filtros de Eventos">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Evento, local ou organizador..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Período</Label>
            <Select
              value={dateFilter}
              onValueChange={(val) => setDateFilter(val as DateFilterOption)}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Eventos</SelectItem>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="amanha">Amanhã</SelectItem>
                <SelectItem value="semana">Esta Semana</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Tipo de evento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                <SelectItem value="academico">Acadêmico</SelectItem>
                <SelectItem value="cultural">Cultural</SelectItem>
                <SelectItem value="esportivo">Esportivo</SelectItem>
                <SelectItem value="reuniao">Reunião</SelectItem>
                <SelectItem value="palestra">Palestra</SelectItem>
                <SelectItem value="externo">Comunidade Externa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </FilterPanel>

      {/* Events Table Panel */}
      <DataTablePanel
        title={`Eventos Agendados (${filteredEventos.length})`}
        description="Eventos que requerem controle de acesso ou orientação na portaria."
      >
        {filteredEventos.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <CalendarDays className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-2 text-base font-semibold text-slate-700">Nenhum evento encontrado</p>
            <p className="text-sm text-slate-500">
              Não há eventos cadastrados que atendam aos filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Data & Horário</TableHead>
                  <TableHead>Evento & Local</TableHead>
                  <TableHead>Organizador</TableHead>
                  <TableHead>Instruções Portaria</TableHead>
                  <TableHead className="text-center">Participantes</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEventos.map((evento) => {
                  const statusInfo = statusLabels[evento.status] || {
                    label: evento.status,
                    variant: 'outline',
                  };
                  const pct =
                    evento.total_participantes && evento.total_participantes > 0
                      ? Math.round(
                          ((evento.total_presentes || 0) / evento.total_participantes) * 100
                        )
                      : 0;

                  return (
                    <TableRow key={evento.id} className="hover:bg-slate-50/80">
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <span className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-slate-500" />
                            {formatHorario(evento.data_inicio)}
                          </span>
                          {evento.data_fim && (
                            <span className="text-[11px] text-slate-500 block">
                              até {formatHoraSimples(evento.data_fim)}
                            </span>
                          )}
                          <Badge variant={statusInfo.variant} className="text-[10px] mt-1">
                            {statusInfo.label}
                          </Badge>
                        </div>
                      </TableCell>

                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-900 text-sm">{evento.titulo}</p>
                          <div className="flex items-center gap-2 text-xs text-primary font-medium">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            {evento.local}
                          </div>
                          {evento.descricao && (
                            <p className="text-xs text-slate-500 line-clamp-2">{evento.descricao}</p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="align-top">
                        <div className="text-xs space-y-1">
                          {evento.responsavel_nome ? (
                            <p className="font-medium text-slate-800">{evento.responsavel_nome}</p>
                          ) : (
                            <span className="text-slate-400 italic">Não informado</span>
                          )}
                          {evento.responsavel_contato && (
                            <p className="text-slate-500 flex items-center gap-1 text-[11px]">
                              <Phone className="h-3 w-3" />
                              {evento.responsavel_contato}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="align-top">
                        {evento.observacoes_portaria ? (
                          <div className="flex items-start gap-1.5 rounded-md bg-amber-50 p-2 text-xs text-amber-800 border border-amber-200/80">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                            <span className="leading-tight">{evento.observacoes_portaria}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Sem observações</span>
                        )}
                      </TableCell>

                      <TableCell className="align-top text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="text-xs font-semibold text-slate-800">
                            {evento.total_presentes || 0} / {evento.total_participantes || 0}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            ({pct}% presentes)
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="align-top text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 text-xs font-medium"
                            onClick={() => handleOpenParticipantes(evento)}
                          >
                            <Users className="h-3.5 w-3.5 mr-1" />
                            Participantes
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-slate-600"
                            onClick={() => handleOpenEditEvento(evento)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteEvento(evento.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DataTablePanel>

      {/* Modal de Gestão de Participantes */}
      <Dialog open={isParticipantesModalOpen} onOpenChange={setIsParticipantesModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Lista de Participantes — {selectedEvento?.titulo}
            </DialogTitle>
            <DialogDescription>
              Local: <strong>{selectedEvento?.local}</strong> • Horário:{' '}
              {selectedEvento && formatHorario(selectedEvento.data_inicio)}
            </DialogDescription>
          </DialogHeader>

          {/* Subheader com Filtros e Ações */}
          <div className="space-y-4 my-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por nome, documento ou placa..."
                  value={searchParticipante}
                  onChange={(e) => setSearchParticipante(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <Tabs
                  value={tabPresenca}
                  onValueChange={(val) => setTabPresenca(val as any)}
                >
                  <TabsList className="h-8">
                    <TabsTrigger value="todos" className="text-xs">
                      Todos ({participantes.length})
                    </TabsTrigger>
                    <TabsTrigger value="presentes" className="text-xs">
                      Presentes ({participantes.filter((p) => p.presente).length})
                    </TabsTrigger>
                    <TabsTrigger value="ausentes" className="text-xs">
                      Ausentes ({participantes.filter((p) => !p.presente).length})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAddingBatch(!isAddingBatch)}
                  className="text-xs"
                >
                  {isAddingBatch ? 'Fechar Lote' : 'Colar Lista (Lote)'}
                </Button>
              </div>
            </div>

            {/* Inserção em lote */}
            {isAddingBatch && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <Label className="text-xs font-semibold">
                  Colar lista de nomes (um participante por linha):
                </Label>
                <Textarea
                  placeholder="Maria Silva; 045.123.789-00; IFRN; ABC-1234&#10;João Santos&#10;Dra. Ana Souza; 1.234.567; UFRN"
                  value={batchNomes}
                  onChange={(e) => setBatchNomes(e.target.value)}
                  rows={4}
                  className="text-xs"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setBatchNomes('');
                      setIsAddingBatch(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleAddBatch}>
                    Salvar Participantes
                  </Button>
                </div>
              </div>
            )}

            {/* Cadastro individual rápido */}
            <form
              onSubmit={handleAddParticipante}
              className="grid grid-cols-1 gap-2 sm:grid-cols-6 rounded-lg border border-slate-100 bg-slate-50/50 p-3 items-end"
            >
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-[11px]">Nome Completo *</Label>
                <Input
                  placeholder="Nome do participante"
                  value={nomeNovoPart}
                  onChange={(e) => setNomeNovoPart(e.target.value)}
                  className="h-8 text-xs bg-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Documento / RG</Label>
                <Input
                  placeholder="CPF ou RG"
                  value={docNovoPart}
                  onChange={(e) => setDocNovoPart(e.target.value)}
                  className="h-8 text-xs bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Instituição</Label>
                <Input
                  placeholder="Ex: IFRN, UFRN"
                  value={instNovoPart}
                  onChange={(e) => setInstNovoPart(e.target.value)}
                  className="h-8 text-xs bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Placa Veículo</Label>
                <Input
                  placeholder="Ex: ABC-1D23"
                  value={placaNovoPart}
                  onChange={(e) => setPlacaNovoPart(e.target.value)}
                  className="h-8 text-xs bg-white"
                />
              </div>

              <div>
                <Button type="submit" size="sm" className="w-full h-8 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar
                </Button>
              </div>
            </form>

            {/* Tabela de Participantes */}
            <div className="rounded-md border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participante</TableHead>
                    <TableHead>Instituição / Tipo</TableHead>
                    <TableHead>Veículo / Placa</TableHead>
                    <TableHead>Status de Entrada</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingParticipantes ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                        Carregando participantes...
                      </TableCell>
                    </TableRow>
                  ) : filteredParticipantes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                        Nenhum participante encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredParticipantes.map((part) => (
                      <TableRow
                        key={part.id}
                        className={part.presente ? 'bg-emerald-50/40' : undefined}
                      >
                        <TableCell>
                          <div>
                            <p className="font-semibold text-slate-900 text-xs">{part.nome}</p>
                            {part.documento && (
                              <p className="text-[11px] text-slate-500">Doc: {part.documento}</p>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {part.tipo}
                            </Badge>
                            {part.instituicao && (
                              <p className="text-[11px] text-slate-600">{part.instituicao}</p>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          {part.veiculo_placa ? (
                            <span className="inline-flex items-center gap-1 font-mono text-xs font-bold px-2 py-0.5 rounded border border-slate-300 bg-white text-slate-800">
                              <Car className="h-3 w-3 text-slate-500" />
                              {part.veiculo_placa}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs italic">—</span>
                          )}
                        </TableCell>

                        <TableCell>
                          {part.presente ? (
                            <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Presente</span>
                              {part.horario_entrada && (
                                <span className="text-[10px] text-slate-500 font-normal">
                                  ({formatHoraSimples(part.horario_entrada)})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">Pendente</span>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant={part.presente ? 'outline' : 'default'}
                              className={`h-7 px-2.5 text-xs font-medium ${
                                part.presente
                                  ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                              onClick={() => handleTogglePresenca(part)}
                            >
                              {part.presente ? (
                                <>
                                  <UserX className="h-3 w-3 mr-1" />
                                  Desfazer
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-3 w-3 mr-1" />
                                  Confirmar Entrada
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                              onClick={() => handleDeleteParticipante(part.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsParticipantesModalOpen(false);
                setSelectedEvento(null);
              }}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Cadastrar / Editar Evento */}
      <Dialog open={isEventoDialogOpen} onOpenChange={setIsEventoDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEventoId ? 'Editar Evento' : 'Novo Evento para Portaria'}
            </DialogTitle>
            <DialogDescription>
              Cadastre o evento para que a equipe de portaria possa acompanhar os horários e
              participantes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEvento} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Título do Evento *</Label>
              <Input
                placeholder="Ex: Semana de Tecnologia e Ciência"
                value={eventoForm.titulo}
                onChange={(e) => setEventoForm({ ...eventoForm, titulo: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Local / Sala *</Label>
                <Input
                  placeholder="Ex: Auditório Principal"
                  value={eventoForm.local}
                  onChange={(e) => setEventoForm({ ...eventoForm, local: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tipo de Evento</Label>
                <Select
                  value={eventoForm.tipo}
                  onValueChange={(val) =>
                    setEventoForm({ ...eventoForm, tipo: val as PortariaEventoTipo })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="academico">Acadêmico</SelectItem>
                    <SelectItem value="cultural">Cultural</SelectItem>
                    <SelectItem value="esportivo">Esportivo</SelectItem>
                    <SelectItem value="reuniao">Reunião</SelectItem>
                    <SelectItem value="palestra">Palestra</SelectItem>
                    <SelectItem value="externo">Comunidade Externa</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Data e Hora de Início *</Label>
                <Input
                  type="datetime-local"
                  value={eventoForm.data_inicio}
                  onChange={(e) => setEventoForm({ ...eventoForm, data_inicio: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Data e Hora de Término</Label>
                <Input
                  type="datetime-local"
                  value={eventoForm.data_fim || ''}
                  onChange={(e) => setEventoForm({ ...eventoForm, data_fim: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Responsável / Organizador</Label>
                <Input
                  placeholder="Nome do organizador"
                  value={eventoForm.responsavel_nome || ''}
                  onChange={(e) =>
                    setEventoForm({ ...eventoForm, responsavel_nome: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Telefone de Contato</Label>
                <Input
                  placeholder="(84) 99999-0000"
                  value={eventoForm.responsavel_contato || ''}
                  onChange={(e) =>
                    setEventoForm({ ...eventoForm, responsavel_contato: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Status</Label>
              <Select
                value={eventoForm.status}
                onValueChange={(val) =>
                  setEventoForm({ ...eventoForm, status: val as PortariaEventoStatus })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Orientações Especiais para a Portaria
              </Label>
              <Textarea
                placeholder="Ex: Liberar entrada prioritária de veículos no estacionamento A. Exigir documento na recepção."
                value={eventoForm.observacoes_portaria || ''}
                onChange={(e) =>
                  setEventoForm({ ...eventoForm, observacoes_portaria: e.target.value })
                }
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEventoDialogOpen(false)}
                disabled={isSubmittingEvento}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingEvento}>
                {isSubmittingEvento ? 'Salvando...' : 'Salvar Evento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
