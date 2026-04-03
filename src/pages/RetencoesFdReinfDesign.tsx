import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, FileUp, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import { HeaderActions, HeaderSubtitle } from '@/components/HeaderParts';
import { StatCard } from '@/components/StatCard';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { TableSkeletonRows } from '@/components/design-system/TableSkeletonRows';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  formatRetencaoEfdReinfDate,
  loadLatestRetencoesEfdReinfRowsFromDb,
  parseRetencoesEfdReinfCsv,
  type RetencaoEfdReinfRegistro,
  saveRetencoesEfdReinfRows,
  validateRetencaoEfdReinfRow,
} from '@/services/retencoesEfdReinfImportService';

type ViewRow = { row: RetencaoEfdReinfRegistro; validation: ReturnType<typeof validateRetencaoEfdReinfRow> };
type AlertFilter = 'all' | 'critical' | 'warning' | 'with-alert' | 'ok';
type SortKey = 'documentoHabil' | 'dhSituacao' | 'dhUgPagadora' | 'dhDiaPagamento' | 'dhValorDocOrigem' | 'valorRetencao' | 'percentualRetencao' | 'severity';

const pageSize = 100;
const sortLabels: Record<SortKey, string> = {
  documentoHabil: 'Documento habil',
  dhSituacao: 'Situacao',
  dhUgPagadora: 'UG pagadora',
  dhDiaPagamento: 'Data de pagamento',
  dhValorDocOrigem: 'Valor origem',
  valorRetencao: 'Valor retido',
  percentualRetencao: '% retencao',
  severity: 'Severidade',
};

const formatCurrency = (value: number | null) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const formatPercent = (value: number | null) => (value === null ? '-' : `${value.toFixed(2).replace('.', ',')}%`);
const formatDocumentoHabil = (value: string) => {
  const match = value.match(/\d{4}NP\d+$/i);
  return match ? match[0].toUpperCase() : value;
};

const severityWeight = { critical: 3, warning: 2, ok: 1 } satisfies Record<'critical' | 'warning' | 'ok', number>;

export default function RetencoesFdReinfDesign() {
  const [rows, setRows] = useState<RetencaoEfdReinfRegistro[]>([]);
  const [fileName, setFileName] = useState('');
  const [importedAt, setImportedAt] = useState<string | null>(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [query, setQuery] = useState('');
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('all');
  const [situacaoFilter, setSituacaoFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('severity');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const deferredQuery = useDeferredValue(query);

  const loadLatest = async (mode: 'initial' | 'refresh' = 'initial') => {
    try {
      if (mode === 'refresh') {
        setIsRefreshing(true);
      } else {
        setIsLoadingInitial(true);
      }
      const latest = await loadLatestRetencoesEfdReinfRowsFromDb();
      setRows(latest.rows);
      setFileName(latest.sourceFile);
      setImportedAt(latest.importedAt);
    } catch (error) {
      console.error('Erro ao carregar retencoes EFD-Reinf:', error);
      toast.error('Nao foi possivel carregar as retencoes EFD-Reinf do banco.');
    } finally {
      setIsLoadingInitial(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadLatest();
  }, []);

  const handleUpload = async (file?: File) => {
    if (!file) return;
    try {
      setIsUploading(true);
      const parsed = await parseRetencoesEfdReinfCsv(file);
      await saveRetencoesEfdReinfRows(parsed, file.name);
      setRows(parsed);
      setFileName(file.name);
      setImportedAt(new Date().toISOString());
      setPage(1);
      toast.success(`${parsed.length} linha(s) de retencao importadas com sucesso.`);
    } catch (error) {
      console.error('Erro ao importar retencoes EFD-Reinf:', error);
      toast.error((error as Error).message || 'Erro ao importar o arquivo de retencoes.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const rowsWithValidation = useMemo<ViewRow[]>(
    () => rows.map((row) => ({ row, validation: validateRetencaoEfdReinfRow(row) })),
    [rows],
  );

  const resumo = useMemo(() => ({
    total: rows.length,
    criticos: rowsWithValidation.filter((item) => item.validation.hasCriticalUgPagadora).length,
    alertasPrazo: rowsWithValidation.filter((item) => item.validation.hasWarningPrazo).length,
    comAlerta: rowsWithValidation.filter((item) => item.validation.issues.length > 0).length,
    liquidados: rows.filter((row) => row.dhItemLiquidado === true).length,
    valorTotalRetencao: rows.reduce((sum, row) => sum + row.valorRetencao, 0),
  }), [rows, rowsWithValidation]);

  const situacoes = useMemo(
    () => Array.from(new Set(rows.map((row) => row.dhSituacao).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return rowsWithValidation
      .filter(({ row, validation }) => {
        const matchQuery =
          !q ||
          [row.documentoHabil, row.dhProcesso, row.dhSituacao, row.dhCredorDocumento, row.dhCredorNome, row.dhUgPagadora, row.dhItemUgPagadora, row.metrica]
            .some((value) => value.toLowerCase().includes(q));
        const matchAlert =
          alertFilter === 'all' ||
          (alertFilter === 'critical' && validation.hasCriticalUgPagadora) ||
          (alertFilter === 'warning' && validation.hasWarningPrazo) ||
          (alertFilter === 'with-alert' && validation.issues.length > 0) ||
          (alertFilter === 'ok' && validation.issues.length === 0);
        const matchSituacao = situacaoFilter === 'all' || row.dhSituacao === situacaoFilter;
        return matchQuery && matchAlert && matchSituacao;
      })
      .sort((left, right) => {
        const direction = sortDirection === 'asc' ? 1 : -1;
        const getValue = (item: ViewRow) => {
          switch (sortKey) {
            case 'documentoHabil': return item.row.documentoHabil;
            case 'dhSituacao': return item.row.dhSituacao;
            case 'dhUgPagadora': return item.row.dhUgPagadora;
            case 'dhDiaPagamento': return item.row.dhDiaPagamento || '';
            case 'dhValorDocOrigem': return item.row.dhValorDocOrigem;
            case 'valorRetencao': return item.row.valorRetencao;
            case 'percentualRetencao': return item.validation.percentualRetencao ?? -1;
            case 'severity': return severityWeight[item.validation.severity];
          }
        };
        const a = getValue(left);
        const b = getValue(right);
        if (typeof a === 'number' && typeof b === 'number') return (a - b) * direction;
        return String(a).localeCompare(String(b), 'pt-BR') * direction;
      });
  }, [rowsWithValidation, deferredQuery, alertFilter, situacaoFilter, sortKey, sortDirection]);

  useEffect(() => {
    setPage(1);
  }, [deferredQuery, rows.length, alertFilter, situacaoFilter, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const rowsPage = useMemo(() => filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize), [filteredRows, safePage]);
  const pageStart = filteredRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = filteredRows.length === 0 ? 0 : Math.min(filteredRows.length, safePage * pageSize);
  const importedAtLabel = importedAt ? format(new Date(importedAt), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR }) : null;
  const resetFilters = () => {
    setQuery('');
    setAlertFilter('all');
    setSituacaoFilter('all');
    setSortKey('severity');
    setSortDirection('desc');
  };

  const handleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) return setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    setSortKey(nextKey);
    setSortDirection(nextKey === 'severity' ? 'desc' : 'asc');
  };

  const renderSortIcon = (column: SortKey) =>
    sortKey !== column ? <ArrowUpDown className="h-3.5 w-3.5 opacity-50" /> : sortDirection === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 text-primary" />
      : <ArrowDown className="h-3.5 w-3.5 text-primary" />;

  return (
    <div className="space-y-6 pb-10">
      <HeaderSubtitle>Auditoria das retencoes FDReinf com foco em UG pagadora, prazo esperado e percentual retido.</HeaderSubtitle>

      <HeaderActions>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => void handleUpload(event.target.files?.[0])} />
          <Button onClick={() => void loadLatest('refresh')} size="sm" variant="outline" disabled={isRefreshing || isUploading} className="gap-space-2 h-space-9 shadow-shadow-sm">
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            {isRefreshing ? 'Atualizando...' : 'Atualizar base'}
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} size="sm" variant="outline" disabled={isUploading} className="gap-space-2 h-space-9 shadow-shadow-sm">
            <FileUp className="h-4 w-4" />
            {isUploading ? 'Importando...' : 'Importar CSV FDReinf'}
          </Button>
        </div>
      </HeaderActions>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Registros auditados" value={resumo.total} subtitle={fileName ? `Base atual: ${fileName}` : 'Aguardando importacao da base'} icon={FileUp} stitchColor="vibrant-blue" isLoading={isLoadingInitial} />
        <StatCard title="Criticos de UG" value={resumo.criticos} subtitle="Itens com UG pagadora diferente de 158155" icon={ShieldAlert} stitchColor="red-500" progress={resumo.total ? (resumo.criticos / resumo.total) * 100 : 0} isLoading={isLoadingInitial} />
        <StatCard title="Alertas de prazo" value={resumo.alertasPrazo} subtitle="DDF021 e DDF025 fora da regra do dia 20" icon={AlertTriangle} stitchColor="amber" progress={resumo.total ? (resumo.alertasPrazo / resumo.total) * 100 : 0} isLoading={isLoadingInitial} />
        <StatCard title="Retencao total" value={formatCurrency(resumo.valorTotalRetencao)} subtitle={`${resumo.liquidados} item(ns) marcados como liquidados`} icon={ShieldAlert} stitchColor="emerald-green" isLoading={isLoadingInitial} />
      </div>

      <FilterPanel className="shadow-sm" title="Filtros da auditoria" actions={<Button type="button" variant="ghost" size="sm" onClick={resetFilters} disabled={sortKey === 'severity' && sortDirection === 'desc' && !query && alertFilter === 'all' && situacaoFilter === 'all'}>Limpar filtros</Button>}>
        <div className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_220px_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por documento, processo, credor, UG ou metrica..." className="input-system h-10 pl-9" />
            </div>
            <Select value={alertFilter} onValueChange={(value) => setAlertFilter(value as AlertFilter)}>
              <SelectTrigger className="input-system h-10"><SelectValue placeholder="Severidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as severidades</SelectItem>
                <SelectItem value="critical">Somente criticos</SelectItem>
                <SelectItem value="warning">Somente prazo</SelectItem>
                <SelectItem value="with-alert">Com qualquer alerta</SelectItem>
                <SelectItem value="ok">Somente OK</SelectItem>
              </SelectContent>
            </Select>
            <Select value={situacaoFilter} onValueChange={setSituacaoFilter}>
              <SelectTrigger className="input-system h-10"><SelectValue placeholder="Situacao" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situacoes</SelectItem>
                {situacoes.map((situacao) => <SelectItem key={situacao} value={situacao}>{situacao}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FilterPanel>

      <DataTablePanel title="Tabela de conferencia" description="Ordene pelas colunas para revisar documentos, datas, percentual retido e alertas." actions={<Badge variant="secondary" className="bg-slate-100 text-slate-700 font-medium">{pageStart}-{pageEnd} de {filteredRows.length}</Badge>}>
        <Table>
          <TableHeader className="bg-slate-50/70">
            <TableRow className="hover:bg-transparent border-b border-border-default/50">
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider"><button type="button" onClick={() => handleSort('documentoHabil')} className="flex items-center gap-2">Documento{renderSortIcon('documentoHabil')}</button></TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider"><button type="button" onClick={() => handleSort('dhSituacao')} className="flex items-center gap-2">Credor / situacao{renderSortIcon('dhSituacao')}</button></TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider"><button type="button" onClick={() => handleSort('dhUgPagadora')} className="flex items-center gap-2">UG pagadora{renderSortIcon('dhUgPagadora')}</button></TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider"><button type="button" onClick={() => handleSort('dhDiaPagamento')} className="flex items-center gap-2">Datas{renderSortIcon('dhDiaPagamento')}</button></TableHead>
              <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider"><button type="button" onClick={() => handleSort('dhValorDocOrigem')} className="ml-auto flex items-center gap-2">Valor origem{renderSortIcon('dhValorDocOrigem')}</button></TableHead>
              <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider"><button type="button" onClick={() => handleSort('valorRetencao')} className="ml-auto flex items-center gap-2">Retencao{renderSortIcon('valorRetencao')}</button></TableHead>
              <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider"><button type="button" onClick={() => handleSort('percentualRetencao')} className="ml-auto flex items-center gap-2">% retencao{renderSortIcon('percentualRetencao')}</button></TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider"><button type="button" onClick={() => handleSort('severity')} className="flex items-center gap-2">Alertas{renderSortIcon('severity')}</button></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingInitial || isUploading ? (
              <TableSkeletonRows rows={8} columns={8} widths={['w-36', 'w-52', 'w-24', 'w-44', 'w-24 ml-auto', 'w-24 ml-auto', 'w-20 ml-auto', 'w-40']} />
            ) : filteredRows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="h-28 text-center text-muted-foreground italic">Nenhum registro encontrado para os filtros aplicados.</TableCell></TableRow>
            ) : (
              rowsPage.map(({ row, validation }) => (
                <TableRow key={`${row.documentoHabil}-${row.sourceIndex}-${row.dhSituacao}-${row.valorRetencao}`} className={cn('border-b border-border-default/30 last:border-0 transition-colors', validation.severity === 'critical' ? 'bg-red-50/80 hover:bg-red-50' : validation.severity === 'warning' ? 'bg-amber-50/80 hover:bg-amber-50' : 'bg-white hover:bg-slate-50/70')}>
                  <TableCell className="px-4 py-3 align-top">
                    <div className="font-data text-xs font-semibold text-text-primary">{formatDocumentoHabil(row.documentoHabil)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{row.dhProcesso || '-'}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="font-mono text-[10px]">{row.dhEstado || 'sem estado'}</Badge>
                      <Badge variant="secondary" className="font-mono text-[10px]">{row.metrica || 'sem metrica'}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 align-top">
                    <div className="text-xs font-semibold text-text-primary">{row.dhCredorDocumento || '-'}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{row.dhCredorNome || '-'}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="font-mono text-[10px]">{row.dhSituacao || '-'}</Badge>
                      <Badge variant="secondary" className={cn('text-[10px]', row.dhItemLiquidado === true && 'border border-emerald-200 bg-emerald-50 text-emerald-700', row.dhItemLiquidado === false && 'border border-slate-200 bg-slate-100 text-slate-700', row.dhItemLiquidado === null && 'border border-slate-200 bg-white text-slate-500')}>
                        {row.dhItemLiquidado === true ? 'Liquidado' : row.dhItemLiquidado === false ? 'Nao liquidado' : 'Sem info'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 align-top">
                    <div className="text-xs font-semibold text-text-primary">DH: {row.dhUgPagadora || '-'}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Item: {row.dhItemUgPagadora || '-'}</div>
                  </TableCell>
                  <TableCell className="px-4 py-3 align-top">
                    <div className="text-xs">Emissao: {formatRetencaoEfdReinfDate(row.dhDataEmissaoDocOrigem)}</div>
                    <div className="mt-1 text-xs">DH pgto: {formatRetencaoEfdReinfDate(row.dhDiaPagamento)}</div>
                    <div className="mt-1 text-xs">Item vencto: {formatRetencaoEfdReinfDate(row.dhItemDiaVencimento)}</div>
                    <div className="mt-1 text-xs">Item pgto: {formatRetencaoEfdReinfDate(row.dhItemDiaPagamento)}</div>
                    {validation.expectedDate ? <div className="mt-2 text-[11px] font-medium text-amber-700">Esperado ({validation.expectedRule}): {formatRetencaoEfdReinfDate(validation.expectedDate)}</div> : null}
                  </TableCell>
                  <TableCell className="px-4 py-3 align-top text-right text-xs font-semibold text-text-primary">{formatCurrency(row.dhValorDocOrigem)}</TableCell>
                  <TableCell className="px-4 py-3 align-top text-right text-xs font-semibold text-status-warning">{formatCurrency(row.valorRetencao)}</TableCell>
                  <TableCell className="px-4 py-3 align-top text-right text-xs font-semibold text-text-primary">{formatPercent(validation.percentualRetencao)}</TableCell>
                  <TableCell className="px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-2">
                      {validation.hasCriticalUgPagadora ? <Badge variant="secondary" className="border border-red-200 bg-red-100 text-red-700">UG critica</Badge> : null}
                      {validation.hasWarningPrazo ? <Badge variant="secondary" className="border border-amber-200 bg-amber-100 text-amber-700">Prazo inconsistente</Badge> : null}
                      {validation.issues.length === 0 ? <Badge variant="secondary" className="border border-emerald-200 bg-emerald-50 text-emerald-700">OK</Badge> : null}
                    </div>
                    {validation.issues.length > 0 ? <div className="mt-2 space-y-1 text-[11px] leading-5 text-muted-foreground">{validation.issues.map((issue) => <div key={issue}>{issue}</div>)}</div> : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="flex flex-col gap-3 border-t border-border-default/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">Mostrando {pageStart}-{pageEnd} de {filteredRows.length} resultado(s)</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-xs text-muted-foreground">Pag. {safePage} de {totalPages}</span>
            <Button size="sm" variant="outline" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </DataTablePanel>
    </div>
  );
}
