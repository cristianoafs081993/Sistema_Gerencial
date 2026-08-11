import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  authenticateUserFromToken,
  corsHeaders,
  getUserTokenFromRequest,
  jsonResponse,
} from "../_shared/process_pdf_shared.ts";
import { parseJsonResponse } from "../_shared/json_response.ts";

type ReviewType = "tr" | "etp";
type ReviewProvider = "openai" | "gemini";

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PAGES = 200;
const MODEL = Deno.env.get("GEMINI_SUAP_DOCUMENT_REVIEW_MODEL") ?? "gemini-2.5-flash";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_MODEL = Deno.env.get("OPENAI_SUAP_DOCUMENT_REVIEW_MODEL") ?? "gpt-5.6-luna";
const REVIEW_TIMEOUT_MS = 120000;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const OFFICIAL_SOURCES = [
  {
    title: "Lei nº 14.133/2021",
    reference: "arts. 6º e 18",
    url: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm",
  },
  {
    title: "IN SEGES nº 58/2022",
    reference: "Estudo Técnico Preliminar",
    url: "https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-no-58-de-8-de-agosto-de-2022",
  },
  {
    title: "IN SEGES/ME nº 81/2022",
    reference: "Termo de Referência",
    url: "https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-81-de-25-de-novembro-de-2022",
  },
  {
    title: "Modelos da AGU",
    reference: "Lei nº 14.133/2021",
    url: "https://www.gov.br/agu/pt-br/composicao/cgu/cgu/modelos/licitacoesecontratos/14133/pregao-e-concorrencia",
  },
  {
    title: "Cadernos de Logística oficiais",
    reference: "Portal de Logística Pública",
    url: "https://www.gov.br/compras/pt-br/acesso-a-informacao/perguntas-frequentes/logistica-publica-sustentavel/plano-diretor-de-logistica-sustentavel",
  },
];

const ALLOWED_HOSTS = new Set(["planalto.gov.br", "www.planalto.gov.br", "gov.br", "www.gov.br", "in.gov.br", "www.in.gov.br"]);

function cleanText(value: unknown, maxLength = 4000) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function isOfficialUrl(value: unknown): value is string {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function decodePdf(value: unknown) {
  const input = cleanText(value, MAX_PDF_BYTES * 2).replace(/^data:application\/pdf;base64,/i, "");
  if (!input || !/^[A-Za-z0-9+/]*={0,2}$/.test(input)) throw new Error("pdfBase64 inválido.");
  const binary = atob(input);
  if (binary.length > MAX_PDF_BYTES) throw new Error("O PDF excede o limite de 20 MB para análise.");
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (new TextDecoder().decode(bytes.slice(0, 4)) !== "%PDF") throw new Error("O conteúdo enviado não é um PDF válido.");
  return input;
}

function buildPrompt(documentType: ReviewType, title: string, processNumber: string, pageCount?: number, provider: ReviewProvider = "gemini") {
  const label = documentType === "tr" ? "Termo de Referência" : "Estudo Técnico Preliminar";
  const checklist = documentType === "tr"
    ? "Verifique, conforme aplicável, objeto, natureza, quantitativos, prazo, especificações, entrega/recebimento, garantia, fundamentação, solução e ciclo de vida, requisitos, execução, gestão, medição/pagamento, seleção do fornecedor, estimativa de preços e adequação orçamentária."
    : "Verifique, conforme aplicável, necessidade, previsão no planejamento, requisitos, estimativas de quantidades, levantamento de mercado, solução, quantidades/valores, parcelamento, resultados, providências, contratações correlatas, impactos ambientais e conclusão sobre viabilidade.";
  const onlineInstruction = provider === "gemini"
    ? "Use Google Search apenas para consultar fontes oficiais nos domínios planalto.gov.br, gov.br e in.gov.br."
    : "Considere somente fontes oficiais nos domínios planalto.gov.br, gov.br e in.gov.br.";
  return `Você é um revisor técnico de documentos de contratação pública federal no Brasil. Analise o PDF anexado como ${label}.\n\nDocumento: ${title}\nProcesso: ${processNumber || "não informado"}\nPáginas informadas: ${pageCount || "não informado"}\n\nBase oficial mínima: ${OFFICIAL_SOURCES.map((source) => `${source.title} (${source.url})`).join("; ")}. ${onlineInstruction} Não use bases locais, tabelas internas, memória do sistema ou fontes comerciais.\n\nChecklist principal: ${checklist}\n\nRegras: diferencie ausência comprovada de informação não localizada; considere exceções e justificativas previstas nas normas; não invente fatos, valores, artigos ou fontes; não produza opinião jurídica definitiva; priorize achados verificáveis no PDF; proponha correção apenas quando houver base e evidência; indique página quando possível. Se a evidência for insuficiente, registre isso em limitations e use status insufficient_evidence. Em valores de texto do JSON, escape quebras de linha, tabulações e outros caracteres de controle como \\n, \\t e \\u0000; nunca insira esses caracteres literalmente dentro de uma string.\n\nRetorne exclusivamente JSON válido neste formato: {"documentType":"tr|etp","checkedAt":"ISO-8601","status":"critical|attention|no_major_finding|insufficient_evidence","summary":"...","counts":{"critical":0,"high":0,"medium":0,"low":0},"findings":[{"id":"...","severity":"critical|high|medium|low","category":"...","title":"...","page":1,"excerpt":"...","problem":"...","recommendation":"...","suggestedText":"...","confidence":"high|medium|low","legalBases":[{"title":"...","reference":"...","url":"https://..."}]}],"sources":[{"title":"...","reference":"...","url":"https://..."}],"limitations":["..."]}.`;
}

function extractOpenAiMessage(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const response = value as Record<string, unknown>;
  if (typeof response.output_text === "string" && response.output_text.trim()) return response.output_text.trim();
  const output = Array.isArray(response.output) ? response.output : [];
  return output
    .flatMap((item) => item && typeof item === "object" && Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as Array<Record<string, unknown>>
      : [])
    .filter((part) => part.type === "output_text")
    .map((part) => typeof part.text === "string" ? part.text.trim() : "")
    .filter(Boolean)
    .join("\n");
}

async function requestOpenAi(prompt: string, pdfBase64: string) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada no Supabase.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REVIEW_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [{
          role: "user",
          content: [
            {
              type: "input_file",
              filename: "documento-licitacao.pdf",
              file_data: `data:application/pdf;base64,${pdfBase64}`,
            },
            { type: "input_text", text: prompt },
          ],
        }],
        text: { format: { type: "json_object" } },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = cleanText(payload?.error?.message, 500);
      throw new Error(detail || `OpenAI respondeu HTTP ${response.status}.`);
    }
    const text = extractOpenAiMessage(payload);
    if (!text) throw new Error("OpenAI não retornou uma análise estruturada.");
    return { parsed: parseJsonResponse(text), grounding: [] as unknown[] };
  } finally {
    clearTimeout(timeout);
  }
}
async function requestGemini(prompt: string, pdfBase64: string) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada no Supabase.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inline_data: { mime_type: "application/pdf", data: pdfBase64 } },
          ],
        }],
        tools: [{ google_search: {} }],
        // Gemini 2.5 supports Google Search grounding, but structured output
        // combined with built-in tools is only supported by Gemini 3 models.
        // The prompt still requires JSON and parseJsonResponse validates the response.
        generationConfig: { temperature: 0.1, maxOutputTokens: 12000 },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(cleanText(payload?.error?.message) || `Gemini respondeu HTTP ${response.status}.`);
    const text = payload?.candidates?.flatMap((candidate: any) => candidate?.content?.parts || [])
      .map((part: any) => typeof part?.text === "string" ? part.text : "")
      .join("")
      .trim();
    if (!text) throw new Error("Gemini não retornou uma análise estruturada.");
    return { parsed: parseJsonResponse(text), grounding: payload?.candidates?.flatMap((candidate: any) => candidate?.groundingMetadata?.groundingChunks || []) || [] };
  } finally {
    clearTimeout(timeout);
  }
}

async function requestReview(
  documentType: ReviewType,
  title: string,
  processNumber: string,
  pageCount: number | undefined,
  pdfBase64: string,
) {
  let openAiFailure = "";
  try {
    return await requestOpenAi(buildPrompt(documentType, title, processNumber, pageCount, "openai"), pdfBase64);
  } catch (error) {
    openAiFailure = error instanceof Error ? error.message : String(error);
    console.warn("[analisar-documento-licitacao] OpenAI falhou; Gemini será usado como fallback.", openAiFailure);
  }

  try {
    return await requestGemini(buildPrompt(documentType, title, processNumber, pageCount, "gemini"), pdfBase64);
  } catch (error) {
    const geminiFailure = error instanceof Error ? error.message : String(error);
    throw new Error(`OpenAI falhou: ${openAiFailure.slice(0, 500)}; Gemini fallback falhou: ${geminiFailure.slice(0, 500)}`);
  }
}
function sourceFromValue(value: unknown, checkedAt: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const url = cleanText(source.url || source.uri, 1000);
  if (!isOfficialUrl(url)) return null;
  return { title: cleanText(source.title) || "Fonte oficial", reference: cleanText(source.reference), url, checkedAt };
}

function groundingSources(chunks: unknown[], checkedAt: string) {
  return chunks.map((chunk) => {
    const web = chunk && typeof chunk === "object" ? (chunk as Record<string, unknown>).web : null;
    return sourceFromValue(web, checkedAt);
  }).filter(Boolean);
}

function normalizeReview(raw: unknown, documentType: ReviewType, checkedAt: string, grounding: unknown[]) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const findings = Array.isArray(source.findings) ? source.findings.map((item, index) => normalizeFinding(item, index, checkedAt)).filter(Boolean) : [];
  const counts = {
    critical: findings.filter((item: any) => item.severity === "critical").length,
    high: findings.filter((item: any) => item.severity === "high").length,
    medium: findings.filter((item: any) => item.severity === "medium").length,
    low: findings.filter((item: any) => item.severity === "low").length,
  };
  const sources = dedupeSources([
    ...OFFICIAL_SOURCES.map((item) => ({ ...item, checkedAt })),
    ...((Array.isArray(source.sources) ? source.sources : []).map((item) => sourceFromValue(item, checkedAt)).filter(Boolean)),
    ...groundingSources(grounding, checkedAt),
  ]);
  const status = ["critical", "attention", "no_major_finding", "insufficient_evidence"].includes(String(source.status))
    ? source.status
    : counts.critical > 0 ? "critical" : findings.length ? "attention" : "insufficient_evidence";
  const limitations = Array.isArray(source.limitations) ? source.limitations.map((item) => cleanText(item)).filter(Boolean).slice(0, 20) : [];
  if (!groundingSources(grounding, checkedAt).length) limitations.push("A busca online não retornou citações adicionais; as fontes normativas-base foram exibidas para conferência manual.");
  limitations.push("A revisão usou somente fontes oficiais online e não consultou a base local de normativos.");
  return {
    documentType,
    checkedAt,
    status,
    summary: cleanText(source.summary) || "A análise não retornou um resumo suficiente.",
    counts,
    findings,
    sources,
    limitations: [...new Set(limitations)],
  };
}

function normalizeFinding(value: unknown, index: number, checkedAt: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const severity = ["critical", "high", "medium", "low"].includes(String(source.severity)) ? String(source.severity) : "medium";
  const confidence = ["high", "medium", "low"].includes(String(source.confidence)) ? String(source.confidence) : "medium";
  const title = cleanText(source.title);
  const problem = cleanText(source.problem);
  const recommendation = cleanText(source.recommendation);
  if (!title || !problem || !recommendation) return null;
  return {
    id: cleanText(source.id) || `finding-${index + 1}`,
    severity,
    category: cleanText(source.category) || "Conformidade documental",
    title,
    ...(Number.isInteger(source.page) && Number(source.page) > 0 ? { page: Number(source.page) } : {}),
    excerpt: cleanText(source.excerpt, 1200),
    problem,
    recommendation,
    ...(cleanText(source.suggestedText, 5000) ? { suggestedText: cleanText(source.suggestedText, 5000) } : {}),
    confidence,
    legalBases: Array.isArray(source.legalBases) ? source.legalBases.map((item) => sourceFromValue(item, checkedAt)).filter(Boolean) : [],
  };
}

function dedupeSources(sources: Array<Record<string, string> | null>) {
  const seen = new Set<string>();
  return sources.filter((source): source is Record<string, string> => {
    if (!source || seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const token = getUserTokenFromRequest(req);
    if (!token) return jsonResponse({ error: "Unauthorized: missing user token" }, 401);
    await authenticateUserFromToken(token);
    const body = await req.json();
    const documentType = body?.documentType === "etp" || body?.documentType === "tr" ? body.documentType as ReviewType : null;
    const title = cleanText(body?.documentTitle, 4000);
    const processNumber = cleanText(body?.processNumber, 120);
    const pageCount = Number.isInteger(body?.pageCount) ? Number(body.pageCount) : undefined;
    if (!documentType) return jsonResponse({ error: "documentType must be tr or etp" }, 400);
    if (!title) return jsonResponse({ error: "documentTitle is required" }, 400);
    if (pageCount && (pageCount < 1 || pageCount > MAX_PAGES)) return jsonResponse({ error: "O PDF deve possuir no máximo 200 páginas." }, 413);
    const pdfBase64 = decodePdf(body?.pdfBase64);
    const checkedAt = new Date().toISOString();
    const response = await requestReview(documentType, title, processNumber, pageCount, pdfBase64);
    return jsonResponse(normalizeReview(response.parsed, documentType, checkedAt, response.grounding));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("invalid user token")) return jsonResponse({ error: `Unauthorized: ${message}` }, 401);
    console.error("[analisar-documento-licitacao]", message);
    return jsonResponse({ error: message }, message.includes("limite") || message.includes("inválido") ? 400 : 500);
  }
});
