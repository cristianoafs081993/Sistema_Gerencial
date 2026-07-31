import type { Atividade, Descentralizacao, Empenho } from '@/types';
import { getDimensionLabel, resolveRecordDimensionCode } from '@/utils/dimensionFilters';

export type SuapPlanActivityDetail = {
  id: string;
  atividade: string;
  descricao: string;
  componenteFuncional: string;
  origemRecurso: string;
  planoInterno: string;
  valor: number;
};

export type SuapPlanDescentralizacaoDetail = {
  id: string;
  notaCredito?: string;
  descricao?: string;
  origemRecurso: string;
  naturezaDespesa?: string;
  planoInterno?: string;
  dataEmissao?: string;
  valor: number;
};

export type SuapPlanEmpenhoDetail = {
  id: string;
  numero: string;
  descricao: string;
  origemRecurso: string;
  dataEmpenho: string;
  valor: number;
};

export type SuapPlanDimensionSummary = {
  key: string;
  dimensao: string;
  totalPlanejado: number;
  totalDescentralizado: number;
  aDescentralizar: number;
  totalEmpenhado: number;
  aEmpenhar: number;
  atividades: SuapPlanActivityDetail[];
  descentralizacoes: SuapPlanDescentralizacaoDetail[];
  empenhos: SuapPlanEmpenhoDetail[];
};

export type SuapPlanSummary = {
  planId: 8;
  dimensoes: SuapPlanDimensionSummary[];
};

type BuildSuapPlanSummaryInput = {
  atividades: Atividade[];
  descentralizacoes: Descentralizacao[];
  empenhos: Empenho[];
};

type DimensionIdentityInput = {
  dimensao?: string;
  planoInterno?: string;
  descricao?: string;
};

function resolveDimension({ dimensao, planoInterno, descricao }: DimensionIdentityInput) {
  const code = resolveRecordDimensionCode({
    dimensionValue: dimensao,
    planInternal: planoInterno,
    description: descricao,
  });
  const fallback = dimensao?.trim() || 'Sem dimensão';

  return {
    key: code || fallback.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(),
    label: getDimensionLabel(code) || fallback,
  };
}

function toDateString(value?: Date) {
  return value && !Number.isNaN(value.getTime()) ? value.toISOString() : undefined;
}

function getOrCreateDimension(
  map: Map<string, SuapPlanDimensionSummary>,
  identity: DimensionIdentityInput,
) {
  const dimension = resolveDimension(identity);
  const existing = map.get(dimension.key);
  if (existing) return existing;

  const created: SuapPlanDimensionSummary = {
    key: dimension.key,
    dimensao: dimension.label,
    totalPlanejado: 0,
    totalDescentralizado: 0,
    aDescentralizar: 0,
    totalEmpenhado: 0,
    aEmpenhar: 0,
    atividades: [],
    descentralizacoes: [],
    empenhos: [],
  };
  map.set(dimension.key, created);
  return created;
}

/**
 * Produz o resumo do plano que a extensão exibe no SUAP. O total de
 * descentralizações parte dos lançamentos detalhados (e não do snapshot por
 * PTRES) para que cada célula seja auditável pelos registros do drill-down.
 */
export function buildSuapPlanSummary({
  atividades,
  descentralizacoes,
  empenhos,
}: BuildSuapPlanSummaryInput): SuapPlanSummary {
  const dimensions = new Map<string, SuapPlanDimensionSummary>();

  atividades.forEach((atividade) => {
    const dimension = getOrCreateDimension(dimensions, {
      dimensao: atividade.dimensao,
      planoInterno: atividade.planoInterno,
      descricao: atividade.descricao,
    });
    const valor = Number(atividade.valorTotal) || 0;
    dimension.totalPlanejado += valor;
    dimension.atividades.push({
      id: atividade.id,
      atividade: atividade.atividade,
      descricao: atividade.descricao,
      componenteFuncional: atividade.componenteFuncional,
      origemRecurso: atividade.origemRecurso,
      planoInterno: atividade.planoInterno,
      valor,
    });
  });

  descentralizacoes.forEach((descentralizacao) => {
    const dimension = getOrCreateDimension(dimensions, {
      dimensao: descentralizacao.dimensao,
      planoInterno: descentralizacao.planoInterno,
      descricao: descentralizacao.descricao,
    });
    const valor = Number(descentralizacao.valor) || 0;
    dimension.totalDescentralizado += valor;
    dimension.descentralizacoes.push({
      id: descentralizacao.id,
      notaCredito: descentralizacao.notaCredito,
      descricao: descentralizacao.descricao,
      origemRecurso: descentralizacao.origemRecurso,
      naturezaDespesa: descentralizacao.naturezaDespesa,
      planoInterno: descentralizacao.planoInterno,
      dataEmissao: toDateString(descentralizacao.dataEmissao),
      valor,
    });
  });

  empenhos
    .filter((empenho) => empenho.tipo === 'exercicio' && empenho.status !== 'cancelado')
    .forEach((empenho) => {
      const dimension = getOrCreateDimension(dimensions, {
        dimensao: empenho.dimensao,
        planoInterno: empenho.planoInterno,
        descricao: empenho.descricao,
      });
      const valor = Number(empenho.valor) || 0;
      dimension.totalEmpenhado += valor;
      dimension.empenhos.push({
        id: empenho.id,
        numero: empenho.numero,
        descricao: empenho.descricao,
        origemRecurso: empenho.origemRecurso,
        dataEmpenho: toDateString(empenho.dataEmpenho) || '',
        valor,
      });
    });

  const dimensoes = Array.from(dimensions.values())
    .map((dimension) => ({
      ...dimension,
      aDescentralizar: dimension.totalPlanejado - dimension.totalDescentralizado,
      aEmpenhar: dimension.totalDescentralizado - dimension.totalEmpenhado,
      atividades: dimension.atividades.sort((left, right) => left.atividade.localeCompare(right.atividade)),
      descentralizacoes: dimension.descentralizacoes.sort((left, right) =>
        String(right.dataEmissao || '').localeCompare(String(left.dataEmissao || '')),
      ),
      empenhos: dimension.empenhos.sort((left, right) => right.dataEmpenho.localeCompare(left.dataEmpenho)),
    }))
    .sort((left, right) => left.dimensao.localeCompare(right.dimensao, 'pt-BR'));

  return { planId: 8, dimensoes };
}
