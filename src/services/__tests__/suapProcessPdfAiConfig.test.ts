import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('SUAP process PDF AI extraction flow', () => {
  it('enqueues the async worker without treating a pending job as completed', () => {
    const serviceSource = readFileSync(
      path.resolve(process.cwd(), 'src/services/suapScraperService.ts'),
      'utf8',
    );

    expect(serviceSource).toContain('aiRes?.queued');
    expect(serviceSource).toContain('Extracao IA enfileirada. Acompanhe o status na tabela.');
    expect(serviceSource).toContain("status: typeof aiRes?.status === 'string' ? aiRes.status : 'queued_extraction'");
    expect(serviceSource).not.toContain('waitForAiExtractionResult');
    expect(serviceSource).toContain('body: { suap_id: proc.suapId }');
    expect(serviceSource).not.toContain('extraction_context');
    expect(serviceSource).not.toContain('deterministicData');
    expect(serviceSource).not.toContain('collectDeterministicProcessData');
    expect(serviceSource).not.toContain('persistDeterministicPrefill');
  });

  it('keeps inventory sync lightweight and preserves existing processes by default', () => {
    const serviceSource = readFileSync(
      path.resolve(process.cwd(), 'src/services/suapScraperService.ts'),
      'utf8',
    );
    const panelSource = readFileSync(
      path.resolve(process.cwd(), 'src/components/suap/SuapSyncPanel.tsx'),
      'utf8',
    );

    expect(serviceSource).toContain('forceUpdateProcessIds');
    expect(serviceSource).toContain('already_exists: true');
    expect(serviceSource).toContain('created: false');
    expect(serviceSource).toContain('created: true');
    expect(serviceSource).toContain("status: 'pending_extraction'");
    expect(panelSource).toContain('processesToProcess = syncedProcesses.filter((proc) => proc.created)');
    expect(panelSource).toContain('Executar Fluxo Completo');
    expect(panelSource).toContain('Sincronizar Inventario');
    expect(panelSource).not.toContain('enrichProcessNumber');
  });

  it('reconcilia vínculos apenas para caixas lidas com sucesso e preserva processos ocultos', () => {
    const scraperSource = readFileSync(
      path.resolve(process.cwd(), 'src/services/suapScraperService.ts'),
      'utf8',
    );
    const panelSource = readFileSync(
      path.resolve(process.cwd(), 'src/components/suap/SuapSyncPanel.tsx'),
      'utf8',
    );
    const processosSource = readFileSync(
      path.resolve(process.cwd(), 'src/services/suapProcessos.ts'),
      'utf8',
    );
    const migrationSource = readFileSync(
      path.resolve(process.cwd(), 'supabase/migrations/20260727110000_reconcile_suap_process_box_memberships.sql'),
      'utf8',
    );

    expect(migrationSource).toContain('CREATE TABLE IF NOT EXISTS public.suap_processo_caixas');
    expect(migrationSource).toContain('REFERENCES public.processos(id) ON DELETE CASCADE');
    expect(migrationSource).toContain('REFERENCES public.suap_caixas(id) ON DELETE CASCADE');
    expect(migrationSource).toContain('ON CONFLICT (processo_id, caixa_id)');
    expect(scraperSource).toContain('async reconcileProcessBoxMemberships(');
    expect(scraperSource).toContain(".delete()");
    expect(scraperSource).toContain(".in('processo_id', staleProcessIds)");
    expect(scraperSource).toContain('if (uniqueProcessIds.length === 0) return;');
    expect(panelSource).toContain('const scrapedProcessesByBox = new Map<string, ScrapedProcesso[]>();');
    expect(panelSource).toContain('if (scrapedProcessesByBox.size === 0)');
    expect(panelSource).toContain('reconcileProcessBoxMemberships(caixaId, processIds, session.user.id)');
    expect(panelSource).not.toContain("Nenhum processo foi localizado em nenhuma das caixas selecionadas.");
    expect(processosSource).toContain(".from('suap_processo_caixas')");
    expect(processosSource).toContain('.filter((processo) => caixasByProcessoId.has(processo.id))');
  });
  it('keeps SUAP configuration manual and refreshes processes after synchronization', () => {
    const serviceSource = readFileSync(
      path.resolve(process.cwd(), 'src/services/suapScraperService.ts'),
      'utf8',
    );
    const panelSource = readFileSync(
      path.resolve(process.cwd(), 'src/components/suap/SuapSyncPanel.tsx'),
      'utf8',
    );

    expect(panelSource).toContain("queryClient.invalidateQueries({ queryKey: ['suap-processos'] })");
    expect(panelSource).toContain('Cadastre uma caixa manualmente para iniciar a sincronização.');
    expect(panelSource).not.toContain('Auto-descobrir Caixas');
    expect(panelSource).not.toContain('handleDiscoverBoxes');
    expect(serviceSource).not.toContain('discoverCaixasProcessos');
  });
  it('exposes independent PDF and AI stages on the SUAP page', () => {
    const pageSource = readFileSync(
      path.resolve(process.cwd(), 'src/pages/Suap.tsx'),
      'utf8',
    );

    expect(pageSource).toContain('selectedProcessIds');
    expect(pageSource).toContain('runBulkAction');
    expect(pageSource).toContain('handleDownloadPdfStage');
    expect(pageSource).toContain('handleAiExtractionStage');
    expect(pageSource).toContain('downloadPdfForProcess');
    expect(pageSource).toContain('runAiExtractionForProcess');
    expect(pageSource).toContain("from '@/components/ui/table'");
    expect(pageSource).toContain('TableHeader');
    expect(pageSource).toContain('TableRow');
    expect(pageSource).toContain('Eye');
    expect(pageSource).toContain('Sparkles');
    expect(pageSource).toContain('FileDown');
    expect(pageSource).toContain('setDetailsProcesso');
    expect(pageSource).toContain('Limpar seleção');
    expect(pageSource).toContain('Filtrar por caixa');
    expect(pageSource).toContain('hasBeneficiarioPanel');
    expect(pageSource).toContain('hasDadosBancariosPanel');
    expect(pageSource).toContain("'queued_extraction'");
    expect(pageSource).toContain("'processing_extraction'");
    expect(pageSource).toContain('IA em fila');
    expect(pageSource).toContain('IA processando');
    expect(pageSource).toContain('Gemini indisponivel por limite de cota');
    expect(pageSource).toContain('A tabela sera atualizada automaticamente.');
    expect(pageSource).toContain('refetchInterval: (query)');
    expect(pageSource).toContain("type StatusFilter = 'active' | 'concluded'");
    expect(pageSource).toContain('Informacoes');
    expect(pageSource).toContain('Andamento');
    expect(pageSource).toContain('rowDetails');
    expect(pageSource).not.toContain("['pending', 'Pendentes']");
    expect(pageSource).not.toContain("['error', 'Erros']");
    expect(pageSource).not.toContain("['all', 'Todos']");
    expect(pageSource).not.toContain('grid gap-5 xl:grid-cols-2 2xl:grid-cols-3');
    expect(pageSource).not.toContain('visibleInCurrentFilter');
  });

  it('keeps despacho generation available from the SUAP table and bulk selection', () => {
    const pageSource = readFileSync(
      path.resolve(process.cwd(), 'src/pages/Suap.tsx'),
      'utf8',
    );
    const dialogSource = readFileSync(
      path.resolve(process.cwd(), 'src/components/suap/SuapDocumentGeneratorDialog.tsx'),
      'utf8',
    );

    expect(pageSource).toContain('SuapDocumentGeneratorDialog');
    expect(pageSource).toContain('startDispatchGeneration(selectedProcesses)');
    expect(pageSource).toContain('startDispatchGeneration([processo])');
    expect(pageSource).toContain('FilePenLine');
    expect(dialogSource).toContain('Despacho de Liquidacao');
    expect(dialogSource).toContain('buildSuapCloneUrl');
    expect(dialogSource).toContain('copySuapDocumentToClipboard');
  });

  it('uses a stable Gemini model default for process-pdf extraction', () => {
    const sharedSource = readFileSync(
      path.resolve(process.cwd(), 'supabase/functions/_shared/process_pdf_shared.ts'),
      'utf8',
    );

    expect(sharedSource).toContain('Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash-lite"');
    expect(sharedSource).toContain('generativelanguage.googleapis.com');
    expect(sharedSource).not.toContain('gemini-3-flash-preview');
  });

  it('uses the Gemini, OpenAI, then OpenRouter fallback order for PDF extraction', () => {
    const workerSource = readFileSync(
      path.resolve(process.cwd(), 'supabase/functions/process-pdf-worker/index.ts'),
      'utf8',
    );
    const sharedSource = readFileSync(
      path.resolve(process.cwd(), 'supabase/functions/_shared/process_pdf_shared.ts'),
      'utf8',
    );

    expect(workerSource).toContain('callOpenAiWithPdfBytes');
    expect(workerSource).toContain('runOpenAiThenOpenRouter');
    expect(workerSource).toContain('runOpenAiChunkedFallback');
    expect(workerSource).toContain('runGeminiChunkedFallback');
    expect(workerSource).toContain('if (await runGeminiChunkedFallback(job, processo, pdfBytes)) return;');
    expect(workerSource).toContain('buildGeminiFallbackFailure');
    expect(workerSource).toContain('Gemini (tentativa principal) falhou');
    expect(workerSource).toContain('OpenAI/OpenRouter (fallback) falhou');
    expect(workerSource).toContain('isOpenAiContextWindowError(openAiError)');
    expect(workerSource).toContain('const openRouterContext = cleanContextText || cleanString(openAiResult?.rawText);');
    expect(sharedSource).toContain('Deno.env.get("OPENAI_MODEL") ?? "gpt-5-mini"');
    expect(sharedSource).toContain('https://api.openai.com/v1/responses');
    expect(sharedSource).toContain('function extractOpenAiMessage');
    expect(sharedSource).toContain('response.output');
    expect(sharedSource).toContain('no_extractable_data');
    expect(sharedSource).toContain('type: "input_file"');
    expect(sharedSource).toContain('detail: "high"');
    expect(sharedSource).toContain('p_provider_order: ["gemini", "openai", "openrouter"]');
  });

  it('passes service role auth when triggering the internal worker', () => {
    const sharedSource = readFileSync(
      path.resolve(process.cwd(), 'supabase/functions/_shared/process_pdf_shared.ts'),
      'utf8',
    );
    const configSource = readFileSync(
      path.resolve(process.cwd(), 'supabase/config.toml'),
      'utf8',
    );

    expect(sharedSource).toContain('"Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`');
    expect(sharedSource).toContain('"apikey": SUPABASE_SERVICE_ROLE_KEY');
    expect(configSource).toContain('[functions.process-pdf]');
    expect(configSource).toContain('[functions.process-pdf-worker]');
  });
});