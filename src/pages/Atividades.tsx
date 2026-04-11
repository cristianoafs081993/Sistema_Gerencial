import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Filter, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { HeaderActions } from '@/components/HeaderParts';
import { JsonImportDialog } from '@/components/JsonImportDialog';
import { StatCard } from '@/components/StatCard';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { TablePagination } from '@/components/design-system/TablePagination';
import { AtividadeDialog } from '@/components/modals/AtividadeDialog';
import { ConfirmDialog } from '@/components/modals/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useAuth } from '@/contexts/AuthContext';
import { cn, formatCurrency, parseCurrency } from '@/lib/utils';
import { atividadesService } from '@/services/atividades';
import { Atividade, DIMENSOES, TipoAtividade } from '@/types';
import { resolveTipoAtividade } from '@/utils/atividadeScopes';
import { matchesDimensionFilter } from '@/utils/dimensionFilters';

type PlanningScope = TipoAtividade;

type PlanningView = {
  scope: PlanningScope;
  label: string;
  switcherLabel: string;
  description: string;
  tableTitle: string;
};

const DEFAULT_SCOPE: PlanningScope = 'campus';

const PLANNING_VIEWS: PlanningView[] = [
  {
    scope: 'campus',
    label: 'Campus',
    switcherLabel: 'Campus',
    description: 'Planejamento do campus com a estrutura operacional atual de filtros, tabela e cadastro.',
    tableTitle: 'Planejamento Campus',
  },
  {
    scope: 'sistemico',
    label: 'Sistemico',
    switcherLabel: 'Sistemico',
    description: 'Visao sistemica com o mesmo modelo de acompanhamento e operacao usado no planejamento do campus.',
    tableTitle: 'Planejamento Sistemico',
  },
  {
    scope: 'emendas-parlamentares',
    label: 'Emendas parlamentares',
    switcherLabel: 'Emendas',
    description: 'Acompanhamento de emendas parlamentares com a mesma experiencia de consulta e manutencao.',
    tableTitle: 'Emendas Parlamentares',
  },
];

const planningViewByScope = Object.fromEntries(
  PLANNING_VIEWS.map((view) => [view.scope, view]),
) as Record<PlanningScope, PlanningView>;

const atividadesJsonFields = [
  'dimensao',
  'componentefuncional',
  'atividade',
  'descricao',
  'valortotal',
  'origemrecurso',
  'naturezadespesa',
  'planointerno',
];

function isPlanningScope(value: string | undefined): value is PlanningScope {
  return value === 'campus' || value === 'sistemico' || value === 'emendas-parlamentares';
}

function PlanningScopeSwitcher({ currentScope }: { currentScope: PlanningScope }) {
  return (
    <div className="hidden h-9 items-center gap-2 md:flex">
      <div className="inline-flex h-8 items-center justify-center rounded-lg border border-border-default/60 bg-surface-card p-0.5 shadow-sm sm:h-9">
      {PLANNING_VIEWS.map((view) => {
        const isActive = view.scope === currentScope;

        return (
          <Link
            key={view.scope}
            to={`/planejamento/${view.scope}`}
            className={cn(
              'inline-flex h-7 items-center justify-center whitespace-nowrap rounded-md px-3 text-[11px] font-semibold transition-all sm:h-8 sm:px-4 sm:text-xs',
              isActive
                ? 'bg-[#2f9e41] text-white shadow-sm'
                : 'text-slate-600 hover:bg-background hover:text-foreground',
            )}
          >
            {view.switcherLabel}
          </Link>
        );
      })}
      </div>
    </div>
  );
}

export default function Atividades() {
  const { scope } = useParams<{ scope?: string }>();
  const { isSuperAdmin } = useAuth();

  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAtividade, setSelectedAtividade] = useState<Atividade | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterDimensao, setFilterDimensao] = useState('all');
  const [filterComponente, setFilterComponente] = useState('all');
  const [filterOrigem, setFilterOrigem] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const resolvedScope = isPlanningScope(scope) ? scope : DEFAULT_SCOPE;
  const currentView = planningViewByScope[resolvedScope];
  const scopedAtividades = useMemo(
    () => atividades.filter((atividade) => atividade.tipoAtividade === currentView.scope),
    [atividades, currentView.scope],
  );

  const fetchAtividades = async () => {
    try {
      setIsPageLoading(true);
      const data = await atividadesService.getAll();
      setAtividades(data || []);
    } catch (error) {
      console.error('Erro ao buscar atividades:', error);
      toast.error('Erro ao buscar atividades');
    } finally {
      setIsPageLoading(false);
    }
  };

  useEffect(() => {
    void fetchAtividades();
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
    setShowAdvancedFilters(false);
    setIsDialogOpen(false);
    setIsImportDialogOpen(false);
    setIsConfirmDeleteDialogOpen(false);
    setPage(1);
  }, [scope]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterDimensao, filterComponente, filterOrigem, perPage]);

  const filteredAtividades = useMemo(
    () =>
      scopedAtividades.filter((atividade) => {
        const search = searchTerm.trim().toLowerCase();
        const matchesSearch =
          search === '' ||
          atividade.atividade.toLowerCase().includes(search) ||
          atividade.descricao.toLowerCase().includes(search) ||
          atividade.planoInterno?.toLowerCase().includes(search);

        const matchesDimensao = matchesDimensionFilter({
          dimensionValue: atividade.dimensao,
          planInternal: atividade.planoInterno,
          description: atividade.descricao,
          filterValue: filterDimensao,
        });

        const matchesComponente =
          filterComponente === 'all' || atividade.componenteFuncional === filterComponente;
        const matchesOrigem = filterOrigem === 'all' || atividade.origemRecurso === filterOrigem;

        return matchesSearch && matchesDimensao && matchesComponente && matchesOrigem;
      }),
    [scopedAtividades, searchTerm, filterDimensao, filterComponente, filterOrigem],
  );

  const componentesUnicos = useMemo(
    () =>
      Array.from(
        new Set(scopedAtividades.map((atividade) => atividade.componenteFuncional).filter(Boolean)),
      ).sort(),
    [scopedAtividades],
  );

  const origensUnicas = useMemo(
    () =>
      Array.from(
        new Set(scopedAtividades.map((atividade) => atividade.origemRecurso).filter(Boolean)),
      ).sort(),
    [scopedAtividades],
  );

  const totalPlanejado = useMemo(
    () => scopedAtividades.reduce((sum, atividade) => sum + (atividade.valorTotal || 0), 0),
    [scopedAtividades],
  );

  const totalPages = Math.ceil(filteredAtividades.length / perPage);
  const safePage = Math.min(page, Math.max(1, totalPages || 1));
  const paginatedAtividades = filteredAtividades.slice((safePage - 1) * perPage, safePage * perPage);

  const handleOpenDialog = (atividade?: Atividade) => {
    setSelectedAtividade(atividade || null);
    setIsDialogOpen(true);
  };

  const handleImport = async (data: Record<string, string>[]) => {
    const toastId = toast.loading('Processando importacao...');

    try {
      const mappedData = data.map((row) => ({
        dimensao: row.dimensao || '',
        componenteFuncional: row.componentefuncional || '',
        tipoAtividade: currentView.scope,
        atividade: row.atividade || '',
        descricao: row.descricao || '',
        valorTotal: parseCurrency(row.valortotal || row.valor || '0'),
        origemRecurso: row.origemrecurso || '',
        naturezaDespesa: row.naturezadespesa || '',
        planoInterno: row.planointerno || '',
      }));

      for (const item of mappedData) {
        await atividadesService.create(item);
      }

      toast.success('Importacao concluida com sucesso.', { id: toastId });
      setIsImportDialogOpen(false);
      void fetchAtividades();
    } catch (error) {
      console.error('Erro ao importar JSON:', error);
      toast.error('Erro ao processar importacao.', { id: toastId });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const toastId = toast.loading('Excluindo atividades...');

    try {
      for (const id of Array.from(selectedIds)) {
        await atividadesService.delete(id);
      }

      toast.success(`${selectedIds.size} atividades excluidas.`, { id: toastId });
      setSelectedIds(new Set());
      setIsConfirmDeleteDialogOpen(false);
      void fetchAtividades();
    } catch (error) {
      console.error('Erro ao excluir atividades:', error);
      toast.error('Erro ao excluir atividades.', { id: toastId });
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAtividades.length) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(new Set(filteredAtividades.map((atividade) => atividade.id.toString())));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setFilterDimensao('all');
    setFilterComponente('all');
    setFilterOrigem('all');
    setSearchTerm('');
  };

  if (!isPlanningScope(scope)) {
    return <Navigate replace to={`/planejamento/${DEFAULT_SCOPE}`} />;
  }

  return (
    <div className="space-y-6 pb-10">
      <HeaderActions>
        {isPageLoading ? (
          <Skeleton className="h-9 w-32" />
        ) : (
          <div className="flex flex-wrap gap-2">
            <PlanningScopeSwitcher currentScope={currentView.scope} />

            {selectedIds.size > 0 ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setIsConfirmDeleteDialogOpen(true)}
                className="h-9 gap-2 text-sm"
              >
                <Trash2 className="h-4 w-4" />
                Excluir ({selectedIds.size})
              </Button>
            ) : null}

            {isSuperAdmin ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsImportDialogOpen(true)}
                className="h-8 gap-2 px-4 text-xs sm:h-9 sm:text-sm"
              >
                <Upload className="h-4 w-4" />
                Importar JSON
              </Button>
            ) : null}

            <Button
              type="button"
              onClick={() => handleOpenDialog()}
              className="btn-primary h-8 px-4 text-xs sm:h-9 sm:text-sm"
            >
              <Plus className="h-4 w-4" />
              Nova Atividade
            </Button>
          </div>
        )}
      </HeaderActions>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Planejado"
          value={formatCurrency(totalPlanejado)}
          icon={Plus}
          stitchColor="purple"
          isLoading={isPageLoading}
        />
        <StatCard
          title="Registros"
          value={scopedAtividades.length}
          icon={Filter}
          stitchColor="vibrant-blue"
          isLoading={isPageLoading}
        />
        <StatCard
          title="Dimensoes"
          value={new Set(scopedAtividades.map((atividade) => atividade.dimensao)).size}
          icon={Search}
          stitchColor="amber"
          isLoading={isPageLoading}
        />
        <StatCard
          title="Componentes"
          value={componentesUnicos.length}
          icon={Filter}
          stitchColor="emerald-green"
          isLoading={isPageLoading}
        />
      </div>

      <FilterPanel className="shadow-sm">
        <CardContent className="p-0">
          {isPageLoading ? (
            <div className="flex flex-col gap-4 sm:flex-row">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-full sm:w-[160px]" />
              <Skeleton className="h-10 w-full sm:w-[160px]" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por atividade, descricao ou plano interno..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="input-system h-10 pl-9 text-sm"
                  />
                </div>

                <div className="w-full sm:w-[180px]">
                  <Select value={filterDimensao} onValueChange={setFilterDimensao}>
                    <SelectTrigger className="input-system h-10">
                      <SelectValue placeholder="Dimensao" />
                    </SelectTrigger>
                    <SelectContent className="rounded-sm">
                      <SelectItem value="all">Todas as dimensoes</SelectItem>
                      {DIMENSOES.map((dimensao) => (
                        <SelectItem key={dimensao.codigo} value={dimensao.codigo}>
                          {dimensao.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  variant={showAdvancedFilters ? 'secondary' : 'outline'}
                  onClick={() => setShowAdvancedFilters((value) => !value)}
                  className="h-10 gap-2 font-bold"
                >
                  <Filter className="h-4 w-4" />
                  Opcoes
                </Button>
              </div>

              {showAdvancedFilters ? (
                <div className="grid grid-cols-1 gap-4 rounded-lg border border-border-default/50 bg-slate-50/50 p-4 animate-in fade-in duration-200 md:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Componente Funcional
                    </label>
                    <Select value={filterComponente} onValueChange={setFilterComponente}>
                      <SelectTrigger className="input-system h-10">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-sm">
                        <SelectItem value="all">Todos</SelectItem>
                        {componentesUnicos.map((componente) => (
                          <SelectItem key={componente} value={componente}>
                            {componente}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Origem de Recurso
                    </label>
                    <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                      <SelectTrigger className="input-system h-10">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-sm">
                        <SelectItem value="all">Todas</SelectItem>
                        {origensUnicas.map((origem) => (
                          <SelectItem key={origem} value={origem}>
                            {origem}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 w-full font-bold text-muted-foreground hover:text-primary"
                      onClick={clearFilters}
                    >
                      Limpar filtros
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </FilterPanel>

      <Card className="card-system mt-6 border-none shadow-none">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border-default/50 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <CardTitle className="table-title">{currentView.tableTitle}</CardTitle>
            <Badge variant="secondary" className="h-5 bg-slate-100 px-2 py-0 font-bold text-slate-600">
              {filteredAtividades.length}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-b border-border-default/50 hover:bg-transparent">
                  <TableHead className="w-[50px] px-6">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300"
                      checked={selectedIds.size === filteredAtividades.length && filteredAtividades.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Atividade
                  </TableHead>
                  <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Dimensao
                  </TableHead>
                  <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Componente Funcional
                  </TableHead>
                  <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Origem de Recurso
                  </TableHead>
                  <TableHead className="py-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Valor
                  </TableHead>
                  <TableHead className="w-[100px] py-4 pr-6 text-right text-xs font-semibold uppercase tracking-wider">
                    Acoes
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isPageLoading
                  ? Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell className="px-6">
                          <Skeleton className="h-4 w-4" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-48" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="ml-auto h-4 w-20" />
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <Skeleton className="ml-auto h-8 w-8" />
                        </TableCell>
                      </TableRow>
                    ))
                  : paginatedAtividades.length === 0
                    ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center italic text-muted-foreground">
                          Nenhum registro encontrado em {currentView.label.toLowerCase()}.
                        </TableCell>
                      </TableRow>
                      )
                    : paginatedAtividades.map((atividade) => (
                        <TableRow
                          key={atividade.id}
                          className="group border-b transition-colors last:border-0 hover:bg-slate-50/80"
                        >
                          <TableCell className="px-6">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300"
                              checked={selectedIds.has(atividade.id.toString())}
                              onChange={() => toggleSelect(atividade.id.toString())}
                            />
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex max-w-[400px] flex-col gap-0.5">
                              <span className="text-sm font-semibold transition-colors group-hover:text-primary">
                                {atividade.atividade}
                              </span>
                              <span
                                className="line-clamp-1 text-xs text-muted-foreground"
                                title={atividade.descricao}
                              >
                                {atividade.descricao}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge
                              variant="outline"
                              className="border-slate-200 text-[10px] font-bold uppercase tracking-wider"
                            >
                              {atividade.dimensao ? atividade.dimensao.split(' - ')[0] : 'N/D'}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 text-xs">
                            {atividade.componenteFuncional || '-'}
                          </TableCell>
                          <TableCell className="py-4 font-mono text-xs">
                            {atividade.origemRecurso || '-'}
                          </TableCell>
                          <TableCell className="py-4 text-right text-sm font-bold">
                            {formatCurrency(atividade.valorTotal)}
                          </TableCell>
                          <TableCell className="py-4 pr-6 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"
                              onClick={() => handleOpenDialog(atividade)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        <TablePagination
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={filteredAtividades.length}
          pageSize={perPage}
          onPageSizeChange={(value) => {
            setPerPage(value);
            setPage(1);
          }}
        />
      </Card>

      <AtividadeDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        atividade={selectedAtividade}
        defaultTipoAtividade={resolveTipoAtividade(selectedAtividade?.tipoAtividade, currentView.scope)}
        onSuccess={() => void fetchAtividades()}
      />

      <ConfirmDialog
        open={isConfirmDeleteDialogOpen}
        onOpenChange={setIsConfirmDeleteDialogOpen}
        onConfirm={handleBulkDelete}
        title="Confirmar Exclusao"
        description={`Tem certeza que deseja excluir as ${selectedIds.size} atividades selecionadas? Esta acao nao podera ser desfeita.`}
        confirmText="Excluir atividades"
      />

      {isSuperAdmin ? (
        <JsonImportDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          onImport={handleImport}
          title="Importar Atividades (JSON)"
          expectedFields={atividadesJsonFields}
        />
      ) : null}
    </div>
  );
}
