import {
  normalizeSuapDocumentReviewResult,
  type SuapDocumentReviewResult,
  type SuapDocumentReviewType,
} from '@/lib/suapDocumentReview';
import { supabase } from '@/lib/supabase';

export const SUAP_DOCUMENT_REVIEW_FUNCTION = 'analisar-documento-licitacao';
export const SUAP_DOCUMENT_REVIEW_MAX_BYTES = 20 * 1024 * 1024;
export const SUAP_DOCUMENT_REVIEW_MAX_PAGES = 200;

export type AnalyzeSuapDocumentInput = {
  documentType: SuapDocumentReviewType;
  documentTitle: string;
  processNumber?: string;
  pdfBase64: string;
  pageCount?: number;
};

export async function analyzeSuapDocument(input: AnalyzeSuapDocumentInput): Promise<SuapDocumentReviewResult> {
  const { data, error } = await supabase.functions.invoke(SUAP_DOCUMENT_REVIEW_FUNCTION, {
    body: input,
  });

  if (error) throw new Error(await getFunctionErrorMessage(error));
  if (data?.error) throw new Error(String(data.error));

  return normalizeSuapDocumentReviewResult(data, input.documentType);
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
