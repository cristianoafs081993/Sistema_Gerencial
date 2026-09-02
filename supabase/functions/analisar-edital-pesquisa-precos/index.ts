import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DemandItem = {
  description: string;
  detailedSpecification?: string;
  unit?: string;
  quantity?: number;
};

type CandidateInput = {
  id?: string;
  purchaseId?: string;
  purchaseItemId?: string;
  cnpj?: string;
  ano?: string | number;
  sequencial?: string | number;
  uasg?: string;
  numeroCompra?: string;
  description?: string;
  detailedDescription?: string;
  brand?: string;
  unitPrice?: number;
  supplierName?: string;
  supplierDocument?: string;
};

type RequestBody = {
  demand: DemandItem;
  candidate: CandidateInput;
  pncpControlNumber?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  return value;
}

function getGeminiApiKey() {
  return Deno.env.get("GEMINI_API_KEY") ||
    Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") ||
    Deno.env.get("GOOGLE_API_KEY") ||
    "";
}

function parsePurchaseDigits(value: string | undefined | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 15) {
    return {
      uasg: digits.slice(0, 6),
      number: digits.slice(6, 11).replace(/^0+/, "") || digits.slice(6, 11),
      year: digits.slice(11, 15),
    };
  }
  if (digits.length >= 17) {
    return {
      uasg: digits.slice(0, 6),
      number: digits.slice(8, 13).replace(/^0+/, "") || digits.slice(8, 13),
      year: digits.slice(13, 17),
    };
  }
  return null;
}

type PncpPurchaseCoordinates = {
  cnpj: string;
  ano: number;
  sequencial: number;
  controlNumber: string;
};

async function resolveCoordinates(
  supabase: ReturnType<typeof createClient>,
  candidate: CandidateInput,
  pncpControlNumber?: string,
): Promise<PncpPurchaseCoordinates | null> {
  // 1. Direct control number match
  const rawCtrl = pncpControlNumber || "";
  const matchCtrl = rawCtrl.match(/^(\d{14})-1-(\d+)\/(\d{4})/);
  if (matchCtrl) {
    return {
      cnpj: matchCtrl[1],
      sequencial: parseInt(matchCtrl[2], 10),
      ano: parseInt(matchCtrl[3], 10),
      controlNumber: rawCtrl,
    };
  }

  // 2. Candidate purchaseId may be a control number
  const purchaseIdCtrl = String(candidate.purchaseId || "").match(/^(\d{14})-1-(\d+)\/(\d{4})/);
  if (purchaseIdCtrl) {
    return {
      cnpj: purchaseIdCtrl[1],
      sequencial: parseInt(purchaseIdCtrl[2], 10),
      ano: parseInt(purchaseIdCtrl[3], 10),
      controlNumber: candidate.purchaseId!,
    };
  }

  // 3. Resolve by UASG + Compra / Ano via local DB cache
  const parsed = parsePurchaseDigits(candidate.purchaseId) || {
    uasg: candidate.uasg,
    number: candidate.numeroCompra,
    year: candidate.ano ? String(candidate.ano) : undefined,
  };

  if (parsed.uasg && parsed.number) {
    const cleanNum = String(parsed.number).replace(/^0+/, "");
    const { data: dbRows } = await supabase
      .from("licitacoes_pncp")
      .select("numero_controle_pncp, cnpj_orgao, ano_compra, sequencial_compra, numero_compra")
      .eq("uasg_codigo", parsed.uasg);

    if (dbRows && dbRows.length > 0) {
      for (const row of dbRows) {
        const rowClean = String(row.numero_compra || "").split("/")[0].replace(/^0+/, "");
        if (rowClean === cleanNum && (!parsed.year || String(row.ano_compra) === String(parsed.year))) {
          return {
            cnpj: row.cnpj_orgao,
            ano: Number(row.ano_compra),
            sequencial: Number(row.sequencial_compra),
            controlNumber: row.numero_controle_pncp,
          };
        }
      }
    }

    // 4. Query PNCP Public API by UASG / CNPJ
    try {
      const pncpSearchUrl = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?codigoModalidadeContratacao=6&pagina=1&tamanhoPagina=10&objeto=${encodeURIComponent(parsed.uasg)}`;
      const resp = await fetch(pncpSearchUrl, { headers: { Accept: "application/json" } });
      if (resp.ok) {
        const json = await resp.json();
        const items = Array.isArray(json?.data) ? json.data : [];
        for (const item of items) {
          const itemNum = String(item.numeroCompra || "").split("/")[0].replace(/^0+/, "");
          if (itemNum === cleanNum && item.cnpjOrgao && item.anoCompra && item.sequencialCompra) {
            return {
              cnpj: item.cnpjOrgao,
              ano: Number(item.anoCompra),
              sequencial: Number(item.sequencialCompra),
              controlNumber: item.numeroControlePNCP || `${item.cnpjOrgao}-1-${item.sequencialCompra}/${item.anoCompra}`,
            };
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

type PncpArquivo = {
  sequencialDocumento: number;
  tipoDocumentoId?: number;
  tipoDocumentoNome?: string;
  titulo?: string;
  url?: string;
  uri?: string;
  status?: string;
};

async function fetchPncpArquivos(coords: PncpPurchaseCoordinates): Promise<PncpArquivo[]> {
  const url = `https://pncp.gov.br/api/pncp/v1/orgaos/${coords.cnpj}/compras/${coords.ano}/${coords.sequencial}/arquivos`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

function selectBestDocument(arquivos: PncpArquivo[]): PncpArquivo | null {
  if (!arquivos.length) return null;

  // Priority ranking
  const getRank = (arq: PncpArquivo) => {
    const name = `${arq.tipoDocumentoNome || ""} ${arq.titulo || ""}`.toLowerCase();
    if (name.includes("termo de refer") || name.includes(" tr ") || name.includes("tr.")) return 1;
    if (name.includes("projeto b") || name.includes(" pb ")) return 2;
    if (name.includes("edital")) return 3;
    if (name.includes("aviso")) return 4;
    if (name.includes("ata")) return 5;
    return 10;
  };

  const sorted = [...arquivos].sort((a, b) => getRank(a) - getRank(b));
  return sorted[0] || null;
}

async function downloadDocumentBuffer(
  coords: PncpPurchaseCoordinates,
  arquivo: PncpArquivo,
): Promise<{ buffer: Uint8Array; mimeType: string } | null> {
  // First try direct URL if present
  if (arquivo.url && arquivo.url.startsWith("http")) {
    try {
      const resp = await fetch(arquivo.url);
      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        const mime = resp.headers.get("content-type") || "application/pdf";
        return { buffer: new Uint8Array(arrayBuf), mimeType: mime };
      }
    } catch {
      // fallback
    }
  }

  // Next try PNCP download endpoint
  const downloadUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${coords.cnpj}/compras/${coords.ano}/${coords.sequencial}/arquivos/${arquivo.sequencialDocumento}/documento`;
  try {
    const resp = await fetch(downloadUrl);
    if (resp.ok) {
      const arrayBuf = await resp.arrayBuffer();
      const mime = resp.headers.get("content-type") || "application/pdf";
      return { buffer: new Uint8Array(arrayBuf), mimeType: mime };
    }
  } catch {
    // fallback
  }

  return null;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function analyzeWithGemini(
  demand: DemandItem,
  candidate: CandidateInput,
  documentInfo: { title: string; type: string; url: string },
  pdfBase64: string,
) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Chave GEMINI_API_KEY nao configurada no backend.");
  }

  const model = Deno.env.get("GEMINI_PRICE_RESEARCH_MODEL") || "gemini-2.5-flash";

  const prompt = `Voce e um especialista auditor de compras publicas e pesquisa de precos (Lei 14.133/2021 e IN SEGES/ME 65/2021).
Sua missao e examinar o documento anexo (Edital / Termo de Referencia / Projeto Basico de uma contratacao publica) e confrontar com a Demanda do orgao contratante para verificar se o item cotado atende com precisao as especificacoes exigidas.

DEMANDA DO ORGAO CONTRATANTE:
- Descricao do Item: ${demand.description}
- Especificacao Detalhada: ${demand.detailedSpecification || "Conforme descricao padrao"}
- Quantidade: ${demand.quantity || 1}
- Unidade: ${demand.unit || "UN"}

DADOS DO CANDIDATO / ITEM PARADIGMA:
- Item: ${candidate.description || ""}
- Detalhes adicionais: ${candidate.detailedDescription || ""}
- Marca cotada/homologada: ${candidate.brand || "Nao especificada"}
- Preco Unitario: R$ ${candidate.unitPrice || 0}
- Fornecedor: ${candidate.supplierName || ""} (${candidate.supplierDocument || ""})
- Documento Auditado: ${documentInfo.type} - ${documentInfo.title}

INSTRUCOES MANDATORIAS:
1. Localize no documento o item ou lote correspondente a esta cotacao.
2. Extraia o trecho literal exato do Edital/TR com a descricao e especificacoes do item (maximo 500 caracteres).
3. Indique a pagina, secao ou item onde a especificacao foi encontrada (ex: "Pagina 14, Item 3.1" ou "Anexo I, Termo de Referencia, Tabela 2").
4. Avalie a aderencia tecnica em uma nota de 0 a 100:
   - 85 a 100: COMPATIVEL (atende plenamente ou com pequenas vantagens tecnicas compativeis)
   - 60 a 84: COMPATIVEL_COM_RESSALVA (especificacao equivalente com pequenas divergencias nao impeditivas)
   - 0 a 59: INCOMPATIVEL (potencia diferente, dimensoes incompativeis, modelo restritivo ou material divergente)
5. Elabore uma justificativa tecnica formal de 2 a 4 linhas fundamentando a similaridade ou divergencia para instruir o processo de pesquisa de precos.
6. Valide a equivalencia da unidade de fornecimento (ex: pacote, caixa, unidade).

Retorne EXCLUSIVAMENTE um JSON valido no seguinte formato:
{
  "technicalScore": 95,
  "compatibility": "COMPATIVEL",
  "documentPage": "Pagina X, Secao Y",
  "extractedExcerpt": "texto literal extraido do edital/TR...",
  "justification": "O item do Termo de Referencia atende com precisao aos requisitos exigidos...",
  "unitMatchNotes": "Unidade compativel (Unidade)."
}`;

  const requestPayload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  };

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestPayload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText.slice(0, 300)}`);
  }

  const json = await response.json();
  const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("Gemini nao retornou texto na resposta.");

  const parsed = JSON.parse(rawText);
  return {
    technicalScore: Math.max(0, Math.min(100, Number(parsed.technicalScore || 70))),
    compatibility: ["COMPATIVEL", "COMPATIVEL_COM_RESSALVA", "INCOMPATIVEL", "NAO_IDENTIFICADO"].includes(parsed.compatibility)
      ? parsed.compatibility
      : (parsed.technicalScore >= 85 ? "COMPATIVEL" : "COMPATIVEL_COM_RESSALVA"),
    documentPage: String(parsed.documentPage || "Pagina nao identificada").slice(0, 100),
    extractedExcerpt: String(parsed.extractedExcerpt || "").slice(0, 800),
    justification: String(parsed.justification || "Item analisado com base no Termo de Referencia da contratacao.").slice(0, 1000),
    unitMatchNotes: String(parsed.unitMatchNotes || "Unidade compativel.").slice(0, 200),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo nao permitido." }, 405);
  }

  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = (await req.json()) as RequestBody;
    if (!body?.demand?.description || !body?.candidate) {
      return jsonResponse({ error: "Demand e candidate sao obrigatorios." }, 400);
    }

    const { demand, candidate, pncpControlNumber } = body;

    // 1. Resolve PNCP purchase coordinates
    const coords = await resolveCoordinates(supabase, candidate, pncpControlNumber);
    if (!coords) {
      return jsonResponse({
        success: true,
        editalEvidence: {
          analyzed: false,
          status: "not_found",
          technicalScore: 70,
          compatibility: "NAO_IDENTIFICADO",
          justification: "Contratacao publica nao localizada no repositorio PNCP para download automatico do Edital.",
          analyzedAt: new Date().toISOString(),
        },
      });
    }

    // 2. Query available files
    const arquivos = await fetchPncpArquivos(coords);
    const bestDoc = selectBestDocument(arquivos);

    if (!bestDoc) {
      return jsonResponse({
        success: true,
        editalEvidence: {
          analyzed: false,
          status: "not_found",
          documentUrl: `https://pncp.gov.br/app/editais/${coords.cnpj}/${coords.ano}/${coords.sequencial}`,
          technicalScore: 70,
          compatibility: "NAO_IDENTIFICADO",
          justification: "Nenhum arquivo de Edital ou Termo de Referencia anexado no PNCP para esta contratacao.",
          analyzedAt: new Date().toISOString(),
        },
      });
    }

    const docType = bestDoc.tipoDocumentoNome || "Termo de Referência";
    const docTitle = bestDoc.titulo || `Documento ${bestDoc.sequencialDocumento}`;
    const docUrl = bestDoc.url || `https://pncp.gov.br/app/editais/${coords.cnpj}/${coords.ano}/${coords.sequencial}`;

    // 3. Download the PDF
    const downloaded = await downloadDocumentBuffer(coords, bestDoc);
    if (!downloaded || downloaded.buffer.byteLength === 0) {
      return jsonResponse({
        success: true,
        editalEvidence: {
          analyzed: false,
          status: "warning",
          documentTitle: docTitle,
          documentType: docType,
          documentUrl: docUrl,
          technicalScore: 75,
          compatibility: "COMPATIVEL_COM_RESSALVA",
          justification: "Arquivo de Edital/TR identificado no PNCP, mas o download automatico nao foi concluido pelo servidor de origem.",
          analyzedAt: new Date().toISOString(),
        },
      });
    }

    // Limit PDF payload to 12MB if oversized
    const MAX_PDF_BYTES = 12 * 1024 * 1024;
    const bufferToUse = downloaded.buffer.byteLength > MAX_PDF_BYTES
      ? downloaded.buffer.slice(0, MAX_PDF_BYTES)
      : downloaded.buffer;

    const base64 = uint8ArrayToBase64(bufferToUse);

    // 4. Analyze with Gemini
    const aiResult = await analyzeWithGemini(
      demand,
      candidate,
      { title: docTitle, type: docType, url: docUrl },
      base64,
    );

    return jsonResponse({
      success: true,
      editalEvidence: {
        analyzed: true,
        status: aiResult.compatibility === "INCOMPATIVEL" ? "incompatible" : "success",
        documentTitle: docTitle,
        documentType: docType,
        documentUrl: docUrl,
        documentPage: aiResult.documentPage,
        extractedExcerpt: aiResult.extractedExcerpt,
        technicalScore: aiResult.technicalScore,
        compatibility: aiResult.compatibility,
        justification: aiResult.justification,
        unitMatchNotes: aiResult.unitMatchNotes,
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("analisar-edital-pesquisa-precos error:", error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro inesperado na analise de edital.",
      },
      500,
    );
  }
});
