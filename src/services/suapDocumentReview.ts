import {
  normalizeSuapDocumentReviewResult,
  type SuapDocumentReviewResult,
  type SuapDocumentReviewType,
} from '@/lib/suapDocumentReview';
import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export const SUAP_DOCUMENT_REVIEW_FUNCTION = 'analisar-documento-licitacao';
export const SUAP_DOCUMENT_REVIEW_TABLE = 'suap_document_reviews';
export const SUAP_DOCUMENT_REVIEW_MAX_BYTES = 20 * 1024 * 1024;
export const SUAP_DOCUMENT_REVIEW_MAX_PAGES = 200;

export type AnalyzeSuapDocumentInput = {
  suapId: string;
  documentId: string;
  documentType: SuapDocumentReviewType;
  documentTitle: string;
  processNumber?: string;
  pdfBase64: string;
  pageCount?: number;
};

type SavedSuapDocumentReviewInput = {
  suapId: string;
  documentId: string;
  documentType: SuapDocumentReviewType;
  documentTitle: string;
  processNumber?: string;
  result: SuapDocumentReviewResult;
};

type LatestSuapDocumentReviewInput = {
  suapId: string;
  documentId: string;
  documentType: SuapDocumentReviewType;
};

export async function analyzeSuapDocument(input: AnalyzeSuapDocumentInput, client: SupabaseClient = supabase): Promise<SuapDocumentReviewResult> {
  const { suapId: _suapId, documentId: _documentId, ...functionInput } = input;
  const { data, error } = await client.functions.invoke(SUAP_DOCUMENT_REVIEW_FUNCTION, {
    body: functionInput,
  });

  if (error) throw new Error(await getFunctionErrorMessage(error));
  if (data?.error) throw new Error(String(data.error));

  const result = normalizeSuapDocumentReviewResult(data, input.documentType);
  await saveSuapDocumentReview({
    suapId: input.suapId,
    documentId: input.documentId,
    documentType: input.documentType,
    documentTitle: input.documentTitle,
    processNumber: input.processNumber,
    result,
  }, client);
  return result;
}

export async function saveSuapDocumentReview(input: SavedSuapDocumentReviewInput, client: SupabaseClient = supabase) {
  const { error } = await client.from(SUAP_DOCUMENT_REVIEW_TABLE).insert({
    suap_id: input.suapId,
    document_id: input.documentId,
    document_type: input.documentType,
    document_title: input.documentTitle,
    process_number: input.processNumber || null,
    checked_at: input.result.checkedAt,
    result: input.result,
  });

  if (error) throw new Error(`A análise foi concluída, mas não pôde ser salva para consulta futura: ${error.message}`);
}

export async function getLatestSuapDocumentReview(input: LatestSuapDocumentReviewInput, client: SupabaseClient = supabase): Promise<SuapDocumentReviewResult | null> {
  const { data, error } = await client
    .from(SUAP_DOCUMENT_REVIEW_TABLE)
    .select('result')
    .eq('suap_id', input.suapId)
    .eq('document_id', input.documentId)
    .eq('document_type', input.documentType)
    .order('checked_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Não foi possível carregar a análise salva: ${error.message}`);
  if (!data?.result) return null;
  return normalizeSuapDocumentReviewResult(data.result, input.documentType);
}

async function getFunctionErrorMessage(error: { message?: string; context?: unknown }) {
  const context = error.context;
  if (typeof Response !== 'undefined' && context instanceof Response) {
    try {
      const payload = await context.clone().json() as { error?: unknown };
      if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
    } catch {
      // Keep the SDK message when the response body is not JSON or was consumed.
    }
  }
  return error.message || 'Não foi possível analisar o documento.';
}
