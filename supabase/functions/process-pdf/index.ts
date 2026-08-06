import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  authenticateUserFromToken,
  cleanString,
  corsHeaders,
  enqueueJob,
  fetchProcessRecord,
  getUserTokenFromRequest,
  jsonResponse,
  supabase,
  triggerWorker,
  updateProcessStatus,
} from "../_shared/process_pdf_shared.ts";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanInputDocumentIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((id) => String(id)).filter((id) => UUID_REGEX.test(id)))];
}

function cleanStageMetrics(value: unknown): Record<string, string | number | boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string | number | boolean> = {};
  for (const [key, metric] of Object.entries(value as Record<string, unknown>).slice(0, 32)) {
    if (!/^[a-z][a-z0-9_]{0,63}$/i.test(key)) continue;
    if (typeof metric === "string") result[key] = metric.slice(0, 256);
    if (typeof metric === "number" && Number.isFinite(metric)) result[key] = metric;
    if (typeof metric === "boolean") result[key] = metric;
  }
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const token = getUserTokenFromRequest(req);
    if (!token) return jsonResponse({ error: "Unauthorized: missing user token" }, 401);

    const user = await authenticateUserFromToken(token);
    const body = await req.json();
    const suap_id = cleanString(body?.suap_id);
    const extraction_context = cleanString(body?.extraction_context);
    if (!suap_id) return jsonResponse({ error: "suap_id required" }, 400);

    const requestedStrategy = cleanString(body?.input_strategy) || "full";
    if (requestedStrategy !== "full" && requestedStrategy !== "eligible_documents") {
      return jsonResponse({ error: "input_strategy must be full or eligible_documents" }, 400);
    }
    const inputStrategy = requestedStrategy as "full" | "eligible_documents";
    const rawDocumentIds = Array.isArray(body?.input_document_ids) ? body.input_document_ids : [];
    const inputDocumentIds = cleanInputDocumentIds(rawDocumentIds);
    if (rawDocumentIds.length !== inputDocumentIds.length) {
      return jsonResponse({ error: "input_document_ids contains an invalid document id" }, 400);
    }

    const processo = await fetchProcessRecord(user.id, suap_id);
    let selectedDocumentIds: string[] = [];
    if (inputStrategy === "full") {
      if (!processo?.pdf_url) return jsonResponse({ error: "PDF not found" }, 404);
    } else {
      const documentsQuery = supabase
        .from("suap_processo_documentos")
        .select("id, classificacao, download_status, storage_path")
        .eq("tenant_id", user.id)
        .eq("processo_id", processo.id)
        .order("ordem", { ascending: true });
      if (inputDocumentIds.length > 0) documentsQuery.in("id", inputDocumentIds);
      const { data: documents, error: documentsError } = await documentsQuery;
      if (documentsError) throw new Error(documentsError.message);
      const selected = documents || [];
      const allRequestedWereFound = inputDocumentIds.length === 0 || selected.length === inputDocumentIds.length;
      const allReady = selected.length > 0 && selected.every((document) => (
        document.classificacao === "included"
        && document.download_status === "downloaded"
        && Boolean(document.storage_path)
      ));
      if (!allRequestedWereFound || !allReady) {
        return jsonResponse({ error: "Eligible process documents are incomplete or unavailable" }, 409);
      }
      selectedDocumentIds = selected.map((document) => String(document.id));
    }

    const job = await enqueueJob(user.id, suap_id, extraction_context, {
      inputStrategy,
      inputDocumentIds: selectedDocumentIds,
      stageMetrics: cleanStageMetrics(body?.stage_metrics),
    });
    if (job.status === "processing" && job.input_strategy !== inputStrategy) {
      return jsonResponse({ error: "Another extraction strategy is already processing this process" }, 409);
    }
    const publicStatus = job.status === "processing" ? "processing_extraction" : "queued_extraction";
    await updateProcessStatus(user.id, suap_id, publicStatus);

    EdgeRuntime.waitUntil(
      triggerWorker(job.id).catch((error) => {
        console.error(`[process-pdf] Failed to trigger worker for ${suap_id}:`, error instanceof Error ? error.message : error);
      }),
    );

    return jsonResponse({
      success: true,
      queued: true,
      suap_id,
      job_id: job.id,
      run_id: job.current_run_id,
      input_strategy: inputStrategy,
      status: publicStatus,
    }, 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("invalid user token")) {
      return jsonResponse({ error: `Unauthorized: ${message}` }, 401);
    }
    if (message === "Processo not found") {
      return jsonResponse({ error: message }, 404);
    }
    console.error("[process-pdf] Wrapper error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
