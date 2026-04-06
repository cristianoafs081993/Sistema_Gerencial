import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  Atividade,
  Contrato,
  ContratoEmpenho,
  CreditoDisponivel,
  Descentralizacao,
  Empenho,
  ResumoOrcamentario,
} from '@/types';
import { atividadesService } from '@/services/atividades';
import { descentralizacoesService } from '@/services/descentralizacoes';
import { empenhosService } from '@/services/empenhos';
import { allDataQueryKeys, dataQueryKeys } from '@/contexts/dataQueryKeys';
import {
  getADescentralizar,
  getResumoOrcamentario,
  getSaldoTotal,
  getTotalDescentralizado,
  getTotalEmpenhado,
  getTotalPlanejado,
} from '@/contexts/dataMetrics';
import { useCrudMutations } from '@/contexts/useCrudMutations';
import { useDataQueries } from '@/contexts/useDataQueries';

interface DataContextType {
  atividades: Atividade[];
  empenhos: Empenho[];
  descentralizacoes: Descentralizacao[];
  contratos: Contrato[];
  contratosEmpenhos: ContratoEmpenho[];
  creditosDisponiveis: CreditoDisponivel[];
  isLoading: boolean;
  addAtividade: (atividade: Omit<Atividade, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateAtividade: (id: string, atividade: Partial<Atividade>) => void;
  deleteAtividade: (id: string) => void;
  addEmpenho: (empenho: Omit<Empenho, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateEmpenho: (id: string, empenho: Partial<Empenho>) => void;
  deleteEmpenho: (id: string) => void;
  addDescentralizacao: (d: Omit<Descentralizacao, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateDescentralizacao: (id: string, d: Partial<Descentralizacao>) => void;
  deleteDescentralizacao: (id: string) => void;
  getResumoOrcamentario: () => ResumoOrcamentario[];
  getTotalPlanejado: () => number;
  getTotalEmpenhado: () => number;
  getTotalDescentralizado: () => number;
  getADescentralizar: () => number;
  getSaldoTotal: () => number;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const {
    atividades,
    empenhos,
    descentralizacoes,
    contratos,
    contratosEmpenhos,
    creditosDisponiveis,
    isLoading,
  } = useDataQueries();

  const atividadeMutations = useCrudMutations<
    Atividade,
    Omit<Atividade, 'id' | 'createdAt' | 'updatedAt'>
  >({
    queryKey: dataQueryKeys.atividades,
    service: atividadesService,
    messages: {
      createSuccess: 'Atividade criada com sucesso!',
      createError: 'Erro ao criar atividade.',
      updateSuccess: 'Atividade atualizada com sucesso!',
      updateError: 'Erro ao atualizar atividade.',
      deleteSuccess: 'Atividade excluida com sucesso!',
      deleteError: 'Erro ao excluir atividade.',
    },
  });

  const empenhoMutations = useCrudMutations<
    Empenho,
    Omit<Empenho, 'id' | 'createdAt' | 'updatedAt'>
  >({
    queryKey: dataQueryKeys.empenhos,
    service: empenhosService,
    messages: {
      createSuccess: 'Empenho criado com sucesso!',
      createError: 'Erro ao criar empenho.',
      updateSuccess: 'Empenho atualizado com sucesso!',
      updateError: 'Erro ao atualizar empenho.',
      deleteSuccess: 'Empenho excluido com sucesso!',
      deleteError: 'Erro ao excluir empenho.',
    },
  });

  const descentralizacaoMutations = useCrudMutations<
    Descentralizacao,
    Omit<Descentralizacao, 'id' | 'createdAt' | 'updatedAt'>
  >({
    queryKey: dataQueryKeys.descentralizacoes,
    service: descentralizacoesService,
    messages: {
      createSuccess: 'Descentralizacao criada com sucesso!',
      createError: 'Erro ao criar descentralizacao.',
      updateSuccess: 'Descentralizacao atualizada com sucesso!',
      updateError: 'Erro ao atualizar descentralizacao.',
      deleteSuccess: 'Descentralizacao excluida com sucesso!',
      deleteError: 'Erro ao excluir descentralizacao.',
    },
  });

  const metrics = useMemo(
    () => ({
      resumoOrcamentario: getResumoOrcamentario(atividades, empenhos),
      totalPlanejado: getTotalPlanejado(atividades),
      totalEmpenhado: getTotalEmpenhado(empenhos),
      totalDescentralizado: getTotalDescentralizado(descentralizacoes),
      aDescentralizar: getADescentralizar(atividades, descentralizacoes),
      saldoTotal: getSaldoTotal(atividades, empenhos),
    }),
    [atividades, empenhos, descentralizacoes],
  );

  const getResumoOrcamentarioValue = useCallback((): ResumoOrcamentario[] => {
    return metrics.resumoOrcamentario;
  }, [metrics.resumoOrcamentario]);

  const getTotalPlanejadoValue = useCallback(() => {
    return metrics.totalPlanejado;
  }, [metrics.totalPlanejado]);

  const getTotalEmpenhadoValue = useCallback(() => {
    return metrics.totalEmpenhado;
  }, [metrics.totalEmpenhado]);

  const getTotalDescentralizadoValue = useCallback(() => {
    return metrics.totalDescentralizado;
  }, [metrics.totalDescentralizado]);

  const getADescentralizarValue = useCallback(() => {
    return metrics.aDescentralizar;
  }, [metrics.aDescentralizar]);

  const getSaldoTotalValue = useCallback(() => {
    return metrics.saldoTotal;
  }, [metrics.saldoTotal]);

  const refreshData = useCallback(async () => {
    await Promise.all(
      allDataQueryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  }, [queryClient]);

  const value = useMemo(
    () => ({
      atividades,
      empenhos,
      descentralizacoes,
      contratos,
      contratosEmpenhos,
      creditosDisponiveis,
      isLoading,
      addAtividade: atividadeMutations.add,
      updateAtividade: atividadeMutations.update,
      deleteAtividade: atividadeMutations.remove,
      addEmpenho: empenhoMutations.add,
      updateEmpenho: empenhoMutations.update,
      deleteEmpenho: empenhoMutations.remove,
      addDescentralizacao: descentralizacaoMutations.add,
      updateDescentralizacao: descentralizacaoMutations.update,
      deleteDescentralizacao: descentralizacaoMutations.remove,
      getResumoOrcamentario: getResumoOrcamentarioValue,
      getTotalPlanejado: getTotalPlanejadoValue,
      getTotalEmpenhado: getTotalEmpenhadoValue,
      getTotalDescentralizado: getTotalDescentralizadoValue,
      getADescentralizar: getADescentralizarValue,
      getSaldoTotal: getSaldoTotalValue,
      refreshData,
    }),
    [
      atividades,
      empenhos,
      descentralizacoes,
      contratos,
      contratosEmpenhos,
      creditosDisponiveis,
      isLoading,
      atividadeMutations.add,
      atividadeMutations.update,
      atividadeMutations.remove,
      empenhoMutations.add,
      empenhoMutations.update,
      empenhoMutations.remove,
      descentralizacaoMutations.add,
      descentralizacaoMutations.update,
      descentralizacaoMutations.remove,
      getResumoOrcamentarioValue,
      getTotalPlanejadoValue,
      getTotalEmpenhadoValue,
      getTotalDescentralizadoValue,
      getADescentralizarValue,
      getSaldoTotalValue,
      refreshData,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);

  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }

  return context;
}
