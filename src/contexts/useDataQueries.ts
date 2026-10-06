import { useQuery } from '@tanstack/react-query';
import { atividadesService } from '@/services/atividades';
import { contratosService } from '@/services/contratos';
import { creditosDisponiveisService } from '@/services/creditosDisponiveis';
import { descentralizacoesContaSaldosService } from '@/services/descentralizacoesContaSaldos';
import { descentralizacoesService } from '@/services/descentralizacoes';
import { empenhosService } from '@/services/empenhos';
import { dataQueryKeys } from '@/contexts/dataQueryKeys';
import { useOptionalAuth } from '@/contexts/AuthContext';
import { DEFAULT_IFRN_CAMPUS_UASG } from '@/lib/ifrnCampuses';
import { getSuapPlanUnitForCampus } from '@/lib/suapPlanUnits';

export function useDataQueries() {
  const auth = useOptionalAuth();
  const campusUasg = auth?.userCampus.codigo ?? DEFAULT_IFRN_CAMPUS_UASG;
  const suapUnitCode = getSuapPlanUnitForCampus(campusUasg).value;
  // Failed reads require an explicit retry; focus changes must not flood an outage.
  const readOptions = { retry: false as const, staleTime: 60_000, refetchOnWindowFocus: false };
  const atividadesQuery = useQuery({
    ...readOptions,
    queryKey: [...dataQueryKeys.atividades, campusUasg, suapUnitCode],
    queryFn: () => atividadesService.getAll(campusUasg, suapUnitCode),
  });

  const empenhosQuery = useQuery({
    ...readOptions,
    queryKey: [...dataQueryKeys.empenhos, campusUasg],
    queryFn: () => empenhosService.getAll(campusUasg),
  });

  const descentralizacoesQuery = useQuery({
    ...readOptions,
    queryKey: [...dataQueryKeys.descentralizacoes, campusUasg],
    queryFn: () => descentralizacoesService.getAll(campusUasg),
  });

  const contaDescentralizacoesQuery = useQuery({
    ...readOptions,
    queryKey: [...dataQueryKeys.descentralizacoesContaSaldos, campusUasg],
    queryFn: () => descentralizacoesContaSaldosService.getAll(campusUasg),
  });

  const contratosQuery = useQuery({
    ...readOptions,
    queryKey: [...dataQueryKeys.contratos, campusUasg],
    queryFn: () => contratosService.getContratos(campusUasg),
  });

  const contratosEmpenhosQuery = useQuery({
    ...readOptions,
    queryKey: [...dataQueryKeys.contratosEmpenhos, campusUasg],
    queryFn: () => contratosService.getContratosEmpenhos(campusUasg),
  });

  const creditosDisponiveisQuery = useQuery({
    ...readOptions,
    queryKey: [...dataQueryKeys.creditosDisponiveis, campusUasg],
    queryFn: () => creditosDisponiveisService.getAll(campusUasg),
  });

  const queries = [atividadesQuery, empenhosQuery, descentralizacoesQuery, contaDescentralizacoesQuery,
    contratosQuery, contratosEmpenhosQuery, creditosDisponiveisQuery];
  const names = ['atividades', 'empenhos', 'descentralizações', 'saldos de descentralização',
    'contratos', 'vínculos de contratos', 'créditos disponíveis'];
  const errors = queries.flatMap((query, index) => query.isError ? [names[index]] : []);
  return {
    atividades: atividadesQuery.data ?? [],
    empenhos: empenhosQuery.data ?? [],
    descentralizacoes: descentralizacoesQuery.data ?? [],
    contaDescentralizacoes: contaDescentralizacoesQuery.data ?? [],
    contratos: contratosQuery.data ?? [],
    contratosEmpenhos: contratosEmpenhosQuery.data ?? [],
    creditosDisponiveis: creditosDisponiveisQuery.data ?? [],
    isLoading: queries.some(query => query.isLoading),
    isRefreshing: queries.some(query => query.isFetching),
    dataError: errors.length ? `Não foi possível atualizar: ${errors.join(', ')}.` : null,
    hasInitialDataError: queries.some(query => query.isError && query.data === undefined),
  };
}
