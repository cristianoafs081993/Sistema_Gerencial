import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { cleanExpiredSuapPdfs, type RetentionCandidate } from "../_shared/suap_pdf_retention.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", {
  auth: { persistSession: false },
});

Deno.serve(async (request: Request) => {
  const secret = Deno.env.get("SUAP_PDF_RETENTION_SECRET");
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!secret || request.headers.get("x-retention-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await cleanExpiredSuapPdfs({
      async reconcile() {
        const { error } = await supabase.rpc("suap_reconcile_missing_pdf_references");
        if (error) throw error;
      },
      async candidates(name) {
        const { data, error } = await supabase.rpc("suap_expired_pdf_candidates", {
          p_limit: 50,
          p_name: name ?? null,
        });
        if (error) throw error;
        return (data || []) as RetentionCandidate[];
      },
      async remove(name) {
        const { error } = await supabase.storage.from("suap-pdfs").remove([name]);
        if (error) throw error;
      },
      async clearReference(name) {
        const { error } = await supabase.rpc("suap_clear_deleted_pdf_reference", { p_name: name });
        if (error) throw error;
      },
    });
    return Response.json(result, { status: result.failed ? 500 : 200 });
  } catch {
    console.error("[cleanup-suap-pdfs] Falha ao executar a limpeza.");
    return Response.json({ error: "Falha ao executar a limpeza." }, { status: 500 });
  }
});
