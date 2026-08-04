import type { Empenho } from '@/types';

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const normalizeNumero = (value: unknown) => normalizeText(value).replace(/[^a-z0-9]/g, '');

export type RequisicaoEmpenhoSelectorFilters = {
  busca?: string;
  favorecido?: string;
};

/** Keeps the available NE list deterministic while prioritizing an exact NE lookup. */
export function filterAndRankRequisicaoEmpenhos(
  empenhos: Empenho[],
  filters: RequisicaoEmpenhoSelectorFilters = {},
): Empenho[] {
  const busca = normalizeText(filters.busca);
  const buscaNumero = normalizeNumero(filters.busca);
  const favorecido = normalizeText(filters.favorecido);

  return empenhos
    .map((empenho, originalIndex) => {
      const numero = normalizeNumero(empenho.numero);
      const descricao = normalizeText(empenho.descricao);
      const nomeFavorecido = normalizeText(empenho.favorecidoNome);
      const valor = normalizeNumero(empenho.valor);

      if (favorecido && !nomeFavorecido.includes(favorecido)) return null;

      let relevance = 0;
      if (busca) {
        if (buscaNumero && numero === buscaNumero) relevance = 0;
        else if (buscaNumero && numero.startsWith(buscaNumero)) relevance = 1;
        else if (buscaNumero && numero.includes(buscaNumero)) relevance = 2;
        else if (descricao.startsWith(busca)) relevance = 3;
        else if (descricao.includes(busca)) relevance = 4;
        else if (nomeFavorecido.includes(busca)) relevance = 5;
        else if (valor.includes(buscaNumero)) relevance = 6;
        else return null;
      }

      return { empenho, originalIndex, relevance };
    })
    .filter((entry): entry is { empenho: Empenho; originalIndex: number; relevance: number } => entry !== null)
    .sort((a, b) => a.relevance - b.relevance || a.originalIndex - b.originalIndex)
    .map((entry) => entry.empenho);
}
