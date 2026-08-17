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
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { HeaderActions } from '@/components/HeaderParts';
import { ContratosSyncDialog } from '@/components/modals/ContratosSyncDialog';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getRapBaseVigente, getRapReferenceYear, getRapSaldoAtual } from '@/utils/rapMetrics';
import { buildEmpenhoLookupKeys, normalizeContratoNumero, shouldIgnoreContratoNumero } from '@/utils/contratosSync';
import { getValorTotalFromHistorico } from '@/utils/contratosApiHistorico';
import { isContratoApiCampusEmpenho } from '@/utils/contratosApiStatus';
import { contratosApiService, type ContratoApiDetails, type ContratoApiEmpenhoRow, type ContratoApiHistoricoRow, type ContratoApiRow, type ContratoApiSyncRun, type ContratoApiFaturaRow } from '@/services/contratosApi';
import { ContratoApiDetailsSheet } from '@/components/contratos/ContratoApiDetailsSheet';
import { useUserFavorites } from '@/services/userFavorites';

const REITORIA_UG = '158155';
const normalizeEmpenhoRef = (value: string) =>
  (value || '')
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const buildEmpenhoRefKeys = (value: unknown) => {
  const keys = new Set(buildEmpenhoLookupKeys(value));
  const normalized = normalizeEmpenhoRef(String(value ?? ''));
  if (normalized) keys.add(normalized);
  if (normalized.length >= 12) keys.add(normalized.slice(-12));
  return keys;
};

const getEmpenhoSortParts = (value: unknown) => {
  const normalized = normalizeEmpenhoRef(String(value ?? ''));
  const match = normalized.match(/(\d{4})NE(\d+)/);
  return {
    year: match ? Number(match[1]) : Number.MAX_SAFE_INTEGER,
    sequence: match ? Number(match[2]) : Number.MAX_SAFE_INTEGER,
    normalized,
  };
};

const compareEmpenhoRefs = (a: unknown, b: unknown) => {
  const left = getEmpenhoSortParts(a);
  const right = getEmpenhoSortParts(b);

  if (left.year !== right.year) return left.year - right.year;
  if (left.sequence !== right.sequence) return left.sequence - right.sequence;
  return left.normalized.localeCompare(right.normalized);
};

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

const getApiRapLiquidadoPago = (empenho: ContratoApiEmpenhoRow) => {
  const rpLiquidadoApi = getApiEmpenhoNumber(empenho, 'rp_liquidado', 'rpliquidado') ?? 0;
  const rpPagoApi = getApiEmpenhoNumber(empenho, 'rp_pago', 'rppago') ?? 0;
  return rpLiquidadoApi + rpPagoApi;
};

const getApiRapBase = (empenho: ContratoApiEmpenhoRow) => {
  const rpInscritoApi = getApiEmpenhoNumber(empenho, 'rp_inscrito', 'rpinscrito') ?? 0;
  const rpALiquidarApi = getApiEmpenhoNumber(empenho, 'rp_a_liquidar', 'rpaliquidar') ?? 0;
  const rpAPagarApi = getApiEmpenhoNumber(empenho, 'rp_a_pagar', 'rpapagar') ?? 0;
  const rpLiquidadoPagoApi = getApiRapLiquidadoPago(empenho);

  if (rpInscritoApi > 0) return rpInscritoApi;
  if (rpALiquidarApi > 0) return rpALiquidarApi;
  return rpLiquidadoPagoApi + rpAPagarApi;
};

const isApiRapEmpenho = (empenho: ContratoApiEmpenhoRow) =>
  getApiEmpenhoYear(empenho) < new Date().getFullYear() ||
  getApiRapBase(empenho) > 0 ||
  getApiRapLiquidadoPago(empenho) > 0;

const getApiRapSaldoAtual = (empenho: ContratoApiEmpenhoRow) => {
  const rpAPagarDbApi = getApiEmpenhoNumber(empenho, 'rp_a_pagar', 'rpapagar');
  if (rpAPagarDbApi !== undefined) return rpAPagarDbApi;
  return Math.max(0, getApiRapBase(empenho) - getApiRapLiquidadoPago(empenho));
};

const getSaldoEmpenhoApi = (empenho: ContratoApiEmpenhoRow) => {
  if (isApiRapEmpenho(empenho)) return getApiRapSaldoAtual(empenho);
  return getApiEmpenhoNumber(empenho, 'valor_a_liquidar', 'valoraliquidar') ?? 0;
};

const getEmpenhoSaldoBadgeClass = (saldo: number) =>
  cn(
    'text-[10px] font-mono py-0 h-5 cursor-pointer transition-colors',
    saldo > 0
      ? 'border-emerald-green/25 bg-emerald-green/[0.06] text-emerald-green shadow-[0_0_0_1px_rgba(34,197,94,0.08)] hover:bg-emerald-green/10'
      : 'hover:bg-muted-foreground/20',
  );

export default function Contratos() {
  const { isSuperAdmin } = useAuth();
  const { contratos, empenhos, contratosEmpenhos, isLoading, refreshData } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewFilter, setViewFilter] = useState<'all' | 'favorites' | 'expired120'>('all');
  const { favoriteIdsByType, isFavorite, toggleFavorite, isPending: isFavoritePending } = useUserFavorites();
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [apiContratos, setApiContratos] = useState<ContratoApiRow[]>([]);
  const [apiEmpenhos, setApiEmpenhos] = useState<ContratoApiEmpenhoRow[]>([]);
  const [apiHistoricos, setApiHistoricos] = useState<ContratoApiHistoricoRow[]>([]);
  const [apiFaturas, setApiFaturas] = useState<ContratoApiFaturaRow[]>([]);
  const [lastApiSyncRun, setLastApiSyncRun] = useState<ContratoApiSyncRun | null>(null);
  const [selectedApiContrato, setSelectedApiContrato] = useState<ContratoApiRow | null>(null);
  const [selectedApiDetails, setSelectedApiDetails] = useState<ContratoApiDetails | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  const loadApiContracts = useCallback(async (isCancelled: () => boolean = () => false) => {
    try {
      const contratosApi = await contratosApiService.getContratosApi(true);
      const contratoApiIds = contratosApi.map((contrato) => contrato.id);
      const [empenhosApi, historicosApi, faturasApi, lastSync] = await Promise.all([
        contratosApiService.getEmpenhosApi(contratoApiIds),
        contratosApiService.getHistoricosApi(contratoApiIds),
        contratosApiService.getFaturasApi(contratoApiIds),
        contratosApiService.getLastSyncRun().catch(() => null),
      ]);
      if (isCancelled()) return;
      setApiContratos(contratosApi);
      setApiEmpenhos(empenhosApi.filter((empenho) => isContratoApiCampusEmpenho(empenho)));
      setApiHistoricos(historicosApi);
      setApiFaturas(faturasApi);
      setLastApiSyncRun(lastSync);
    } catch (error) {
      console.warn('Contratos: nao foi possivel carregar dados da API do Comprasnet', error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadApiContracts(() => cancelled);

    return () => {
      cancelled = true;
    };
  }, [loadApiContracts]);

  const handleSyncComplete = useCallback(() => {
    refreshData();
    void loadApiContracts();
  }, [refreshData, loadApiContracts]);

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

  type LocalContrato = (typeof contratos)[number];
  type ContratoDisplay = {
    id: string;
    localId: string | null;
    source: 'api' | 'local';
    numero: string;
    contratada: string;
    cnpj?: string | null;
    valor?: number | null;
    data_inicio?: Date | string | null;
    data_termino?: Date | string | null;
    apiContrato?: ContratoApiRow;
    localContrato?: LocalContrato;
  };

  const localContratoByNumero = useMemo(() => {
    const map = new Map<string, LocalContrato>();
    for (const contrato of contratos) {
      if (shouldIgnoreContratoNumero(contrato.numero)) continue;
      map.set(normalizeContratoNumero(contrato.numero), contrato);
    }
    return map;
  }, [contratos]);

  const apiContratoByNumero = useMemo(() => {
    const map = new Map<string, ContratoApiRow>();
    for (const contrato of apiContratos) {
      map.set(normalizeContratoNumero(contrato.numero), contrato);
    }
    return map;
  }, [apiContratos]);

  const visibleContratos = useMemo<ContratoDisplay[]>(() => {
    if (apiContratos.length === 0) {
      return contratos
        .filter((contrato) => !shouldIgnoreContratoNumero(contrato.numero))
        .map((contrato) => ({
          id: `local-${contrato.id}`,
          localId: contrato.id,
          source: 'local',
          numero: contrato.numero,
          contratada: contrato.contratada,
          cnpj: contrato.cnpj,
          valor: contrato.valor,
          data_inicio: contrato.data_inicio,
          data_termino: contrato.data_termino,
          localContrato: contrato,
        }));
    }

    return apiContratos
      .filter((contrato) => !shouldIgnoreContratoNumero(contrato.numero))
      .map((apiContrato) => {
        const localContrato = localContratoByNumero.get(normalizeContratoNumero(apiContrato.numero));
        return {
          id: localContrato ? `local-${localContrato.id}` : `api-${apiContrato.id}`,
          localId: localContrato?.id ?? null,
          source: 'api',
          numero: localContrato?.numero ?? apiContrato.numero,
          contratada: apiContrato.fornecedor_nome || localContrato?.contratada || 'Fornecedor nao informado',
          cnpj: localContrato?.cnpj,
          valor: Math.max(localContrato?.valor ?? 0, apiContrato.valor_acumulado ?? 0, apiContrato.valor_global ?? 0),
          data_inicio: apiContrato.vigencia_inicio_derivada ?? apiContrato.vigencia_inicio ?? localContrato?.data_inicio ?? null,
          data_termino: apiContrato.vigencia_fim_derivada ?? apiContrato.vigencia_fim ?? localContrato?.data_termino ?? null,
          apiContrato,
          localContrato,
        };
      });
  }, [apiContratos, contratos, localContratoByNumero]);

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

  const localEmpenhoByLookupKey = useMemo(() => {
    const map = new Map<string, (typeof empenhos)[number]>();
    for (const empenho of empenhos) {
      for (const key of buildEmpenhoRefKeys(empenho.numero)) {
        if (!map.has(key)) map.set(key, empenho);
      }
    }
    return map;
  }, [empenhos]);

  const openApiDetails = useCallback(async (contrato: ContratoApiRow) => {
    setSelectedApiContrato(contrato);
    setSelectedApiDetails(null);
    setIsDetailsOpen(true);
    setIsDetailsLoading(true);
    try {
      const details = await contratosApiService.getContratoApiDetails(contrato.id);
      const campusEmpenhos = details.empenhos.filter((empenho) => isContratoApiCampusEmpenho(empenho));
      const campusEmpenhoIds = new Set(campusEmpenhos.map((empenho) => empenho.id));
      const campusApiEmpenhoIds = new Set(campusEmpenhos.map((empenho) => Number(empenho.api_empenho_id)));
      setSelectedApiDetails({
        ...details,
        empenhos: campusEmpenhos,
        faturaEmpenhos: details.faturaEmpenhos.filter((row) =>
          (row.contrato_api_empenho_id != null && campusEmpenhoIds.has(row.contrato_api_empenho_id)) ||
          (row.api_empenho_id != null && campusApiEmpenhoIds.has(Number(row.api_empenho_id))),
        ),
      });
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
    let baseContratos = visibleContratos;

    if (viewFilter === 'all') {
      baseContratos = visibleContratos.filter(
        (contrato) => !contrato.apiContrato || contrato.apiContrato.situacao_derivada === true
      );
    } else if (viewFilter === 'favorites') {
      baseContratos = visibleContratos.filter((contrato) =>
        (contrato.localId && favoriteIdsByType.contrato.has(contrato.localId)) ||
        (contrato.apiContrato && favoriteIdsByType.contrato_api?.has(contrato.apiContrato.id)),
      );
    } else if (viewFilter === 'expired120') {
      const today = new Date();
      const hundredTwentyDaysAgo = new Date(today.getTime() - 120 * 24 * 60 * 60 * 1000);
      baseContratos = visibleContratos.filter((contrato) => {
        if (!contrato.data_termino) return false;
        const dateTermino = new Date(contrato.data_termino);
        if (isNaN(dateTermino.getTime())) return false;
        return dateTermino.getTime() < today.getTime() && dateTermino.getTime() >= hundredTwentyDaysAgo.getTime();
      });
    }

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
  }, [visibleContratos, viewFilter, favoriteIdsByType, searchTerm, normalizeString, sortConfig]);

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

  const getSaldoEmpenhoLocal = useCallback(
    (empenho: (typeof empenhos)[number]) => {
      if (empenho.tipo === 'rap') return getRapSaldoAtual(empenho, rapReferenceYear);
      const liquidado = (empenho.valorLiquidadoAPagar || 0) + (empenho.valorPagoOficial || 0);
      return Math.max(0, empenho.valor - liquidado);
    },
    [rapReferenceYear],
  );

  const getLocalEmpenhoForApi = useCallback(
    (empenhoApi: ContratoApiEmpenhoRow) => {
      for (const key of buildEmpenhoRefKeys(empenhoApi.numero)) {
        const local = localEmpenhoByLookupKey.get(key);
        if (local) return local;
      }
      return undefined;
    },
    [localEmpenhoByLookupKey],
  );

  const getSaldoEmpenhoApiPreferLocal = useCallback(
    (empenhoApi: ContratoApiEmpenhoRow) => {
      const local = getLocalEmpenhoForApi(empenhoApi);
      return local ? getSaldoEmpenhoLocal(local) : getSaldoEmpenhoApi(empenhoApi);
    },
    [getLocalEmpenhoForApi, getSaldoEmpenhoLocal],
  );

  const getEmpenhosDoContrato = useCallback(
    (contratoId: string | null | undefined) => {
      if (!contratoId) return [];
      const linkIds = contratosEmpenhos.filter((l) => l.contrato_id === contratoId).map((l) => l.empenho_id);

      // Compatibilidade: dependendo do histórico/imports, `contratos_empenhos.empenho_id`
      // pode estar armazenando o UUID do empenho OU o número do empenho.
      // Para não "sumir" vínculos na UI, resolvemos por ambos.
      const byId = new Map(empenhos.map((e) => [e.id, e] as const));
      const byNumero = new Map(empenhos.map((e) => [e.numero, e] as const));
      const resolved: typeof empenhos = [];
      const seen = new Set<string>();
      for (const ref of linkIds) {
        const refStr = (ref || '').toString().trim();
        const emp =
          byId.get(refStr) ||
          byNumero.get(refStr) ||
          Array.from(buildEmpenhoRefKeys(refStr))
            .map((key) => localEmpenhoByLookupKey.get(key))
            .find(Boolean);
        if (!emp) continue;
        if (seen.has(emp.id)) continue;
        seen.add(emp.id);
        resolved.push(emp);
      }
      return resolved;
    },
    [empenhos, contratosEmpenhos, localEmpenhoByLookupKey],
  );

  const getValorEmpenhadoLocal = useCallback(
    (contratoId: string | null | undefined) => {
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
    (contratoId: string | null | undefined, apiContrato?: ContratoApiRow) => {
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

  const getEmpenhosApiSomente = useCallback(
    (empenhosVinculados: Array<{ numero: string }>, apiContrato?: ContratoApiRow) => {
      if (!apiContrato) return [];
      const localEmpenhosKeys = new Set(empenhosVinculados.flatMap((e) => Array.from(buildEmpenhoRefKeys(e.numero))));
      const empenhosApiVinculados = apiEmpenhosByContratoApiId.get(apiContrato.id) ?? [];
      return empenhosApiVinculados.filter((empenhoApi) => {
        const apiKeys = Array.from(buildEmpenhoRefKeys(empenhoApi.numero));
        return apiKeys.length > 0 && !apiKeys.some((key) => localEmpenhosKeys.has(key));
      });
    },
    [apiEmpenhosByContratoApiId],
  );

  const totalALiquidarGlobal = useMemo(() => {
    return visibleContratos.reduce((sumContrato, c) => {
      const emps = getEmpenhosDoContrato(c.localId);
      const apiContrato = c.apiContrato ?? apiContratoByNumero.get(normalizeContratoNumero(c.numero));
      const empenhosApiSomente = getEmpenhosApiSomente(emps, apiContrato);
      const saldoLocal = emps.reduce((sumEmp, e) => sumEmp + getSaldoEmpenhoLocal(e), 0);
      const saldoApiSomente = empenhosApiSomente.reduce((sumEmp, e) => sumEmp + getSaldoEmpenhoApiPreferLocal(e), 0);
      return sumContrato + saldoLocal + saldoApiSomente;
    }, 0);
  }, [visibleContratos, getEmpenhosDoContrato, apiContratoByNumero, getEmpenhosApiSomente, getSaldoEmpenhoLocal, getSaldoEmpenhoApiPreferLocal]);

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

  const lastSyncLabel = useMemo(() => {
    if (!lastApiSyncRun) return 'Ultima sincronizacao: nao registrada';
    const rawDate = lastApiSyncRun.finished_at ?? lastApiSyncRun.started_at;
    const parsed = rawDate ? new Date(rawDate) : null;
    const dateLabel = parsed && !Number.isNaN(parsed.getTime()) ? format(parsed, 'dd/MM/yyyy HH:mm') : '-';
    const statusLabel = lastApiSyncRun.status === 'success' ? 'sucesso' : lastApiSyncRun.status;
    return `Ultima sincronizacao: ${dateLabel} (${statusLabel})`;
  }, [lastApiSyncRun]);

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
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-xs text-text-secondary">{lastSyncLabel}</span>
            <Button variant="outline" className="gap-2 h-8 text-xs sm:h-9 sm:text-sm bg-surface-card border-border-default shadow-sm transition-all" onClick={() => setIsSyncDialogOpen(true)}>
              <RefreshCw className="h-4 w-4 text-action-primary" />
              Atualizar Comprasnet
            </Button>
          </div>
        ) : null}
      </HeaderActions>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <StatCard title="Contratos Ativos" value={visibleContratos.length} icon={FileText} stitchColor="vibrant-blue" />

        <StatCard
          title="Valor Total"
          value={formatCurrency(
            visibleContratos.reduce((sum, c) => {
              const apiContrato = c.apiContrato ?? apiContratoByNumero.get(normalizeContratoNumero(c.numero));
              const historico = apiContrato ? (apiHistoricosByContratoApiId.get(apiContrato.id) ?? []) : [];
              return sum + getValorTotalContrato(c, apiContrato, historico);
            }, 0),
          )}
          icon={DollarSign}
          stitchColor="purple"
        />

        <StatCard
          title="Saldo dos empenhos"
          value={formatCurrency(totalALiquidarGlobal)}
          icon={Calendar}
          stitchColor="amber"
          progress={45} // Placeholder progress or calculate if possible
        />

        <StatCard
          title="Valor Empenhado"
          value={formatCurrency(
            visibleContratos.reduce((sum, c) => {
              const apiContrato = c.apiContrato ?? apiContratoByNumero.get(normalizeContratoNumero(c.numero));
              return sum + getValorEmpenhadoContrato(c.localId, apiContrato);
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
              variant={viewFilter === 'all' ? 'default' : 'ghost'}
              className="h-10 rounded-none px-4 text-xs font-semibold"
              onClick={() => setViewFilter('all')}
            >
              Todos
            </Button>
            <Button
              type="button"
              variant={viewFilter === 'favorites' ? 'default' : 'ghost'}
              className="h-10 rounded-none px-4 text-xs font-semibold"
              onClick={() => setViewFilter('favorites')}
            >
              <Star className="h-3.5 w-3.5 mr-1" />
              Favoritos
            </Button>
            <Button
              type="button"
              variant={viewFilter === 'expired120' ? 'default' : 'ghost'}
              className="h-10 rounded-none px-4 text-xs font-semibold"
              onClick={() => setViewFilter('expired120')}
            >
              <Calendar className="h-3.5 w-3.5 mr-1" />
              Vencidos (120d)
            </Button>
          </div>
        </div>
      </FilterPanel>

      <DataTablePanel className="mt-6">
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
              <TableHead className="h-11 px-4 text-right">Saldo dos empenhos</TableHead>
              <TableHead className="h-11 w-12 px-4 text-center">
                <span className="sr-only">Ações</span>
              </TableHead>
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
                const apiContrato = c.apiContrato ?? apiContratoByNumero.get(normalizeContratoNumero(c.numero));
                const hasReitoriaOrigin = apiContrato?.unidade_origem_codigo === REITORIA_UG || apiContrato?.unidade_codigo === REITORIA_UG;
                const empenhosVinculados = getEmpenhosDoContrato(c.localId);
                const empenhosApiSomente = getEmpenhosApiSomente(empenhosVinculados, apiContrato);
                const empenhoBadgeItems = [
                  ...empenhosVinculados.map((empenho) => ({
                    type: 'local' as const,
                    numero: empenho.numero,
                    empenho,
                  })),
                  ...empenhosApiSomente.map((empenho) => ({
                    type: 'api' as const,
                    numero: empenho.numero,
                    empenho,
                  })),
                ].sort((a, b) => compareEmpenhoRefs(a.numero, b.numero));
                const historicoApi = apiContrato ? (apiHistoricosByContratoApiId.get(apiContrato.id) ?? []) : [];
                const valorTotalContrato = getValorTotalContrato(c, apiContrato, historicoApi);
                const totalEmpenhado = getValorEmpenhadoContrato(c.localId, apiContrato);
                const percentualEmpenhado = valorTotalContrato > 0 ? Math.min(100, (totalEmpenhado / valorTotalContrato) * 100) : 0;

                const totalALiquidar =
                  empenhosVinculados.reduce((sum, e) => sum + getSaldoEmpenhoLocal(e), 0) +
                  empenhosApiSomente.reduce((sum, e) => sum + getSaldoEmpenhoApiPreferLocal(e), 0);
                const favoriteEntity = c.localId
                  ? { type: 'contrato' as const, id: c.localId }
                  : apiContrato
                    ? { type: 'contrato_api' as const, id: apiContrato.id }
                    : null;
                const contratoFavorite = favoriteEntity ? isFavorite(favoriteEntity.type, favoriteEntity.id) : false;

                const contractFaturas = apiFaturas.filter((f) => f.contrato_api_id === apiContrato?.id);
                const openFaturas = contractFaturas.filter((f) => {
                  const status = (f.situacao || '').toLowerCase();
                  return status !== 'pago' && status !== 'siafi apropriado';
                });
                const hasOpenInvoice = openFaturas.length > 0;

                return (
                  <TableRow
                    key={c.id}
                    className={cn(
                      'border-b border-border-default/40 transition-all last:border-0',
                      hasOpenInvoice
                        ? 'bg-amber-500/[0.03] hover:bg-amber-500/[0.06] border-l-4 border-l-amber-500'
                        : 'hover:bg-surface-subtle/60'
                    )}
                  >
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={contratoFavorite ? `Remover contrato ${c.numero} dos favoritos` : `Favoritar contrato ${c.numero}`}
                              className={cn(
                                'h-8 w-8 hover:bg-amber-50',
                                contratoFavorite
                                  ? 'text-amber-500 hover:text-amber-600'
                                  : 'text-muted-foreground hover:text-amber-500',
                              )}
                              disabled={isFavoritePending || !favoriteEntity}
                              onClick={() => {
                                if (favoriteEntity) void toggleFavorite(favoriteEntity.type, favoriteEntity.id);
                              }}
                            >
                              <Star className={cn('h-4 w-4', contratoFavorite ? 'fill-current' : '')} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {favoriteEntity ? (contratoFavorite ? 'Remover dos favoritos' : 'Favoritar contrato') : 'Favorito indisponivel para este contrato'}
                          </TooltipContent>
                        </Tooltip>
                        <span className="font-data text-sm font-medium text-text-primary">{c.numero}</span>
                        {hasOpenInvoice ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500 hover:bg-amber-600 text-white animate-pulse shadow-sm flex items-center gap-1 border-none cursor-help">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                                </span>
                                Invoice Aberta
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs p-3 space-y-2 border-border-default/60 shadow-lifted">
                              <div className="space-y-1">
                                <span className="font-bold text-xs text-status-warning block">Invoices (Faturas) Pendentes:</span>
                                <div className="text-[11px] space-y-1 font-mono">
                                  {openFaturas.map((f) => (
                                    <div key={f.id} className="flex justify-between gap-4 border-b border-border-default/40 pb-0.5 last:border-0 last:pb-0">
                                      <span>#{f.numero_instrumento_cobranca || f.api_fatura_id}</span>
                                      <span className="font-semibold text-status-warning">{f.situacao}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
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
                            {empenhoBadgeItems.map((item) => {
                              if (item.type === 'local') {
                                const e = item.empenho;
                                const balance = getSaldoEmpenhoLocal(e);
                                const rapBase = e.tipo === 'rap' ? getRapBaseVigente(e, rapReferenceYear) : 0;

                              return (
                                <Popover key={e.id}>
                                  <PopoverTrigger asChild>
                                    <Badge variant="secondary" className={getEmpenhoSaldoBadgeClass(balance)}>
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
                              }

                              const e = item.empenho;
                              const localOverride = getLocalEmpenhoForApi(e);
                              if (localOverride) {
                                const balance = getSaldoEmpenhoLocal(localOverride);
                                const isRapLocal = localOverride.tipo === 'rap';
                                const baseValue = isRapLocal ? getRapBaseVigente(localOverride, rapReferenceYear) : localOverride.valor || 0;

                                return (
                                  <Popover key={`api-${e.id}`}>
                                    <PopoverTrigger asChild>
                                      <Badge variant="secondary" className={getEmpenhoSaldoBadgeClass(balance)}>
                                        {e.numero}
                                      </Badge>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 border-border-default/60 p-3 shadow-lifted">
                                      <div className="space-y-2">
                                        <div className="mr-1 flex items-center justify-between border-b border-border-default/50 pb-1">
                                          <span className="font-data text-xs font-bold text-action-primary">{e.numero}</span>
                                          <Badge variant="outline" className="text-[9px] uppercase px-1 h-4">
                                            SIAFI
                                          </Badge>
                                        </div>
                                        <div className="grid grid-cols-2 gap-y-1.5 text-xs py-1">
                                          <span className="text-text-secondary">{isRapLocal ? 'Base RAP:' : 'Valor Total:'}</span>
                                          <span className="text-right font-medium">{formatCurrency(baseValue)}</span>
                                          <span className="font-semibold text-text-secondary">{isRapLocal ? 'Saldo Atual:' : 'Saldo a Liquidar:'}</span>
                                          <span className={cn('text-right font-bold underline decoration-dotted', balance > 0 ? 'text-status-warning' : 'text-status-success')}>
                                            {formatCurrency(balance)}
                                          </span>
                                        </div>
                                        <div className="border-t border-border-default/40 pt-1.5 text-[9px] font-medium text-text-secondary">
                                          Fonte: SIAFI local + vínculo API Comprasnet
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                );
                              }

                              const valorEmpenhadoApi = Number(e.valor_empenhado) || 0;
                              const valorLiquidadoApi = Number(e.valor_liquidado) || 0;
                              const valorPagoApi = Number(e.valor_pago) || 0;
                              const rpBaseApi = getApiRapBase(e);
                              const rpLiquidadoPagoApi = getApiRapLiquidadoPago(e);
                              const rpAPagarApi = getApiRapSaldoAtual(e);
                              const totalLiquidadoApi = valorLiquidadoApi + valorPagoApi;
                              const isRapApi = isApiRapEmpenho(e);
                              const saldoApi = getSaldoEmpenhoApi(e);
                              const apiEmpenhoYear = getApiEmpenhoYear(e);
                              const rapBaseLabel = apiEmpenhoYear <= new Date().getFullYear() - 2 ? 'RP reinscrito:' : 'RP inscrito:';

                              return (
                                <Popover key={`api-${e.id}`}>
                                  <PopoverTrigger asChild>
                                    <Badge variant="secondary" className={getEmpenhoSaldoBadgeClass(saldoApi)}>
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
                                        <span className={cn('text-right font-bold underline decoration-dotted', saldoApi > 0 ? 'text-status-warning' : 'text-status-success')}>
                                          {formatCurrency(saldoApi)}
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
                    <TableCell className="py-4 px-4 text-center">
                      {apiContrato ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-text-secondary hover:text-action-primary hover:bg-surface-subtle"
                              aria-label="Ver detalhes"
                              onClick={() => openApiDetails(apiContrato)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Ver detalhes
                          </TooltipContent>
                        </Tooltip>
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

      {isSuperAdmin ? <ContratosSyncDialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen} onSyncComplete={handleSyncComplete} /> : null}
      <ContratoApiDetailsSheet open={isDetailsOpen} onOpenChange={setIsDetailsOpen} contrato={selectedApiContrato} details={selectedApiDetails} lastSyncRun={lastApiSyncRun} loading={isDetailsLoading} />
    </div>
  );
}
