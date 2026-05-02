import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, FileText, Calendar, DollarSign, ExternalLink, ArrowUpDown, ChevronUp, ChevronDown, RefreshCw, Eye, Star } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { StatCard } from '@/components/StatCard';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { formatCurrency, formatarDocumento, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { HeaderActions } from '@/components/HeaderParts';
import { ContratosSyncDialog } from '@/components/modals/ContratosSyncDialog';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getRapBaseVigente, getRapReferenceYear, getRapSaldoAtual } from '@/utils/rapMetrics';
import { normalizeContratoNumero, shouldIgnoreContratoNumero } from '@/utils/contratosSync';
import { getValorTotalFromHistorico } from '@/utils/contratosApiHistorico';
import { contratosApiService, type ContratoApiDetails, type ContratoApiEmpenhoRow, type ContratoApiHistoricoRow, type ContratoApiRow, type ContratoApiSyncRun } from '@/services/contratosApi';
import { ContratoApiDetailsSheet } from '@/components/contratos/ContratoApiDetailsSheet';
import { useUserFavorites } from '@/services/userFavorites';

const REITORIA_UG = '158155';
const normalizeEmpenhoRef = (value: string) =>
  (value || '')
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const toApiCurrencyNumber = (value: unknown) => {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const parsed = Number(
    String(value)
      .trim()
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, ''),
  );
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getApiEmpenhoNumber = (
  empenho: ContratoApiEmpenhoRow,
  dbKey: keyof ContratoApiEmpenhoRow,
  rawKey: string,
) => {
  const fromDb = toApiCurrencyNumber(empenho[dbKey]);
  if (fromDb !== undefined) return Math.max(0, fromDb);

  const raw = empenho.raw_data && typeof empenho.raw_data === 'object' ? empenho.raw_data : {};
  const fromRaw = toApiCurrencyNumber((raw as Record<string, unknown>)[rawKey]);
  return fromRaw === undefined ? undefined : Math.max(0, fromRaw);
};

const getApiEmpenhoYear = (empenho: ContratoApiEmpenhoRow) => {
  const match = empenho.numero.match(/^(\d{4})NE/i);
  if (match) return Number(match[1]);
  if (!empenho.data_emissao) return new Date().getFullYear();
  const parsed = new Date(empenho.data_emissao);
  return Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getFullYear();
};

export default function Contratos() {
  const { isSuperAdmin } = useAuth();
  const { contratos, empenhos, contratosEmpenhos, isLoading, refreshData } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [favoritesFilter, setFavoritesFilter] = useState<'all' | 'favorites'>('all');
  const { favoriteIdsByType, isFavorite, toggleFavorite, isPending: isFavoritePending } = useUserFavorites();
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [apiContratos, setApiContratos] = useState<ContratoApiRow[]>([]);
  const [apiEmpenhos, setApiEmpenhos] = useState<ContratoApiEmpenhoRow[]>([]);
  const [apiHistoricos, setApiHistoricos] = useState<ContratoApiHistoricoRow[]>([]);
  const [lastApiSyncRun, setLastApiSyncRun] = useState<ContratoApiSyncRun | null>(null);
  const [selectedApiContrato, setSelectedApiContrato] = useState<ContratoApiRow | null>(null);
  const [selectedApiDetails, setSelectedApiDetails] = useState<ContratoApiDetails | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadApiContracts() {
      try {
        const contratosApi = await contratosApiService.getContratosApi(true);
        const contratoApiIds = contratosApi.map((contrato) => contrato.id);
        const [empenhosApi, historicosApi, lastSync] = await Promise.all([contratosApiService.getEmpenhosApi(contratoApiIds), contratosApiService.getHistoricosApi(contratoApiIds), contratosApiService.getLastSyncRun().catch(() => null)]);
        if (cancelled) return;
        setApiContratos(contratosApi);
        setApiEmpenhos(empenhosApi);
        setApiHistoricos(historicosApi);
        setLastApiSyncRun(lastSync);
      } catch (error) {
        console.warn('Contratos: nao foi possivel carregar dados da API do Comprasnet', error);
      }
    }

    loadApiContracts();

    return () => {
      cancelled = true;
    };
  }, []);

  const normalizeString = useCallback(
    (str: string) =>
      str
        ? str
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
        : '',
    [],
  );

  const visibleContratos = useMemo(() => contratos.filter((c) => !shouldIgnoreContratoNumero(c.numero)), [contratos]);

  const apiContratoByNumero = useMemo(() => {
    const map = new Map<string, ContratoApiRow>();
    for (const contrato of apiContratos) {
      map.set(normalizeContratoNumero(contrato.numero), contrato);
    }
    return map;
  }, [apiContratos]);

  const apiEmpenhosByContratoApiId = useMemo(() => {
    const map = new Map<string, ContratoApiEmpenhoRow[]>();
    for (const empenho of apiEmpenhos) {
      const current = map.get(empenho.contrato_api_id) ?? [];
      current.push(empenho);
      map.set(empenho.contrato_api_id, current);
    }
    return map;
  }, [apiEmpenhos]);

  const apiHistoricosByContratoApiId = useMemo(() => {
    const map = new Map<string, ContratoApiHistoricoRow[]>();
    for (const historico of apiHistoricos) {
      const current = map.get(historico.contrato_api_id) ?? [];
      current.push(historico);
      map.set(historico.contrato_api_id, current);
    }
    return map;
  }, [apiHistoricos]);

  const openApiDetails = useCallback(async (contrato: ContratoApiRow) => {
    setSelectedApiContrato(contrato);
    setSelectedApiDetails(null);
    setIsDetailsOpen(true);
    setIsDetailsLoading(true);
    try {
      const details = await contratosApiService.getContratoApiDetails(contrato.id);
      setSelectedApiDetails(details);
    } catch (error) {
      console.error('Contratos: erro ao carregar detalhes do contrato da API', error);
      setSelectedApiDetails({
        historico: [],
        empenhos: [],
        itens: [],
        faturas: [],
        faturaItens: [],
        faturaEmpenhos: [],
      });
    } finally {
      setIsDetailsLoading(false);
    }
  }, []);

  const filteredContratos = useMemo(() => {
    const searchNormalized = normalizeString(searchTerm);
    const baseContratos = favoritesFilter === 'favorites'
      ? visibleContratos.filter((contrato) => favoriteIdsByType.contrato.has(contrato.id))
      : visibleContratos;

    let result = baseContratos.filter((c) => {
      return normalizeString(c.numero).includes(searchNormalized) || normalizeString(c.contratada).includes(searchNormalized) || normalizeString(c.cnpj || '').includes(searchNormalized);
    });

    if (sortConfig) {
      result = [...result].sort((a, b) => {
        let aValue: string | number = '';
        let bValue: string | number = '';

        if (sortConfig.key === 'numero') {
          aValue = a.numero;
          bValue = b.numero;
        } else if (sortConfig.key === 'data_termino') {
          aValue = a.data_termino ? new Date(a.data_termino).getTime() : 0;
          bValue = b.data_termino ? new Date(b.data_termino).getTime() : 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [visibleContratos, favoritesFilter, favoriteIdsByType, searchTerm, normalizeString, sortConfig]);

  const safeFormatDate = (dateVal: Date | string | null | undefined) => {
    if (!dateVal) return '-';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '-';
      return format(d, 'dd/MM/yyyy');
    } catch (e) {
      return '-';
    }
  };

  const rapReferenceYear = useMemo(() => getRapReferenceYear(empenhos), [empenhos]);

  const getEmpenhosDoContrato = useCallback(
    (contratoId: string) => {
      const linkIds = contratosEmpenhos.filter((l) => l.contrato_id === contratoId).map((l) => l.empenho_id);

      // Compatibilidade: dependendo do histórico/imports, `contratos_empenhos.empenho_id`
      // pode estar armazenando o UUID do empenho OU o número do empenho.
      // Para não "sumir" vínculos na UI, resolvemos por ambos.
      const byId = new Map(empenhos.map((e) => [e.id, e] as const));
      const byNumero = new Map(empenhos.map((e) => [e.numero, e] as const));
      const byNumeroNorm = new Map(empenhos.map((e) => [normalizeEmpenhoRef(e.numero), e] as const));
      // Alguns vínculos antigos guardam só o final do número
      const byNumeroSuffix12 = new Map(empenhos.map((e) => [normalizeEmpenhoRef(e.numero).slice(-12), e] as const));

      const resolved: typeof empenhos = [];
      const seen = new Set<string>();
      for (const ref of linkIds) {
        const refStr = (ref || '').toString().trim();
        const refNorm = normalizeEmpenhoRef(refStr);
        const emp = byId.get(refStr) || byNumero.get(refStr) || byNumeroNorm.get(refNorm) || (refNorm.length >= 12 ? byNumeroSuffix12.get(refNorm.slice(-12)) : undefined);
        if (!emp) continue;
        if (seen.has(emp.id)) continue;
        seen.add(emp.id);
        resolved.push(emp);
      }
      return resolved;
    },
    [empenhos, contratosEmpenhos],
  );

  const getValorEmpenhadoLocal = useCallback(
    (contratoId: string) => {
      const emps = getEmpenhosDoContrato(contratoId);
      return emps.reduce((sum, empenho) => sum + (empenho.valor || 0), 0);
    },
    [getEmpenhosDoContrato],
  );

  const getValorEmpenhadoApi = useCallback(
    (contratoApiId: string) => {
      return (apiEmpenhosByContratoApiId.get(contratoApiId) ?? []).reduce((sum, empenho) => sum + (Number(empenho.valor_empenhado) || 0), 0);
    },
    [apiEmpenhosByContratoApiId],
  );

  const getValorEmpenhadoContrato = useCallback(
    (contratoId: string, apiContrato?: ContratoApiRow) => {
      if (apiContrato) {
        const apiTotal = getValorEmpenhadoApi(apiContrato.id);
        if (apiTotal > 0) return apiTotal;
      }
      return getValorEmpenhadoLocal(contratoId);
    },
    [getValorEmpenhadoApi, getValorEmpenhadoLocal],
  );

  const getValorTotalContrato = useCallback((contrato: { valor?: number | null }, apiContrato?: ContratoApiRow, historico: ContratoApiHistoricoRow[] = []) => {
    const valorHistorico = getValorTotalFromHistorico(historico);
    if (valorHistorico > 0) return valorHistorico;

    return contrato.valor || 0;
  }, []);

  const totalALiquidarGlobal = useMemo(() => {
    return visibleContratos.reduce((sumContrato, c) => {
      const emps = getEmpenhosDoContrato(c.id);
      return (
        sumContrato +
        emps.reduce((sumEmp, e) => {
          if (e.tipo === 'rap') return sumEmp + getRapSaldoAtual(e, rapReferenceYear);
          const liquidado = (e.valorLiquidadoAPagar || 0) + (e.valorPagoOficial || 0);
          return sumEmp + Math.max(0, e.valor - liquidado);
        }, 0)
      );
    }, 0);
  }, [visibleContratos, getEmpenhosDoContrato, rapReferenceYear]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (!sortConfig || sortConfig.key !== columnKey) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="ml-2 h-3 w-3 text-primary" /> : <ChevronDown className="ml-2 h-3 w-3 text-primary" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  return (
    <div className="space-y-6 pb-10">
      <HeaderActions>
        {isSuperAdmin ? (
          <Button variant="outline" className="gap-2 h-8 text-xs sm:h-9 sm:text-sm bg-surface-card border-border-default shadow-sm transition-all" onClick={() => setIsSyncDialogOpen(true)}>
            <RefreshCw className="h-4 w-4 text-action-primary" />
            Sincronizar Contratos
          </Button>
        ) : null}
      </HeaderActions>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <StatCard title="Contratos Ativos" value={visibleContratos.length} icon={FileText} stitchColor="vibrant-blue" />

        <StatCard
          title="Valor Total"
          value={formatCurrency(
            visibleContratos.reduce((sum, c) => {
              const apiContrato = apiContratoByNumero.get(normalizeContratoNumero(c.numero));
              const historico = apiContrato ? (apiHistoricosByContratoApiId.get(apiContrato.id) ?? []) : [];
              return sum + getValorTotalContrato(c, apiContrato, historico);
            }, 0),
          )}
          icon={DollarSign}
          stitchColor="purple"
        />

        <StatCard
          title="Saldo Atual"
          value={formatCurrency(totalALiquidarGlobal)}
          icon={Calendar}
          stitchColor="amber"
          progress={45} // Placeholder progress or calculate if possible
        />

        <StatCard
          title="Valor Empenhado"
          value={formatCurrency(
            visibleContratos.reduce((sum, c) => {
              const apiContrato = apiContratoByNumero.get(normalizeContratoNumero(c.numero));
              return sum + getValorEmpenhadoContrato(c.id, apiContrato);
            }, 0),
          )}
          icon={ExternalLink}
          stitchColor="emerald-green"
        />
      </div>

      {/* Standard Filter Card */}
      <FilterPanel className="shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <Input placeholder="Buscar por número ou contratada..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input-system h-10 pl-9 text-sm" />
          </div>
          <div className="inline-flex h-10 overflow-hidden rounded-xl border border-border-default bg-white shadow-sm">
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
        </div>
      </FilterPanel>

      <DataTablePanel title="Contratos Ativos" className="mt-6" tableContainerClassName="border-t border-border-default/50">
        <Table>
          <TableHeader className="bg-surface-subtle/70">
            <TableRow className="hover:bg-transparent border-b border-border-default/50">
              <TableHead className="h-11 cursor-pointer px-6 transition-colors hover:bg-surface-subtle" onClick={() => handleSort('numero')}>
                <div className="flex items-center">
                  Contrato
                  <SortIcon columnKey="numero" />
                </div>
              </TableHead>
              <TableHead className="h-11 px-4">Contratada</TableHead>
              <TableHead className="h-11 cursor-pointer px-4 text-right transition-colors hover:bg-surface-subtle" onClick={() => handleSort('data_termino')}>
                <div className="flex items-center justify-end">
                  Vigência
                  <SortIcon columnKey="data_termino" />
                </div>
              </TableHead>
              <TableHead className="h-11 px-4 text-right">Valor Total</TableHead>
              <TableHead className="h-11 px-6">Empenhado</TableHead>
              <TableHead className="h-11 px-4 text-right">Saldo Atual</TableHead>
              <TableHead className="h-11 px-6 text-right">API</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContratos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">
                  Nenhum contrato encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredContratos.map((c) => {
                const apiContrato = apiContratoByNumero.get(normalizeContratoNumero(c.numero));
                const hasReitoriaOrigin = apiContrato?.unidade_origem_codigo === REITORIA_UG;
                const empenhosVinculados = getEmpenhosDoContrato(c.id);
                const localEmpenhosNorm = new Set(empenhosVinculados.map((e) => normalizeEmpenhoRef(e.numero)).filter(Boolean));
                const empenhosApiVinculados = apiContrato ? (apiEmpenhosByContratoApiId.get(apiContrato.id) ?? []) : [];
                const empenhosApiSomente = empenhosApiVinculados.filter((empenhoApi) => {
                  const numeroNorm = normalizeEmpenhoRef(empenhoApi.numero);
                  return numeroNorm && !localEmpenhosNorm.has(numeroNorm);
                });
                const historicoApi = apiContrato ? (apiHistoricosByContratoApiId.get(apiContrato.id) ?? []) : [];
                const valorTotalContrato = getValorTotalContrato(c, apiContrato, historicoApi);
                const totalEmpenhado = getValorEmpenhadoContrato(c.id, apiContrato);
                const percentualEmpenhado = valorTotalContrato > 0 ? Math.min(100, (totalEmpenhado / valorTotalContrato) * 100) : 0;

                const totalALiquidar = empenhosVinculados.reduce((sum, e) => {
                  if (e.tipo === 'rap') return sum + getRapSaldoAtual(e, rapReferenceYear);
                  const liquidado = (e.valorLiquidadoAPagar || 0) + (e.valorPagoOficial || 0);
                  return sum + Math.max(0, e.valor - liquidado);
                }, 0);

                return (
                  <TableRow key={c.id} className="border-b border-border-default/40 transition-colors last:border-0 hover:bg-surface-subtle/60">
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={isFavorite('contrato', c.id) ? `Remover contrato ${c.numero} dos favoritos` : `Favoritar contrato ${c.numero}`}
                              className={cn(
                                'h-8 w-8 hover:bg-amber-50',
                                isFavorite('contrato', c.id)
                                  ? 'text-amber-500 hover:text-amber-600'
                                  : 'text-muted-foreground hover:text-amber-500',
                              )}
                              disabled={isFavoritePending}
                              onClick={() => {
                                void toggleFavorite('contrato', c.id);
                              }}
                            >
                              <Star className={cn('h-4 w-4', isFavorite('contrato', c.id) ? 'fill-current' : '')} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{isFavorite('contrato', c.id) ? 'Remover dos favoritos' : 'Favoritar contrato'}</TooltipContent>
                        </Tooltip>
                        <span className="font-data text-sm font-medium text-text-primary">{c.numero}</span>
                      </div>
                      {hasReitoriaOrigin ? (
                        <Badge variant="secondary" className="ml-2 rounded-md text-[10px]" title="Contrato com unidade de origem 158155. O contrato global pode ser da Reitoria; leia a execução pelos empenhos/faturas da UG 158366.">
                          Origem Reitoria
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-text-primary">{c.contratada}</span>
                        {c.cnpj && <span className="font-data text-xs text-text-secondary">{formatarDocumento(c.cnpj)}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-4 text-right">
                      <div className="flex flex-col text-xs space-y-0.5">
                        <span className="text-text-secondary">+ {safeFormatDate(c.data_inicio)}</span>
                        <span className="font-medium text-text-secondary">- {safeFormatDate(c.data_termino)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-4 text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-sm font-semibold text-action-primary">{formatCurrency(valorTotalContrato)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <div className="space-y-2">
                        {totalEmpenhado > 0 && (
                          <div className="rounded-radius-md border border-border-default/60 bg-surface-subtle/80 p-space-3 shadow-soft">
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <span className="font-semibold text-text-primary">{formatCurrency(totalEmpenhado)}</span>
                              <span className="font-medium text-text-secondary">{percentualEmpenhado.toFixed(1)}%</span>
                            </div>
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border-default/80">
                              <div className="h-full rounded-full bg-action-primary transition-all" style={{ width: `${percentualEmpenhado}%` }} />
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1">
                          {empenhosVinculados.length > 0 || empenhosApiSomente.length > 0 ? (
                            <>
                            {empenhosVinculados.map((e) => {
                              const balance = e.tipo === 'rap' ? getRapSaldoAtual(e, rapReferenceYear) : Math.max(0, e.valor - ((e.valorLiquidadoAPagar || 0) + (e.valorPagoOficial || 0)));
                              const rapBase = e.tipo === 'rap' ? getRapBaseVigente(e, rapReferenceYear) : 0;

                              return (
                                <Popover key={e.id}>
                                  <PopoverTrigger asChild>
                                    <Badge variant="secondary" className="text-[10px] font-mono py-0 h-5 cursor-pointer hover:bg-muted-foreground/20 transition-colors">
                                      {e.numero}
                                    </Badge>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64 border-border-default/60 p-3 shadow-lifted">
                                    <div className="space-y-2">
                                      <div className="mr-1 flex items-center justify-between border-b border-border-default/50 pb-1">
                                        <span className="font-data text-xs font-bold text-action-primary">{e.numero}</span>
                                        <Badge variant="outline" className="text-[9px] uppercase px-1 h-4">
                                          {e.tipo === 'rap' ? 'RAP' : 'Exercício'}
                                        </Badge>
                                      </div>
                                      <div className="grid grid-cols-2 gap-y-1.5 text-xs py-1">
                                        <span className="text-text-secondary">{e.tipo === 'rap' ? 'Empenhado:' : 'Valor Total:'}</span>
                                        <span className="text-right font-medium">{formatCurrency(e.tipo === 'rap' ? rapBase : e.valor || 0)}</span>
                                        <span className="font-semibold text-text-secondary">{e.tipo === 'rap' ? 'Saldo Atual:' : 'Saldo a Liquidar:'}</span>
                                        <span className={cn('text-right font-bold underline decoration-dotted', balance > 0 ? 'text-status-warning' : 'text-status-success')}>{formatCurrency(balance)}</span>
                                      </div>
                                      {e.tipo !== 'rap' && (
                                        <div className="mt-1 border-t border-dashed border-border-default/50 pt-1.5">
                                          <div className="flex justify-between text-[10px]">
                                            <span className="text-text-secondary">Total Liquidado:</span>
                                            <span className="font-medium text-status-success">{formatCurrency((e.valorLiquidadoAPagar || 0) + (e.valorPagoOficial || 0))}</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              );
                            })}
                            {empenhosApiSomente.map((e) => {
                              const valorEmpenhadoApi = Number(e.valor_empenhado) || 0;
                              const valorALiquidarApi = Number(e.valor_a_liquidar) || 0;
                              const valorLiquidadoApi = Number(e.valor_liquidado) || 0;
                              const valorPagoApi = Number(e.valor_pago) || 0;
                              const rpInscritoApi = getApiEmpenhoNumber(e, 'rp_inscrito', 'rpinscrito') ?? 0;
                              const rpALiquidarApi = getApiEmpenhoNumber(e, 'rp_a_liquidar', 'rpaliquidar') ?? 0;
                              const rpLiquidadoApi = getApiEmpenhoNumber(e, 'rp_liquidado', 'rpliquidado') ?? 0;
                              const rpPagoApi = getApiEmpenhoNumber(e, 'rp_pago', 'rppago') ?? 0;
                              const rpAPagarDbApi = getApiEmpenhoNumber(e, 'rp_a_pagar', 'rpapagar');
                              const rpLiquidadoPagoApi = rpLiquidadoApi + rpPagoApi;
                              const rpBaseApi =
                                rpInscritoApi > 0
                                  ? rpInscritoApi
                                  : rpALiquidarApi > 0
                                    ? rpALiquidarApi
                                    : rpLiquidadoPagoApi + (rpAPagarDbApi ?? 0);
                              const rpAPagarApi = rpAPagarDbApi ?? Math.max(0, rpBaseApi - rpLiquidadoPagoApi);
                              const totalLiquidadoApi = valorLiquidadoApi + valorPagoApi;
                              const isRapApi = rpBaseApi > 0 || rpAPagarApi > 0 || rpLiquidadoPagoApi > 0;
                              const apiEmpenhoYear = getApiEmpenhoYear(e);
                              const rapBaseLabel = apiEmpenhoYear <= new Date().getFullYear() - 2 ? 'RP reinscrito:' : 'RP inscrito:';

                              return (
                                <Popover key={`api-${e.id}`}>
                                  <PopoverTrigger asChild>
                                    <Badge variant="secondary" className="text-[10px] font-mono py-0 h-5 cursor-pointer hover:bg-muted-foreground/20 transition-colors">
                                      {e.numero}
                                    </Badge>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64 border-border-default/60 p-3 shadow-lifted">
                                    <div className="space-y-2">
                                      <div className="mr-1 flex items-center justify-between border-b border-border-default/50 pb-1">
                                        <span className="font-data text-xs font-bold text-action-primary">{e.numero}</span>
                                        <Badge variant="outline" className="text-[9px] uppercase px-1 h-4">
                                          {isRapApi ? 'RAP' : 'Exercício'}
                                        </Badge>
                                      </div>
                                      <div className="grid grid-cols-2 gap-y-1.5 text-xs py-1">
                                        <span className="text-text-secondary">{isRapApi ? rapBaseLabel : 'Valor Total:'}</span>
                                        <span className="text-right font-medium">{formatCurrency(isRapApi ? rpBaseApi : valorEmpenhadoApi)}</span>
                                        <span className="font-semibold text-text-secondary">{isRapApi ? 'Saldo Atual:' : 'Saldo a Liquidar:'}</span>
                                        <span className={cn('text-right font-bold underline decoration-dotted', (isRapApi ? rpAPagarApi : valorALiquidarApi) > 0 ? 'text-status-warning' : 'text-status-success')}>
                                          {formatCurrency(isRapApi ? rpAPagarApi : valorALiquidarApi)}
                                        </span>
                                      </div>
                                      <div className="mt-1 border-t border-dashed border-border-default/50 pt-1.5">
                                        <div className="flex justify-between text-[10px]">
                                          <span className="text-text-secondary">{isRapApi ? 'Liquidado/Pago RAP:' : 'Total Liquidado:'}</span>
                                          <span className="font-medium text-status-success">{formatCurrency(isRapApi ? rpLiquidadoPagoApi : totalLiquidadoApi)}</span>
                                        </div>
                                      </div>
                                      {isRapApi ? (
                                        <div className="mt-1 border-t border-dashed border-border-default/50 pt-1.5">
                                          <div className="flex justify-between text-[10px]">
                                            <span className="text-text-secondary">Empenhado original:</span>
                                            <span className="font-medium">{formatCurrency(valorEmpenhadoApi)}</span>
                                          </div>
                                          <div className="flex justify-between text-[10px]">
                                            <span className="text-text-secondary">Pago no exercicio:</span>
                                            <span className="font-medium">{formatCurrency(totalLiquidadoApi)}</span>
                                          </div>
                                        </div>
                                      ) : null}
                                      <div className="border-t border-border-default/40 pt-1.5 text-[9px] font-medium text-text-secondary">
                                        Fonte: API Comprasnet
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              );
                            })}
                            </>
                          ) : (
                            <span className="text-xs italic text-text-secondary">Sem empenhos</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-4 text-right">
                      <div className="flex flex-col">
                        <span className={cn('font-semibold text-sm', totalALiquidar > 0 ? 'text-status-warning' : 'text-status-success')}>{formatCurrency(totalALiquidar)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-6 text-right">
                      {apiContrato ? (
                        <Button variant="ghost" size="sm" className="h-8 gap-2 px-2 text-xs" onClick={() => openApiDetails(apiContrato)}>
                          <Eye className="h-3.5 w-3.5" />
                          Detalhes
                        </Button>
                      ) : (
                        <span className="text-xs text-text-secondary">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </DataTablePanel>

      {isSuperAdmin ? <ContratosSyncDialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen} onSyncComplete={refreshData} /> : null}
      <ContratoApiDetailsSheet open={isDetailsOpen} onOpenChange={setIsDetailsOpen} contrato={selectedApiContrato} details={selectedApiDetails} lastSyncRun={lastApiSyncRun} loading={isDetailsLoading} />
    </div>
  );
}
