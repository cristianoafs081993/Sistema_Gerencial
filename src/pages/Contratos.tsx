import { formatContractDate, contractDaysRemaining, contractDeadlineLabel } from '@/utils/contractPresentation';
import { EmpenhoDialog } from '@/components/modals/EmpenhoDialog';
import type { Empenho } from '@/types';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Search, Calendar, ArrowUpDown, ChevronUp, ChevronDown, RefreshCw, Eye, Star } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { formatCurrency, formatarDocumento, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { HeaderActions } from '@/components/HeaderParts';
import { ContratosSyncDialog } from '@/components/modals/ContratosSyncDialog';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { ActiveFilterChips, type ActiveFilterItem } from '@/components/design-system/ActiveFilterChips';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';

import { useAuth } from '@/contexts/AuthContext';
import { getAuthUserMatricula, permissionMatchesAuthUser } from '@/lib/terceirizadoIdentity';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getRapBaseVigente, getRapLiquidadoNoAno, getRapReferenceYear, getRapSaldoAtual } from '@/utils/rapMetrics';
import { buildEmpenhoLookupKeys, normalizeContratoNumero, shouldIgnoreContratoNumero } from '@/utils/contratosSync';
import { getValorTotalFromHistorico } from '@/utils/contratosApiHistorico';
import { isContratoApiCampusEmpenho } from '@/utils/contratosApiStatus';
import { contratosApiService, type ContratoApiDetails, type ContratoApiEmpenhoRow, type ContratoApiHistoricoRow, type ContratoApiRow, type ContratoApiSyncRun, type ContratoApiFaturaRow } from '@/services/contratosApi';
import { ContratoApiDetailsSheet } from '@/components/contratos/ContratoApiDetailsSheet';
import { useUserFavorites } from '@/services/userFavorites';
import { requisicoesCompraService } from '@/services/requisicoesCompra';
import type { TerceirizadoPermission } from '@/types';

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

const createEmptyContratoApiDetails = (): ContratoApiDetails => ({
  historico: [],
  empenhos: [],
  itens: [],
  faturas: [],
  faturaItens: [],
  faturaEmpenhos: [],
});

export default function Contratos() {
  const { isSuperAdmin, user = null, userGroups = [] } = useAuth();
  const { contratos, empenhos, atividades, contratosEmpenhos, isLoading, refreshData } = useData();
  const isTerceirizado = userGroups.some((group) => group.slug === 'terceirizado');
  const userMatricula = getAuthUserMatricula(user);
  const userIdentity = useMemo(
    () => ({
      id: user?.id,
      email: user?.email,
      user_metadata: { matricula: userMatricula },
    }),
    [user?.email, user?.id, userMatricula],
  );
  const [terceirizadoPermissions, setTerceirizadoPermissions] = useState<TerceirizadoPermission[]>([]);
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(false);
  const [inspectedEmpenho, setInspectedEmpenho] = useState<Empenho | null>(null);
  const detailRequest = useRef(0);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewFilter, setViewFilter] = useState<'all' | 'favorites' | 'expired120' | 'expiring90' | 'pending'>('all');
  const { favoriteIdsByType, isFavorite, toggleFavorite, isPending: isFavoritePending } = useUserFavorites();
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>({
    key: 'data_inicio',
    direction: 'desc',
  });
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [isApiLoading, setIsApiLoading] = useState(true);
  const [apiContratos, setApiContratos] = useState<ContratoApiRow[]>([]);
  const [apiEmpenhos, setApiEmpenhos] = useState<ContratoApiEmpenhoRow[]>([]);
  const [apiHistoricos, setApiHistoricos] = useState<ContratoApiHistoricoRow[]>([]);
  const [apiFaturas, setApiFaturas] = useState<ContratoApiFaturaRow[]>([]);
  const [lastApiSyncRun, setLastApiSyncRun] = useState<ContratoApiSyncRun | null>(null);
  const [selectedApiContrato, setSelectedApiContrato] = useState<ContratoApiRow | null>(null);
  const [selectedApiDetails, setSelectedApiDetails] = useState<ContratoApiDetails | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  useEffect(() => {
    if (!isTerceirizado || isSuperAdmin) {
      setTerceirizadoPermissions([]);
      setIsPermissionsLoading(false);
      return;
    }

    let cancelled = false;
    setIsPermissionsLoading(true);
    requisicoesCompraService.listPermissions()
      .then((permissions) => {
        if (!cancelled) setTerceirizadoPermissions(permissions);
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('Contratos: nao foi possivel carregar os vinculos do terceirizado', error);
          setTerceirizadoPermissions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsPermissionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, isTerceirizado]);

  const allowedLocalContractIds = useMemo<Set<string> | null>(() => {
    if (!isTerceirizado || isSuperAdmin) return null;

    return new Set(
      terceirizadoPermissions
        .filter((permission) => permissionMatchesAuthUser(permission, userIdentity) && permission.contratoId)
        .map((permission) => permission.contratoId as string),
    );
  }, [isSuperAdmin, isTerceirizado, terceirizadoPermissions, userIdentity]);

  const loadApiContracts = useCallback(async (isCancelled: () => boolean = () => false) => {
    if (isTerceirizado && !isSuperAdmin) {
      setApiContratos([]);
      setApiEmpenhos([]);
      setApiHistoricos([]);
      setApiFaturas([]);
      setLastApiSyncRun(null);
      setIsApiLoading(false);
      return;
    }

    try {
      setIsApiLoading(true);
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
    } finally {
      if (!isCancelled()) {
        setIsApiLoading(false);
      }
    }
  }, [isSuperAdmin, isTerceirizado]);

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
        .filter((contrato) =>
          !shouldIgnoreContratoNumero(contrato.numero) &&
          (allowedLocalContractIds === null || allowedLocalContractIds.has(contrato.id)),
        )
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
      })
      .filter((contrato) =>
        allowedLocalContractIds === null ||
        (contrato.localId !== null && allowedLocalContractIds.has(contrato.localId)),
      );
  }, [allowedLocalContractIds, apiContratos, contratos, localContratoByNumero]);

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
    const requestId = ++detailRequest.current;
    setSelectedApiContrato(contrato);
    setSelectedApiDetails(null);
    setIsDetailsOpen(true);
    setIsDetailsLoading(true);
    setDetailsError(null);
    try {
      const details = await contratosApiService.getContratoApiDetails(contrato.id);
      if (requestId !== detailRequest.current) return;
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
      if (requestId !== detailRequest.current) return;
      console.error('Contratos: erro ao carregar detalhes do contrato da API', error);
      setDetailsError('Não foi possível carregar os detalhes do contrato. Tente novamente.');
      setSelectedApiDetails({
        historico: [],
        empenhos: [],
        itens: [],
        faturas: [],
        faturaItens: [],
        faturaEmpenhos: [],
      });
    } finally {
      if (requestId === detailRequest.current) setIsDetailsLoading(false);
    }
  }, []);

  const openContractDetails = useCallback(async (contract: ContratoDisplay) => {
    setDetailsError(null);
    let apiContract = contract.apiContrato;

    // Terceirizados não carregam a listagem global da API. Quando solicitam
    // detalhes, resolvemos apenas o contrato local já autorizado, por número.
    if (!apiContract && typeof contratosApiService.getContratoApiByNumeroOrId === 'function') {
      try {
        apiContract = await contratosApiService.getContratoApiByNumeroOrId(contract.numero);
      } catch (error) {
        console.warn('Contratos: não foi possível localizar o contrato na API', error);
      }
    }

    if (apiContract) {
      await openApiDetails(apiContract);
      return;
    }

    // Contratos legados podem não ter correspondente no cache da API. Ainda
    // assim, o ícone deve abrir os dados locais autorizados, sem deixar a ação
    // indisponível para o usuário.
    const now = new Date().toISOString();
    setSelectedApiContrato({
      id: `local-${contract.localId ?? contract.id}`,
      api_contrato_id: 0,
      numero: contract.numero,
      fornecedor_nome: contract.contratada || null,
      fornecedor_documento: contract.cnpj || null,
      unidade_codigo: null,
      unidade_nome: null,
      unidade_origem_codigo: null,
      unidade_origem_nome: null,
      objeto: null,
      processo: null,
      vigencia_inicio: contract.data_inicio ? new Date(contract.data_inicio).toISOString() : null,
      vigencia_fim: contract.data_termino ? new Date(contract.data_termino).toISOString() : null,
      valor_global: contract.valor ?? null,
      valor_acumulado: contract.valor ?? null,
      situacao: true,
      situacao_derivada: true,
      updated_at: now,
      pncp_has_record: false,
      pncp_documentos_checked_at: now,
    });
    setSelectedApiDetails(createEmptyContratoApiDetails());
    setIsDetailsLoading(false);
    setIsDetailsOpen(true);
  }, [openApiDetails]);

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

    if (viewFilter === 'expiring90') {
      baseContratos = visibleContratos.filter(c => {
        const days = contractDaysRemaining(c.data_termino);
        return days !== null && days >= 0 && days <= 90 && (!c.apiContrato || c.apiContrato.situacao_derivada === true);
      });
    } else if (viewFilter === 'pending') {
      baseContratos = visibleContratos.filter(c => apiFaturas.some(f => f.contrato_api_id === c.apiContrato?.id && !['pago', 'siafi apropriado'].includes((f.situacao || '').toLowerCase())));
    }

    let result = baseContratos.filter((c) => {
      return normalizeString(c.numero).includes(searchNormalized) || normalizeString(c.contratada).includes(searchNormalized) || normalizeString(c.cnpj || '').includes(searchNormalized) || normalizeString(c.apiContrato?.objeto || '').includes(searchNormalized);
    });

    if (sortConfig) {
      result = [...result].sort((a, b) => {
        if (sortConfig.key === 'numero') {
          const res = a.numero.localeCompare(b.numero, undefined, { numeric: true, sensitivity: 'base' });
          return sortConfig.direction === 'asc' ? res : -res;
        }

        if (sortConfig.key === 'data_inicio') {
          const aTime = a.data_inicio ? new Date(a.data_inicio).getTime() : null;
          const bTime = b.data_inicio ? new Date(b.data_inicio).getTime() : null;
          const aValid = aTime !== null && !Number.isNaN(aTime);
          const bValid = bTime !== null && !Number.isNaN(bTime);

          if (!aValid && !bValid) return a.numero.localeCompare(b.numero, undefined, { numeric: true, sensitivity: 'base' });
          if (!aValid) return 1;
          if (!bValid) return -1;

          if (aTime !== bTime) {
            return sortConfig.direction === 'asc' ? aTime! - bTime! : bTime! - aTime!;
          }
          return a.numero.localeCompare(b.numero, undefined, { numeric: true, sensitivity: 'base' });
        }

        if (sortConfig.key === 'data_termino') {
          const aTime = a.data_termino ? new Date(a.data_termino).getTime() : null;
          const bTime = b.data_termino ? new Date(b.data_termino).getTime() : null;
          const aValid = aTime !== null && !Number.isNaN(aTime);
          const bValid = bTime !== null && !Number.isNaN(bTime);

          if (!aValid && !bValid) return a.numero.localeCompare(b.numero, undefined, { numeric: true, sensitivity: 'base' });
          if (!aValid) return 1;
          if (!bValid) return -1;

          if (aTime !== bTime) {
            return sortConfig.direction === 'asc' ? aTime! - bTime! : bTime! - aTime!;
          }
          return a.numero.localeCompare(b.numero, undefined, { numeric: true, sensitivity: 'base' });
        }

        return 0;
      });
    }

    return result;
  }, [visibleContratos, viewFilter, favoriteIdsByType, searchTerm, normalizeString, sortConfig, apiFaturas]);

  const safeFormatDate = formatContractDate;

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
    (empenhosVinculados: Array<{ numero: string }>, apiContrato?: ContratoApiRow, detailEmpenhos?: ContratoApiEmpenhoRow[]) => {
      if (!apiContrato) return [];
      const localEmpenhosKeys = new Set(empenhosVinculados.flatMap((e) => Array.from(buildEmpenhoRefKeys(e.numero))));
      const empenhosApiVinculados = apiEmpenhosByContratoApiId.get(apiContrato.id) ?? detailEmpenhos ?? [];
      return empenhosApiVinculados.filter((empenhoApi) => {
        const apiKeys = Array.from(buildEmpenhoRefKeys(empenhoApi.numero));
        return apiKeys.length > 0 && !apiKeys.some((key) => localEmpenhosKeys.has(key));
      });
    },
    [apiEmpenhosByContratoApiId],
  );

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key) {
      direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else if (key === 'data_inicio' || key === 'data_termino') {
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

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setViewFilter('all');
  };

  const selectedPageContrato = useMemo(() => selectedApiContrato ? {
    ...selectedApiContrato,
    vigencia_inicio: selectedApiContrato.vigencia_inicio_derivada ?? selectedApiContrato.vigencia_inicio,
    vigencia_fim: selectedApiContrato.vigencia_fim_derivada ?? selectedApiContrato.vigencia_fim,
  } : null, [selectedApiContrato]);

  const selectedDisplay = selectedApiContrato ? visibleContratos.find(c => normalizeContratoNumero(c.numero) === normalizeContratoNumero(selectedApiContrato.numero)) : undefined;
  const selectedLocalEmpenhos = getEmpenhosDoContrato(selectedDisplay?.localId);
  const selectedApiEmpenhos = getEmpenhosApiSomente(selectedLocalEmpenhos, selectedApiContrato ?? undefined, selectedApiDetails?.empenhos);
  const selectedExecution = {
    valorGlobal: getValorTotalContrato(selectedDisplay ?? {}, selectedApiContrato ?? undefined, selectedApiContrato ? apiHistoricosByContratoApiId.get(selectedApiContrato.id) ?? [] : []),
    empenhado: getValorEmpenhadoContrato(selectedDisplay?.localId, selectedApiContrato ?? undefined) || selectedApiEmpenhos.reduce((sum, e) => sum + (Number(e.valor_empenhado) || 0), 0),
    rows: [
      ...selectedLocalEmpenhos.map(e => ({ id: e.id, numero: e.numero, valor: e.tipo === 'rap' ? getRapBaseVigente(e, rapReferenceYear) : e.valor, saldo: getSaldoEmpenhoLocal(e), liquidado: e.tipo === 'rap' ? getRapLiquidadoNoAno(e) : e.valorLiquidado || 0, fonte: 'SIAFI local', tipo: e.tipo === 'rap' ? 'RAP' : 'Exercício', local: e })),
      ...selectedApiEmpenhos.map(e => {
        const local = getLocalEmpenhoForApi(e);
        const rap = local ? local.tipo === 'rap' : isApiRapEmpenho(e);
        return {
          id: e.id, numero: e.numero,
          valor: rap ? (local ? getRapBaseVigente(local, rapReferenceYear) : getApiRapBase(e)) : Number(e.valor_empenhado) || 0,
          liquidado: rap ? (local ? getRapLiquidadoNoAno(local) : getApiRapLiquidadoPago(e)) : local?.valorLiquidado ?? (Number(e.valor_liquidado) || 0),
          saldo: getSaldoEmpenhoApiPreferLocal(e), tipo: rap ? 'RAP' : 'Exercício', local,
          fonte: local ? 'SIAFI local + vínculo API Comprasnet' : 'API Comprasnet',
        };
      }),
    ].sort((a, b) => compareEmpenhoRefs(a.numero, b.numero)),
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

    if (viewFilter === 'favorites') {
      list.push({
        id: 'view',
        label: 'Visualização',
        value: 'Apenas Favoritos',
        onRemove: () => setViewFilter('all'),
      });
    } else if (viewFilter === 'expired120') {
      list.push({
        id: 'view',
        label: 'Visualização',
        value: 'Vencidos em 120 dias',
        onRemove: () => setViewFilter('all'),
      });
    }

    if (viewFilter === 'expiring90' || viewFilter === 'pending') list.push({
      id: 'view', label: 'Visualização', value: viewFilter === 'expiring90' ? 'A vencer em 90 dias' : 'Com faturas pendentes', onRemove: () => setViewFilter('all'),
    });
    return list;
  }, [searchTerm, viewFilter]);

  if (isLoading || isApiLoading || isPermissionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  return (
    <div className="space-y-6 pb-10">
      <HeaderActions>
        {lastSyncLabel ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-xs text-text-secondary">{lastSyncLabel}</span>
          </div>
        ) : null}
      </HeaderActions>

      <div hidden={isDetailsOpen} className="space-y-6">
      {/* Standard Filter Card */}
      <FilterPanel className="shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <Input aria-label="Buscar contratos" placeholder="Buscar por número, contratada ou objeto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input-system h-10 pl-9 text-sm" />
          </div>
          <div className="inline-flex flex-wrap h-auto overflow-hidden rounded-xl border border-border-default bg-card shadow-sm">
            <Button
              type="button"
              variant={viewFilter === 'all' ? 'default' : 'ghost'}
              className="h-10 rounded-none px-4 text-xs font-semibold"
              onClick={() => setViewFilter('all')}
            >
              Vigentes
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
            <Button type="button" variant={viewFilter === 'expiring90' ? 'default' : 'ghost'} className="h-10 rounded-none px-4 text-xs" onClick={() => setViewFilter('expiring90')}>A vencer em 90 dias</Button>
            <Button type="button" variant={viewFilter === 'pending' ? 'default' : 'ghost'} className="h-10 rounded-none px-4 text-xs" onClick={() => setViewFilter('pending')}>Com faturas pendentes</Button>
          </div>
        </div>

        {/* Chips de Filtros Ativos (Eixo 04) */}
        <ActiveFilterChips
          filters={activeFilterList}
          onClearAll={activeFilterList.length > 0 ? handleClearAllFilters : undefined}
          filteredCount={filteredContratos.length}
          totalCount={visibleContratos.length}
        />
      </FilterPanel>



      <DataTablePanel title="Contratos" description="Valor global do instrumento; execução e saldos dos empenhos vinculados ao campus. Os saldos incluem RAP." className="mt-6">
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
              <TableHead className="h-11 cursor-pointer px-4 text-right transition-colors hover:bg-surface-subtle" onClick={() => handleSort('data_inicio')}>
                <div className="flex items-center justify-end">
                  Vigência
                  <SortIcon columnKey="data_inicio" />
                </div>
              </TableHead>
              <TableHead className="h-11 px-4 text-right">Valor global</TableHead>
              <TableHead className="h-11 px-6">Empenhado campus</TableHead>
              <TableHead className="h-11 px-4 text-right">A liquidar campus</TableHead>
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
                    <TableCell className="py-3 px-6">
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
                        <button type="button" className="font-data text-sm font-semibold text-primary hover:underline underline-offset-4" onClick={() => void openContractDetails(c)}>{c.numero}</button>
                        {hasOpenInvoice ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="border-status-warning/40 bg-status-warning/10 text-status-warning text-xs whitespace-nowrap">
                                {openFaturas.length} {openFaturas.length === 1 ? 'fatura pendente' : 'faturas pendentes'}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs p-3 space-y-2 border-border-default/60 shadow-lifted">
                              <div className="space-y-1">
                                <span className="font-bold text-xs text-status-warning block">Faturas pendentes:</span>
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
                      <p className="mt-2 max-w-sm line-clamp-2 text-xs text-muted-foreground" title={apiContrato?.objeto || ''}>{apiContrato?.objeto || 'Objeto não informado'}</p>
                      {hasReitoriaOrigin ? (
                        <Badge variant="secondary" className="ml-2 rounded-md text-[10px]" title="Contrato com unidade de origem 158155. O contrato global pode ser da Reitoria; leia a execução pelos empenhos/faturas da UG 158366.">
                          Origem Reitoria
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-text-primary">{c.contratada}</span>
                        {c.cnpj && <span className="font-data text-xs text-text-secondary">{formatarDocumento(c.cnpj)}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right">
                      <div className="flex flex-col text-xs space-y-0.5">
                        <span className="text-text-secondary">Início: {safeFormatDate(c.data_inicio)}</span>
                        <span className="font-medium text-text-secondary">Fim: {safeFormatDate(c.data_termino)}</span>
                        <span className="font-medium text-foreground">{contractDeadlineLabel(c.data_termino)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-sm font-semibold text-action-primary">{formatCurrency(valorTotalContrato)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-6 text-right whitespace-nowrap">
                      <p className="font-data text-sm font-semibold">{formatCurrency(totalEmpenhado)}</p>
                      <button type="button" className="mt-1 text-xs text-primary hover:underline" onClick={() => void openContractDetails(c)}>{empenhoBadgeItems.length} empenho(s)</button>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right">
                      <div className="flex flex-col">
                        <span className={cn('font-semibold text-sm', totalALiquidar > 0 ? 'text-status-warning' : 'text-status-success')}>{formatCurrency(totalALiquidar)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-text-secondary hover:text-action-primary hover:bg-surface-subtle"
                            aria-label={`Ver detalhes do contrato ${c.numero}`}
                            onClick={() => void openContractDetails(c)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Ver detalhes
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </DataTablePanel>

      </div>
      {isSuperAdmin ? <ContratosSyncDialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen} onSyncComplete={handleSyncComplete} /> : null}
      <div hidden={!!inspectedEmpenho}>
      <ContratoApiDetailsSheet presentation="page" error={detailsError} onRetry={() => selectedApiContrato && void openApiDetails(selectedApiContrato)} execution={selectedExecution} onOpenEmpenho={setInspectedEmpenho} open={isDetailsOpen} onOpenChange={open => { if (!open) detailRequest.current++; setIsDetailsOpen(open); }} contrato={selectedPageContrato} details={selectedApiDetails} lastSyncRun={lastApiSyncRun} loading={isDetailsLoading} />
      </div>
      {inspectedEmpenho && <EmpenhoDialog presentation="page" backLabel="Voltar ao contrato" readOnly open={!!inspectedEmpenho} onOpenChange={open => { if (!open) setInspectedEmpenho(null); }} empenho={inspectedEmpenho} atividades={atividades} onSave={() => {}} />}
    </div>
  );
}
