import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, ShieldAlert, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import { HeaderActions } from '@/components/HeaderParts';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { TableSkeletonRows } from '@/components/design-system/TableSkeletonRows';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import {
  formatRetencaoEfdReinfDate,
  loadLatestRetencoesEfdReinfRowsFromDb,
  parseRetencoesEfdReinfCsv,
  RetencaoEfdReinfRegistro,
  saveRetencoesEfdReinfRows,
  validateRetencaoEfdReinfRow,
} from '@/services/retencoesEfdReinfImportService';

type RetencaoRowView = {
  row: RetencaoEfdReinfRegistro;
  validation: ReturnType<typeof validateRetencaoEfdReinfRow>;
};

type AlertFilter = 'all' | 'critical' | 'warning' | 'with-alert' | 'ok';
type SortKey =
  | 'documentoHabil'
  | 'dhSituacao'
  | 'dhUgPagadora'
  | 'dhDiaPagamento'
  | 'dhValorDocOrigem'
  | 'valorRetencao'
  | 'percentualRetencao'
  | 'severity';

const pageSize = 100;

const formatCurrency = (value: number | null) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const formatPercent = (value: number | null) =>
  value === null ? '-' : `${value.toFixed(2).replace('.', ',')}%`;

export default function RetencoesEfdReinfPage() {
  const [rows, setRows] = useState<RetencaoEfdReinfRegistro[]>([]);
  const [fileName, setFileName] = useState('');
  const [importedAt, setImportedAt] = useState<string | null>(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [query, setQuery] = useState('');
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('documentoHabil');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const deferredQuery = useDeferredValue(query);

  const loadLatest = async () => {
    try {
      setIsLoadingInitial(true);
      const latest = await loadLatestRetencoesEfdReinfRowsFromDb();
      setRows(latest.rows);
      setFileName(latest.sourceFile);
      setImportedAt(latest.importedAt);
    } catch (error) {
      console.error('Erro ao carregar retencoes EFD-Reinf:', error);
      toast.error('Nao foi possivel carregar as retencoes EFD-Reinf do banco.');
    } finally {
      setIsLoadingInitial(false);
    }
  };

  useEffect(() => {
    loadLatest();
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

  const rowsWithValidation = useMemo<RetencaoRowView[]>(
    () => rows.map((row) => ({ row, validation: validateRetencaoEfdReinfRow(row) })),
    [rows],
  );

  const resumo = useMemo(() => {
    const criticos = rowsWithValidation.filter((item) => item.validation.hasCriticalUgPagadora).length;
    const alertasPrazo = rowsWithValidation.filter((item) => item.validation.hasWarningPrazo).length;
    const valorTotalRetencao = rows.reduce((sum, row) => sum + row.valorRetencao, 0);

    return {
      total: rows.length,
      criticos,
      alertasPrazo,
      valorTotalRetencao,
    };
  }, [rows, rowsWithValidation]);

  const filteredRows = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const queriedRows = !q
      ? rowsWithValidation
      : rowsWithValidation.filter(({ row }) =>
      row.documentoHabil.toLowerCase().includes(q) ||
      row.dhProcesso.toLowerCase().includes(q) ||
      row.dhSituacao.toLowerCase().includes(q) ||
      row.dhCredorDocumento.toLowerCase().includes(q) ||
      row.dhCredorNome.toLowerCase().includes(q),
    );

    const alertFilteredRows = queriedRows.filter(({ validation }) => {
      switch (alertFilter) {
        case 'critical':
          return validation.hasCriticalUgPagadora;
        case 'warning':
          return validation.hasWarningPrazo;
        case 'with-alert':
          return validation.hasCriticalUgPagadora || validation.hasWarningPrazo;
        case 'ok':
          return validation.issues.length === 0;
        default:
          return true;
      }
    });

    const severityWeight = {
      critical: 3,
      warning: 2,
      ok: 1,
    } satisfies Record<'critical' | 'warning' | 'ok', number>;

    return [...alertFilteredRows].sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;

      const comparableA = (() => {
        switch (sortKey) {
          case 'documentoHabil':
            return a.row.documentoHabil;
          case 'dhSituacao':
            return a.row.dhSituacao;
          case 'dhUgPagadora':
            return a.row.dhUgPagadora;
          case 'dhDiaPagamento':
            return a.row.dhDiaPagamento || '';
          case 'dhValorDocOrigem':
            return a.row.dhValorDocOrigem;
          case 'valorRetencao':
            return a.row.valorRetencao;
          case 'percentualRetencao':
            return a.validation.percentualRetencao ?? -1;
          case 'severity':
            return severityWeight[a.validation.severity];
        }
      })();

      const comparableB = (() => {
        switch (sortKey) {
          case 'documentoHabil':
            return b.row.documentoHabil;
          case 'dhSituacao':
            return b.row.dhSituacao;
          case 'dhUgPagadora':
            return b.row.dhUgPagadora;
          case 'dhDiaPagamento':
            return b.row.dhDiaPagamento || '';
          case 'dhValorDocOrigem':
            return b.row.dhValorDocOrigem;
          case 'valorRetencao':
            return b.row.valorRetencao;
          case 'percentualRetencao':
            return b.validation.percentualRetencao ?? -1;
          case 'severity':
            return severityWeight[b.validation.severity];
        }
      })();

      if (typeof comparableA === 'number' && typeof comparableB === 'number') {
        return (comparableA - comparableB) * direction;
      }

      return String(comparableA).localeCompare(String(comparableB), 'pt-BR') * direction;
    });
  }, [rowsWithValidation, deferredQuery, alertFilter, sortDirection, sortKey]);

  useEffect(() => {
    setPage(1);
  }, [deferredQuery, rows.length, alertFilter, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const rowsPage = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);

  const importedAtLabel = importedAt
    ? format(new Date(importedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : null;

  const handleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextKey);
    setSortDirection('asc');
  };

  const renderSortIcon = (column: SortKey) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 text-primary" />
      : <ArrowDown className="h-3.5 w-3.5 text-primary" />;
  };

  return (
    <div className="space-y-6 pb-10">
      <HeaderActions>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(event) => handleUpload(event.target.files?.[0])}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            size="sm"
            variant="outline"
            disabled={isUploading}
            className="gap-space-2 h-space-9 shadow-shadow-sm"
          >
            <Upload className="h-4 w-4" />
            {isUploading ? 'Carregando...' : 'Upload CSV Retenções'}
          </Button>
        </div>
      </HeaderActions>

      <SectionPanel
        title="Retenções EFD-Reinf"
        description="Conferência das retenções importadas via CSV, com validações de UG pagadora, vencimento e pagamento."
      >
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-border-default/60 bg-white px-4 py-3 shadow-soft">
            <p className="label-eyebrow">Registros</p>
            <p className="mt-2 font-ui text-2xl font-semibold text-text-primary">{resumo.total}</p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50/70 px-4 py-3 shadow-soft">
            <p className="label-eyebrow text-red-700/80">Críticos</p>
            <p className="mt-2 font-ui text-2xl font-semibold text-red-700">{resumo.criticos}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 shadow-soft">
            <p className="label-eyebrow text-amber-700/80">Alertas de prazo</p>
            <p className="mt-2 font-ui text-2xl font-semibold text-amber-700">{resumo.alertasPrazo}</p>
          </div>
          <div className="rounded-2xl border border-border-default/60 bg-white px-4 py-3 shadow-soft">
            <p className="label-eyebrow">Retenção total</p>
            <p className="mt-2 font-ui text-2xl font-semibold text-text-primary">
              {formatCurrency(resumo.valorTotalRetencao)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="border border-red-200 bg-red-50 text-red-700">
            <ShieldAlert className="mr-1 h-3.5 w-3.5" />
            Vermelho: DH Item - UG Pagadora diferente de 158155
          </Badge>
          <Badge variant="secondary" className="border border-amber-200 bg-amber-50 text-amber-700">
            <AlertTriangle className="mr-1 h-3.5 w-3.5" />
            Amarelo: datas de DDF025/DDF021 fora da regra do dia 20
          </Badge>
          {importedAtLabel ? (
            <span className="ml-auto">Última importação: {importedAtLabel}{fileName ? ` · ${fileName}` : ''}</span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por documento, processo, situação ou credor..."
              className="input-system h-10 pl-9"
            />
          </div>
          <Select value={alertFilter} onValueChange={(value) => setAlertFilter(value as AlertFilter)}>
            <SelectTrigger className="h-10 w-full md:w-[220px]">
              <SelectValue placeholder="Filtrar alertas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os registros</SelectItem>
              <SelectItem value="critical">Somente críticos</SelectItem>
              <SelectItem value="warning">Somente prazo</SelectItem>
              <SelectItem value="with-alert">Com qualquer alerta</SelectItem>
              <SelectItem value="ok">Somente OK</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SectionPanel>

      <DataTablePanel title="Tabela de conferência">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-b border-border-default/50">
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                <button type="button" onClick={() => handleSort('documentoHabil')} className="flex items-center gap-2">
                  Documento
                  {renderSortIcon('documentoHabil')}
                </button>
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                <button type="button" onClick={() => handleSort('dhSituacao')} className="flex items-center gap-2">
                  Credor / Situação
                  {renderSortIcon('dhSituacao')}
                </button>
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                <button type="button" onClick={() => handleSort('dhUgPagadora')} className="flex items-center gap-2">
                  UG Pagadora
                  {renderSortIcon('dhUgPagadora')}
                </button>
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                <button type="button" onClick={() => handleSort('dhDiaPagamento')} className="flex items-center gap-2">
                  Datas
                  {renderSortIcon('dhDiaPagamento')}
                </button>
              </TableHead>
              <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                <button type="button" onClick={() => handleSort('dhValorDocOrigem')} className="ml-auto flex items-center gap-2">
                  Valor Origem
                  {renderSortIcon('dhValorDocOrigem')}
                </button>
              </TableHead>
              <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                <button type="button" onClick={() => handleSort('valorRetencao')} className="ml-auto flex items-center gap-2">
                  Retenção
                  {renderSortIcon('valorRetencao')}
                </button>
              </TableHead>
              <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                <button type="button" onClick={() => handleSort('percentualRetencao')} className="ml-auto flex items-center gap-2">
                  % Retenção
                  {renderSortIcon('percentualRetencao')}
                </button>
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                <button type="button" onClick={() => handleSort('severity')} className="flex items-center gap-2">
                  Alertas
                  {renderSortIcon('severity')}
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingInitial || isUploading ? (
              <TableSkeletonRows
                rows={8}
                columns={8}
                widths={['w-36', 'w-52', 'w-20', 'w-44', 'w-24 ml-auto', 'w-24 ml-auto', 'w-20 ml-auto', 'w-40']}
              />
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground italic">
                  Nenhum registro encontrado.
                </TableCell>
              </TableRow>
            ) : (
              rowsPage.map(({ row, validation }) => {
                const rowClassName =
                  validation.severity === 'critical'
                    ? 'bg-red-50/70 hover:bg-red-50/80'
                    : validation.severity === 'warning'
                      ? 'bg-amber-50/70 hover:bg-amber-50/80'
                      : 'border-b border-border-default/30 last:border-0';

                return (
                  <TableRow
                    key={`${row.documentoHabil}-${row.sourceIndex}-${row.dhSituacao}-${row.valorRetencao}`}
                    className={`${rowClassName} border-b border-border-default/30 last:border-0`}
                  >
                    <TableCell className="px-4 py-3 align-top">
                      <div className="font-mono text-xs font-semibold">{row.documentoHabil}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{row.dhProcesso || '-'}</div>
                    </TableCell>
                    <TableCell className="px-4 py-3 align-top">
                      <div className="text-xs font-semibold">{row.dhCredorDocumento || '-'}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{row.dhCredorNome || '-'}</div>
                      <div className="mt-2">
                        <Badge variant="secondary" className="font-mono text-[11px]">
                          {row.dhSituacao || '-'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 align-top">
                      <div className="text-xs font-semibold">DH: {row.dhUgPagadora || '-'}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Item: {row.dhItemUgPagadora || '-'}</div>
                    </TableCell>
                    <TableCell className="px-4 py-3 align-top">
                      <div className="text-xs">Emissão: {formatRetencaoEfdReinfDate(row.dhDataEmissaoDocOrigem)}</div>
                      <div className="mt-1 text-xs">DH Pgto: {formatRetencaoEfdReinfDate(row.dhDiaPagamento)}</div>
                      <div className="mt-1 text-xs">Item Vencto: {formatRetencaoEfdReinfDate(row.dhItemDiaVencimento)}</div>
                      <div className="mt-1 text-xs">Item Pgto: {formatRetencaoEfdReinfDate(row.dhItemDiaPagamento)}</div>
                      {validation.expectedDate ? (
                        <div className="mt-2 text-[11px] font-medium text-amber-700">
                          Esperado ({validation.expectedRule}): {formatRetencaoEfdReinfDate(validation.expectedDate)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-top text-right text-xs font-semibold">
                      {formatCurrency(row.dhValorDocOrigem)}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-top text-right text-xs font-semibold text-status-warning">
                      {formatCurrency(row.valorRetencao)}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-top text-right text-xs font-semibold">
                      {formatPercent(validation.percentualRetencao)}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        {validation.hasCriticalUgPagadora ? (
                          <Badge variant="secondary" className="border border-red-200 bg-red-100 text-red-700">
                            UG item crítica
                          </Badge>
                        ) : null}
                        {validation.hasWarningPrazo ? (
                          <Badge variant="secondary" className="border border-amber-200 bg-amber-100 text-amber-700">
                            Prazo inconsistente
                          </Badge>
                        ) : null}
                        {validation.issues.length === 0 ? (
                          <Badge variant="secondary" className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                            OK
                          </Badge>
                        ) : null}
                      </div>
                      {validation.issues.length > 0 ? (
                        <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                          {validation.issues.map((issue) => (
                            <div key={issue}>{issue}</div>
                          ))}
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between border-t border-border-default/50 px-4 py-3">
          <span className="text-xs text-muted-foreground">{filteredRows.length} resultado(s)</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              Pag. {page} de {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DataTablePanel>
    </div>
  );
}
