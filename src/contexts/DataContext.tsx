
import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Atividade, Empenho, Descentralizacao, ResumoOrcamentario, Contrato, ContratoEmpenho, CreditoDisponivel } from '@/types';
import { atividadesService } from '@/services/atividades';
import { empenhosService } from '@/services/empenhos';
import { descentralizacoesService } from '@/services/descentralizacoes';
import { contratosService } from '@/services/contratos';
import { toast } from 'sonner';

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

  // --- Queries ---
  const { data: atividades = [], isLoading: isLoadingAtividades } = useQuery({
    queryKey: ['atividades'],
    queryFn: atividadesService.getAll,
  });

  const { data: empenhos = [], isLoading: isLoadingEmpenhos } = useQuery({
    queryKey: ['empenhos'],
    queryFn: empenhosService.getAll,
  });

  const { data: descentralizacoes = [], isLoading: isLoadingDescentralizacoes } = useQuery({
    queryKey: ['descentralizacoes'],
    queryFn: descentralizacoesService.getAll,
  });

  const { data: contratos = [], isLoading: isLoadingContratos } = useQuery({
    queryKey: ['contratos'],
    queryFn: contratosService.getContratos,
  });

  const { data: contratosEmpenhos = [], isLoading: isLoadingContratosEmpenhos } = useQuery({
    queryKey: ['contratos_empenhos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('contratos_empenhos').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: creditosDisponiveis = [], isLoading: isLoadingCreditos } = useQuery({
    queryKey: ['creditos_disponiveis'],
    queryFn: async () => {
      const { data, error } = await supabase.from('creditos_disponiveis').select('*').order('ptres', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const isLoading = isLoadingAtividades || isLoadingEmpenhos || isLoadingDescentralizacoes || isLoadingContratos || isLoadingContratosEmpenhos || isLoadingCreditos;

  // ... (previous mutations omitted for brevity, keeping them)

  // --- Mutations: Atividades ---
  const createAtividadeMutation = useMutation({
    mutationFn: atividadesService.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['atividades'] });
      await queryClient.refetchQueries({ queryKey: ['atividades'] });
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['atividades'] });
      await queryClient.refetchQueries({ queryKey: ['atividades'] });
      toast.success('Atividade atualizada com sucesso!');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao atualizar atividade.');
    },
  });

  const deleteAtividadeMutation = useMutation({
    mutationFn: atividadesService.delete,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['atividades'] });
      await queryClient.refetchQueries({ queryKey: ['atividades'] });
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['empenhos'] });
      await queryClient.refetchQueries({ queryKey: ['empenhos'] });
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['empenhos'] });
      await queryClient.refetchQueries({ queryKey: ['empenhos'] });
      toast.success('Empenho atualizado com sucesso!');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao atualizar empenho.');
    },
  });

  const deleteEmpenhoMutation = useMutation({
    mutationFn: empenhosService.delete,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['empenhos'] });
      await queryClient.refetchQueries({ queryKey: ['empenhos'] });
      toast.success('Empenho excluído com sucesso!');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao excluir empenho.');
    },
  });

  // --- Mutations: Descentralizações ---
  const createDescentralizacaoMutation = useMutation({
    mutationFn: descentralizacoesService.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['descentralizacoes'] });
      await queryClient.refetchQueries({ queryKey: ['descentralizacoes'] });
      toast.success('Descentralização criada com sucesso!');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao criar descentralização.');
    },
  });

  const updateDescentralizacaoMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Descentralizacao> }) =>
      descentralizacoesService.update(id, updates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['descentralizacoes'] });
      await queryClient.refetchQueries({ queryKey: ['descentralizacoes'] });
      toast.success('Descentralização atualizada com sucesso!');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao atualizar descentralização.');
    },
  });

  const deleteDescentralizacaoMutation = useMutation({
    mutationFn: descentralizacoesService.delete,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['descentralizacoes'] });
      await queryClient.refetchQueries({ queryKey: ['descentralizacoes'] });
      toast.success('Descentralização excluída com sucesso!');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao excluir descentralização.');
    },
  });

  // --- Wrappers ---
  const addAtividade = useCallback(
    async (atividade: Omit<Atividade, 'id' | 'createdAt' | 'updatedAt'>) => {
      return createAtividadeMutation.mutateAsync(atividade);
    },
    [createAtividadeMutation]
  );

  const updateAtividade = useCallback(
    async (id: string, updates: Partial<Atividade>) => {
      return updateAtividadeMutation.mutateAsync({ id, updates });
    },
    [updateAtividadeMutation]
  );

  const deleteAtividade = useCallback(
    async (id: string) => {
      return deleteAtividadeMutation.mutateAsync(id);
    },
    [deleteAtividadeMutation]
  );

  const addEmpenho = useCallback(
    async (empenho: Omit<Empenho, 'id' | 'createdAt' | 'updatedAt'>) => {
      return createEmpenhoMutation.mutateAsync(empenho);
    },
    [createEmpenhoMutation]
  );

  const updateEmpenho = useCallback(
    async (id: string, updates: Partial<Empenho>) => {
      return updateEmpenhoMutation.mutateAsync({ id, updates });
    },
    [updateEmpenhoMutation]
  );

  const deleteEmpenho = useCallback(
    async (id: string) => {
      return deleteEmpenhoMutation.mutateAsync(id);
    },
    [deleteEmpenhoMutation]
  );

  const addDescentralizacao = useCallback(
    async (d: Omit<Descentralizacao, 'id' | 'createdAt' | 'updatedAt'>) => {
      return createDescentralizacaoMutation.mutateAsync(d);
    },
    [createDescentralizacaoMutation]
  );

  const updateDescentralizacao = useCallback(
    async (id: string, updates: Partial<Descentralizacao>) => {
      return updateDescentralizacaoMutation.mutateAsync({ id, updates });
    },
    [updateDescentralizacaoMutation]
  );

  const deleteDescentralizacao = useCallback(
    async (id: string) => {
      return deleteDescentralizacaoMutation.mutateAsync(id);
    },
    [deleteDescentralizacaoMutation]
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

  const getTotalDescentralizado = useCallback(() => {
    return descentralizacoes.reduce((sum, d) => sum + d.valor, 0);
  }, [descentralizacoes]);

  const getADescentralizar = useCallback(() => {
    return getTotalPlanejado() - getTotalDescentralizado();
  }, [getTotalPlanejado, getTotalDescentralizado]);

  const getSaldoTotal = useCallback(() => {
    return getTotalPlanejado() - getTotalEmpenhado();
  }, [getTotalPlanejado, getTotalEmpenhado]);

  const refreshData = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['atividades'] });
    await queryClient.invalidateQueries({ queryKey: ['empenhos'] });
    await queryClient.invalidateQueries({ queryKey: ['descentralizacoes'] });
    await queryClient.invalidateQueries({ queryKey: ['contratos'] });
    await queryClient.invalidateQueries({ queryKey: ['contratos_empenhos'] });
    await queryClient.invalidateQueries({ queryKey: ['creditos_disponiveis'] });
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
      addAtividade,
      updateAtividade,
      deleteAtividade,
      addEmpenho,
      updateEmpenho,
      deleteEmpenho,
      addDescentralizacao,
      updateDescentralizacao,
      deleteDescentralizacao,
      getResumoOrcamentario,
      getTotalPlanejado,
      getTotalEmpenhado,
      getTotalDescentralizado,
      getADescentralizar,
      getSaldoTotal,
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
      addAtividade,
      updateAtividade,
      deleteAtividade,
      addEmpenho,
      updateEmpenho,
      deleteEmpenho,
      addDescentralizacao,
      updateDescentralizacao,
      deleteDescentralizacao,
      getResumoOrcamentario,
      getTotalPlanejado,
      getTotalEmpenhado,
      getTotalDescentralizado,
      getADescentralizar,
      getSaldoTotal,
      refreshData,
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
