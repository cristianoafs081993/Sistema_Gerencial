import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { mergeInvoiceLists, normalizeInvoiceList, type InvoiceRecord } from "./invoice_utils.ts";

export const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
export const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
export const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-5-mini";
export const OPENAI_TIMEOUT_MS = Number(Deno.env.get("OPENAI_TIMEOUT_MS") ?? "90000");
export const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
export const OPENROUTER_MODEL = Deno.env.get("OPENROUTER_MODEL") ?? "nvidia/nemotron-3-super-120b-a12b:free";
export const OPENROUTER_BASE_URL = Deno.env.get("OPENROUTER_BASE_URL") ?? "https://openrouter.ai/api/v1";
export const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash-lite";
export const GEMINI_TIMEOUT_MS = Number(Deno.env.get("GEMINI_TIMEOUT_MS") ?? "90000");
export const OPENROUTER_TIMEOUT_MS = Number(Deno.env.get("OPENROUTER_TIMEOUT_MS") ?? "90000");
export const PROCESS_PDF_WORKER_SECRET = Deno.env.get("PROCESS_PDF_WORKER_SECRET") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
export const WORKER_LEASE_SECONDS = Number(Deno.env.get("PROCESS_PDF_WORKER_LEASE_SECONDS") ?? "180");
export const MAX_JOB_ATTEMPTS = Number(Deno.env.get("PROCESS_PDF_MAX_ATTEMPTS") ?? "3");
export const HEAVY_PDF_MAX_BYTES = Number(Deno.env.get("HEAVY_PDF_MAX_BYTES") ?? "2097152");
export const HEAVY_PDF_MAX_PAGES = Number(Deno.env.get("HEAVY_PDF_MAX_PAGES") ?? "10");
export const CHUNK_PAGE_SIZE = Number(Deno.env.get("PROCESS_PDF_CHUNK_PAGE_SIZE") ?? "5");
export const CHUNK_PAGE_OVERLAP = Number(Deno.env.get("PROCESS_PDF_CHUNK_PAGE_OVERLAP") ?? "1");
export const OPENROUTER_CONTEXT_LIMIT = Number(Deno.env.get("OPENROUTER_CONTEXT_LIMIT") ?? "24000");

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const PROCESS_NUMBER_REGEX = /\b\d{5}\.\d{6}\.\d{4}-\d{2}\b/;
export const MARKUP_REGEX = /<\/?[a-z][^>]*>|&lt;\/?[a-z][^&]*&gt;|\b(?:href|class|aria-hidden|data-[\w-]+)=|[<>]/i;
export const STRICT_CPF_CNPJ_REGEX = /^(?:\d{3}\.?\d{3}\.?\d{3}-\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-\d{2})$/;
export const UI_LABEL_NOISE = new Set([
  "assunto",
  "nivel de prioridade",
  "nÃ­vel de prioridade",
  "nivel de acesso",
  "nÃ­vel de acesso",
  "acoes",
  "aÃ§Ãµes",
  "solicitar",
  "ver detalhes",
  "visualizar/baixar processo",
  "visualizar baixar processo",
  "visualizar documento original",
  "visualizar rotulos",
  "visualizar rÃ³tulos",
  "rotulo",
  "rÃ³tulo",
  "atribuir",
  "documento",
  "despacho",
  "ciencia",
  "ciÃªncia",
  "interessados",
  "interessado",
  "link publico",
  "link pÃºblico",
]);

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-jwt, x-worker-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const EXTRACTION_PROMPT = `Analise o PDF deste processo do SUAP e extraia as seguintes informacoes em JSON:
{
  "num_processo": "23035.000000.2026-00",
  "beneficiario": "Nome da empresa ou pessoa beneficiaria",
  "cpf_cnpj": "CPF ou CNPJ (formato com pontuacao)",
  "val_nf": "Valor total (formato: 17.635,47)",
  "contrato_numero": "Numero do contrato ou null",
  "assunto": "Descricao breve",
  "dados_bancarios": { "banco": "", "agencia": "", "conta": "" },
  "notas_fiscais": [ { "numero": "", "data_emissao": "", "valor": "" } ],
  "retencoes_tributarias": { "optante_simples_nacional": false, "iss": null, "inss": null, "ir": null, "csll": null, "cofins": null, "pis_pasep": null },
  "empenhos": []
}
Regras adicionais:
- percorra todas as paginas do PDF e todos os documentos de cobranca anexados ao processo;
- em "notas_fiscais", retorne uma entrada para cada nota fiscal ou DANFE distinta encontrada, sem limitar a resposta a primeira nota e sem substituir varias notas por um unico numero;
- preserve o numero, a data de emissao e o valor de cada nota individualmente; retorne [] somente quando nenhuma nota fiscal estiver presente;
- assunto nunca pode ser rotulo de interface como "Assunto", "Nivel de prioridade", "Nivel de acesso", "Solicitar" ou "Acoes".
- cpf_cnpj so pode ser retornado se estiver em formato valido de CPF/CNPJ ou um placeholder claro como "Varios (Folha de Pagamento)".
Retorne APENAS o JSON, sem markdown, sem comentarios e sem HTML.`;

export const INVOICE_VERIFICATION_PROMPT = `Analise novamente todas as paginas e documentos deste PDF do processo do SUAP, com foco exclusivo na identificacao de notas fiscais e DANFE.
Retorne o mesmo JSON estruturado do extrator principal, mas confira especialmente "notas_fiscais": inclua uma entrada distinta para cada nota fiscal/DANFE encontrada, mantendo numero, data_emissao e valor de cada uma. Nunca retorne somente a primeira nota quando houver outras no PDF. Retorne [] apenas se nenhuma nota estiver presente.
Retorne APENAS o JSON, sem markdown, sem comentarios e sem HTML.

${EXTRACTION_PROMPT}`;

export type ProviderName = "gemini" | "openai" | "openrouter";
export type JobStatus = "queued" | "processing" | "retryable" | "completed" | "failed";
export type ProcessStatus =
  | "pending_extraction"
  | "pdf_uploaded"
  | "queued_extraction"
  | "processing_extraction"
  | "processing_chunks"
  | "consolidating_extraction"
  | "success"
  | "incomplete_extraction"
  | "extraction_failed";

export type ExtractionValidation = {
  ok: boolean;
  reason: "ok" | "technical_failure" | "html_contamination" | "schema_invalid";
  provider: ProviderName;
  details: string[];
};

export type DadosBancarios = {
  banco: string | null;
  agencia: string | null;
  conta: string | null;
};

export type NotaFiscal = InvoiceRecord;

export type RetencoesTributarias = {
  optante_simples_nacional: boolean | null;
  iss: string | number | null;
  inss: string | number | null;
  ir: string | number | null;
  csll: string | number | null;
  cofins: string | number | null;
  pis_pasep: string | number | null;
};

export type ExtractionPayload = {
  num_processo: string | null;
  beneficiario: string | null;
  cpf_cnpj: string | null;
  val_nf: string | null;
  contrato_numero: string | null;
  assunto: string | null;
  dados_bancarios: DadosBancarios | null;
  notas_fiscais: NotaFiscal[];
  retencoes_tributarias: RetencoesTributarias | null;
  empenhos: string[];
};

export type ProcessRecord = Record<string, unknown>;
export type InputStrategy = 'full' | 'eligible_documents';
export type ExtractionJobRow = {
  id: string;
  tenant_id: string;
  suap_id: string;
  status: JobStatus;
  attempt_count: number;
  lease_expires_at: string | null;
  context_text: string | null;
  provider_order: unknown;
  input_strategy: InputStrategy;
  input_document_ids: string[];
  current_run_id: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  result_provider: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type ChunkDescriptor = {
  chunkIndex: number;
  pageStart: number;
  pageEnd: number;
  bytes: Uint8Array;
};

export function emptyPayload(processoNumeroAtual: string | null): ExtractionPayload {
  return {
    num_processo: processoNumeroAtual,
    beneficiario: null,
    cpf_cnpj: null,
    val_nf: null,
    contrato_numero: null,
    assunto: null,
    dados_bancarios: null,
    notas_fiscais: [],
    retencoes_tributarias: null,
    empenhos: [],
  };
}

export function cleanString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  const low = cleaned.toLowerCase();
  if (low === "-" || low === "null" || low === "none" || low === "undefined" || low === "nao extraido") {
    return null;
  }
  return cleaned;
}

export function normalizeTextValue(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function looksLikeUiLabelNoise(value: unknown): boolean {
  const key = normalizeTextValue(value);
  return Boolean(key && UI_LABEL_NOISE.has(key));
}

export function isAcceptableCpfCnpj(value: unknown): boolean {
  const text = cleanString(value);
  if (!text) return false;
  const key = normalizeTextValue(text);
  if (key.includes("varios") || key.includes("folha de pagamento")) return true;
  return STRICT_CPF_CNPJ_REGEX.test(text);
}

export function uniqueStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = cleanString(value);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

export function normalizeJson(text: string): unknown {
  const trimmed = String(text || "").trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Model output is not valid JSON.");
    }
    return JSON.parse(withoutFence.slice(start, end + 1));
  }
}

function assertOptionalArray(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") return;
  if (!Array.isArray(value)) throw new Error(`${fieldName} must be an array.`);
}

function assertOptionalObject(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") return;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error(`${fieldName} must be an object.`);
}

function normalizeBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

function normalizeRetencaoValue(value: unknown): string | number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return cleanString(value);
}

export function normalizePayload(raw: unknown, processoNumeroAtual: string | null): ExtractionPayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Extraction payload must be an object.");
  }

  const source = raw as Record<string, unknown>;
  assertOptionalObject(source.dados_bancarios, "dados_bancarios");
  assertOptionalObject(source.retencoes_tributarias, "retencoes_tributarias");
  assertOptionalArray(source.notas_fiscais, "notas_fiscais");
  assertOptionalArray(source.empenhos, "empenhos");

  const dadosBancariosSource = source.dados_bancarios && typeof source.dados_bancarios === "object" && !Array.isArray(source.dados_bancarios)
    ? source.dados_bancarios as Record<string, unknown>
    : null;

  const retencoesSource = source.retencoes_tributarias && typeof source.retencoes_tributarias === "object" && !Array.isArray(source.retencoes_tributarias)
    ? source.retencoes_tributarias as Record<string, unknown>
    : null;

  const notas = Array.isArray(source.notas_fiscais)
    ? source.notas_fiscais.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("Each nota_fiscal must be an object.");
      }
      const nota = item as Record<string, unknown>;
      return {
        numero: cleanString(nota.numero),
        data_emissao: cleanString(nota.data_emissao),
        valor: cleanString(nota.valor),
      };
    }).filter((item) => item.numero || item.data_emissao || item.valor)
    : [];

  return {
    num_processo: cleanString(source.num_processo) ?? processoNumeroAtual,
    beneficiario: cleanString(source.beneficiario),
    cpf_cnpj: cleanString(source.cpf_cnpj),
    val_nf: cleanString(source.val_nf),
    contrato_numero: cleanString(source.contrato_numero),
    assunto: cleanString(source.assunto),
    dados_bancarios: dadosBancariosSource
      ? {
          banco: cleanString(dadosBancariosSource.banco),
          agencia: cleanString(dadosBancariosSource.agencia),
          conta: cleanString(dadosBancariosSource.conta),
        }
      : null,
    notas_fiscais: notas,
    retencoes_tributarias: retencoesSource
      ? {
          optante_simples_nacional: normalizeBoolean(retencoesSource.optante_simples_nacional),
          iss: normalizeRetencaoValue(retencoesSource.iss),
          inss: normalizeRetencaoValue(retencoesSource.inss),
          ir: normalizeRetencaoValue(retencoesSource.ir),
          csll: normalizeRetencaoValue(retencoesSource.csll),
          cofins: normalizeRetencaoValue(retencoesSource.cofins),
          pis_pasep: normalizeRetencaoValue(retencoesSource.pis_pasep),
        }
      : null,
    empenhos: Array.isArray(source.empenhos) ? uniqueStrings(source.empenhos) : [],
  };
}

export function hasMarkup(value: unknown): boolean {
  const text = cleanString(value);
  return Boolean(text && MARKUP_REGEX.test(text));
}

export function validatePayload(payload: ExtractionPayload, provider: ProviderName): ExtractionValidation {
  const details: string[] = [];

  if (!payload.num_processo || !PROCESS_NUMBER_REGEX.test(payload.num_processo)) details.push("num_processo");
  if (!Array.isArray(payload.notas_fiscais)) details.push("notas_fiscais");
  if (!Array.isArray(payload.empenhos)) details.push("empenhos");
  if (payload.dados_bancarios !== null && typeof payload.dados_bancarios !== "object") details.push("dados_bancarios");
  if (payload.retencoes_tributarias !== null && typeof payload.retencoes_tributarias !== "object") details.push("retencoes_tributarias");
  if (payload.assunto && looksLikeUiLabelNoise(payload.assunto)) details.push("assunto_ui_noise");
  if (payload.beneficiario && looksLikeUiLabelNoise(payload.beneficiario)) details.push("beneficiario_ui_noise");
  if (payload.cpf_cnpj && !isAcceptableCpfCnpj(payload.cpf_cnpj)) details.push("cpf_cnpj_invalid");

  const hasUsefulData = [
    payload.beneficiario,
    payload.cpf_cnpj,
    payload.assunto,
    payload.val_nf,
    payload.contrato_numero,
    ...payload.empenhos,
    ...payload.notas_fiscais.flatMap((nota) => [nota.numero, nota.data_emissao, nota.valor]),
    ...(payload.dados_bancarios ? Object.values(payload.dados_bancarios) : []),
    ...(payload.retencoes_tributarias
      ? Object.entries(payload.retencoes_tributarias)
        .filter(([key, value]) => key !== "optante_simples_nacional" || value === true)
        .map(([, value]) => value)
      : []),
  ].some((value) => cleanString(value));
  if (!hasUsefulData) details.push("no_extractable_data");

  if (details.length > 0) {
    return { ok: false, reason: "schema_invalid", provider, details };
  }

  const htmlDetails = new Set<string>();
  const textFields: Array<[string, unknown]> = [
    ["beneficiario", payload.beneficiario],
    ["cpf_cnpj", payload.cpf_cnpj],
    ["assunto", payload.assunto],
    ["contrato_numero", payload.contrato_numero],
  ];
  for (const [field, value] of textFields) {
    if (hasMarkup(value)) htmlDetails.add(field);
  }
  for (const [index, nota] of payload.notas_fiscais.entries()) {
    if (hasMarkup(nota.numero) || hasMarkup(nota.data_emissao) || hasMarkup(nota.valor)) {
      htmlDetails.add(`notas_fiscais[${index}]`);
    }
  }
  for (const value of payload.empenhos) {
    if (hasMarkup(value)) htmlDetails.add("empenhos");
  }
  if (payload.dados_bancarios) {
    for (const [key, value] of Object.entries(payload.dados_bancarios)) {
      if (hasMarkup(value)) htmlDetails.add(`dados_bancarios.${key}`);
    }
  }
  if (htmlDetails.size > 0) {
    return { ok: false, reason: "html_contamination", provider, details: Array.from(htmlDetails) };
  }
  return { ok: true, reason: "ok", provider, details: [] };
}

export function isTechnicalProviderError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return error.name === "AbortError"
    || message.includes("timeout")
    || message.includes("network")
    || message.includes("provider unavailable")
    || message.includes("invalid json");
}

export async function withTimeout<T>(timeoutMs: number, callback: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    return await callback(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

export function pdfBytesToBase64(pdfBytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < pdfBytes.length; index += chunkSize) {
    const chunk = pdfBytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function callGeminiWithPdfBytes(
  pdfBytes: Uint8Array,
  processoNumeroAtual: string | null,
  label = "full",
  contextText: string | null = null,
  prompt = EXTRACTION_PROMPT,
) {
  if (!GEMINI_API_KEY) throw new Error("Missing environment variable: GEMINI_API_KEY");
  const base64Pdf = pdfBytesToBase64(pdfBytes);
  const contextSection = cleanString(contextText)
    ? `\n\nContexto textual ja extraido do processo:\n${String(contextText).slice(0, OPENROUTER_CONTEXT_LIMIT)}`
    : "";
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  console.time(`[process-pdf-worker] gemini:${label}`);
  try {
    const response = await withTimeout(GEMINI_TIMEOUT_MS, async (signal) => {
      const res = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: "application/pdf", data: base64Pdf } },
              { text: `${prompt}${contextSection}` },
            ],
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
        signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 429 || res.status >= 500) {
          throw new Error(`provider unavailable: gemini ${res.status} ${errText}`);
        }
        throw new Error(`Gemini API error: ${res.status} details: ${errText.substring(0, 200)}`);
      }
      try {
        return await res.json();
      } catch (error) {
        throw new Error(`invalid json from gemini response: ${(error as Error).message}`);
      }
    });

    const rawText = response?.candidates?.[0]?.content?.parts?.find((part: { text?: string }) => typeof part?.text === "string")?.text ?? "{}";
    try {
      const extracted = normalizePayload(normalizeJson(rawText), processoNumeroAtual);
      const validation = validatePayload(extracted, "gemini");
      return { extracted, validation, rawText };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const reason = message.toLowerCase().includes("json") ? "technical_failure" : "schema_invalid";
      return {
        extracted: emptyPayload(processoNumeroAtual),
        validation: { ok: false, reason, provider: "gemini", details: [message] } as ExtractionValidation,
        rawText,
      };
    }
  } finally {
    console.timeEnd(`[process-pdf-worker] gemini:${label}`);
  }
}

function extractOpenAiMessage(response: Record<string, unknown>): string {
  const directOutput = cleanString(response.output_text);
  if (directOutput) return directOutput;

  const output = Array.isArray(response.output) ? response.output as Array<Record<string, unknown>> : [];
  const parts = output.flatMap((item) => Array.isArray(item.content) ? item.content as Array<Record<string, unknown>> : []);
  return parts
    .filter((part) => part.type === "output_text")
    .map((part) => cleanString(part.text))
    .filter((text): text is string => Boolean(text))
    .join("\n");
}

export async function callOpenAiWithPdfBytes(pdfBytes: Uint8Array, processoNumeroAtual: string | null) {
  if (!OPENAI_API_KEY) throw new Error("Missing environment variable: OPENAI_API_KEY");
  const base64Pdf = pdfBytesToBase64(pdfBytes);

  console.time("[process-pdf-worker] openai");
  try {
    const response = await withTimeout(OPENAI_TIMEOUT_MS, async (signal) => {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          input: [{
            role: "user",
            content: [
              {
                type: "input_file",
                filename: "processo.pdf",
                file_data: `data:application/pdf;base64,${base64Pdf}`,
                detail: "high",
              },
              { type: "input_text", text: EXTRACTION_PROMPT },
            ],
          }],
          text: { format: { type: "json_object" } },
        }),
        signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 429 || res.status >= 500) {
          throw new Error(`provider unavailable: openai ${res.status} ${errText}`);
        }
        throw new Error(`OpenAI API error: ${res.status} details: ${errText.substring(0, 200)}`);
      }
      return await res.json();
    });

    const rawText = extractOpenAiMessage(response as Record<string, unknown>) || "{}";
    try {
      const extracted = normalizePayload(normalizeJson(rawText), processoNumeroAtual);
      const validation = validatePayload(extracted, "openai");
      return { extracted, validation, rawText };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const reason = message.toLowerCase().includes("json") ? "technical_failure" : "schema_invalid";
      return {
        extracted: emptyPayload(processoNumeroAtual),
        validation: { ok: false, reason, provider: "openai", details: [message] } as ExtractionValidation,
        rawText,
      };
    }
  } finally {
    console.timeEnd("[process-pdf-worker] openai");
  }
}
function buildOpenRouterPrompt(contextText: string, partialPayloads: ExtractionPayload[] = []) {
  const partialSection = partialPayloads.length > 0
    ? `\n\nDados parciais ja extraidos com alta confianca:\n${JSON.stringify(partialPayloads.slice(0, 12), null, 2)}`
    : "";
  return `${EXTRACTION_PROMPT}\n\nContexto textual do processo:\n${contextText.slice(0, OPENROUTER_CONTEXT_LIMIT)}${partialSection}`;
}

function extractOpenRouterMessage(response: Record<string, unknown>): string {
  const choices = Array.isArray(response?.choices) ? response.choices as Array<Record<string, unknown>> : [];
  const content = choices[0]?.message && typeof choices[0].message === "object"
    ? (choices[0].message as Record<string, unknown>).content
    : null;

  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const merged = content
      .map((item) => typeof item === "object" && item && "text" in item ? String((item as Record<string, unknown>).text ?? "") : "")
      .join("\n")
      .trim();
    if (merged) return merged;
  }
  throw new Error("OpenRouter returned no message content.");
}

export async function callOpenRouterWithContext(contextText: string, processoNumeroAtual: string | null, partialPayloads: ExtractionPayload[] = []) {
  if (!OPENROUTER_API_KEY) throw new Error("Missing environment variable: OPENROUTER_API_KEY");
  if (!cleanString(contextText)) throw new Error("OpenRouter fallback requires non-empty context text.");

  console.time("[process-pdf-worker] openrouter");
  try {
    const response = await withTimeout(OPENROUTER_TIMEOUT_MS, async (signal) => {
      const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          temperature: 0.1,
          messages: [
            { role: "system", content: "Retorne somente JSON valido, sem markdown e sem HTML." },
            { role: "user", content: buildOpenRouterPrompt(contextText, partialPayloads) },
          ],
        }),
        signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter API error: ${res.status} details: ${errText.substring(0, 200)}`);
      }
      return await res.json();
    });

    const rawText = extractOpenRouterMessage(response);
    try {
      const extracted = normalizePayload(normalizeJson(rawText), processoNumeroAtual);
      const validation = validatePayload(extracted, "openrouter");
      return { extracted, validation, rawText };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const reason = message.toLowerCase().includes("json") ? "technical_failure" : "schema_invalid";
      return {
        extracted: emptyPayload(processoNumeroAtual),
        validation: { ok: false, reason, provider: "openrouter", details: [message] } as ExtractionValidation,
        rawText,
      };
    }
  } finally {
    console.timeEnd("[process-pdf-worker] openrouter");
  }
}

export async function inspectPdf(pdfBytes: Uint8Array) {
  console.time("[process-pdf-worker] inspectPdf");
  try {
    const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pageCount = pdf.getPageCount();
    return {
      pageCount,
      byteLength: pdfBytes.byteLength,
      isHeavy: pdfBytes.byteLength > HEAVY_PDF_MAX_BYTES || pageCount > HEAVY_PDF_MAX_PAGES,
      document: pdf,
    };
  } finally {
    console.timeEnd("[process-pdf-worker] inspectPdf");
  }
}

export async function splitPdfIntoChunks(pdfBytes: Uint8Array, pageSize = CHUNK_PAGE_SIZE, overlap = CHUNK_PAGE_OVERLAP): Promise<ChunkDescriptor[]> {
  console.time("[process-pdf-worker] splitPdfIntoChunks");
  try {
    const source = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pageCount = source.getPageCount();
    const chunks: ChunkDescriptor[] = [];
    const safePageSize = Math.max(1, pageSize);
    const safeOverlap = Math.max(0, Math.min(overlap, safePageSize - 1));
    let start = 0;
    let chunkIndex = 0;

    while (start < pageCount) {
      const end = Math.min(pageCount, start + safePageSize);
      const chunkDoc = await PDFDocument.create();
      const pageIndexes = Array.from({ length: end - start }, (_, offset) => start + offset);
      const copiedPages = await chunkDoc.copyPages(source, pageIndexes);
      for (const page of copiedPages) chunkDoc.addPage(page);
      const bytes = await chunkDoc.save();
      chunks.push({
        chunkIndex,
        pageStart: start + 1,
        pageEnd: end,
        bytes,
      });
      if (end >= pageCount) break;
      start = end - safeOverlap;
      chunkIndex += 1;
    }

    return chunks;
  } finally {
    console.timeEnd("[process-pdf-worker] splitPdfIntoChunks");
  }
}

function hasUsableText(value: unknown): boolean {
  const cleaned = cleanString(value);
  return Boolean(cleaned && !hasMarkup(cleaned) && !looksLikeUiLabelNoise(cleaned));
}

function pickTextField(fieldName: string, incoming: unknown, existing: unknown): string | null {
  const incomingCleaned = cleanString(incoming);
  if (incomingCleaned && hasUsableText(incomingCleaned)) {
    if (fieldName !== "cpf_cnpj" || isAcceptableCpfCnpj(incomingCleaned)) return incomingCleaned;
  }
  const existingCleaned = cleanString(existing);
  if (existingCleaned && hasUsableText(existingCleaned)) {
    if (fieldName !== "cpf_cnpj" || isAcceptableCpfCnpj(existingCleaned)) return existingCleaned;
  }
  return null;
}

export function mergeNotas(existingNotas: NotaFiscal[], incomingNotas: NotaFiscal[]): NotaFiscal[] {
  return mergeInvoiceLists(existingNotas, incomingNotas);
}

function mergeRetencoes(existing: RetencoesTributarias | null, incoming: RetencoesTributarias | null): RetencoesTributarias | null {
  if (!existing && !incoming) return null;
  return {
    optante_simples_nacional: incoming?.optante_simples_nacional ?? existing?.optante_simples_nacional ?? null,
    iss: incoming?.iss ?? existing?.iss ?? null,
    inss: incoming?.inss ?? existing?.inss ?? null,
    ir: incoming?.ir ?? existing?.ir ?? null,
    csll: incoming?.csll ?? existing?.csll ?? null,
    cofins: incoming?.cofins ?? existing?.cofins ?? null,
    pis_pasep: incoming?.pis_pasep ?? existing?.pis_pasep ?? null,
  };
}

export function consolidateExtractionPayloads(payloads: ExtractionPayload[], processoNumeroAtual: string | null): ExtractionPayload {
  let consolidated = emptyPayload(processoNumeroAtual);
  for (const payload of payloads) {
    consolidated = {
      num_processo: pickTextField("num_processo", consolidated.num_processo, payload.num_processo) ?? processoNumeroAtual,
      beneficiario: pickTextField("beneficiario", consolidated.beneficiario, payload.beneficiario),
      cpf_cnpj: pickTextField("cpf_cnpj", consolidated.cpf_cnpj, payload.cpf_cnpj),
      val_nf: pickTextField("val_nf", consolidated.val_nf, payload.val_nf),
      contrato_numero: pickTextField("contrato_numero", consolidated.contrato_numero, payload.contrato_numero),
      assunto: pickTextField("assunto", consolidated.assunto, payload.assunto),
      dados_bancarios: {
        banco: pickTextField("banco", consolidated.dados_bancarios?.banco, payload.dados_bancarios?.banco),
        agencia: pickTextField("agencia", consolidated.dados_bancarios?.agencia, payload.dados_bancarios?.agencia),
        conta: pickTextField("conta", consolidated.dados_bancarios?.conta, payload.dados_bancarios?.conta),
      },
      notas_fiscais: mergeNotas(consolidated.notas_fiscais, payload.notas_fiscais),
      retencoes_tributarias: mergeRetencoes(consolidated.retencoes_tributarias, payload.retencoes_tributarias),
      empenhos: uniqueStrings([...(consolidated.empenhos ?? []), ...(payload.empenhos ?? [])]),
    };
  }

  const hasBank = consolidated.dados_bancarios && Object.values(consolidated.dados_bancarios).some((value) => cleanString(value));
  return {
    ...consolidated,
    dados_bancarios: hasBank ? consolidated.dados_bancarios : null,
  };
}

export function buildUpdatePayload(processo: ProcessRecord, extracted: ExtractionPayload, status: ProcessStatus = "success") {
  const existingDados = processo.dados_completos && typeof processo.dados_completos === "object" && !Array.isArray(processo.dados_completos)
    ? processo.dados_completos as Record<string, unknown>
    : {};

  const processoNumero = pickTextField("num_processo", extracted.num_processo, processo.num_processo ?? existingDados.processo_numero);
  const beneficiario = pickTextField("beneficiario", extracted.beneficiario, processo.beneficiario ?? existingDados.beneficiario);
  const cpfCnpj = pickTextField("cpf_cnpj", extracted.cpf_cnpj, processo.cpf_cnpj ?? existingDados.cpf_cnpj);
  const valNf = pickTextField("val_nf", extracted.val_nf, existingDados.val_nf);
  const contratoNumero = pickTextField("contrato_numero", extracted.contrato_numero, processo.contrato ?? existingDados.contrato_numero);
  const assunto = pickTextField("assunto", extracted.assunto, processo.assunto ?? existingDados.assunto);
  const existingNotas = normalizeInvoiceList(existingDados.notas_fiscais);

  return {
    status,
    num_processo: processoNumero,
    dados_completos: {
      ...existingDados,
      processo_numero: processoNumero,
      beneficiario,
      cpf_cnpj: cpfCnpj,
      val_nf: valNf,
      contrato_numero: contratoNumero,
      assunto,
      dados_bancarios: extracted.dados_bancarios ?? existingDados.dados_bancarios ?? null,
      notas_fiscais: mergeNotas(existingNotas, extracted.notas_fiscais),
      retencoes_tributarias: extracted.retencoes_tributarias ?? existingDados.retencoes_tributarias ?? null,
      empenhos: extracted.empenhos.length ? extracted.empenhos : existingDados.empenhos ?? [],
    },
    beneficiario,
    cpf_cnpj: cpfCnpj,
    contrato: contratoNumero,
    assunto,
    updated_at: new Date().toISOString(),
  };
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export function getUserTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  const forwardedUserJwt = req.headers.get("x-user-jwt");
  return cleanString(forwardedUserJwt) ?? (authHeader?.startsWith("Bearer ") ? authHeader.replace(/^Bearer\s+/i, "") : null);
}

export async function authenticateUserFromToken(token: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    throw new Error(userError?.message ?? "invalid user token");
  }
  return userData.user;
}

export function assertInternalWorkerRequest(req: Request) {
  const workerSecret = req.headers.get("x-worker-secret");
  if (!workerSecret || workerSecret !== PROCESS_PDF_WORKER_SECRET) {
    throw new Error("Unauthorized worker request.");
  }
}

export async function fetchProcessRecord(tenantId: string, suapId: string) {
  const { data: processo, error: processoError } = await supabase
    .from("processos")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("suap_id", suapId)
    .single();

  if (processoError || !processo) {
    throw new Error("Processo not found");
  }
  return processo as ProcessRecord;
}

export type EnqueueJobOptions = {
  inputStrategy?: InputStrategy;
  inputDocumentIds?: string[];
  stageMetrics?: Record<string, unknown>;
};

export async function enqueueJob(
  tenantId: string,
  suapId: string,
  contextText: string | null,
  options: EnqueueJobOptions = {},
) {
  const { data, error } = await supabase.rpc("enqueue_process_extraction_job", {
    p_tenant_id: tenantId,
    p_suap_id: suapId,
    p_context_text: contextText,
    p_provider_order: ["gemini", "openai", "openrouter"],
    p_input_strategy: options.inputStrategy ?? "full",
    p_input_document_ids: options.inputDocumentIds ?? [],
    p_stage_metrics: options.stageMetrics ?? {},
  });
  if (error || !data) throw new Error(error?.message ?? "Failed to enqueue extraction job.");
  return (Array.isArray(data) ? data[0] : data) as ExtractionJobRow;
}

export async function claimJob(jobId: string) {
  const { data, error } = await supabase.rpc("claim_process_extraction_job", {
    p_job_id: jobId,
    p_lease_seconds: WORKER_LEASE_SECONDS,
    p_max_attempts: MAX_JOB_ATTEMPTS,
  });
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : [];
  return rows[0] as ExtractionJobRow | undefined;
}

export async function updateJob(jobId: string, patch: Partial<ExtractionJobRow>) {
  const { error } = await supabase
    .from("process_extraction_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) throw new Error(error.message);
}

export async function updateExtractionRun(runId: string | null, patch: Record<string, unknown>) {
  if (!runId) return;
  const { error } = await supabase
    .from("process_extraction_runs")
    .update(patch)
    .eq("id", runId);
  if (error) throw new Error(error.message);
}

export async function fetchJob(jobId: string) {
  const { data, error } = await supabase
    .from("process_extraction_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Job not found");
  return data as ExtractionJobRow;
}

export async function updateProcessStatus(tenantId: string, suapId: string, status: ProcessStatus) {
  const { error } = await supabase
    .from("processos")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("suap_id", suapId);
  if (error) throw new Error(error.message);
}

export async function updateChunk(jobId: string, chunkIndex: number, patch: Record<string, unknown>) {
  const { error } = await supabase
    .from("process_extraction_job_chunks")
    .upsert({
      job_id: jobId,
      chunk_index: chunkIndex,
      updated_at: new Date().toISOString(),
      ...patch,
    }, {
      onConflict: "job_id,chunk_index",
    });
  if (error) throw new Error(error.message);
}

export async function initializeChunkRows(jobId: string, chunks: ChunkDescriptor[]) {
  if (chunks.length === 0) return;
  const rows = chunks.map((chunk) => ({
    job_id: jobId,
    chunk_index: chunk.chunkIndex,
    page_start: chunk.pageStart,
    page_end: chunk.pageEnd,
    status: "queued",
    attempt_count: 0,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("process_extraction_job_chunks")
    .upsert(rows, { onConflict: "job_id,chunk_index" });
  if (error) throw new Error(error.message);
}

export async function downloadPdfBytes(storagePath: string) {
  console.time("[process-pdf-worker] downloadPdf");
  try {
    const { data: pdfData, error: pdfError } = await supabase.storage.from("suap-pdfs").download(storagePath);
    if (pdfError || !pdfData) throw new Error("PDF not found");
    const arrayBuffer = await pdfData.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } finally {
    console.timeEnd("[process-pdf-worker] downloadPdf");
  }
}

export function detectErrorCode(input: { error?: unknown; validation?: ExtractionValidation | null }): string {
  if (input.validation?.reason === "html_contamination") return "html_contamination";
  if (input.validation?.reason === "schema_invalid") return "schema_invalid";
  const error = input.error;
  if (!(error instanceof Error)) return "unknown";
  const message = error.message.toLowerCase();
  if (message.includes("timeout") || error.name === "AbortError") return "provider_timeout";
  if (message.includes("429")) return "provider_rate_limit";
  if (message.includes("worker_limit")) return "worker_limit";
  if (message.includes("provider unavailable")) return "provider_timeout";
  return "unknown";
}

export function isRetryableErrorCode(code: string): boolean {
  return code === "worker_limit"
    || code === "provider_timeout"
    || code === "provider_rate_limit"
    || code === "unknown";
}

export async function triggerWorker(jobId: string) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/process-pdf-worker`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "x-worker-secret": PROCESS_PDF_WORKER_SECRET,
    },
    body: JSON.stringify({ job_id: jobId }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to trigger process-pdf-worker: ${response.status} ${text}`);
  }
}
