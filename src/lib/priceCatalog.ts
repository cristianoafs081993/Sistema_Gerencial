export type PriceCatalogType = 'material' | 'service';

export type PriceCatalogSuggestion = {
  code: string;
  catalogType: PriceCatalogType;
  description: string;
  context: string;
  score: number;
  rawScore?: number;
  reason: string;
};

type CompactCatalogEntry = [
  code: string,
  description: string,
  context: string,
  normalizedSearchText: string,
];

type CompactCatalog = {
  version: number;
  type: PriceCatalogType;
  generatedAt: string;
  source: string;
  entries: CompactCatalogEntry[];
};

const STOP_WORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas',
  'no', 'nos', 'o', 'os', 'ou', 'para', 'por', 'sem', 'sob', 'um', 'uma',
  'aquisicao', 'contratacao', 'fornecimento', 'item', 'servico', 'servicos', 'unidade',
]);

const SHORT_DOMAIN_TOKENS = new Set(['ar', 'g', 'kg', 'l', 'ml', 'rh', 'ti', 'tv']);

const catalogCache = new Map<PriceCatalogType, Promise<CompactCatalog>>();

export function normalizeCatalogText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalToken(token: string) {
  if (token.length > 4 && token.endsWith('s') && !token.endsWith('ss')) {
    return token.slice(0, -1);
  }
  return token;
}

function tokenize(value: unknown) {
  return normalizeCatalogText(value)
    .split(' ')
    .map(canonicalToken)
    .filter((token) => (
      token.length >= 3
      || /^\d+$/.test(token)
      || SHORT_DOMAIN_TOKENS.has(token)
    ) && !STOP_WORDS.has(token));
}

export async function parseCatalogResponse(response: Response) {
  if (!response.ok) throw new Error(`Catálogo indisponível: HTTP ${response.status}.`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  const isGzipPayload = bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!isGzipPayload) {
    return JSON.parse(new TextDecoder().decode(bytes)) as CompactCatalog;
  }

  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador não suporta a descompactação do catálogo.');
  }

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  }).pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json() as Promise<CompactCatalog>;
}

async function loadCatalog(catalogType: PriceCatalogType) {
  const cached = catalogCache.get(catalogType);
  if (cached) return cached;

  const fileName = catalogType === 'material' ? 'catmat.json.gz' : 'catser.json.gz';
  const baseUrl = import.meta.env.BASE_URL || '/';
  const promise = fetch(`${baseUrl}catalogs/${fileName}`)
    .then(parseCatalogResponse)
    .catch((error) => {
      catalogCache.delete(catalogType);
      throw error;
    });
  catalogCache.set(catalogType, promise);
  return promise;
}

function insertTopSuggestion(
  suggestions: PriceCatalogSuggestion[],
  suggestion: PriceCatalogSuggestion,
  limit: number,
) {
  const index = suggestions.findIndex(
    (current) => (suggestion.rawScore ?? suggestion.score) > (current.rawScore ?? current.score)
  );
  if (index < 0) suggestions.push(suggestion);
  else suggestions.splice(index, 0, suggestion);
  if (suggestions.length > limit) suggestions.pop();
}

export function rankCatalogEntries(
  description: string,
  catalogType: PriceCatalogType,
  entries: CompactCatalogEntry[],
  limit = 50,
) {
  const normalizedQuery = normalizeCatalogText(description);
  const queryTokens = [...new Set(tokenize(description))];
  if (queryTokens.length === 0) return [];

  const queryNumbers = queryTokens.filter((token) => /^\d+$/.test(token));
  const significantTokens = queryTokens
    .filter((token) => !/^\d+$/.test(token))
    .sort((left, right) => right.length - left.length)
    .slice(0, 5);
  const queryBigrams = queryTokens.slice(0, -1).map((token, index) => `${token} ${queryTokens[index + 1]}`);
  const suggestions: PriceCatalogSuggestion[] = [];

  for (const [code, candidateDescription, context, normalizedSearchText] of entries) {
    if (
      significantTokens.length > 0
      && !significantTokens.some((token) => normalizedSearchText.includes(token))
    ) {
      continue;
    }

    const candidateTokenList = normalizedSearchText.split(' ');
    const candidateTokens = new Set(candidateTokenList);
    let matchedWeight = 0;
    let totalWeight = 0;
    let matchedTerms = 0;
    for (const token of queryTokens) {
      const weight = /^\d+$/.test(token) ? 3 : Math.min(2.2, 1 + (token.length / 10));
      totalWeight += weight;
      if (candidateTokens.has(token)) {
        matchedWeight += weight;
        matchedTerms += 1;
      }
    }

    const coverage = totalWeight > 0 ? matchedWeight / totalWeight : 0;
    if (coverage < 0.2) continue;

    const matchedBigrams = queryBigrams.filter((bigram) => normalizedSearchText.includes(bigram)).length;
    const missingNumbers = queryNumbers.filter((number) => !candidateTokens.has(number));
    const numberAdjustment = queryNumbers.length === 0
      ? 0
      : ((queryNumbers.length - missingNumbers.length) * 3) - (missingNumbers.length * 6);
    const phraseBonus = normalizedSearchText.includes(normalizedQuery) ? 18 : 0;
    const candidateObjectTokens = tokenize(candidateDescription.split(/[,;:-]/, 1)[0]);
    const matchedObjectTokens = candidateObjectTokens.filter((token) => queryTokens.includes(token)).length;
    const objectScore = candidateObjectTokens.length > 0
      ? (matchedObjectTokens / candidateObjectTokens.length) * 28
      : 0;
    const objectPenalty = matchedObjectTokens === 0 ? -12 : 0;
    const firstCandidateToken = candidateObjectTokens[0];
    const descriptionPrefixBonus = firstCandidateToken && queryTokens.includes(firstCandidateToken) ? 15 : 0;
    const rawScore = (coverage * 68)
      + Math.min(30, matchedBigrams * 12)
      + numberAdjustment
      + phraseBonus
      + descriptionPrefixBonus
      + objectScore
      + objectPenalty;
    const scoreCeiling = missingNumbers.length > 0 ? 92 : 100;
    const score = Math.max(0, Math.min(scoreCeiling, Math.round(rawScore)));
    if (score < 25) continue;

    const numericReason = queryNumbers.length === 0
      ? ''
      : missingNumbers.length === 0
        ? ' Especificações numéricas coincidem.'
        : ` Rever números: ${missingNumbers.join(', ')} não coincidem.`;

    insertTopSuggestion(suggestions, {
      code,
      catalogType,
      description: candidateDescription,
      context,
      score,
      rawScore,
      reason: `${matchedTerms} de ${queryTokens.length} termos relevantes coincidem.${numericReason}`,
    }, limit);
  }

  return suggestions;
}

export async function findCatalogSuggestionsDirect(
  description: string,
  catalogType: PriceCatalogType,
  limit = 50,
) {
  const catalog = await loadCatalog(catalogType);
  return rankCatalogEntries(description, catalogType, catalog.entries, limit);
}

export function clearPriceCatalogCache() {
  catalogCache.clear();
}
