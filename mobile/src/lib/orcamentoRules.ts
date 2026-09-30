/**
 * Regras das telas Descentralizações e Crédito disponível — espelham o web
 * (src/pages/Descentralizacoes.tsx, src/pages/CreditoDisponivel.tsx). Funções puras, sem rede.
 */
import { codigoPtresDaOrigem, origemCorrespondeAoPtres } from './dashboardRules';

export type DescentralizacaoLinha = {
  id: string;
  data: string | null;
  dimensao: string;
  notaCredito: string | null;
  operacao: string | null;
  origem: string;
  naturezaDespesa: string | null;
  planoInterno: string | null;
  descricao: string | null;
  valor: number;
};

export type ContaSaldo = { ptres: string; valor: number };

export type ResumoPtres = { ptres: string; valor: number };

export type ResumoDescentralizacoes = {
  total: number;
  /** true quando o total vem do saldo oficial da conta por PTRES (não da soma das linhas). */
  oficial: boolean;
  porPtres: ResumoPtres[];
  quantidade: number;
};

const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** "AD - Administração" → "AD". */
export function codigoDaDimensao(dimensao?: string | null): string {
  const codigo = (dimensao ?? '').split(' - ')[0].trim();
  return codigo || '—';
}

export function filtrarDescentralizacoes(linhas: DescentralizacaoLinha[], { ptres, busca }: { ptres?: string; busca?: string }): DescentralizacaoLinha[] {
  const termo = normalizar((busca ?? '').trim());
  return linhas.filter((linha) => {
    if (!origemCorrespondeAoPtres(linha.origem, ptres)) return false;
    if (!termo) return true;
    return normalizar([linha.dimensao, linha.origem, linha.planoInterno, linha.descricao, linha.notaCredito, linha.naturezaDespesa].join(' ')).includes(termo);
  });
}

const soma = (lista: number[]) => lista.reduce((acc, valor) => acc + (Number(valor) || 0), 0);

/**
 * Total descentralizado como no web: com busca, soma das linhas encontradas; sem busca, o saldo
 * oficial da conta por PTRES (quando existe) ou a soma das linhas.
 */
export function resumirDescentralizacoes({
  linhas,
  contaSaldos,
  ptres,
  busca,
}: {
  linhas: DescentralizacaoLinha[];
  contaSaldos: ContaSaldo[];
  ptres?: string;
  busca?: string;
}): ResumoDescentralizacoes {
  const filtradas = filtrarDescentralizacoes(linhas, { ptres, busca });
  const temBusca = Boolean((busca ?? '').trim());
  const usaConta = contaSaldos.length > 0 && !temBusca;

  const contaFiltrada = contaSaldos.filter((c) => origemCorrespondeAoPtres(c.ptres, ptres));
  const total = usaConta ? soma(contaFiltrada.map((c) => c.valor)) : soma(filtradas.map((l) => l.valor));

  const mapa = new Map<string, number>();
  if (usaConta) {
    for (const c of contaFiltrada) mapa.set(c.ptres.trim(), (mapa.get(c.ptres.trim()) ?? 0) + c.valor);
  } else {
    for (const l of filtradas) {
      const codigo = codigoPtresDaOrigem(l.origem) ?? (l.origem.trim() || 'Sem origem');
      mapa.set(codigo, (mapa.get(codigo) ?? 0) + l.valor);
    }
  }
  const porPtres = Array.from(mapa, ([codigo, valor]) => ({ ptres: codigo, valor })).sort((a, b) => b.valor - a.valor);

  return { total, oficial: usaConta, porPtres, quantidade: filtradas.length };
}

/** Anulação/devolução aparece como valor negativo. */
export const ehEstorno = (linha: Pick<DescentralizacaoLinha, 'valor'>) => linha.valor < 0;

export type CreditoLinha = {
  id: string;
  ptres: string;
  planoInterno: string;
  descricao: string;
  valor: number;
};

export type FiltroSaldo = 'com-saldo' | 'zerado' | 'todos';

export function filtrarCredito(linhas: CreditoLinha[], { ptres, saldo, busca }: { ptres?: string; saldo: FiltroSaldo; busca?: string }): CreditoLinha[] {
  const termo = normalizar((busca ?? '').trim());
  return linhas.filter((linha) => {
    if (ptres && ptres !== 'all' && linha.ptres !== ptres) return false;
    if (saldo === 'com-saldo' && linha.valor === 0) return false;
    if (saldo === 'zerado' && linha.valor !== 0) return false;
    if (!termo) return true;
    return normalizar([linha.ptres, linha.planoInterno, linha.descricao].join(' ')).includes(termo);
  });
}

export function totalCredito(linhas: CreditoLinha[]): number {
  return soma(linhas.map((l) => l.valor));
}

/** Agrupa o crédito por PTRES (maior primeiro), para o gráfico de barras. */
export function creditoPorPtres(linhas: CreditoLinha[]): ResumoPtres[] {
  const mapa = new Map<string, number>();
  for (const l of linhas) mapa.set(l.ptres, (mapa.get(l.ptres) ?? 0) + l.valor);
  return Array.from(mapa, ([ptres, valor]) => ({ ptres, valor })).sort((a, b) => b.valor - a.valor);
}
