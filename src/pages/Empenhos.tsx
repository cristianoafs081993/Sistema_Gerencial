import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { Fragment, useEffect, useMemo, useState } from 'react';

import { Plus, Pencil, Search, Filter, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, Layers, X, Star, History } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Empenho, DIMENSOES, COMPONENTES_POR_DIMENSAO } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EmpenhoDialog } from '@/components/modals/EmpenhoDialog';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { ActiveFilterChips, type ActiveFilterItem } from '@/components/design-system/ActiveFilterChips';
import { TablePagination } from '@/components/design-system/TablePagination';

import { formatCurrency, formatarDocumento } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getRapReferenceYear, isRapReinscrito } from '@/utils/rapMetrics';
import { useAuth } from '@/contexts/AuthContext';
import { useUserFavorites } from '@/services/userFavorites';
import { filterEmpenhos, getRapBase, getRapLiquidado, getRapSaldo } from './empenhosFilters';


const statusColors: Record<string, string> = {
  pendente: 'bg-status-warning/20 text-status-warning border-status-warning/30',
  liquidado: 'bg-action-primary/20 text-action-primary border-action-primary/30',
  pago: 'bg-status-success/20 text-status-success border-status-success/30',
  cancelado: 'bg-status-error/20 text-status-error border-status-error/30',
};

const statusLabels: Record<string, string> = {
  pendente: 'Pendente',
  liquidado: 'Liquidado',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

export default function Empenhos() {
  const { isSuperAdmin } = useAuth();
  const { empenhos, atividades, isLoading, addEmpenho, updateEmpenho, deleteEmpenho, refreshData } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('pendente');
  const [filterDimensao, setFilterDimensao] = useState('all');

  // Novos Filtros
  const [filterComponente, setFilterComponente] = useState('all');
  const [filterOrigem, setFilterOrigem] = useState('all');
  const [filterPlanoInterno, setFilterPlanoInterno] = useState('all');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('execucao');
  const [favoritesFilter, setFavoritesFilter] = useState<'all' | 'favorites'>('all');
  const { favoriteIdsByType, isFavorite, toggleFavorite, isPending: isFavoritePending } = useUserFavorites();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEmpenho, setSelectedEmpenho] = useState<Empenho | null>(null);

  // Extrair opções únicas para filtros
  const componentesUnicos = Array.from(new Set(empenhos.map(e => e.componenteFuncional?.trim()).filter(Boolean))).sort();
  const origensUnicas = Array.from(new Set(empenhos.map(e => e.origemRecurso?.trim()).filter(Boolean))).sort();
  const planosUnicos = Array.from(new Set(empenhos.map(e => e.planoInterno?.trim()).filter(Boolean))).sort();
  const filteredEmpenhos = useMemo(
    () => {
      const baseEmpenhos = favoritesFilter === 'favorites'
        ? empenhos.filter((empenho) => favoriteIdsByType.empenho.has(empenho.id))
        : empenhos;

      return filterEmpenhos(baseEmpenhos, {
        searchTerm,
        filterStatus,
        filterDimensao,
        filterComponente,
        filterOrigem,
        filterPlanoInterno,
        dataInicio,
        dataFim,
      });
    },
    [
      empenhos,
      favoriteIdsByType,
      favoritesFilter,
      searchTerm,
      filterStatus,
      filterDimensao,
      filterComponente,
      filterOrigem,
      filterPlanoInterno,
      dataInicio,
      dataFim,
    ],
  );

  const handleOpenDialog = (empenho?: Empenho) => {
    setSelectedEmpenho(empenho || null);
    setIsDialogOpen(true);
  };

  const handleSaveEmpenho = (id: string, data: Partial<Empenho>) => {
    updateEmpenho(id, data);
    setIsDialogOpen(false);
  };

  const handleClearAllFilters = () => {

    setSearchTerm('');
    setFilterStatus('all');
    setFilterDimensao('all');
    setFilterComponente('all');
    setFilterOrigem('all');
    setFilterPlanoInterno('all');
    setDataInicio('');
    setDataFim('');
    setFavoritesFilter('all');
  };

  const activeFilterList = useMemo<ActiveFilterItem[]>(() => {
    const list: ActiveFilterItem[] = [];

    if (searchTerm.trim()) {
      list.push({
        id: 'search',
        label: 'Busca',
        value: `"${searchTerm.trim()}"`,
        onRemove: () => setSearchTerm(''),
      });
    }

    if (filterDimensao !== 'all') {
      const dimName = DIMENSOES.find((d) => d.codigo === filterDimensao)?.nome || filterDimensao;
      list.push({
        id: 'dimensao',
        label: 'Dimensão',
        value: dimName,
        onRemove: () => setFilterDimensao('all'),
      });
    }

    if (filterStatus !== 'all') {
      list.push({
        id: 'status',
        label: 'Status',
        value: statusLabels[filterStatus] || filterStatus,
        onRemove: () => setFilterStatus('all'),
      });
    }

    if (favoritesFilter === 'favorites') {
      list.push({
        id: 'favorites',
        label: 'Filtro',
        value: 'Apenas Favoritos',
        onRemove: () => setFavoritesFilter('all'),
      });
    }

    if (filterComponente !== 'all') {
      list.push({
        id: 'componente',
        label: 'Componente',
        value: filterComponente,
        onRemove: () => setFilterComponente('all'),
      });
    }

    if (filterOrigem !== 'all') {
      list.push({
        id: 'origem',
        label: 'Origem',
        value: filterOrigem,
        onRemove: () => setFilterOrigem('all'),
      });
    }

    if (filterPlanoInterno !== 'all') {
      list.push({
        id: 'pi',
        label: 'Plano Interno',
        value: filterPlanoInterno,
        onRemove: () => setFilterPlanoInterno('all'),
      });
    }

    if (dataInicio || dataFim) {
      list.push({
        id: 'periodo',
        label: 'Período',
        value: `${dataInicio || 'Início'} até ${dataFim || 'Fim'}`,
        onRemove: () => {
          setDataInicio('');
          setDataFim('');
        },
      });
    }

    return list;
  }, [
    searchTerm,
    filterDimensao,
    filterStatus,
    favoritesFilter,
    filterComponente,
    filterOrigem,
    filterPlanoInterno,
    dataInicio,
    dataFim,
  ]);

  return (
    <div className="space-y-space-6 pb-space-10">
      <div hidden={isDialogOpen} className="space-y-6">
      <FilterPanel className="shadow-sm">
        <CardContent className="p-0">
          {/* Linha 1: Busca e Filtros Básicos */}
          <div className="flex flex-col sm:flex-row gap-4">

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Buscar empenhos"
                placeholder="Buscar por NE, favorecido, processo ou PI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 text-sm input-system"
              />
            </div>
            <div className="w-full sm:w-[150px]">
              <Select value={filterDimensao} onValueChange={setFilterDimensao}>
                <SelectTrigger className="input-system h-10">
                  <SelectValue placeholder="Dimensão" />
                </SelectTrigger>
                <SelectContent className="rounded-sm">
                  <SelectItem value="all">Todas dimensões</SelectItem>
                  {DIMENSOES.map((d) => (
                    <SelectItem key={d.codigo} value={d.codigo}>
                      {d.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-[150px]">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="input-system h-10">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-sm">
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  {activeTab !== 'restos' && <SelectItem value="liquidado">Liquidado</SelectItem>}
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="inline-flex h-10 overflow-hidden rounded-xl border border-border-default bg-card shadow-sm">
              <Button
                type="button"
                variant={favoritesFilter === 'all' ? 'default' : 'ghost'}
                className="h-10 rounded-none px-4 text-xs font-semibold"
                onClick={() => setFavoritesFilter('all')}
              >
                Todos
              </Button>
              <Button
                type="button"
                variant={favoritesFilter === 'favorites' ? 'default' : 'ghost'}
                className="h-10 rounded-none px-4 text-xs font-semibold"
                onClick={() => setFavoritesFilter('favorites')}
              >
                <Star className="h-3.5 w-3.5" />
                Favoritos
              </Button>
            </div>
            <Button
              variant={showAdvancedFilters ? "secondary" : "outline"}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="gap-2 h-10 font-bold"
            >
              <Filter className="w-4 h-4" />
              Opções
            </Button>
          </div>

          {/* Linha 2: Filtros Avançados (Colapsável) */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 mt-4 bg-muted/50 rounded-lg border border-border-default/50">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Componente Funcional</label>
                <Select value={filterComponente} onValueChange={setFilterComponente}>
                  <SelectTrigger className="input-system">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {componentesUnicos.map(comp => (
                      <SelectItem key={comp} value={comp}>{comp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Origem de Recurso</label>
                <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                  <SelectTrigger className="input-system">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {origensUnicas.map(origem => (
                      <SelectItem key={origem} value={origem}>{origem}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Plano Interno</label>
                <Select value={filterPlanoInterno} onValueChange={setFilterPlanoInterno}>
                  <SelectTrigger className="input-system">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {planosUnicos.map(plano => (
                      <SelectItem key={plano} value={plano}>{plano}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Período (Início)</label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="input-system h-10"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Período (Fim)</label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="input-system h-10"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Limpar Filtros"
                    onClick={() => {
                      setFilterDimensao('all');
                      setFilterStatus('all');
                      setFilterComponente('all');
                      setFilterOrigem('all');
                      setFilterPlanoInterno('all');
                      setDataInicio('');
                      setDataFim('');
                      setSearchTerm('');
                      setFavoritesFilter('all');
                    }}
                    className="h-10 w-10 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    <span className="sr-only">Limpar</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Chips de Filtros Ativos (Eixo 04) */}
          <ActiveFilterChips
            filters={activeFilterList}
            onClearAll={activeFilterList.length > 0 ? handleClearAllFilters : undefined}
            filteredCount={filteredEmpenhos.length}
            totalCount={empenhos.length}
          />
        </CardContent>
      </FilterPanel>


      {/* Container de Card Tab Integrado */}
      <div className="relative mt-6">
        {/* Tabs de Navegação - Layout Folder Tab */}
        <div className="flex items-end justify-between px-0 relative -mb-[1px] z-10 w-full gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex space-x-1 overflow-x-auto">
            <button
              type="button"
              className={`px-6 py-3 text-sm font-bold font-ui transition-all duration-200 border rounded-t-radius-lg whitespace-nowrap ${
                activeTab === 'execucao'
                  ? 'bg-surface-card border-border-default/80 border-b-surface-card text-sebrae-blue shadow-sm relative z-20 pb-[13px]'
                  : 'bg-surface-subtle/30 text-text-muted hover:text-text-primary hover:bg-surface-subtle/60 border-transparent border-b-border-default/80 cursor-pointer relative z-10 pb-3'
              }`}
              onClick={() => setActiveTab('execucao')}
            >
              Execução {new Date().getFullYear()}
            </button>
            <button
              type="button"
              className={`px-6 py-3 text-sm font-bold font-ui transition-all duration-200 border rounded-t-radius-lg whitespace-nowrap ${
                activeTab === 'restos'
                  ? 'bg-surface-card border-border-default/80 border-b-surface-card text-sebrae-blue shadow-sm relative z-20 pb-[13px]'
                  : 'bg-surface-subtle/30 text-text-muted hover:text-text-primary hover:bg-surface-subtle/60 border-transparent border-b-border-default/80 cursor-pointer relative z-10 pb-3'
              }`}
              onClick={() => setActiveTab('restos')}
            >
              Restos a Pagar
            </button>
          </div>
        </div>

        {/* Card Principal de Conteúdo */}
        {activeTab === 'execucao' ? (
          <EmpenhosTable
            empenhos={filteredEmpenhos.filter(e => e.tipo === 'exercicio' || (!e.tipo && e.numero.includes(String(new Date().getFullYear()))))}
            type="execucao"
            handleOpenDialog={handleOpenDialog}
            isFavorite={isFavorite}
            toggleFavorite={toggleFavorite}
            isFavoritePending={isFavoritePending}
            isLoading={isLoading}
            isFirstTabActive={true}
          />
        ) : (
          <EmpenhosTable
            empenhos={filteredEmpenhos.filter(e => e.tipo === 'rap' || (!e.tipo && !e.numero.includes(String(new Date().getFullYear()))))}
            type="restos"
            handleOpenDialog={handleOpenDialog}
            isFavorite={isFavorite}
            toggleFavorite={toggleFavorite}
            isFavoritePending={isFavoritePending}
            isLoading={isLoading}
            isFirstTabActive={false}
          />
        )}
      </div>

      </div>
      <EmpenhoDialog
        presentation="page"
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        empenho={selectedEmpenho}
        atividades={atividades}
        onSave={handleSaveEmpenho}
      />
    </div>
  );
}

function EmpenhoRow({
  empenho,
  type,
  handleOpenDialog,
  isFavorite,
  toggleFavorite,
  isFavoritePending,
  rapReferenceYear,
  isChild = false
}: {
  empenho: Empenho;
  type: 'execucao' | 'restos';
  handleOpenDialog: (e: Empenho) => void;
  isFavorite: (entityType: 'empenho', entityId: string) => boolean;
  toggleFavorite: (entityType: 'empenho', entityId: string) => Promise<unknown>;
  isFavoritePending?: boolean;
  rapReferenceYear: number;
  isChild?: boolean;
}) {
  const rapBase = type === 'restos' ? getRapBase(empenho, rapReferenceYear) : 0;
  const rapSaldoAtual = type === 'restos' ? getRapSaldo(empenho, rapReferenceYear) : 0;
  const rapBaseLabel = isRapReinscrito(empenho, rapReferenceYear) ? 'Reinscrito' : 'Inscrito';
  const favorite = isFavorite('empenho', empenho.id);

  return (
    <TableRow
      className={`hover:bg-muted/60 transition-colors border-b border-border-default/50 cursor-pointer ${isChild ? 'bg-muted/30' : ''}`}
      onClick={() => handleOpenDialog(empenho)}
    >
      <TableCell className={`py-3 pl-3 pr-2 sm:pl-4 sm:pr-2.5 align-top ${isChild ? 'pl-8' : ''}`}>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="w-fit font-mono text-sm font-semibold whitespace-nowrap text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDialog(empenho);
            }}
          >
            {empenho.numero}
          </button>
          {empenho.processo && (
            <span className="text-xs text-muted-foreground whitespace-nowrap" title="Processo">
              {empenho.processo}
            </span>
          )}
          {empenho.historicoOperacoes && empenho.historicoOperacoes.length > 1 && (
            <span className="text-[10px] text-action-primary flex items-center gap-0.5" title="Empenho com histórico de alterações">
              <History className="h-3 w-3" />
              {empenho.historicoOperacoes.length} ops
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="py-3 px-2 sm:px-2.5 align-top">
        <div className="flex flex-col">
          <span className="text-sm font-medium line-clamp-2" title={empenho.favorecidoNome}>{empenho.favorecidoNome || '-'}</span>
          <span className="text-xs text-muted-foreground">
            {formatarDocumento(empenho.favorecidoDocumento || '')}
          </span>
        </div>
      </TableCell>
      <TableCell className="py-3 px-2 sm:px-2.5 align-top">
        <div className="flex flex-col gap-1">
          <span className="text-sm line-clamp-2" title={empenho.descricao}>{empenho.descricao || '-'}</span>
          {type === 'execucao' && (empenho.origemRecurso || empenho.planoInterno) && (
            <span
              className="text-xs text-muted-foreground truncate"
              title={[empenho.origemRecurso, empenho.planoInterno].filter(Boolean).join(' • ')}
            >
              {[empenho.origemRecurso, empenho.planoInterno].filter(Boolean).join(' • ')}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="py-3 px-2 sm:px-2.5 text-right align-top whitespace-nowrap font-data text-sm">
        {formatCurrency(type === 'restos' ? rapBase : empenho.valor)}
      </TableCell>
      <TableCell className="py-3 px-2 sm:px-2.5 text-right align-top whitespace-nowrap">
        {(() => {
          if (type === 'restos') {
            return (
              <span className={`font-semibold text-sm ${rapSaldoAtual > 0 ? 'text-status-warning' : 'text-muted-foreground'}`}>
                {formatCurrency(rapSaldoAtual)}
              </span>
            );
          }
          const saldo = empenho.valor - (empenho.valorLiquidado || 0);
          return (
            <span className={`font-semibold text-sm ${saldo > 0 ? 'text-status-success' : saldo < 0 ? 'text-status-error' : 'text-muted-foreground'}`}>
              {formatCurrency(saldo)}
            </span>
          );
        })()}
      </TableCell>

      <TableCell className="py-3 px-1 sm:px-1.5 align-top whitespace-nowrap w-[48px] min-w-[44px]">
        <div className="flex items-center justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={favorite ? `Remover empenho ${empenho.numero} dos favoritos` : `Favoritar empenho ${empenho.numero}`}
                className={`h-8 w-8 ${favorite ? 'text-amber-500 hover:text-amber-600' : 'text-muted-foreground hover:text-amber-500'} hover:bg-amber-50`}
                disabled={isFavoritePending}
                onClick={(e) => {
                  e.stopPropagation();
                  void toggleFavorite('empenho', empenho.id);
                }}
              >
                <Star className={`h-4 w-4 ${favorite ? 'fill-current' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{favorite ? 'Remover dos favoritos' : 'Favoritar empenho'}</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
}

function EmpenhosTable({
  empenhos,
  type,
  handleOpenDialog,
  isFavorite,
  toggleFavorite,
  isFavoritePending,
  isLoading,
  isFirstTabActive = true,
}: {
  empenhos: Empenho[];
  type: 'execucao' | 'restos';
  handleOpenDialog: (e: Empenho) => void;
  isFavorite: (entityType: 'empenho', entityId: string) => boolean;
  toggleFavorite: (entityType: 'empenho', entityId: string) => Promise<unknown>;
  isFavoritePending?: boolean;
  isLoading?: boolean;
  isFirstTabActive?: boolean;
}) {
  const [sortKey, setSortKey] = useState<string>('numero');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const [groupBy, setGroupBy] = useState<'none' | 'favorecido'>('none');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const rapReferenceYear = useMemo(() => getRapReferenceYear(empenhos), [empenhos]);

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const processData = useMemo(() => {
    if (groupBy === 'none') {
      return empenhos.map(e => ({ isGroup: false as const, item: e }));
    }

    const groups = new Map<string, Empenho[]>();
    empenhos.forEach(e => {
      const key = e.favorecidoNome || 'Não informado';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    });

    return Array.from(groups.entries()).map(([name, items]) => ({
      isGroup: true as const,
      name,
      items,
      valorTotal: items.reduce((acc, e) => acc + (type === 'restos' ? getRapBase(e, rapReferenceYear) : e.valor), 0),
      saldoTotal: items.reduce((acc, e) => acc + (type === 'restos' ? getRapSaldo(e, rapReferenceYear) : (e.valor - (e.valorLiquidado || 0))), 0),
      pagoTotal: items.reduce((acc, e) => acc + (type === 'restos' ? getRapLiquidado(e) : (e.valorPago || 0)), 0),
      liquidadoTotal: items.reduce((acc, e) => acc + (type === 'restos' ? getRapLiquidado(e) : (e.valorLiquidado || 0)), 0),
    }));
  }, [empenhos, groupBy, rapReferenceYear, type]);

  const sortedData = useMemo(() => {
    const sorted = [...processData].sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      if (a.isGroup && b.isGroup) {
        switch (sortKey) {
          case 'favorecido': valA = a.name; valB = b.name; break;
          case 'valor': valA = a.valorTotal; valB = b.valorTotal; break;
          case 'saldo': valA = a.saldoTotal; valB = b.saldoTotal; break;
          case 'pago': valA = a.pagoTotal; valB = b.pagoTotal; break;
          default: valA = a.name; valB = b.name; break;
        }
      } else {
        const itemA = (a as { isGroup: false; item: Empenho }).item;
        const itemB = (b as { isGroup: false; item: Empenho }).item;
        switch (sortKey) {
          case 'numero': valA = itemA.numero; valB = itemB.numero; break;
          case 'favorecido': valA = itemA.favorecidoNome || ''; valB = itemB.favorecidoNome || ''; break;
          case 'valor':
            valA = type === 'restos' ? getRapBase(itemA, rapReferenceYear) : itemA.valor;
            valB = type === 'restos' ? getRapBase(itemB, rapReferenceYear) : itemB.valor;
            break;
          case 'saldo':
            valA = type === 'restos' ? getRapSaldo(itemA, rapReferenceYear) : (itemA.valor - (itemA.valorLiquidado || 0));
            valB = type === 'restos' ? getRapSaldo(itemB, rapReferenceYear) : (itemB.valor - (itemB.valorLiquidado || 0));
            break;
          case 'pago':
            valA = type === 'restos' ? getRapLiquidado(itemA) : (itemA.valorPago || 0);
            valB = type === 'restos' ? getRapLiquidado(itemB) : (itemB.valorPago || 0);
            break;
          default: valA = itemA.numero; valB = itemB.numero;
        }
      }

      if (typeof valA === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
      }
      return sortDir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
    return sorted;
  }, [processData, rapReferenceYear, sortKey, sortDir, type]);

  const totalRecords = sortedData.length;
  const totalPages = Math.ceil(totalRecords / perPage);
  const safePage = Math.min(page, Math.max(1, totalPages));
  const paginatedData = sortedData.slice((safePage - 1) * perPage, safePage * perPage);

  useEffect(() => {
    setPage(1);
  }, [empenhos.length, perPage, groupBy]);

  const SortHeader = ({ label, colKey, align = 'left', className = '' }: { label: string; colKey: string; align?: 'left' | 'right' | 'center'; className?: string }) => (
    <TableHead
      className={`h-11 px-2 sm:px-2.5 text-xs font-semibold cursor-pointer hover:bg-muted/80 transition-colors select-none ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : ''} ${className}`}
      aria-sort={sortKey === colKey ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" onClick={() => handleSort(colKey)} className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        {sortKey === colKey && (
          <span className="text-action-primary text-xs transition-transform duration-200">{sortDir === 'asc' ? '▲' : '▼'}</span>
        )}
      </button>
    </TableHead>
  );

  return (
    <DataTablePanel
      actions={
        <Button
          variant={groupBy === 'favorecido' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setGroupBy(g => g === 'none' ? 'favorecido' : 'none')}
          className="h-8 gap-2 btn-secondary"
        >
          <Layers className="h-4 w-4" />
          {groupBy === 'favorecido' ? 'Desagrupar' : 'Agrupar por Favorecido'}
        </Button>
      }>
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent border-b border-border-default/50">
              <SortHeader label="Número" colKey="numero" className="w-[12%] pl-3 pr-2 sm:pl-4 sm:pr-2.5" />
              <SortHeader label="Favorecido" colKey="favorecido" className="w-[28%] px-2 sm:px-2.5" />
              <TableHead className="h-11 px-2 sm:px-2.5 text-xs font-semibold">Descrição</TableHead>
              <SortHeader label={type === 'execucao' ? 'Empenhado' : 'Inscrito / reinscrito'} colKey="valor" align="right" className="w-[13%] px-2 sm:px-2.5" />
              <SortHeader label={type === 'execucao' ? 'A liquidar' : 'Saldo atual'} colKey="saldo" align="right" className="w-[13%] px-2 sm:px-2.5" />
              <TableHead className="h-11 px-1 sm:px-1.5 text-center text-xs font-semibold w-[48px] min-w-[44px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-3 pr-2 sm:pl-4 sm:pr-2.5"><Skeleton className="h-8 w-20" /></TableCell>
                  <TableCell className="px-2 sm:px-2.5"><Skeleton className="h-8 w-28" /></TableCell>
                  <TableCell className="px-2 sm:px-2.5"><Skeleton className="h-8 w-32" /></TableCell>
                  <TableCell className="px-2 sm:px-2.5"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  <TableCell className="px-2 sm:px-2.5"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  <TableCell className="px-1 sm:px-1.5"><Skeleton className="h-8 w-8 mx-auto" /></TableCell>
                </TableRow>
              ))
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">Nenhum empenho encontrado.</TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, idx) => {
                if (row.isGroup) {
                  const isExpanded = expandedGroups[row.name];
                  return (
                    <Fragment key={`group-${idx}`}>
                      <TableRow
                        className="bg-muted/50 hover:bg-muted/80 transition-colors cursor-pointer border-b border-border-default/50"
                        onClick={() => toggleGroup(row.name)}
                      >
                        <TableCell className="py-3 pl-3 pr-2 sm:pl-4 sm:pr-2.5 font-medium" colSpan={2}>
                          <div className="flex items-center gap-2">
                            <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            <span>{row.name}</span>
                            <Badge variant="secondary" className="ml-2 bg-card text-xs">{row.items.length}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-2 sm:px-2.5 text-sm text-muted-foreground">
                          -
                        </TableCell>
                        <TableCell className="py-3 px-2 sm:px-2.5 text-right font-data text-sm whitespace-nowrap">{formatCurrency(row.valorTotal)}</TableCell>
                        <TableCell className="py-3 px-2 sm:px-2.5 text-right">
                          {(() => {
                            if (type === 'restos') {
                              return (
                                <span className={`font-bold text-sm ${row.saldoTotal > 0 ? 'text-status-warning' : 'text-muted-foreground'}`}>
                                  {formatCurrency(row.saldoTotal)}
                                </span>
                              );
                            }
                            return (
                              <span className={`font-bold text-sm ${row.saldoTotal > 0 ? 'text-status-success' : row.saldoTotal < 0 ? 'text-status-error' : 'text-muted-foreground'}`}>
                                {formatCurrency(row.saldoTotal)}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="py-3 px-1 sm:px-1.5 text-center w-[48px] min-w-[44px]"></TableCell>
                      </TableRow>
                        {isExpanded && row.items.map(empenho => (
                          <EmpenhoRow
                            key={empenho.id}
                            empenho={empenho}
                            type={type}
                            handleOpenDialog={handleOpenDialog}
                            isFavorite={isFavorite}
                            toggleFavorite={toggleFavorite}
                            isFavoritePending={isFavoritePending}
                            rapReferenceYear={rapReferenceYear}
                            isChild
                          />
                        ))}
                      </Fragment>
                    );
                  } else {
                    const singleRow = row as { isGroup: false; item: Empenho };
                    return (
                      <EmpenhoRow
                        key={singleRow.item.id}
                        empenho={singleRow.item}
                        type={type}
                        handleOpenDialog={handleOpenDialog}
                        isFavorite={isFavorite}
                        toggleFavorite={toggleFavorite}
                        isFavoritePending={isFavoritePending}
                        rapReferenceYear={rapReferenceYear}
                      />
                    );
                  }
                })
              )}
            </TableBody>
          </Table>
        <TablePagination
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={totalRecords}
          pageSize={perPage}
          onPageSizeChange={(value) => {
            setPerPage(value);
            setPage(1);
          }}
        />
    </DataTablePanel>
  );
}




