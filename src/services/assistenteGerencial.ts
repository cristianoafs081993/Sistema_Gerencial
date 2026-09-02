import { supabase } from '@/lib/supabase';
import type {
  AssistenteGerencialMessage,
  AssistenteGerencialPriceResearchData,
  AssistenteGerencialSource,
} from '@/lib/assistenteGerencialSessions';

export type AssistenteGerencialHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AssistenteGerencialRequest = {
  message?: string;
  pergunta?: string;
  history?: AssistenteGerencialMessage[] | AssistenteGerencialHistoryMessage[];
  historico?: AssistenteGerencialMessage[] | AssistenteGerencialHistoryMessage[];
};

export type AssistenteGerencialResponse = {
  response: string;
  resposta: string;
  suggestions: string[];
  sugestoes: string[];
  model?: string | null;
  modelo?: string | null;
  warnings: string[];
  avisos: string[];
  sources: AssistenteGerencialSource[];
  fontes: AssistenteGerencialSource[];
  priceResearchResult?: AssistenteGerencialPriceResearchData;
};

const MAX_HISTORY_MESSAGES = 8;
const MAX_MESSAGE_LENGTH = 2500;
const MAX_HISTORY_MESSAGE_LENGTH = 1500;
const MAX_NETWORK_ATTEMPTS = 2;
const NETWORK_RETRY_DELAY_MS = 650;

function cleanContent(value: string, maxLength: number) {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function parseAssistenteGerencialSuggestions(text: string) {
  const splitRegex = /(?:\*\*?)?\|\|\s*SUGEST[OÕ]ES\s*\|\|(?:\*\*?)?/i;
  const parts = text.split(splitRegex);
  const response = parts[0]?.trim() || text.trim();
  const suggestions = parts.length > 1
    ? parts[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line))
      .map((line) => line.replace(/^[-*\d.]+\s*/, '').replace(/\[|\]|"/g, '').trim())
      .filter(Boolean)
      .slice(0, 3)
    : [];

  return { response, suggestions };
}

export function buildAssistenteGerencialPayload(params: AssistenteGerencialRequest) {
  const rawMessage = params.message ?? params.pergunta ?? '';
  const message = cleanContent(rawMessage, MAX_MESSAGE_LENGTH);
  const rawHistory = params.history || params.historico || [];
  const history = rawHistory
    .filter((item) => item.role === 'user' || item.role === 'assistant')
    .filter((item) => Boolean(item.content && item.content.trim()))
    .slice(-MAX_HISTORY_MESSAGES)
    .map<AssistenteGerencialHistoryMessage>((item) => ({
      role: item.role,
      content: cleanContent(item.content, MAX_HISTORY_MESSAGE_LENGTH),
    }));

  return { message, history };
}

const wait = (ms: number) => new Promise((resolve) => globalThis.setTimeout(resolve, ms));

function isTransientNetworkFailure(error: unknown) {
  const message = error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: unknown }).message || '')
    : String(error || '');
  return /failed to fetch|network|err_network_changed|networkerror/i.test(message);
}

export const assistenteGerencialService = {
  async ask(params: AssistenteGerencialRequest): Promise<AssistenteGerencialResponse> {
    const body = buildAssistenteGerencialPayload(params);

    if (!body.message) {
      throw new Error('Digite uma pergunta para o Assistente Gerencial.');
    }

    let data: unknown;
    let error: { message?: string } | null = null;

    for (let attempt = 1; attempt <= MAX_NETWORK_ATTEMPTS; attempt += 1) {
      const result = await supabase.functions.invoke('assistente-gerencial', { body });
      data = result.data;
      error = result.error;

      if (!error || !isTransientNetworkFailure(error) || attempt === MAX_NETWORK_ATTEMPTS) {
        break;
      }

      await wait(NETWORK_RETRY_DELAY_MS);
    }

    if (error) {
      throw new Error(error.message || 'Nao foi possivel consultar o Assistente Gerencial.');
    }

    const responseData = data as Record<string, unknown> | null | undefined;

    if (responseData?.error) {
      throw new Error(String(responseData.error));
    }

    const rawResponse = typeof responseData?.response === 'string'
      ? responseData.response
      : typeof responseData?.resposta === 'string'
      ? responseData.resposta
      : '';
    if (!rawResponse.trim()) {
      throw new Error('O Assistente Gerencial nao retornou conteudo.');
    }

    const parsed = parseAssistenteGerencialSuggestions(rawResponse);
    const rawSuggestions = Array.isArray(responseData?.suggestions)
      ? responseData.suggestions
      : Array.isArray(responseData?.sugestoes)
      ? responseData.sugestoes
      : [];
    const serverSuggestions = rawSuggestions
      .filter((item: unknown): item is string => typeof item === 'string')
      .slice(0, 3);
    const finalSuggestions = serverSuggestions.length ? serverSuggestions : parsed.suggestions;

    const rawWarnings = Array.isArray(responseData?.warnings)
      ? responseData.warnings
      : Array.isArray(responseData?.avisos)
      ? responseData.avisos
      : [];
    const warnings = rawWarnings
      .filter((item: unknown): item is string => typeof item === 'string');

    const rawSources = Array.isArray(responseData?.sources)
      ? responseData.sources
      : Array.isArray(responseData?.fontes)
      ? responseData.fontes
      : [];
    const sources = rawSources
      .filter((item: unknown): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => ({
        label: String(item.label || ''),
        totalAmostra: typeof item.totalAmostra === 'number' ? item.totalAmostra : undefined,
        totalDisponivel: typeof item.totalDisponivel === 'number' ? item.totalDisponivel : null,
        warning: typeof item.warning === 'string' ? item.warning : undefined,
      }))
      .filter((item) => item.label);

    const model = typeof responseData?.model === 'string'
      ? responseData.model
      : typeof responseData?.modelo === 'string'
      ? responseData.modelo
      : null;

    const priceResearchResult = responseData?.priceResearchResult as
      | AssistenteGerencialPriceResearchData
      | undefined;

    return {
      response: parsed.response,
      resposta: parsed.response,
      suggestions: finalSuggestions,
      sugestoes: finalSuggestions,
      model,
      modelo: model,
      warnings,
      avisos: warnings,
      sources,
      fontes: sources,
      priceResearchResult,
    };
  },

  async perguntar(params: AssistenteGerencialRequest): Promise<AssistenteGerencialResponse> {
    return this.ask(params);
  },
};
