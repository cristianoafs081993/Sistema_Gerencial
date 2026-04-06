import { useQuery } from '@tanstack/react-query';
import { atividadesService } from '@/services/atividades';
import { contratosService } from '@/services/contratos';
import { creditosDisponiveisService } from '@/services/creditosDisponiveis';
import { descentralizacoesService } from '@/services/descentralizacoes';
import { empenhosService } from '@/services/empenhos';
import { dataQueryKeys } from '@/contexts/dataQueryKeys';

export function useDataQueries() {
  const { data: atividades = [], isLoading: isLoadingAtividades } = useQuery({
    queryKey: dataQueryKeys.atividades,
    queryFn: atividadesService.getAll,
  });

  const { data: empenhos = [], isLoading: isLoadingEmpenhos } = useQuery({
    queryKey: dataQueryKeys.empenhos,
    queryFn: empenhosService.getAll,
  });

  const { data: descentralizacoes = [], isLoading: isLoadingDescentralizacoes } = useQuery({
    queryKey: dataQueryKeys.descentralizacoes,
    queryFn: descentralizacoesService.getAll,
  });

  const { data: contratos = [], isLoading: isLoadingContratos } = useQuery({
    queryKey: dataQueryKeys.contratos,
    queryFn: contratosService.getContratos,
  });

  const { data: contratosEmpenhos = [], isLoading: isLoadingContratosEmpenhos } = useQuery({
    queryKey: dataQueryKeys.contratosEmpenhos,
    queryFn: contratosService.getContratosEmpenhos,
  });

  const { data: creditosDisponiveis = [], isLoading: isLoadingCreditos } = useQuery({
    queryKey: dataQueryKeys.creditosDisponiveis,
    queryFn: creditosDisponiveisService.getAll,
  });

  return {
    atividades,
    empenhos,
    descentralizacoes,
    contratos,
    contratosEmpenhos,
    creditosDisponiveis,
    isLoading:
      isLoadingAtividades ||
      isLoadingEmpenhos ||
      isLoadingDescentralizacoes ||
      isLoadingContratos ||
      isLoadingContratosEmpenhos ||
      isLoadingCreditos,
  };
}
