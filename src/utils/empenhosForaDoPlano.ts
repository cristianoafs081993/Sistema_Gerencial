import type { Atividade, Empenho } from '@/types';

/**
 * Separa os empenhos do exercício entre os que executam o plano do campus e os
 * que vêm de TED ou outras fontes externas (PTRES que não aparece em nenhuma
 * atividade planejada). Só os primeiros entram em "Empenhado x Planejado".
 *
 * Campus sem nenhuma atividade sincronizada mantém o comportamento anterior
 * (tudo conta como empenhado), para não zerar o painel de quem ainda não tem plano.
 */
const normalizeOrigem = (origem?: string | null) => String(origem ?? '').trim();

export function getOrigensDoPlano(atividades: Pick<Atividade, 'origemRecurso'>[]) {
  return new Set(atividades.map((atividade) => normalizeOrigem(atividade.origemRecurso)).filter(Boolean));
}

export function splitEmpenhosPorPlano<T extends Pick<Empenho, 'origemRecurso'>>(
  empenhos: T[],
  origensDoPlano: Set<string>,
): { noPlano: T[]; foraDoPlano: T[] } {
  if (origensDoPlano.size === 0) return { noPlano: empenhos, foraDoPlano: [] };

  const noPlano: T[] = [];
  const foraDoPlano: T[] = [];
  empenhos.forEach((empenho) => {
    (origensDoPlano.has(normalizeOrigem(empenho.origemRecurso)) ? noPlano : foraDoPlano).push(empenho);
  });
  return { noPlano, foraDoPlano };
}

export type EmpenhosForaDoPlanoOrigem = {
  origem: string;
  descricao: string;
  quantidade: number;
  empenhado: number;
  pago: number;
};

export type EmpenhosForaDoPlanoResumo = {
  quantidade: number;
  empenhado: number;
  pago: number;
  porOrigem: EmpenhosForaDoPlanoOrigem[];
};

export function summarizeEmpenhosForaDoPlano(
  empenhos: Pick<Empenho, 'origemRecurso' | 'valor' | 'valorPagoOficial' | 'descricao'>[],
): EmpenhosForaDoPlanoResumo {
  const porOrigem = new Map<string, EmpenhosForaDoPlanoOrigem>();

  empenhos.forEach((empenho) => {
    const origem = normalizeOrigem(empenho.origemRecurso) || 'Sem origem';
    const item = porOrigem.get(origem) ?? {
      origem,
      descricao: empenho.descricao?.trim() ?? '',
      quantidade: 0,
      empenhado: 0,
      pago: 0,
    };
    item.quantidade += 1;
    item.empenhado += Number(empenho.valor) || 0;
    item.pago += Number(empenho.valorPagoOficial) || 0;
    porOrigem.set(origem, item);
  });

  const linhas = Array.from(porOrigem.values()).sort((left, right) => right.empenhado - left.empenhado);
  return {
    quantidade: empenhos.length,
    empenhado: linhas.reduce((sum, item) => sum + item.empenhado, 0),
    pago: linhas.reduce((sum, item) => sum + item.pago, 0),
    porOrigem: linhas,
  };
}
