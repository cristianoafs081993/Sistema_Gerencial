import { supabase } from '@/lib/supabase';
import type { AtaConversationalReply, AtaSearchFilters, AtaSearchResponse, ModuloBuscaAtas } from '@/types';

export interface GeminiAtasHistoryMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface GenerateGeminiAtasReplyInput {
  module: ModuloBuscaAtas;
  query: string;
  response: AtaSearchResponse;
  history: GeminiAtasHistoryMessage[];
}

const formatFilters = (filters: AtaSearchFilters) => {
  const parts: string[] = [];
  if (filters.statusVigencia !== 'todas') parts.push(`vigencia ${filters.statusVigencia}`);
  if (filters.tipoItem !== 'todos') parts.push(`tipo ${filters.tipoItem}`);
  if (filters.requireCatalog) parts.push('com catalogo');
  if (filters.catalogCode) parts.push(`catalogo ${filters.catalogCode}`);
  return parts.length > 0 ? parts.join(', ') : 'sem filtros adicionais';
};

const buildStructuredContext = (input: GenerateGeminiAtasReplyInput) => ({
  module: input.module,
  query: input.query,
  previousQuery: input.response.previousQuery,
  understanding: input.response.intent.understanding,
  filters: formatFilters(input.response.filters),
  nextStep: input.response.nextStep,
  results: input.response.results.map((result) => ({
    position: result.position,
    ataNumero: result.ata.numero_ata,
    ataObjeto: result.ata.objeto,
    orgao: result.ata.orgao_gerenciador,
    vigenciaInicio: result.ata.vigencia_inicio,
    vigenciaFim: result.ata.vigencia_fim,
    statusVigencia: result.ata.status_vigencia,
    justification: result.justification,
    adesaoAnalysis: result.adesaoAnalysis,
    primaryItem: result.primaryItem
      ? {
          descricao: result.primaryItem.descricao,
          tipo: result.primaryItem.tipo_item,
          catalogo: result.primaryItem.codigo_catmat_catser,
          maximoAdesao: result.primaryItem.maximo_adesao,
          valorUnitario: result.primaryItem.valor_unitario,
        }
      : null,
    matchedItems: result.matchedItems.slice(0, 3).map((item) => ({
      descricao: item.descricao,
      tipo: item.tipo_item,
      catalogo: item.codigo_catmat_catser,
      maximoAdesao: item.maximo_adesao,
      valorUnitario: item.valor_unitario,
    })),
  })),
});

const buildFallbackReply = (input: GenerateGeminiAtasReplyInput): AtaConversationalReply => {
  const topResult = input.response.results[0];

  const opening =
    input.module === 'adesao'
      ? 'Encontrei atas para triagem inicial de adesao.'
      : 'Encontrei referencias de atas para apoiar a pesquisa de precos.';

  const summary = topResult
    ? `O primeiro resultado foi a Ata ${topResult.ata.numero_ata}, com objeto "${topResult.ata.objeto}".`
    : 'Nao apareceu referencia aderente com os filtros atuais.';

  const caution =
    input.module === 'adesao'
      ? 'Use isso como apoio de triagem, sem tratar o ranking como decisao conclusiva.'
      : 'Use isso como apoio informacional, sem substituir o procedimento formal de pesquisa.';

  return {
    text: `${opening} ${summary} ${input.response.nextStep} ${caution}`.trim(),
    provider: 'fallback',
    model: null,
  };
};

export const geminiAtasChatService = {
  buildFallbackReply,

  async generateReply(input: GenerateGeminiAtasReplyInput): Promise<AtaConversationalReply> {
    const body = {
      module: input.module,
      query: input.query,
      history: input.history.slice(-6),
      context: buildStructuredContext(input),
    };

    try {
      const { data, error } = await supabase.functions.invoke('gemini-atas-chat', {
        body,
      });

      if (error) {
        throw error;
      }

      if (!data?.message || typeof data.message !== 'string') {
        return buildFallbackReply(input);
      }

      return {
        text: data.message,
        provider: 'gemini',
        model: typeof data.model === 'string' ? data.model : null,
      };
    } catch (error) {
      console.error('Falha ao gerar resposta conversacional com Gemini:', error);
      return buildFallbackReply(input);
    }
  },
};
