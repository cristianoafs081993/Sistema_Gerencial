import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  MAX_JOB_ATTEMPTS,
  WORKER_LEASE_SECONDS,
  assertInternalWorkerRequest,
  buildUpdatePayload,
  callGeminiWithPdfBytes,
  callOpenAiWithPdfBytes,
  callOpenRouterWithContext,
  claimJob,
  cleanString,
  consolidateExtractionPayloads,
  corsHeaders,
  detectErrorCode,
  downloadPdfBytes,
  fetchJob,
  fetchProcessRecord,
  initializeChunkRows,
  inspectPdf,
  isRetryableErrorCode,
  jsonResponse,
  splitPdfIntoChunks,
  supabase,
  updateChunk,
  updateJob,
  updateProcessStatus,
  validatePayload,
  type ExtractionJobRow,
  type ExtractionPayload,
  type ExtractionValidation,
  type ProcessRecord,
  type ProviderName,
} from "../_shared/process_pdf_shared.ts";

function nextLeaseIso() {
  return new Date(Date.now() + WORKER_LEASE_SECONDS * 1000).toISOString();
}

async function extendLease(jobId: string) {
  await updateJob(jobId, { lease_expires_at: nextLeaseIso() });
}

async function markJobCompleted(jobId: string, provider: string) {
  await updateJob(jobId, {
    status: "completed",
    result_provider: provider,
    lease_expires_at: null,
    finished_at: new Date().toISOString(),
    last_error_code: null,
    last_error_message: null,
  });
}

async function markJobFailed(job: ExtractionJobRow, processo: ProcessRecord, code: string, message: string, retryable = false) {
  const shouldRetry = retryable && job.attempt_count < MAX_JOB_ATTEMPTS;
  const processStatus = shouldRetry ? "queued_extraction" : "extraction_failed";

  await updateJob(job.id, {
    status: shouldRetry ? "retryable" : "failed",
    lease_expires_at: null,
    finished_at: shouldRetry ? null : new Date().toISOString(),
    last_error_code: code,
    last_error_message: message,
  });

  const updatePayload = buildUpdatePayload(processo, {
    num_processo: cleanString(processo.num_processo),
    beneficiario: cleanString(processo.beneficiario),
    cpf_cnpj: cleanString(processo.cpf_cnpj),
    val_nf: cleanString((processo.dados_completos as Record<string, unknown> | null)?.val_nf),
    contrato_numero: cleanString((processo.dados_completos as Record<string, unknown> | null)?.contrato_numero),
    assunto: cleanString(processo.assunto),
    dados_bancarios: null,
    notas_fiscais: [],
    retencoes_tributarias: null,
    empenhos: [],
  }, processStatus);

  const existingDados = processo.dados_completos && typeof processo.dados_completos === "object" && !Array.isArray(processo.dados_completos)
    ? processo.dados_completos as Record<string, unknown>
    : {};

  updatePayload.dados_completos = {
    ...existingDados,
    extraction_job: {
      last_error_code: code,
      last_error_message: message,
      updated_at: new Date().toISOString(),
    },
  };

  const { error } = await supabase
    .from("processos")
    .update(updatePayload)
    .eq("tenant_id", job.tenant_id)
    .eq("suap_id", job.suap_id);
  if (error) throw new Error(error.message);
}

async function persistSuccess(job: ExtractionJobRow, processo: ProcessRecord, payload: ExtractionPayload, provider: ProviderName) {
  const validation = validatePayload(payload, provider);
  const processStatus = validation.ok ? "success" : "incomplete_extraction";
  const updatePayload = buildUpdatePayload(processo, payload, processStatus);
  updatePayload.dados_completos = {
    ...updatePayload.dados_completos,
    extraction_job: {
      provider,
      used_async_worker: true,
      updated_at: new Date().toISOString(),
    },
  };

  const { error } = await supabase
    .from("processos")
    .update(updatePayload)
    .eq("tenant_id", job.tenant_id)
    .eq("suap_id", job.suap_id);
  if (error) throw new Error(error.message);

  await markJobCompleted(job.id, provider);
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function buildGeminiFallbackFailure(geminiFailure: Error, fallbackFailure: unknown) {
  const fallbackError = toError(fallbackFailure);
  const message = [
    `Gemini (tentativa principal) falhou: ${geminiFailure.message}`,
    `OpenAI/OpenRouter (fallback) falhou: ${fallbackError.message}`,
  ].join(" | ");

  return Object.assign(new Error(message), {
    code: detectErrorCode({ error: fallbackError }),
  });
}

function isOpenAiContextWindowError(error: Error | null) {
  const message = error?.message.toLowerCase() ?? "";
  return message.includes("context window") || message.includes("context_length_exceeded");
}

async function runOpenAiChunkedFallback(
  job: ExtractionJobRow,
  processo: ProcessRecord,
  pdfBytes: Uint8Array,
  processoNumeroAtual: string | null,
): Promise<boolean> {
  const chunks = await splitPdfIntoChunks(pdfBytes);
  if (chunks.length < 2) return false;

  await initializeChunkRows(job.id, chunks);
  const partialPayloads: ExtractionPayload[] = [];
  let lastOpenAiError: Error | null = null;

  for (const chunk of chunks) {
    await extendLease(job.id);
    await updateChunk(job.id, chunk.chunkIndex, {
      page_start: chunk.pageStart,
      page_end: chunk.pageEnd,
      status: "processing",
      attempt_count: 2,
      provider: "openai",
    });

    try {
      const result = await callOpenAiWithPdfBytes(chunk.bytes, processoNumeroAtual);
      await updateChunk(job.id, chunk.chunkIndex, {
        page_start: chunk.pageStart,
        page_end: chunk.pageEnd,
        status: result.validation.ok ? "completed" : "failed",
        attempt_count: 2,
        provider: "openai",
        partial_result: { extracted: result.extracted, validation: result.validation },
        last_error_code: result.validation.ok ? null : detectErrorCode({ validation: result.validation }),
        last_error_message: result.validation.ok ? null : result.validation.details.join(", "),
      });
      if (result.validation.ok) partialPayloads.push(result.extracted);
    } catch (error) {
      lastOpenAiError = toError(error);
      await updateChunk(job.id, chunk.chunkIndex, {
        page_start: chunk.pageStart,
        page_end: chunk.pageEnd,
        status: "failed",
        attempt_count: 2,
        provider: "openai",
        partial_result: null,
        last_error_code: detectErrorCode({ error }),
        last_error_message: lastOpenAiError.message,
      });
    }
  }

  if (partialPayloads.length > 0) {
    const consolidated = consolidateExtractionPayloads(partialPayloads, processoNumeroAtual);
    await persistSuccess(job, processo, consolidated, "openai");
    return true;
  }

  if (lastOpenAiError) throw lastOpenAiError;
  return false;
}

async function runOpenAiThenOpenRouter(
  job: ExtractionJobRow,
  processo: ProcessRecord,
  pdfBytes: Uint8Array,
  processoNumeroAtual: string | null,
  contextText: string | null,
  partialPayloads: ExtractionPayload[] = [],
): Promise<boolean> {
  let openAiError: Error | null = null;
  let openAiResult: Awaited<ReturnType<typeof callOpenAiWithPdfBytes>> | null = null;

  try {
    openAiResult = await callOpenAiWithPdfBytes(pdfBytes, processoNumeroAtual);
    if (openAiResult.validation.ok) {
      await persistSuccess(job, processo, openAiResult.extracted, "openai");
      return true;
    }
  } catch (error) {
    openAiError = toError(error);
  }

  // Large PDFs are first tried whole to preserve cross-page context. If OpenAI
  // rejects that request for context size, retry it in the same page chunks
  // already used by the Gemini path instead of surfacing a deterministic 400.
  if (isOpenAiContextWindowError(openAiError)) {
    try {
      if (await runOpenAiChunkedFallback(job, processo, pdfBytes, processoNumeroAtual)) return true;
    } catch (error) {
      openAiError = toError(error);
    }
  }

  const cleanContextText = cleanString(contextText);
  const openRouterContext = cleanContextText || cleanString(openAiResult?.rawText);
  if (openRouterContext) {
    try {
      const openrouter = await callOpenRouterWithContext(openRouterContext, processoNumeroAtual, partialPayloads);
      if (openrouter.validation.ok) {
        await persistSuccess(job, processo, openrouter.extracted, "openrouter");
        return true;
      }
    } catch {
      // Preserve the previous provider result below when the final repair also fails.
    }
  }

  if (openAiResult) {
    throw Object.assign(new Error(`OpenAI returned invalid output: ${openAiResult.validation.reason}`), {
      code: detectErrorCode({ validation: openAiResult.validation }),
    });
  }

  if (openAiError) throw openAiError;
  return false;
}

async function runLightPdfPath(job: ExtractionJobRow, processo: ProcessRecord, pdfBytes: Uint8Array, contextText: string | null) {
  const processoNumeroAtual = cleanString(processo.num_processo);
  let geminiError: Error | null = null;
  let geminiValidation: ExtractionValidation | null = null;
  let geminiPayload: ExtractionPayload | null = null;

  try {
    const gemini = await callGeminiWithPdfBytes(pdfBytes, processoNumeroAtual, "full", cleanString(contextText));
    geminiValidation = gemini.validation;
    geminiPayload = gemini.extracted;
    if (gemini.validation.ok) {
      await persistSuccess(job, processo, gemini.extracted, "gemini");
      return;
    }
  } catch (error) {
    geminiError = error instanceof Error ? error : new Error(String(error));
  }

  const geminiFailure = geminiError ?? Object.assign(
    new Error(`Gemini returned invalid output: ${geminiValidation?.details.join(", ") || "unknown validation error"}`),
    { code: detectErrorCode({ validation: geminiValidation }) },
  );

  try {
    if (await runGeminiChunkedFallback(job, processo, pdfBytes)) return;
  } catch {
    // The Gemini full-PDF error remains the primary failure if chunking cannot run.
  }

  try {
    if (await runOpenAiThenOpenRouter(job, processo, pdfBytes, processoNumeroAtual, contextText)) return;
  } catch (fallbackError) {
    throw buildGeminiFallbackFailure(geminiFailure, fallbackError);
  }

  throw geminiFailure;
}
async function processChunk(job: ExtractionJobRow, processoNumeroAtual: string | null, chunk: Awaited<ReturnType<typeof splitPdfIntoChunks>>[number]) {
  await updateChunk(job.id, chunk.chunkIndex, {
    page_start: chunk.pageStart,
    page_end: chunk.pageEnd,
    status: "processing",
    attempt_count: 1,
  });

  try {
    const result = await callGeminiWithPdfBytes(chunk.bytes, processoNumeroAtual, `chunk-${chunk.chunkIndex}`);
    await updateChunk(job.id, chunk.chunkIndex, {
      page_start: chunk.pageStart,
      page_end: chunk.pageEnd,
      status: result.validation.ok ? "completed" : "failed",
      provider: "gemini",
      partial_result: {
        extracted: result.extracted,
        validation: result.validation,
      },
      last_error_code: result.validation.ok ? null : detectErrorCode({ validation: result.validation }),
      last_error_message: result.validation.ok ? null : result.validation.details.join(", "),
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateChunk(job.id, chunk.chunkIndex, {
      page_start: chunk.pageStart,
      page_end: chunk.pageEnd,
      status: "failed",
      provider: "gemini",
      partial_result: null,
      last_error_code: detectErrorCode({ error }),
      last_error_message: message,
    });
    if (detectErrorCode({ error }) === "provider_rate_limit") throw error;
    return null;
  }
}

async function runGeminiChunkedFallback(job: ExtractionJobRow, processo: ProcessRecord, pdfBytes: Uint8Array) {
  const processoNumeroAtual = cleanString(processo.num_processo);
  const chunks = await splitPdfIntoChunks(pdfBytes);
  if (chunks.length < 2) return false;

  await updateProcessStatus(job.tenant_id, job.suap_id, "processing_chunks");
  await initializeChunkRows(job.id, chunks);
  const partialPayloads: ExtractionPayload[] = [];

  for (const chunk of chunks) {
    await extendLease(job.id);
    try {
      const result = await processChunk(job, processoNumeroAtual, chunk);
      if (result?.validation.ok) partialPayloads.push(result.extracted);
    } catch {
      return false;
    }
  }

  if (partialPayloads.length === 0) return false;

  const consolidated = consolidateExtractionPayloads(partialPayloads, processoNumeroAtual);
  if (!validatePayload(consolidated, "gemini").ok) return false;

  await persistSuccess(job, processo, consolidated, "gemini");
  return true;
}

async function runHeavyPdfPath(job: ExtractionJobRow, processo: ProcessRecord, pdfBytes: Uint8Array, contextText: string | null) {
  const processoNumeroAtual = cleanString(processo.num_processo);
  await updateProcessStatus(job.tenant_id, job.suap_id, "processing_chunks");
  const chunks = await splitPdfIntoChunks(pdfBytes);
  await initializeChunkRows(job.id, chunks);

  const partialPayloads: ExtractionPayload[] = [];
  try {
    for (const chunk of chunks) {
      await extendLease(job.id);
      const result = await processChunk(job, processoNumeroAtual, chunk);
      if (result?.validation.ok) {
        partialPayloads.push(result.extracted);
      }
    }
  } catch (geminiError) {
    try {
      if (await runOpenAiThenOpenRouter(job, processo, pdfBytes, processoNumeroAtual, contextText, partialPayloads)) return;
    } catch (fallbackError) {
      throw buildGeminiFallbackFailure(toError(geminiError), fallbackError);
    }
    throw geminiError;
  }

  await extendLease(job.id);
  await updateProcessStatus(job.tenant_id, job.suap_id, "consolidating_extraction");
  console.time("[process-pdf-worker] consolidating");
  try {
    if (partialPayloads.length > 0) {
      const consolidated = consolidateExtractionPayloads(partialPayloads, processoNumeroAtual);
      const consolidatedValidation = validatePayload(consolidated, "gemini");
      if (consolidatedValidation.ok) {
        await persistSuccess(job, processo, consolidated, "gemini");
        return;
      }
    }
  } finally {
    console.timeEnd("[process-pdf-worker] consolidating");
  }

  const geminiFailure = Object.assign(
    new Error("Gemini extraction did not produce usable PDF chunks."),
    { code: detectErrorCode({ validation: { ok: false, reason: "technical_failure", provider: "gemini", details: ["no usable chunks"] } }) },
  );
  try {
    if (await runOpenAiThenOpenRouter(job, processo, pdfBytes, processoNumeroAtual, contextText, partialPayloads)) return;
  } catch (fallbackError) {
    throw buildGeminiFallbackFailure(geminiFailure, fallbackError);
  }

  if (partialPayloads.length > 0) {
    const consolidated = consolidateExtractionPayloads(partialPayloads, processoNumeroAtual);
    await persistSuccess(job, processo, consolidated, "gemini");
    return;
  }

  throw geminiFailure;
}

async function processJob(job: ExtractionJobRow) {
  const processo = await fetchProcessRecord(job.tenant_id, job.suap_id);
  if (!processo?.pdf_url) throw new Error("PDF not found");

  await updateProcessStatus(job.tenant_id, job.suap_id, "processing_extraction");
  const pdfBytes = await downloadPdfBytes(String(processo.pdf_url));
  await extendLease(job.id);

  const inspection = await inspectPdf(pdfBytes);
  await extendLease(job.id);

  if (inspection.isHeavy) {
    await runHeavyPdfPath(job, processo, pdfBytes, cleanString(job.context_text));
    return;
  }

  await runLightPdfPath(job, processo, pdfBytes, cleanString(job.context_text));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    assertInternalWorkerRequest(req);
    const body = await req.json();
    const jobId = cleanString(body?.job_id);
    if (!jobId) return jsonResponse({ error: "job_id required" }, 400);

    const claimed = await claimJob(jobId);
    if (!claimed) {
      const currentJob = await fetchJob(jobId);
      return jsonResponse({
        success: true,
        skipped: true,
        reason: "Job already claimed or exhausted.",
        job_id: currentJob.id,
        status: currentJob.status,
      }, 202);
    }

    try {
      await processJob(claimed);
      return jsonResponse({
        success: true,
        job_id: claimed.id,
        suap_id: claimed.suap_id,
        status: "completed",
      }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code ?? detectErrorCode({ error }))
        : detectErrorCode({ error });

      const processo = await fetchProcessRecord(claimed.tenant_id, claimed.suap_id);
      await markJobFailed(claimed, processo, code, message, isRetryableErrorCode(code));

      return jsonResponse({
        success: false,
        job_id: claimed.id,
        suap_id: claimed.suap_id,
        status: isRetryableErrorCode(code) && claimed.attempt_count < MAX_JOB_ATTEMPTS ? "retryable" : "failed",
        error: message,
        code,
      }, 500);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("Unauthorized worker request") ? 401 : 500;
    console.error("[process-pdf-worker] Fatal error:", message);
    return jsonResponse({ error: message }, status);
  }
});
