import type { Atividade, Descentralizacao, Empenho, ResumoOrcamentario } from '@/types';

export function getTotalPlanejado(atividades: Atividade[]) {
  return atividades.reduce((sum, atividade) => sum + atividade.valorTotal, 0);
}

export function getTotalEmpenhado(empenhos: Empenho[]) {
  return empenhos
    .filter((empenho) => empenho.status !== 'cancelado')
    .reduce((sum, empenho) => sum + empenho.valor, 0);
}

export function getTotalDescentralizado(descentralizacoes: Descentralizacao[]) {
  return descentralizacoes.reduce((sum, descentralizacao) => sum + descentralizacao.valor, 0);
}

export function getADescentralizar(
  atividades: Atividade[],
  descentralizacoes: Descentralizacao[],
) {
  return getTotalPlanejado(atividades) - getTotalDescentralizado(descentralizacoes);
}

export function getSaldoTotal(atividades: Atividade[], empenhos: Empenho[]) {
  return getTotalPlanejado(atividades) - getTotalEmpenhado(empenhos);
}

export function getResumoOrcamentario(
  atividades: Atividade[],
  empenhos: Empenho[],
): ResumoOrcamentario[] {
  const resumoMap = new Map<string, ResumoOrcamentario>();

  atividades.forEach((atividade) => {
    const key = `${atividade.dimensao}|${atividade.origemRecurso}`;
    const existing = resumoMap.get(key);

    if (existing) {
      existing.valorPlanejado += atividade.valorTotal;
      return;
    }

    resumoMap.set(key, {
      dimensao: atividade.dimensao,
      origemRecurso: atividade.origemRecurso,
      valorPlanejado: atividade.valorTotal,
      valorEmpenhado: 0,
      saldoDisponivel: 0,
      percentualExecutado: 0,
    });
  });

  empenhos.forEach((empenho) => {
    if (empenho.status === 'cancelado') {
      return;
    }

    const key = `${empenho.dimensao}|${empenho.origemRecurso}`;
    const existing = resumoMap.get(key);

    if (existing) {
      existing.valorEmpenhado += empenho.valor;
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
}
