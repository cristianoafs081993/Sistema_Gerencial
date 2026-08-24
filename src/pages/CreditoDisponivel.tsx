import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Loader2, RefreshCw, Search } from 'lucide-react';

import { HeaderActions, HeaderSubtitle } from '@/components/HeaderParts';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { TablePagination } from '@/components/design-system/TablePagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useData } from '@/contexts/DataContext';
import { CreditoDisponivelMovimentacoesModal } from '@/components/modals/CreditoDisponivelMovimentacoesModal';
import { creditosDisponiveisDetalhesService, type CreditoDisponivelDetalheRow } from '@/services/creditosDisponiveisDetalhes';

type SaldoFilter = 'todos' | 'com-saldo' | 'zerado';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function CreditoDisponivel() {
  const { empenhos, descentralizacoes, atividades, updateEmpenho } = useData();
  const [search, setSearch] = useState('');
  const [ptresFilter, setPtresFilter] = useState('todos');
  const [saldoFilter, setSaldoFilter] = useState<SaldoFilter>('com-saldo');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedRowForMovimentacoes, setSelectedRowForMovimentacoes] = useState<CreditoDisponivelDetalheRow | null>(null);
  const [isMovimentacoesOpen, setIsMovimentacoesOpen] = useState(false);

  const { data: report = { rows: [], sourceFile: '', importedAt: '' }, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['creditos-disponiveis-detalhes', 'latest'],
    queryFn: () => creditosDisponiveisDetalhesService.getLatestReport(),
    staleTime: 30000,
  });

  const ptresOptions = useMemo(
    () => Array.from(new Set(report.rows.map((row) => row.ptres))).sort(),
    [report.rows],
  );

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return report.rows.filter((row) => {
      const matchesPtres = ptresFilter === 'todos' || row.ptres === ptresFilter;
      const matchesSaldo =
        saldoFilter === 'todos' ||
        (saldoFilter === 'com-saldo' ? row.valor !== 0 : row.valor === 0);
      const matchesSearch =
        !needle ||
        [row.ptres, row.planoInterno, row.descricao]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      return matchesPtres && matchesSaldo && matchesSearch;
    });
  }, [ptresFilter, report.rows, saldoFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const resetPage = () => setPage(1);

  const handleOpenMovimentacoes = (row: CreditoDisponivelDetalheRow) => {
    setSelectedRowForMovimentacoes(row);
    setIsMovimentacoesOpen(true);
  };

  return (
    <div className="space-y-6 pb-10">
      <HeaderSubtitle>
        <span>Orçamentário / Crédito disponível</span>
      </HeaderSubtitle>
      <HeaderActions>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </Button>
        </div>
      </HeaderActions>

      <FilterPanel>
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              className="pl-9"
              placeholder="Buscar por PTRES, PI ou descrição"
            />
          </div>
          <Select
            value={ptresFilter}
            onValueChange={(value) => {
              setPtresFilter(value);
              resetPage();
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="PTRES" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os PTRES</SelectItem>
              {ptresOptions.map((ptres) => <SelectItem key={ptres} value={ptres}>{ptres}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={saldoFilter}
            onValueChange={(value) => {
              setSaldoFilter(value as SaldoFilter);
              resetPage();
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Saldo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os saldos</SelectItem>
              <SelectItem value="com-saldo">Somente com saldo</SelectItem>
              <SelectItem value="zerado">Somente zerados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FilterPanel>

      <DataTablePanel
        title="Relatório de crédito disponível"
        description="Clique em uma linha para ver os empenhos do ano e descentralizações do PTRES."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PTRES</TableHead>
              <TableHead>PI</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center w-[70px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando crédito disponível...
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="py-10 text-center text-sm text-text-secondary">Nenhuma linha encontrada.</div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedRows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => handleOpenMovimentacoes(row)}
                  className="cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                  title="Clique para ver os empenhos do ano e descentralizações do PTRES"
                >
                  <TableCell className="font-mono text-xs font-semibold text-text-primary">{row.ptres}</TableCell>
                  <TableCell className="font-mono text-xs text-text-primary">{row.planoInterno || '-'}</TableCell>
                  <TableCell className="min-w-[280px]">
                    <p className="line-clamp-2 font-ui text-sm text-text-primary">{row.descricao || '-'}</p>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-primary">
                    {formatCurrency(row.valor)}
                  </TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenMovimentacoes(row)}
                      title="Ver empenhos do ano e descentralizações do PTRES"
                      className="h-7 w-7 p-0 text-text-muted hover:text-primary"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">Ver empenhos do ano</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          page={safePage}
          totalPages={totalPages}
          totalItems={filteredRows.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
        />
      </DataTablePanel>

      <CreditoDisponivelMovimentacoesModal
        open={isMovimentacoesOpen}
        onOpenChange={(isOpen) => {
          setIsMovimentacoesOpen(isOpen);
          if (!isOpen) {
            setSelectedRowForMovimentacoes(null);
          }
        }}
        selectedRow={selectedRowForMovimentacoes}
        descentralizacoes={descentralizacoes}
        empenhos={empenhos}
        atividades={atividades}
        onSaveEmpenho={updateEmpenho}
      />
    </div>
  );
}

