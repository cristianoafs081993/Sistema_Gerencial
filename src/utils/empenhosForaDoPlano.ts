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

/** Unidade SUAP da Diretoria de Gestão de Pessoas (DIGPE/RE), que planeja a folha na UG 158155. */
export const SUAP_UNIT_DIGPE = '6';

/**
 * PTRES de folha e benefícios: os que só aparecem em atividades da DIGPE. O crédito de pessoal é
 * suplementado ao longo do ano, então ele fica num indicador próprio para não distorcer o
 * "Empenhado x Planejado" de custeio e investimento.
 */
export function getOrigensDePessoal(atividades: Pick<Atividade, 'origemRecurso' | 'suapUnitCode'>[]) {
  const unidadesPorOrigem = new Map<string, Set<string>>();
  atividades.forEach((atividade) => {
    const origem = normalizeOrigem(atividade.origemRecurso);
    if (!origem) return;
    const unidades = unidadesPorOrigem.get(origem) ?? new Set<string>();
    unidades.add(atividade.suapUnitCode ?? '');
    unidadesPorOrigem.set(origem, unidades);
  });

  return new Set(
    Array.from(unidadesPorOrigem.entries())
      .filter(([, unidades]) => unidades.size === 1 && unidades.has(SUAP_UNIT_DIGPE))
      .map(([origem]) => origem),
  );
}

/** Natureza de despesa do GND 1 (pessoal e encargos sociais), ex.: 319011. */
const isNaturezaPessoal = (natureza?: string | null) => /^\s*31/.test(String(natureza ?? ''));

export function isEmpenhoDePessoal(
  empenho: Pick<Empenho, 'origemRecurso' | 'naturezaDespesa'>,
  origensDePessoal: Set<string>,
) {
  return origensDePessoal.has(normalizeOrigem(empenho.origemRecurso)) || isNaturezaPessoal(empenho.naturezaDespesa);
}

export function isAtividadeDePessoal(atividade: Pick<Atividade, 'origemRecurso'>, origensDePessoal: Set<string>) {
  return origensDePessoal.has(normalizeOrigem(atividade.origemRecurso));
}

export type PessoalResumo = EmpenhosForaDoPlanoResumo & { planejado: number };

export function summarizePessoal(
  atividades: Pick<Atividade, 'valorTotal'>[],
  empenhos: Pick<Empenho, 'origemRecurso' | 'valor' | 'valorPagoOficial' | 'descricao'>[],
): PessoalResumo {
  return {
    ...summarizeEmpenhosForaDoPlano(empenhos),
    planejado: atividades.reduce((sum, atividade) => sum + (Number(atividade.valorTotal) || 0), 0),
  };
}
