import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  authenticateUserFromToken,
  cleanString,
  corsHeaders,
  enqueueJob,
  fetchProcessRecord,
  getUserTokenFromRequest,
  jsonResponse,
  triggerWorker,
  updateProcessStatus,
} from "../_shared/process_pdf_shared.ts";

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

    const processo = await fetchProcessRecord(user.id, suap_id);
    if (!processo?.pdf_url) return jsonResponse({ error: "PDF not found" }, 404);

    const job = await enqueueJob(user.id, suap_id, extraction_context);
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
