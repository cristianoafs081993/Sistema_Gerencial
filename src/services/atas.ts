import { atasModuleConfig } from '@/lib/atas-config';
import { atasRepository } from '@/repositories/atas';
import type {
  AtaAdesaoAnalysis,
  AtaDetalhe,
  AtaSearchFilters,
  AtaRegistroPreco,
  AtaSearchIntent,
  AtaSearchOptions,
  AtaSearchResponse,
  AtaSearchResult,
  AtaSearchSessionSummary,
  AtasModuleDefinition,
  AtasObservabilityMetric,
  AtasObservabilityOverview,
  AtasModuleStatus,
  ItemAta,
  ModuloBuscaAtas,
  OrgaoAtaClassificacao,
  SessaoBatchAtaResumo,
  TipoItemAta,
} from '@/types';

const stopwords = new Set([
  'a',
  'ao',
  'aos',
  'as',
  'com',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'em',
  'na',
  'nas',
  'no',
  'nos',
  'o',
  'os',
  'ou',
  'para',
  'por',
  'sem',
  'um',
  'uma',
]);

const serviceHints = ['servico', 'servicos', 'instalacao', 'locacao', 'manutencao', 'garantia', 'assinatura', 'consultoria', 'suporte'];
const materialHints = ['material', 'equipamento', 'notebook', 'computador', 'mesa', 'cadeira', 'impressora', 'scanner', 'mobiliario'];

const defaultFilters: AtaSearchFilters = {
  statusVigencia: 'todas',
  tipoItem: 'todos',
  requireCatalog: false,
  catalogCode: '',
};

const moduleDefinitions: Record<ModuloBuscaAtas, AtasModuleDefinition> = {
  adesao: {
    module: 'adesao',
    title: 'Buscar atas para adesao',
    summary: 'Triagem de atas com foco na ata como unidade principal e suporte dos itens mais aderentes.',
    focusLabel: 'Foco do ranking: ata + itens aderentes + vigencia',
    outputLabel: 'Saida esperada: 5 atas priorizadas com justificativa curta',
    nextMilestone: 'Proximo passo: refinar ranking e detalhamento da ata conforme feedback de uso',
    queryPlaceholder: 'Ex.: notebooks para laboratorios de informatica com garantia estendida',
    emptyPrompt: 'Descreva a necessidade em linguagem natural para localizar atas que merecem analise posterior.',
  },
  pesquisa_precos: {
    module: 'pesquisa_precos',
    title: 'Buscar atas para pesquisa de precos',
    summary: 'Triagem de itens de atas para apoiar a pesquisa de precos sem substituir o procedimento formal.',
    focusLabel: 'Foco do ranking: item da ata + agrupamento por ata + catalogo',
    outputLabel: 'Saida esperada: 5 referencias de itens agrupadas por ata',
    nextMilestone: 'Proximo passo: evoluir o refinamento de busca e a consolidacao por sessao',
    queryPlaceholder: 'Ex.: servico de garantia estendida para notebooks ou impressoras',
    emptyPrompt: 'Descreva o item ou servico que precisa pesquisar para receber referencias agrupadas por ata.',
  },
};

const buildEmptyObservabilityMetric = (): AtasObservabilityMetric => ({
  totalSearchSessions: 0,
  totalBatchSessions: 0,
  totalCompletedBatchSessions: 0,
  totalRefinements: 0,
  totalDetailOpens: 0,
  totalProcessedBatchItems: 0,
});

const normalizeText = (value: string | null | undefined) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const extractDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '') || null;

const tokenize = (value: string) =>
  normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !stopwords.has(token));

const inferTipo = (tokens: string[]): TipoItemAta | null => {
  if (tokens.some((token) => serviceHints.includes(token))) return 'servico';
  if (tokens.some((token) => materialHints.includes(token))) return 'material';
  return null;
};

const scoreText = (tokens: string[], haystack: string) => {
  if (!haystack) return 0;

  let score = 0;
  for (const token of tokens) {
    if (haystack === token) {
      score += 4;
      continue;
    }

    if (haystack.includes(token)) {
      score += token.length >= 6 ? 2.5 : 1.5;
    }
  }

  return score;
};

const vigenciaBoost = (status: AtaRegistroPreco['status_vigencia']) => {
  if (status === 'vigente') return 2;
  if (status === 'a_vencer') return 1;
  return 0;
};

const formatTipoLabel = (tipo: TipoItemAta | null) => {
  if (tipo === 'material') return 'material';
  if (tipo === 'servico') return 'servico';
  return 'item';
};

const buildIntent = (query: string): AtaSearchIntent => {
  const normalizedQuery = normalizeText(query);
  const tokens = tokenize(query);
  const inferredTipoItem = inferTipo(tokens);

  const understandingParts = [
    inferredTipoItem ? `Demanda interpretada como ${formatTipoLabel(inferredTipoItem)}.` : 'Demanda interpretada sem tipo fechado.',
    tokens.length > 0 ? `Termos principais: ${tokens.slice(0, 6).join(', ')}.` : 'Termos principais nao identificados com seguranca.',
  ];

  return {
    normalizedQuery,
    tokens,
    inferredTipoItem,
    understanding: understandingParts.join(' '),
  };
};

const getAtaOrgaoCnpj = (ata: AtaRegistroPreco) => {
  const rawPayload = (ata.raw_payload || {}) as Record<string, any>;
  return (
    extractDigits(rawPayload.cnpjOrgao) ||
    extractDigits(rawPayload.__pncpCompra?.orgaoEntidade?.cnpj) ||
    extractDigits(rawPayload.orgao?.cnpj) ||
    null
  );
};

const buildAdesaoAnalysis = (
  ata: AtaRegistroPreco,
  candidateItems: ItemAta[],
  orgaoClassificacao?: OrgaoAtaClassificacao | null
): AtaAdesaoAnalysis => {
  const orgaoCnpj = getAtaOrgaoCnpj(ata);
  const maximoAdesaoItems = candidateItems.filter((item) => Number(item.maximo_adesao || 0) > 0);
  const maximoAdesaoTotal =
    maximoAdesaoItems.length > 0
      ? maximoAdesaoItems.reduce((sum, item) => sum + Number(item.maximo_adesao || 0), 0)
      : null;

  const orgaoBloqueado =
    Boolean(orgaoClassificacao?.usar_somente_pesquisa_precos) ||
    orgaoClassificacao?.permite_adesao_ifrn === false;

  if (orgaoBloqueado) {
    return {
      status: 'somente_pesquisa_precos',
      blockedForAdesao: true,
      onlyPriceResearch: true,
      message:
        'Orgao classificado no cadastro local como uso restrito a pesquisa de precos. Nao considerar esta ata para adesao do IFRN.',
      orgaoCnpj,
      classificacaoOrgao: orgaoClassificacao?.classificacao || null,
      naturezaJuridica: orgaoClassificacao?.natureza_juridica || null,
      hasMaximoAdesaoSignal: maximoAdesaoItems.length > 0,
      maximoAdesaoTotal,
      itensComIndicativo: maximoAdesaoItems.length,
    };
  }

  if (maximoAdesaoItems.length > 0) {
    return {
      status: 'revisar_documentos',
      blockedForAdesao: false,
      onlyPriceResearch: false,
      message:
        'Itens com quantidade maxima de adesao informada. Use isso apenas como indicio operacional e confirme a permissao de adesao na ata e nos documentos.',
      orgaoCnpj,
      classificacaoOrgao: orgaoClassificacao?.classificacao || null,
      naturezaJuridica: orgaoClassificacao?.natureza_juridica || null,
      hasMaximoAdesaoSignal: true,
      maximoAdesaoTotal,
      itensComIndicativo: maximoAdesaoItems.length,
    };
  }

  return {
    status: 'sem_indicativo_adesao',
    blockedForAdesao: false,
    onlyPriceResearch: false,
    message:
      'Sem indicativo operacional de adesao nos itens consultados. Confirme a permissao de adesao diretamente na ata e nos documentos vinculados.',
    orgaoCnpj,
    classificacaoOrgao: orgaoClassificacao?.classificacao || null,
    naturezaJuridica: orgaoClassificacao?.natureza_juridica || null,
    hasMaximoAdesaoSignal: false,
    maximoAdesaoTotal: null,
    itensComIndicativo: 0,
  };
};

const buildAdesaoJustification = (
  ata: AtaRegistroPreco,
  bestItems: ItemAta[],
  objectScore: number,
  adesaoAnalysis: AtaAdesaoAnalysis
) => {
  const parts: string[] = [];

  if (objectScore > 0) parts.push('Objeto da ata proximo da demanda.');
  if (bestItems.length > 0) parts.push(`Itens aderentes encontrados: ${bestItems.slice(0, 2).map((item) => item.numero_item || item.descricao.slice(0, 18)).join(', ')}.`);
  if (ata.status_vigencia === 'vigente') parts.push('Vigencia atual relevante para triagem.');
  else if (ata.status_vigencia === 'a_vencer') parts.push('Vigencia proxima do vencimento, mas ainda util para analise.');
  if (adesaoAnalysis.hasMaximoAdesaoSignal) parts.push('Ha indicio operacional de adesao em itens consultados.');

  return parts.slice(0, 2).join(' ') || 'Registro apareceu por proximidade textual com a demanda.';
};

const buildPesquisaJustification = (
  ata: AtaRegistroPreco,
  primaryItem: ItemAta | null,
  inferredTipoItem: TipoItemAta | null,
  adesaoAnalysis: AtaAdesaoAnalysis
) => {
  const parts: string[] = [];

  if (primaryItem) parts.push('Item da ata com descricao proxima da demanda.');
  if (primaryItem?.codigo_catmat_catser) parts.push(`Codigo de catalogo disponivel: ${primaryItem.codigo_catmat_catser}.`);
  if (inferredTipoItem && primaryItem?.tipo_item === inferredTipoItem) parts.push(`Classificacao de ${formatTipoLabel(inferredTipoItem)} alinhada ao pedido.`);
  if (ata.status_vigencia === 'vigente') parts.push('Ata vigente para apoio inicial a pesquisa.');
  if (adesaoAnalysis.onlyPriceResearch) parts.push('Orgao marcado para uso apenas em pesquisa de precos.');

  return parts.slice(0, 2).join(' ') || 'Referencia retornada por proximidade textual do item.';
};

const buildRefinementSuggestions = (
  module: ModuloBuscaAtas,
  query: string,
  intent: AtaSearchIntent,
  results: AtaSearchResult[]
) => {
  const suggestions = new Set<string>();

  if (!intent.inferredTipoItem) {
    suggestions.add(`${query} material`);
    suggestions.add(`${query} servico`);
  }

  const topResult = results[0];
  const primaryItem = topResult?.primaryItem;

  if (topResult?.ata?.orgao_gerenciador) {
    suggestions.add(`${query} ${topResult.ata.orgao_gerenciador}`);
  }

  if (primaryItem?.codigo_catmat_catser) {
    suggestions.add(`${query} ${primaryItem.codigo_catmat_catser}`);
  }

  if (module === 'adesao') {
    suggestions.add(`${query} vigente`);
  } else {
    suggestions.add(`${query} referencia de preco`);
  }

  return Array.from(suggestions)
    .filter((suggestion) => normalizeText(suggestion) !== intent.normalizedQuery)
    .slice(0, 4);
};

const normalizeFilters = (filters?: AtaSearchFilters): AtaSearchFilters => ({
  statusVigencia: filters?.statusVigencia || defaultFilters.statusVigencia,
  tipoItem: filters?.tipoItem || defaultFilters.tipoItem,
  requireCatalog: filters?.requireCatalog || defaultFilters.requireCatalog,
  catalogCode: filters?.catalogCode?.trim() || '',
});

const buildReplayResponse = async (sessionId: string): Promise<AtaSearchResponse | null> => {
  const session = await atasRepository.getSearchSessionById(sessionId);
  if (!session) return null;

  const context = (session.contexto || {}) as Record<string, unknown>;
  const fallbackIntent = buildIntent(session.consulta_original);
  const storedIntent = (context.intent as AtaSearchIntent | undefined) || fallbackIntent;
  const filters = normalizeFilters(context.filters as AtaSearchFilters | undefined);
  const storedResults = [...(session.resultados_busca_atas || [])].sort((a, b) => a.posicao - b.posicao);

  const results: AtaSearchResult[] = storedResults
    .filter((result) => result.ata)
    .map((result) => ({
      position: result.posicao,
      score: Number(result.metadata?.score || 0),
      ata: result.ata!,
      primaryItem: result.item || null,
      matchedItems: result.item ? [result.item] : [],
      justification: result.justificativa_curta || 'Registro recuperado de sessao anterior.',
      matchSource: result.metadata?.matchSource === 'ata' ? 'ata' : 'item',
      adesaoAnalysis:
        (result.metadata?.adesaoAnalysis as AtaAdesaoAnalysis | undefined) ||
        buildAdesaoAnalysis(result.ata!, result.item ? [result.item] : [], null),
    }));

  return {
    module: session.modulo,
    query: session.consulta_original,
    intent: storedIntent,
    results,
    nextStep:
      (context.nextStep as string | undefined) ||
      (results.length > 0
        ? 'Abra o detalhe da ata para aprofundar a analise humana ou refine a descricao da necessidade.'
        : 'Tente incluir sinonimos, caracteristicas do item ou o tipo de material/servico para ampliar a recuperacao.'),
    sessionId: session.id,
    refinementSuggestions: Array.isArray(context.refinementSuggestions)
      ? (context.refinementSuggestions as string[])
      : [],
    previousQuery: (context.previousQuery as string | null | undefined) || null,
    filters,
  };
};

const matchesAtaFilters = (ata: AtaRegistroPreco, filters: AtaSearchFilters) => {
  if (filters.statusVigencia !== 'todas' && ata.status_vigencia !== filters.statusVigencia) {
    return false;
  }

  return true;
};

const matchesItemFilters = (item: ItemAta, filters: AtaSearchFilters) => {
  if (filters.tipoItem !== 'todos' && item.tipo_item !== filters.tipoItem) {
    return false;
  }

  if (filters.requireCatalog && !item.codigo_catmat_catser) {
    return false;
  }

  if (filters.catalogCode && !String(item.codigo_catmat_catser || '').includes(filters.catalogCode)) {
    return false;
  }

  return true;
};

const searchAdesao = (
  atas: AtaRegistroPreco[],
  itemsByAta: Map<string, ItemAta[]>,
  intent: AtaSearchIntent,
  filters: AtaSearchFilters,
  orgaosClassificacaoByCnpj: Map<string, OrgaoAtaClassificacao>
): AtaSearchResult[] => {
  return atas
    .filter((ata) => matchesAtaFilters(ata, filters))
    .map((ata) => {
      const ataItems = (itemsByAta.get(ata.id) || []).filter((item) => matchesItemFilters(item, filters));
      const objectText = normalizeText(ata.objeto_normalizado || ata.objeto);
      const orgaoText = normalizeText(ata.orgao_gerenciador_normalizado || ata.orgao_gerenciador);
      const objectScore = scoreText(intent.tokens, objectText) + scoreText(intent.tokens, orgaoText) * 0.25;

      const rankedItems = ataItems
        .map((item) => ({
          item,
          score:
            scoreText(intent.tokens, normalizeText(item.descricao_normalizada || item.descricao)) +
            (intent.inferredTipoItem && item.tipo_item === intent.inferredTipoItem ? 0.75 : 0),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score);

      const bestItems = rankedItems.slice(0, 3).map((entry) => entry.item);
      const itemScore = rankedItems.slice(0, 2).reduce((sum, entry) => sum + entry.score, 0);
      const adesaoAnalysis = buildAdesaoAnalysis(
        ata,
        ataItems.length > 0 ? ataItems : bestItems,
        orgaosClassificacaoByCnpj.get(getAtaOrgaoCnpj(ata) || '') || null
      );
      const totalScore =
        objectScore * 1.6 +
        itemScore * 1.9 +
        vigenciaBoost(ata.status_vigencia) +
        (adesaoAnalysis.hasMaximoAdesaoSignal ? 0.75 : 0);

      return {
        score: totalScore,
        ata,
        primaryItem: bestItems[0] || null,
        matchedItems: bestItems,
        justification: buildAdesaoJustification(ata, bestItems, objectScore, adesaoAnalysis),
        matchSource: bestItems.length > 0 ? 'item' : 'ata',
        adesaoAnalysis,
      };
    })
    .filter(
      (entry) =>
        !entry.adesaoAnalysis.blockedForAdesao &&
        entry.score > 0 &&
        (filters.tipoItem === 'todos' || entry.matchedItems.length > 0 || entry.primaryItem !== null)
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, atasModuleConfig.defaultResultLimit)
    .map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));
};

const searchPesquisaPrecos = (
  atasById: Map<string, AtaRegistroPreco>,
  items: ItemAta[],
  intent: AtaSearchIntent,
  filters: AtaSearchFilters,
  orgaosClassificacaoByCnpj: Map<string, OrgaoAtaClassificacao>
): AtaSearchResult[] => {
  const grouped = new Map<
    string,
    {
      ata: AtaRegistroPreco;
      items: Array<{ item: ItemAta; score: number }>;
      score: number;
      adesaoAnalysis: AtaAdesaoAnalysis;
    }
  >();

  for (const item of items) {
    const ata = atasById.get(item.ata_id);
    if (!ata) continue;
    if (!matchesAtaFilters(ata, filters)) continue;
    if (!matchesItemFilters(item, filters)) continue;

    const itemScore =
      scoreText(intent.tokens, normalizeText(item.descricao_normalizada || item.descricao)) +
      (item.codigo_catmat_catser ? 0.4 : 0) +
      (intent.inferredTipoItem && item.tipo_item === intent.inferredTipoItem ? 0.9 : 0) +
      vigenciaBoost(ata.status_vigencia) * 0.35;

    if (itemScore <= 0) continue;

    const ataObjectScore = scoreText(intent.tokens, normalizeText(ata.objeto_normalizado || ata.objeto)) * 0.4;
    const totalItemScore = itemScore * 2 + ataObjectScore;

    const current = grouped.get(ata.id) || {
      ata,
      items: [],
      score: 0,
      adesaoAnalysis: buildAdesaoAnalysis(
        ata,
        [item],
        orgaosClassificacaoByCnpj.get(getAtaOrgaoCnpj(ata) || '') || null
      ),
    };

    current.items.push({ item, score: totalItemScore });
    current.items.sort((a, b) => b.score - a.score);
    current.items = current.items.slice(0, 3);
    current.score = current.items[0].score + (current.items[1]?.score || 0) * 0.25;
    current.adesaoAnalysis = buildAdesaoAnalysis(
      ata,
      current.items.map((itemEntry) => itemEntry.item),
      orgaosClassificacaoByCnpj.get(getAtaOrgaoCnpj(ata) || '') || null
    );
    grouped.set(ata.id, current);
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, atasModuleConfig.defaultResultLimit)
    .map((entry, index) => ({
      position: index + 1,
      score: entry.score,
      ata: entry.ata,
      primaryItem: entry.items[0]?.item || null,
      matchedItems: entry.items.map((itemEntry) => itemEntry.item),
      justification: buildPesquisaJustification(
        entry.ata,
        entry.items[0]?.item || null,
        intent.inferredTipoItem,
        entry.adesaoAnalysis
      ),
      matchSource: 'item',
      adesaoAnalysis: entry.adesaoAnalysis,
    }));
};

const persistSearch = async (module: ModuloBuscaAtas, query: string, response: AtaSearchResponse) => {
  try {
    const sessionId = await atasRepository.createSearchSession(module, query, {
      intent: response.intent,
      nextStep: response.nextStep,
      previousQuery: response.previousQuery,
      refinementSuggestions: response.refinementSuggestions,
      filters: response.filters,
    });

    await atasRepository.insertSearchResults(
      sessionId,
      response.results.map((result) => ({
        ata_id: result.ata.id,
        item_ata_id: result.primaryItem?.id || null,
        posicao: result.position,
        justificativa_curta: result.justification,
        metadata: {
          score: result.score,
          matchSource: result.matchSource,
          adesaoAnalysis: result.adesaoAnalysis,
        },
      }))
    );

    return sessionId;
  } catch (error) {
    console.error('Falha ao registrar sessao de busca de atas:', error);
    return null;
  }
};

const trackUsageEvent = async (input: Parameters<typeof atasRepository.logUsageEvent>[0]) => {
  try {
    await atasRepository.logUsageEvent(input);
  } catch (error) {
    console.error('Falha ao registrar evento de uso de atas:', error);
  }
};

export const atasService = {
  getModuleDefinition(module: ModuloBuscaAtas): AtasModuleDefinition {
    return moduleDefinitions[module];
  },

  getModuleStatus(module: ModuloBuscaAtas): AtasModuleStatus {
    return {
      module,
      enabled: atasModuleConfig.enabled,
      sourceName: atasModuleConfig.sourceName,
      sourceConfigured: Boolean(atasModuleConfig.sourceBaseUrl),
      searchReady: true,
      detailReady: true,
      sessionReady: true,
      featureFlag: atasModuleConfig.featureFlag,
    };
  },

  async search(module: ModuloBuscaAtas, query: string, options: AtaSearchOptions = {}): Promise<AtaSearchResponse> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      throw new Error('Informe uma demanda para iniciar a busca.');
    }

    const intent = buildIntent(trimmedQuery);
    const filters = normalizeFilters(options.filters);
    const [atas, items, orgaosClassificacao] = await Promise.all([
      atasRepository.listAtas(),
      atasRepository.listItens(),
      atasRepository.listOrgaosClassificacao(),
    ]);
    const atasById = new Map(atas.map((ata) => [ata.id, ata]));
    const orgaosClassificacaoByCnpj = new Map(orgaosClassificacao.map((orgao) => [orgao.cnpj, orgao]));
    const itemsByAta = new Map<string, ItemAta[]>();

    for (const item of items) {
      const current = itemsByAta.get(item.ata_id) || [];
      current.push(item);
      itemsByAta.set(item.ata_id, current);
    }

    const results =
      module === 'adesao'
        ? searchAdesao(atas, itemsByAta, intent, filters, orgaosClassificacaoByCnpj)
        : searchPesquisaPrecos(atasById, items, intent, filters, orgaosClassificacaoByCnpj);

    const response: AtaSearchResponse = {
      module,
      query: trimmedQuery,
      intent,
      results,
      nextStep:
        results.length > 0
          ? 'Abra o detalhe da ata para aprofundar a analise humana ou refine a descricao da necessidade.'
          : 'Tente incluir sinonimos, caracteristicas do item ou o tipo de material/servico para ampliar a recuperacao.',
      sessionId: null,
      refinementSuggestions: buildRefinementSuggestions(module, trimmedQuery, intent, results),
      previousQuery: options.previousQuery || null,
      filters,
    };

    response.sessionId = await persistSearch(module, trimmedQuery, response);
    await trackUsageEvent({
      modulo: module,
      tipo_evento: options.previousQuery ? 'refinamento_busca' : 'busca_realizada',
      referencia_tipo: 'sessao_busca_atas',
      referencia_id: response.sessionId,
      payload: {
        query: trimmedQuery,
        previousQuery: options.previousQuery || null,
        totalResultados: results.length,
        filters,
      },
    });
    return response;
  },

  async getAtaDetalhe(id: string): Promise<AtaDetalhe | null> {
    const ata = await atasRepository.getAtaById(id);
    if (!ata) return null;

    const [itens, documentos] = await Promise.all([
      atasRepository.listItensByAtaId(id),
      atasRepository.listDocumentosByAtaId(id),
    ]);

    return {
      ata,
      itens,
      documentos,
    };
  },

  async listRecentSessions(module: ModuloBuscaAtas, limit?: number): Promise<AtaSearchSessionSummary[]> {
    return atasRepository.listSearchSessions(module, limit);
  },

  async createBatchSession(title: string, items: string[], filters: AtaSearchFilters) {
    const sessionId = await atasRepository.createBatchSession({
      module: 'pesquisa_precos',
      title,
      items,
      filters: normalizeFilters(filters),
    });

    await trackUsageEvent({
      modulo: 'pesquisa_precos',
      tipo_evento: 'sessao_batch_criada',
      referencia_tipo: 'sessao_batch_atas',
      referencia_id: sessionId,
      payload: {
        titulo: title,
        totalItens: items.length,
        filters: normalizeFilters(filters),
      },
    });

    return sessionId;
  },

  async listRecentBatchSessions(limit?: number): Promise<SessaoBatchAtaResumo[]> {
    const sessions = await atasRepository.listBatchSessions('pesquisa_precos', limit);
    return sessions.map((session) => ({
      ...session,
      filters: normalizeFilters(session.filters),
    }));
  },

  async getSearchSessionReplay(sessionId: string): Promise<AtaSearchResponse | null> {
    return buildReplayResponse(sessionId);
  },

  async getObservabilityOverview(): Promise<AtasObservabilityOverview> {
    const modules: ModuloBuscaAtas[] = ['adesao', 'pesquisa_precos'];
    const byModuleEntries = await Promise.all(
      modules.map(async (module) => {
        const [
          totalSearchSessions,
          totalBatchSessions,
          totalCompletedBatchSessions,
          totalRefinements,
          totalDetailOpens,
          totalProcessedBatchItems,
          recentSessions,
        ] = await Promise.all([
          atasRepository.countSearchSessions(module),
          atasRepository.countBatchSessions(module),
          atasRepository.countBatchSessions(module, 'concluida'),
          atasRepository.countUsageEvents({ module, eventType: 'refinamento_busca' }),
          atasRepository.countUsageEvents({ module, eventType: 'detalhe_ata_aberto' }),
          atasRepository.countUsageEvents({ module, eventType: 'item_batch_processado' }),
          atasRepository.listSearchSessions(module, 6),
        ]);

        return [
          module,
          {
            totalSearchSessions,
            totalBatchSessions,
            totalCompletedBatchSessions,
            totalRefinements,
            totalDetailOpens,
            totalProcessedBatchItems,
          } satisfies AtasObservabilityMetric,
          recentSessions,
        ] as const;
      })
    );

    const byModule = {
      adesao: buildEmptyObservabilityMetric(),
      pesquisa_precos: buildEmptyObservabilityMetric(),
    } satisfies Record<ModuloBuscaAtas, AtasObservabilityMetric>;

    const recentSessions = {
      adesao: [] as AtaSearchSessionSummary[],
      pesquisa_precos: [] as AtaSearchSessionSummary[],
    } satisfies Record<ModuloBuscaAtas, AtaSearchSessionSummary[]>;

    for (const [module, metrics, sessions] of byModuleEntries) {
      byModule[module] = metrics;
      recentSessions[module] = sessions;
    }

    const totals = modules.reduce<AtasObservabilityMetric>((accumulator, module) => {
      const metrics = byModule[module];
      return {
        totalSearchSessions: accumulator.totalSearchSessions + metrics.totalSearchSessions,
        totalBatchSessions: accumulator.totalBatchSessions + metrics.totalBatchSessions,
        totalCompletedBatchSessions: accumulator.totalCompletedBatchSessions + metrics.totalCompletedBatchSessions,
        totalRefinements: accumulator.totalRefinements + metrics.totalRefinements,
        totalDetailOpens: accumulator.totalDetailOpens + metrics.totalDetailOpens,
        totalProcessedBatchItems: accumulator.totalProcessedBatchItems + metrics.totalProcessedBatchItems,
      };
    }, buildEmptyObservabilityMetric());

    const [recentBatchSessions, recentEvents] = await Promise.all([
      this.listRecentBatchSessions(6),
      atasRepository.listUsageEvents(undefined, 16),
    ]);

    return {
      totals,
      byModule,
      recentSessions,
      recentBatchSessions,
      recentEvents,
    };
  },

  async updateBatchProgress(input: {
    batchSessionId: string;
    item: string;
    order: number;
    response: AtaSearchResponse;
    totalConcluded: number;
    currentOrder: number | null;
    totalItems: number;
  }) {
    await atasRepository.updateBatchItem({
      batchSessionId: input.batchSessionId,
      order: input.order,
      status: 'concluido',
      searchSessionId: input.response.sessionId,
      summary: {
        item: input.item,
        totalResultados: input.response.results.length,
        topResultAtaId: input.response.results[0]?.ata.id || null,
        topResultAtaNumero: input.response.results[0]?.ata.numero_ata || null,
      },
    });

    if (input.currentOrder !== null) {
      await atasRepository.updateBatchItem({
        batchSessionId: input.batchSessionId,
        order: input.currentOrder,
        status: 'em_foco',
      });
    }

    await atasRepository.updateBatchSessionProgress({
      batchSessionId: input.batchSessionId,
      totalConcluidos: input.totalConcluded,
      currentOrder: input.currentOrder,
      status: input.totalConcluded >= input.totalItems ? 'concluida' : 'em_andamento',
    });

    await trackUsageEvent({
      modulo: 'pesquisa_precos',
      tipo_evento: 'item_batch_processado',
      referencia_tipo: 'sessao_batch_atas',
      referencia_id: input.batchSessionId,
      payload: {
        item: input.item,
        ordem: input.order,
        totalConcluidos: input.totalConcluded,
        totalItems: input.totalItems,
        totalResultados: input.response.results.length,
      },
    });
  },

  async markBatchItemInFocus(batchSessionId: string, order: number) {
    await atasRepository.updateBatchItem({
      batchSessionId,
      order,
      status: 'em_foco',
    });
  },

  async trackDetailOpened(module: ModuloBuscaAtas, ataId: string) {
    await trackUsageEvent({
      modulo: module,
      tipo_evento: 'detalhe_ata_aberto',
      referencia_tipo: 'ata',
      referencia_id: ataId,
      payload: {},
    });
  },
};
