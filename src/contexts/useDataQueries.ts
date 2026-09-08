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

export function useDataQueries() {
  const auth = useOptionalAuth();
  const campusUasg = auth?.userCampus.codigo ?? DEFAULT_IFRN_CAMPUS_UASG;
  const { data: atividades = [], isLoading: isLoadingAtividades } = useQuery({
    queryKey: [...dataQueryKeys.atividades, campusUasg],
    queryFn: () => atividadesService.getAll(campusUasg),
  });

  const { data: empenhos = [], isLoading: isLoadingEmpenhos } = useQuery({
    queryKey: [...dataQueryKeys.empenhos, campusUasg],
    queryFn: () => empenhosService.getAll(campusUasg),
  });

  const { data: descentralizacoes = [], isLoading: isLoadingDescentralizacoes } = useQuery({
    queryKey: [...dataQueryKeys.descentralizacoes, campusUasg],
    queryFn: () => descentralizacoesService.getAll(campusUasg),
  });

  const { data: contaDescentralizacoes = [], isLoading: isLoadingContaDescentralizacoes } = useQuery({
    queryKey: [...dataQueryKeys.descentralizacoesContaSaldos, campusUasg],
    queryFn: () => descentralizacoesContaSaldosService.getAll(campusUasg),
  });

  const { data: contratos = [], isLoading: isLoadingContratos } = useQuery({
    queryKey: [...dataQueryKeys.contratos, campusUasg],
    queryFn: () => contratosService.getContratos(campusUasg),
  });

  const { data: contratosEmpenhos = [], isLoading: isLoadingContratosEmpenhos } = useQuery({
    queryKey: [...dataQueryKeys.contratosEmpenhos, campusUasg],
    queryFn: () => contratosService.getContratosEmpenhos(campusUasg),
  });

  const { data: creditosDisponiveis = [], isLoading: isLoadingCreditos } = useQuery({
    queryKey: [...dataQueryKeys.creditosDisponiveis, campusUasg],
    queryFn: () => creditosDisponiveisService.getAll(campusUasg),
  });

  return {
    atividades,
    empenhos,
    descentralizacoes,
    contaDescentralizacoes,
    contratos,
    contratosEmpenhos,
    creditosDisponiveis,
    isLoading:
      isLoadingAtividades ||
      isLoadingEmpenhos ||
      isLoadingDescentralizacoes ||
      isLoadingContaDescentralizacoes ||
      isLoadingContratos ||
      isLoadingContratosEmpenhos ||
      isLoadingCreditos,
  };
}
