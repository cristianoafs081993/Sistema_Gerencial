import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  authenticateUserFromToken,
  corsHeaders,
  getUserTokenFromRequest,
  jsonResponse,
} from "../_shared/process_pdf_shared.ts";
import { parseJsonResponse } from "../_shared/json_response.ts";
import {
  BOLSISTAS_RESPONSE_SCHEMA,
  buildBolsistasPrompt,
  MAX_TEXT_CHARS,
  normalizeBolsistasIaResponse,
} from "../_shared/bolsistas_extraction.ts";

// IA de reserva da montagem automatica da LC pela extensao: so e chamada quando o parser
// (script) nao identifica os bolsistas do documento ou encontra menos do que o total declarado.

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 120_000;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL = Deno.env.get("GEMINI_LC_BOLSISTAS_MODEL") ?? "gemini-2.5-flash";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_MODEL = Deno.env.get("OPENAI_LC_BOLSISTAS_MODEL") ?? "gpt-5.6-luna";

type DocumentInput = { kind: "text"; text: string } | { kind: "pdf"; pdfBase64: string };

function cleanText(value: unknown, maxLength = 4000) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function decodePdf(value: unknown) {
  const input = typeof value === "string" ? value.trim().replace(/^data:application\/pdf;base64,/i, "") : "";
  if (!input || !/^[A-Za-z0-9+/]*={0,2}$/.test(input)) throw new Error("pdfBase64 inválido.");
  const binary = atob(input);
  if (binary.length > MAX_PDF_BYTES) throw new Error("O PDF excede o limite de 20 MB.");
  if (binary.slice(0, 4) !== "%PDF") throw new Error("O conteúdo enviado não é um PDF válido.");
  return input;
}

function readDocument(body: Record<string, unknown>): DocumentInput {
  if (typeof body.text === "string" && body.text.trim()) {
    if (body.text.length > MAX_TEXT_CHARS) throw new Error("O texto do documento excede o limite.");
    return { kind: "text", text: body.text };
  }
  return { kind: "pdf", pdfBase64: decodePdf(body.pdfBase64) };
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

async function requestGemini(prompt: string, doc: DocumentInput) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada no Supabase.");
  return await withTimeout(async (signal) => {
    const documentPart = doc.kind === "pdf"
      ? { inline_data: { mime_type: "application/pdf", data: doc.pdfBase64 } }
      : { text: `--- DOCUMENTO ---\n${doc.text}\n--- FIM ---` };
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
      {
        method: "POST",
        signal,
        headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }, documentPart] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 16000,
            responseMimeType: "application/json",
            responseSchema: BOLSISTAS_RESPONSE_SCHEMA,
          },
        }),
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(cleanText(payload?.error?.message) || `Gemini respondeu HTTP ${response.status}.`);
    const text = payload?.candidates?.flatMap((candidate: any) => candidate?.content?.parts || [])
      .map((part: any) => typeof part?.text === "string" ? part.text : "")
      .join("")
      .trim();
    if (!text) throw new Error("Gemini não retornou a lista de bolsistas.");
    return parseJsonResponse(text);
  });
}

function extractOpenAiMessage(value: any): string {
  if (typeof value?.output_text === "string" && value.output_text.trim()) return value.output_text.trim();
  return (Array.isArray(value?.output) ? value.output : [])
    .flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .filter((part: any) => part?.type === "output_text" && typeof part.text === "string")
    .map((part: any) => part.text.trim())
    .join("\n");
}

async function requestOpenAi(prompt: string, doc: DocumentInput) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada no Supabase.");
  return await withTimeout(async (signal) => {
    const documentPart = doc.kind === "pdf"
      ? { type: "input_file", filename: "lista-bolsistas.pdf", file_data: `data:application/pdf;base64,${doc.pdfBase64}` }
      : { type: "input_text", text: `--- DOCUMENTO ---\n${doc.text}\n--- FIM ---` };
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal,
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [{ role: "user", content: [documentPart, { type: "input_text", text: prompt }] }],
        text: { format: { type: "json_object" } },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(cleanText(payload?.error?.message, 500) || `OpenAI respondeu HTTP ${response.status}.`);
    const text = extractOpenAiMessage(payload);
    if (!text) throw new Error("OpenAI não retornou a lista de bolsistas.");
    return parseJsonResponse(text);
  });
}

async function extract(prompt: string, doc: DocumentInput) {
  try {
    return { provider: "gemini", raw: await requestGemini(prompt, doc) };
  } catch (error) {
    const geminiFailure = error instanceof Error ? error.message : String(error);
    console.warn("[extrair-bolsistas-documento] Gemini falhou; OpenAI será usado como reserva.", geminiFailure);
    try {
      return { provider: "openai", raw: await requestOpenAi(prompt, doc) };
    } catch (fallbackError) {
      const openAiFailure = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`Gemini falhou: ${geminiFailure.slice(0, 300)}; OpenAI falhou: ${openAiFailure.slice(0, 300)}`);
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const token = getUserTokenFromRequest(req);
    if (!token) return jsonResponse({ error: "Unauthorized: missing user token" }, 401);
    await authenticateUserFromToken(token);

    const body = await req.json().catch(() => ({}));
    if (!body || typeof body !== "object") return jsonResponse({ error: "Corpo inválido." }, 400);
    const doc = readDocument(body as Record<string, unknown>);
    const title = cleanText((body as any).title, 300);
    const processNumber = cleanText((body as any).processNumber, 120);
    const expected = Number((body as any).expectedCount);
    const expectedCount = Number.isInteger(expected) && expected > 0 && expected < 1000 ? expected : undefined;

    const { provider, raw } = await extract(buildBolsistasPrompt(title, processNumber, expectedCount), doc);
    // Somente contagens vao para o log: o conteudo tem CPF e dados bancarios.
    const result = normalizeBolsistasIaResponse(raw);
    console.info("[extrair-bolsistas-documento]", { provider, kind: doc.kind, found: result.bolsistas.length, discarded: result.discardedInvalidCpf });
    return jsonResponse({ ...result, provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("invalid user token")) return jsonResponse({ error: `Unauthorized: ${message}` }, 401);
    console.error("[extrair-bolsistas-documento]", message);
    return jsonResponse({ error: message }, /limite|inválido/.test(message) ? 400 : 500);
  }
});
