import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('piloto SUAP por PDFs individuais', () => {
  it('persiste inventário e histórico isolados por tenant com RLS', () => {
    const migration = readSource('supabase/migrations/20260806110000_add_suap_individual_document_extraction.sql');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.suap_processo_documentos');
    expect(migration).toContain('UNIQUE (tenant_id, processo_id, suap_documento_id)');
    expect(migration).toContain('ALTER TABLE public.suap_processo_documentos ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('auth.uid() = tenant_id');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.process_extraction_runs');
    expect(migration).toContain('ALTER TABLE public.process_extraction_runs ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('input_strategy');
    expect(migration).toContain('input_document_ids');
  });

  it('mantém o PDF completo canônico e evita regredir a extração em andamento', () => {
    const service = readSource('src/services/suapScraperService.ts');
    const page = readSource('src/pages/Suap.tsx');

    expect(service).toContain(".in('status', ['pending_extraction', 'pdf_uploaded'])");
    expect(service).toContain(".update({ pdf_url: storagePath, updated_at: now })");
    expect(service).toContain('INDIVIDUAL_DOCUMENT_DOWNLOAD_CONCURRENCY = 4');
    expect(service).toContain('runIndividualDocumentPilotForProcess');
    expect(service).toContain("inputStrategy: 'eligible_documents'");
    expect(page).toContain('Extrair com PDFs individuais');
    expect(page).toContain('handleIndividualDocumentPilot');
    expect(service).toContain('hasUnavailableDocuments');
    expect(service).toContain('PDF prioritario disponivel');
    expect(service).toContain('individualDocumentDownloadPriority');
    expect(service).toContain('queueLateFullPdfSupplementIfNeeded');
    expect(service).toContain('expectedRunId');
  });

  it('valida as peças no backend e as une antes de aplicar os fallbacks existentes', () => {
    const endpoint = readSource('supabase/functions/process-pdf/index.ts');
    const worker = readSource('supabase/functions/process-pdf-worker/index.ts');

    expect(endpoint).toContain('Eligible process documents are incomplete or unavailable');
    expect(endpoint).toContain('.eq("tenant_id", user.id)');
    expect(endpoint).toContain('Another extraction strategy is already processing this process');
    expect(worker).toContain('loadEligibleDocumentPdfInput');
    expect(worker).toContain('PDFDocument.create()');
    expect(worker).toContain('copyPages');
    expect(worker).toContain('runHeavyPdfPath');
    expect(worker).toContain('runLightPdfPath');
    expect(worker).toContain('updateExtractionRun');
    expect(worker).toContain('queueFullPdfSupplement');
    expect(worker).toContain("inputStrategy: 'full'");
  });
});