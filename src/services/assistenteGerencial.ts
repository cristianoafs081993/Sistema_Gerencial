import { supabase } from '@/lib/supabase';
import type { AssistenteGerencialMessage } from '@/lib/assistenteGerencialSessions';

export type AssistenteGerencialHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AssistenteGerencialRequest = {
  message: string;
  history?: AssistenteGerencialMessage[];
};

export type AssistenteGerencialResponse = {
  response: string;
  suggestions: string[];
  model?: string | null;
  warnings: string[];
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
  const message = cleanContent(params.message, MAX_MESSAGE_LENGTH);
  const history = (params.history || [])
    .filter((item) => item.role === 'user' || item.role === 'assistant')
    .filter((item) => item.content.trim())
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

    const rawResponse = typeof responseData?.response === 'string' ? responseData.response : '';
    if (!rawResponse.trim()) {
      throw new Error('O Assistente Gerencial nao retornou conteudo.');
    }

    const parsed = parseAssistenteGerencialSuggestions(rawResponse);
    const serverSuggestions = Array.isArray(responseData?.suggestions)
      ? responseData.suggestions.filter((item: unknown): item is string => typeof item === 'string').slice(0, 3)
      : [];
    const warnings = Array.isArray(responseData?.warnings)
      ? responseData.warnings.filter((item: unknown): item is string => typeof item === 'string')
      : [];

    return {
      response: parsed.response,
      suggestions: serverSuggestions.length ? serverSuggestions : parsed.suggestions,
      model: typeof responseData?.model === 'string' ? responseData.model : null,
      warnings,
    };
  },
};
