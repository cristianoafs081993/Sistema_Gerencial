import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Atividade, DIMENSOES } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/StatCard';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Plus, 
  Search, 
  Filter, 
  ChevronLeft as ChevronLeftIcon, 
  ChevronRight as ChevronRightIcon, 
  ChevronsLeft as ChevronsLeftIcon, 
  ChevronsRight as ChevronsRightIcon, 
  X, 
  Trash2, 
  Upload,
  Pencil,
} from 'lucide-react';
import { JsonImportDialog } from '@/components/JsonImportDialog';
import { AtividadeDialog } from '@/components/modals/AtividadeDialog';
import { ConfirmDialog } from '@/components/modals/ConfirmDialog';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { toast } from 'sonner';
import { formatCurrency, parseCurrency } from '@/lib/utils';
import { HeaderActions } from '@/components/HeaderParts';
import { atividadesService } from '@/services/atividades';
import { matchesDimensionFilter } from '@/utils/dimensionFilters';

export default function Atividades() {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAtividade, setSelectedAtividade] = useState<Atividade | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDimensao, setFilterDimensao] = useState('all');
  const [filterComponente, setFilterComponente] = useState('all');
  const [filterOrigem, setFilterOrigem] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Paginação
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

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
    fetchAtividades();
  }, []);

  const handleOpenDialog = (atividade?: Atividade) => {
    setSelectedAtividade(atividade || null);
    setIsDialogOpen(true);
  };

  const handleImport = async (data: Record<string, string>[]) => {
    const toastId = toast.loading('Processando importação...');
    try {
      const mappedData = data.map(row => ({
        dimensao: row['dimensao'] || '',
        componenteFuncional: row['componentefuncional'] || '',
        atividade: row['atividade'] || '',
        descricao: row['descricao'] || '',
        valorTotal: parseCurrency(row['valortotal'] || row['valor'] || '0'),
        origemRecurso: row['origemrecurso'] || '',
        naturezaDespesa: row['naturezadespesa'] || '',
        planoInterno: row['planointerno'] || ''
      }));

      for (const item of mappedData) {
        await atividadesService.create(item);
      }

      toast.success('Importação concluída com sucesso!', { id: toastId });
      setIsImportDialogOpen(false);
      fetchAtividades();
    } catch (error) {
      console.error('Erro ao importar JSON:', error);
      toast.error('Erro ao processar importação', { id: toastId });
    }
  };

  const handleBulkDelete = async () => {
      if (selectedIds.size === 0) return;
      
      const toastId = toast.loading('Excluindo atividades...');
      try {
          for (const id of Array.from(selectedIds)) {
              await atividadesService.delete(id);
          }

          toast.success(`${selectedIds.size} atividades excluídas!`, { id: toastId });
          setSelectedIds(new Set());
          fetchAtividades();
          setIsConfirmDeleteDialogOpen(false);
      } catch (error) {
          console.error('Erro ao excluir:', error);
          toast.error('Erro ao excluir atividades', { id: toastId });
      }
  };

  const filteredAtividades = useMemo(() => {
    return atividades.filter(a => {
      const matchesSearch = searchTerm === '' || 
        a.atividade.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.planoInterno?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDimensao = matchesDimensionFilter({
        dimensionValue: a.dimensao,
        planInternal: a.planoInterno,
        description: a.descricao,
        filterValue: filterDimensao,
      });
      const matchesComponente = filterComponente === 'all' || a.componenteFuncional === filterComponente;
      const matchesOrigem = filterOrigem === 'all' || a.origemRecurso === filterOrigem;

      return matchesSearch && matchesDimensao && matchesComponente && matchesOrigem;
    });
  }, [atividades, searchTerm, filterDimensao, filterComponente, filterOrigem]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAtividades.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAtividades.map(a => a.id.toString())));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const componentesUnicos = useMemo(() => 
    Array.from(new Set(atividades.map(a => a.componenteFuncional).filter(Boolean))).sort(),
    [atividades]
  );

  const origensUnicas = useMemo(() => 
    Array.from(new Set(atividades.map(a => a.origemRecurso).filter(Boolean))).sort(),
    [atividades]
  );

  const totalPages = Math.ceil(filteredAtividades.length / perPage);
  const paginatedAtividades = filteredAtividades.slice((page - 1) * perPage, page * perPage);

  const atividadesJsonFields = [
    'dimensao', 'componentefuncional', 'atividade', 'descricao', 'valortotal', 'origemrecurso', 'naturezadespesa', 'planointerno'
  ];

  return (
    <div className="space-y-6 pb-10">
      <HeaderActions>
        {isPageLoading ? (
          <Skeleton className="h-9 w-32" />
        ) : (
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <Button variant="destructive" onClick={() => setIsConfirmDeleteDialogOpen(true)} className="gap-2 h-9 text-sm">
                <Trash2 className="h-4 w-4" />
                Excluir ({selectedIds.size})
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsImportDialogOpen(true)} className="gap-2 h-9 text-sm">
              <Upload className="h-4 w-4" />
              Importar JSON
            </Button>
            <Button onClick={() => handleOpenDialog()} className="btn-primary">
              <Plus className="h-4 w-4" />
              Nova Atividade
            </Button>
          </div>
        )}
      </HeaderActions>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Planejado"
          value={formatCurrency(atividades.reduce((sum, a) => sum + (a.valorTotal || 0), 0))}
          icon={Plus}
          stitchColor="purple"
          isLoading={isPageLoading}
        />
        <StatCard
          title="Atividades"
          value={atividades.length}
          icon={Filter}
          stitchColor="vibrant-blue"
          isLoading={isPageLoading}
        />
        <StatCard
          title="Dimensões"
          value={new Set(atividades.map(a => a.dimensao)).size}
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

      {/* Standard Filter Card */}
      <FilterPanel className="shadow-sm">
        <CardContent className="p-0">
          {isPageLoading ? (
            <div className="flex flex-col sm:flex-row gap-4">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-[150px]" />
              <Skeleton className="h-10 w-[150px]" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por atividade, processo ou dimensão..."
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
                      <SelectItem value="all">Todas as dimensões</SelectItem>
                      {DIMENSOES.map((d) => (
                        <SelectItem key={d.codigo} value={d.codigo}>
                          {d.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

              {showAdvancedFilters && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50/50 rounded-lg border border-border-default/50 animate-in fade-in duration-200">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Componente Funcional</label>
                    <Select value={filterComponente} onValueChange={setFilterComponente}>
                      <SelectTrigger className="input-system h-10">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-sm">
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
                      <SelectTrigger className="input-system h-10">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-sm">
                        <SelectItem value="all">Todas</SelectItem>
                        {origensUnicas.map(origem => (
                          <SelectItem key={origem} value={origem}>{origem}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      className="w-full text-muted-foreground hover:text-primary h-10 font-bold"
                      onClick={() => {
                        setFilterDimensao('all');
                        setFilterComponente('all');
                        setFilterOrigem('all');
                        setSearchTerm('');
                      }}
                    >
                      Limpar Filtros
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </FilterPanel>

      {/* Main Table Card */}
      <Card className="card-system shadow-sm border-none shadow-none mt-6">
        <CardHeader className="px-6 py-4 border-b border-border-default/50 flex flex-row items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <CardTitle className="table-title">Atividades Planejadas</CardTitle>
            <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-bold px-2 py-0 h-5">
              {filteredAtividades.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b border-border-default/50">
                  <TableHead className="w-[50px] px-6">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300"
                      checked={selectedIds.size === filteredAtividades.length && filteredAtividades.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider py-4 text-muted-foreground">Atividade</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider py-4 text-muted-foreground">Dimensão</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider py-4 text-muted-foreground">Componente Funcional</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider py-4 text-muted-foreground">Origem de Recurso</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wider py-4 text-muted-foreground">Valor</TableHead>
                  <TableHead className="w-[100px] text-right text-xs font-semibold uppercase tracking-wider py-4 pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPageLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="px-6"><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                      <TableCell className="pr-6 text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : paginatedAtividades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                      Nenhuma atividade encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedAtividades.map((a) => (
                    <TableRow key={a.id} className="group hover:bg-slate-50/80 transition-colors border-b last:border-0">
                      <TableCell className="px-6">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300"
                          checked={selectedIds.has(a.id.toString())}
                          onChange={() => toggleSelect(a.id.toString())}
                        />
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col gap-0.5 max-w-[400px]">
                          <span className="font-semibold text-sm group-hover:text-primary transition-colors">{a.atividade}</span>
                          <span className="text-xs text-muted-foreground line-clamp-1" title={a.descricao}>{a.descricao}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider border-slate-200">
                          {a.dimensao ? a.dimensao.split(' - ')[0] : 'N/D'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-xs">{a.componenteFuncional || '-'}</TableCell>
                      <TableCell className="py-4 font-mono text-xs">{a.origemRecurso || '-'}</TableCell>
                      <TableCell className="text-right font-bold text-sm py-4">{formatCurrency(a.valorTotal)}</TableCell>
                      <TableCell className="text-right py-4 pr-6">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-full"
                          onClick={() => handleOpenDialog(a)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        {/* Improved Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-slate-50/70 border-t gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Exibir</span>
              <Select value={String(perPage)} onValueChange={(val) => { setPerPage(Number(val)); setPage(1); }}>
                <SelectTrigger className="h-8 w-[70px] bg-white border-slate-200/60">
                  <SelectValue placeholder={String(perPage)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="h-4 w-[1px] bg-slate-200 hidden sm:block"></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Página <span className="text-foreground">{page}</span> de {totalPages || 1}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-slate-200/60 shadow-sm"
              onClick={() => setPage(1)}
              disabled={page <= 1}
            >
              <ChevronsLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-slate-200/60 shadow-sm"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-slate-200/60 shadow-sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-slate-200/60 shadow-sm"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
            >
              <ChevronsRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <AtividadeDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        atividade={selectedAtividade}
        onSuccess={fetchAtividades}
      />

      <ConfirmDialog
        open={isConfirmDeleteDialogOpen}
        onOpenChange={setIsConfirmDeleteDialogOpen}
        onConfirm={handleBulkDelete}
        title="Confirmar Exclusão"
        description={`Tem certeza que deseja excluir as ${selectedIds.size} atividades selecionadas? Esta ação não poderá ser desfeita.`}
        confirmText="Excluir Atividades"
      />

      <JsonImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImport={handleImport}
        title="Importar Atividades (JSON)"
        expectedFields={atividadesJsonFields}
      />
    </div>
  );
}



