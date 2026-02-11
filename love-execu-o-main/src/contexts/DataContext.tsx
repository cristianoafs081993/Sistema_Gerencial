
import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Atividade, Empenho, ResumoOrcamentario } from '@/types';
import { atividadesService } from '@/services/atividades';
import { empenhosService } from '@/services/empenhos';
import { toast } from 'sonner';

interface DataContextType {
  atividades: Atividade[];
  empenhos: Empenho[];
  isLoading: boolean;
  addAtividade: (atividade: Omit<Atividade, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateAtividade: (id: string, atividade: Partial<Atividade>) => void;
  deleteAtividade: (id: string) => void;
  addEmpenho: (empenho: Omit<Empenho, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateEmpenho: (id: string, empenho: Partial<Empenho>) => void;
  deleteEmpenho: (id: string) => void;
  getResumoOrcamentario: () => ResumoOrcamentario[];
  getTotalPlanejado: () => number;
  getTotalEmpenhado: () => number;
  getSaldoTotal: () => number;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  // --- Queries ---
  const { data: atividades = [], isLoading: isLoadingAtividades } = useQuery({
    queryKey: ['atividades'],
    queryFn: atividadesService.getAll,
  });

  const { data: empenhos = [], isLoading: isLoadingEmpenhos } = useQuery({
    queryKey: ['empenhos'],
    queryFn: empenhosService.getAll,
  });

  const isLoading = isLoadingAtividades || isLoadingEmpenhos;

  // --- Mutations: Atividades ---
  const createAtividadeMutation = useMutation({
    mutationFn: atividadesService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      toast.success('Atividade criada com sucesso!');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao criar atividade.');
    },
  });

  const updateAtividadeMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Atividade> }) =>
      atividadesService.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      toast.success('Atividade atualizada com sucesso!');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao atualizar atividade.');
    },
  });

  const deleteAtividadeMutation = useMutation({
    mutationFn: atividadesService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      toast.success('Atividade excluída com sucesso!');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao excluir atividade.');
    },
  });

  // --- Mutations: Empenhos ---
  const createEmpenhoMutation = useMutation({
    mutationFn: empenhosService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empenhos'] });
      toast.success('Empenho criado com sucesso!');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao criar empenho.');
    },
  });

  const updateEmpenhoMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Empenho> }) =>
      empenhosService.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empenhos'] });
      toast.success('Empenho atualizado com sucesso!');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao atualizar empenho.');
    },
  });

  const deleteEmpenhoMutation = useMutation({
    mutationFn: empenhosService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empenhos'] });
      toast.success('Empenho excluído com sucesso!');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao excluir empenho.');
    },
  });

  // --- Wrappers ---
  const addAtividade = useCallback(
    (atividade: Omit<Atividade, 'id' | 'createdAt' | 'updatedAt'>) => {
      createAtividadeMutation.mutate(atividade);
    },
    [createAtividadeMutation]
  );

  const updateAtividade = useCallback(
    (id: string, updates: Partial<Atividade>) => {
      updateAtividadeMutation.mutate({ id, updates });
    },
    [updateAtividadeMutation]
  );

  const deleteAtividade = useCallback(
    (id: string) => {
      deleteAtividadeMutation.mutate(id);
    },
    [deleteAtividadeMutation]
  );

  const addEmpenho = useCallback(
    (empenho: Omit<Empenho, 'id' | 'createdAt' | 'updatedAt'>) => {
      createEmpenhoMutation.mutate(empenho);
    },
    [createEmpenhoMutation]
  );

  const updateEmpenho = useCallback(
    (id: string, updates: Partial<Empenho>) => {
      updateEmpenhoMutation.mutate({ id, updates });
    },
    [updateEmpenhoMutation]
  );

  const deleteEmpenho = useCallback(
    (id: string) => {
      deleteEmpenhoMutation.mutate(id);
    },
    [deleteEmpenhoMutation]
  );

  // --- Derived Data (KPIs) ---
  const getResumoOrcamentario = useCallback((): ResumoOrcamentario[] => {
    const resumoMap = new Map<string, ResumoOrcamentario>();

    atividades.forEach((a) => {
      const key = `${a.dimensao}|${a.origemRecurso}`;
      const existing = resumoMap.get(key);
      if (existing) {
        existing.valorPlanejado += a.valorTotal;
      } else {
        resumoMap.set(key, {
          dimensao: a.dimensao,
          origemRecurso: a.origemRecurso,
          valorPlanejado: a.valorTotal,
          valorEmpenhado: 0,
          saldoDisponivel: 0,
          percentualExecutado: 0,
        });
      }
    });

    empenhos.forEach((e) => {
      if (e.status !== 'cancelado') {
        const key = `${e.dimensao}|${e.origemRecurso}`;
        const existing = resumoMap.get(key);
        if (existing) {
          existing.valorEmpenhado += e.valor;
        }
      }
    });

    resumoMap.forEach((resumo) => {
      resumo.saldoDisponivel = resumo.valorPlanejado - resumo.valorEmpenhado;
      resumo.percentualExecutado =
        resumo.valorPlanejado > 0
          ? (resumo.valorEmpenhado / resumo.valorPlanejado) * 100
          : 0;
    });

    return Array.from(resumoMap.values());
  }, [atividades, empenhos]);

  const getTotalPlanejado = useCallback(() => {
    return atividades.reduce((sum, a) => sum + a.valorTotal, 0);
  }, [atividades]);

  const getTotalEmpenhado = useCallback(() => {
    return empenhos
      .filter((e) => e.status !== 'cancelado')
      .reduce((sum, e) => sum + e.valor, 0);
  }, [empenhos]);

  const getSaldoTotal = useCallback(() => {
    return getTotalPlanejado() - getTotalEmpenhado();
  }, [getTotalPlanejado, getTotalEmpenhado]);

  const value = useMemo(
    () => ({
      atividades,
      empenhos,
      isLoading,
      addAtividade,
      updateAtividade,
      deleteAtividade,
      addEmpenho,
      updateEmpenho,
      deleteEmpenho,
      getResumoOrcamentario,
      getTotalPlanejado,
      getTotalEmpenhado,
      getSaldoTotal,
    }),
    [
      atividades,
      empenhos,
      isLoading,
      addAtividade,
      updateAtividade,
      deleteAtividade,
      addEmpenho,
      updateEmpenho,
      deleteEmpenho,
      getResumoOrcamentario,
      getTotalPlanejado,
      getTotalEmpenhado,
      getSaldoTotal,
    ]
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
