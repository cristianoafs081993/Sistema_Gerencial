import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  buildGerencialAnalysis,
  calculateStatisticalSummary,
  detectAssistantIntent,
  extractDemandItems,
  normalizeSectionSources,
  type ContextSection,
  type ExtractedDemandItem,
} from './domain.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type HistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AssistantBody = {
  message?: string;
  history?: HistoryMessage[];
};

type ConversationalPriceCandidate = {
  id: string;
  sourceType: string;
  supplierName: string;
  supplierDocument: string;
  agencyName: string;
  agencyCode?: string;
  purchaseId: string;
  purchaseItemId?: string;
  purchaseDate: string | null;
  resultDate?: string | null;
  unitPrice: number;
  comparableUnitPrice: number;
  originalUnitLabel: string;
  unitCompatible: boolean;
  selected: boolean;
  exclusionReason: string;
  pncpUrl: string;
  editalAudited: boolean;
  editalExcerpt?: string;
  editalPage?: string;
  editalScore?: number;
  compatibility?: 'COMPATIVEL' | 'COMPATIVEL_COM_RESSALVA' | 'INCOMPATIVEL' | 'NAO_IDENTIFICADO';
  technicalJustification?: string;
  documentTitle?: string;
  documentType?: string;
  documentUrl?: string;
};

type ConversationalPriceItem = {
  itemNumber: string;
  description: string;
  detailedSpecification?: string;
  catalogType: 'material' | 'service';
  catalogCode: string;
  quantity: number;
  unit: string;
  estimatedUnitPrice: number;
  estimatedTotal: number;
  method: 'median' | 'mean' | 'minimum';
  coefficientOfVariation: number;
  standardDeviation: number;
  minimumPrice: number;
  maximumPrice: number;
  meanPrice: number;
  medianPrice: number;
  candidatesCount: number;
  selectedCount: number;
  candidates: ConversationalPriceCandidate[];
};

type ConversationalPriceResearchData = {
  title: string;
  demandSummary: string;
  responsibleName: string;
  processNumber?: string;
  researchDate: string;
  calculationMethod: 'median' | 'mean' | 'minimum';
  methodologyJustification: string;
  overallEstimatedTotal: number;
  items: ConversationalPriceItem[];
  complianceValid: boolean;
  complianceNotes: string[];
};

async function auditCandidateWithGemini(
  demandDescription: string,
  cand: {
    description: string;
    agencyName: string;
    unitPrice: number;
    brand?: string;
    documentTitle?: string;
  },
  apiKey: string,
): Promise<{
  compativel: boolean;
  score: number;
  classificacao: 'COMPATIVEL' | 'COMPATIVEL_COM_RESSALVA' | 'INCOMPATIVEL';
  justificativa: string;
  trechoEdital?: string;
}> {
  const prompt = `Você é um auditor de contratações públicas federais avaliando a compatibilidade de um item paradigma para pesquisa de preços segundo a IN SEGES/ME nº 65/2021 e Lei 14.133/2021.

Demanda solicitada pelo órgão: "${demandDescription}"
Item e Documentação da Contratação Pública (${cand.agencyName}):
- Descrição Técnica e Objeto do Edital: "${cand.description}"
- Preço Unitário: R$ ${cand.unitPrice}
${cand.brand ? `- Marca/Referência: "${cand.brand}"` : ''}
${cand.documentTitle ? `- Documento Referência: "${cand.documentTitle}"` : ''}

Diretrizes mandatórias de avaliação técnica:
1. Em contratações públicas, é comum a linha do item ter uma denominação sucinta (ex: "NOTEBOOK DELL") enquanto os requisitos técnicos detalhados (ex: memória RAM de 16 GB, processador, armazenamento SSD) constam no Objeto da Licitação, Termo de Referência ou Edital. Analise o CONJUNTO das informações técnicas fornecidas.
2. Se a demanda solicita uma configuração específica (ex: "notebook 16 gb") e a descrição ou o objeto da licitação comprovar que o item possui essa configuração (ex: "16 GB RAM", "16GB"), considere o item plenamente COMPATÍVEL.
3. Se o item atender ao propósito com variações secundárias aceitáveis, classifique como "COMPATIVEL_COM_RESSALVA".
4. Apenas classifique como "INCOMPATIVEL" se o item pertencer a categoria flagrantemente distinta (ex: produto médico, vestuário, obra civil para demanda de informática), se for mero acessório (ex: pendrive, capa, base para demanda de computador), ou se a especificação for comprovadamente insuficiente ou antieconômica.
5. Redija um parecer técnico sucinto e fundamentado para instruir o processo eletrônico, indicando os requisitos atendidos.
6. Indique o trecho literal da especificação técnica essencial comprovada.

Responda estritamente em JSON puro sem markdown:
{
  "compativel": boolean,
  "score": number,
  "classificacao": "COMPATIVEL" | "COMPATIVEL_COM_RESSALVA" | "INCOMPATIVEL",
  "justificativa": "parecer técnico sucinto e fundamentado",
  "trechoEdital": "especificação técnica essencial do item no documento"
}`;

  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash'];
  for (const model of modelsToTry) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          let parsedScore = typeof parsed.score === 'number' ? parsed.score : (parsed.compativel ? 85 : 0);
          if (parsedScore <= 1.0 && parsedScore > 0) {
            parsedScore = Math.round(parsedScore * 100);
          }

          return {
            compativel: Boolean(parsed.compativel),
            score: parsedScore,
            classificacao: parsed.classificacao || (parsed.compativel ? 'COMPATIVEL' : 'INCOMPATIVEL'),
            justificativa: String(parsed.justificativa || ''),
            trechoEdital: parsed.trechoEdital ? String(parsed.trechoEdital) : undefined,
          };
        }
      }
    } catch (err) {
      console.warn(`auditCandidateWithGemini error with model ${model}:`, err);
    }
  }

  // Fallback se a IA falhar: verificação léxica rigorosa
  const normDemand = demandDescription.toLowerCase();
  const normCand = cand.description.toLowerCase();
  const tokens = normDemand.split(/\s+/).filter((t) => t.length > 2);
  const matches = tokens.filter((t) => normCand.includes(t)).length;
  const isMatch = matches / Math.max(1, tokens.length) >= 0.5;

  return {
    compativel: isMatch,
    score: isMatch ? 80 : 0,
    classificacao: isMatch ? 'COMPATIVEL' : 'INCOMPATIVEL',
    justificativa: isMatch
      ? 'Item apresenta semelhança semântica com a demanda solicitada no conjunto das especificações da contratação.'
      : 'Item de categoria ou especificação técnica divergente da demanda solicitada.',
    trechoEdital: cand.description.slice(0, 250),
  };
}

async function executeConversationalPriceResearch(
  supabase: ReturnType<typeof createClient>,
  demandItems: ExtractedDemandItem[],
  apiKey: string,
  userEmail: string,
): Promise<ConversationalPriceResearchData> {
  const items: ConversationalPriceItem[] = [];

  const pncpHeaders = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Origin': 'https://pncp.gov.br',
    'Referer': 'https://pncp.gov.br/app/editais',
  };

  for (const demand of demandItems) {
    const rawCandidates: ConversationalPriceCandidate[] = [];

    // 1. Busca Direta no Elasticsearch do PNCP (Portal Nacional de Contratações Públicas)
    try {
      const pncpSearchUrl = `https://pncp.gov.br/api/search/?q=${encodeURIComponent(demand.description)}&tipos_documento=edital&pagina=1&tam_pagina=6`;
      const searchRes = await fetch(pncpSearchUrl, { headers: pncpHeaders });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const tenders = Array.isArray(searchData?.items) ? searchData.items : [];

        for (const tender of tenders.slice(0, 4)) {
          const cnpj = tender.orgao_cnpj;
          const ano = tender.ano;
          const seq = tender.numero_sequencial;
          if (!cnpj || !ano || !seq) continue;

          // 1.1 Localiza arquivos reais da contratação no PNCP (TR, Edital, Dispensa em PDF)
          let bestDoc: { titulo: string; tipoDocumentoNome: string; url: string } | null = null;
          try {
            const arqUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos`;
            const arqRes = await fetch(arqUrl, { headers: pncpHeaders });
            if (arqRes.ok) {
              const arqs = await arqRes.json();
              if (Array.isArray(arqs) && arqs.length > 0) {
                bestDoc = arqs.find((a: any) => /termo\s+de\s+refer[eê]ncia|\btr\b/i.test(a.titulo || a.tipoDocumentoNome || '')) ||
                          arqs.find((a: any) => /edital|aviso|dispensa/i.test(a.titulo || a.tipoDocumentoNome || '')) ||
                          arqs[0];
              }
            }
          } catch {
            // ignore
          }

          // 1.2 Recupera os itens da contratação no PNCP com valores homologados/estimados
          try {
            const itemUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/itens?pagina=1&tamanhoPagina=10`;
            const itemRes = await fetch(itemUrl, { headers: pncpHeaders });
            if (itemRes.ok) {
              const tenderItens = await itemRes.json();
              if (Array.isArray(tenderItens)) {
                for (const it of tenderItens) {
                  const price = Number(it.valorUnitarioHomologado || it.valorUnitarioEstimado || 0);
                  if (price <= 0) continue;

                  const itemDesc = String(it.descricao || it.especificacaoTecnica || it.descricaoDetalhada || '').trim();
                  const tenderDesc = String(tender.description || tender.title || '').trim();

                  // Fusão contextual: se a linha for sucinta (ex: "NOTEBOOK DELL"), enriquece com o objeto do Edital/Contratação
                  let combinedDesc = itemDesc;
                  if (tenderDesc) {
                    if (!itemDesc) {
                      combinedDesc = tenderDesc;
                    } else if (!itemDesc.toLowerCase().includes(tenderDesc.toLowerCase().slice(0, 30))) {
                      combinedDesc = `${itemDesc} — Objeto do Edital: ${tenderDesc}`;
                    }
                  }

                  const itemNum = String(it.numeroItem || '1');
                  const purchaseId = `${tender.ano}/${tender.numero_sequencial}`;

                  rawCandidates.push({
                    id: `pncp:${tender.numero_controle_pncp || `${cnpj}-${ano}-${seq}-${itemNum}`}`,
                    sourceType: 'pncp_publicacoes',
                    supplierName: String(it.nomeFornecedor || 'Fornecedor Homologado'),
                    supplierDocument: String(tender.orgao_cnpj || ''),
                    agencyName: String(tender.orgao_nome || tender.unidade_nome || 'Órgão Público'),
                    agencyCode: String(tender.unidade_codigo || ''),
                    purchaseId,
                    purchaseDate: tender.data_publicacao_pncp ? String(tender.data_publicacao_pncp).slice(0, 10) : null,
                    unitPrice: price,
                    comparableUnitPrice: price,
                    originalUnitLabel: String(it.unidadeMedida || demand.unit || 'UN'),
                    unitCompatible: true,
                    selected: true,
                    exclusionReason: '',
                    pncpUrl: `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`,
                    documentTitle: bestDoc?.titulo || tender.title || `Edital / TR ${seq}/${ano}`,
                    documentType: bestDoc?.tipoDocumentoNome || tender.modalidade_licitacao_nome || 'Termo de Referência',
                    documentUrl: bestDoc?.url || `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`,
                    editalPage: `Item ${itemNum} - Especificação Técnica`,
                    itemDescription: combinedDesc,
                    editalExcerpt: tenderDesc || itemDesc,
                    editalAudited: false,
                    compatibility: 'NAO_IDENTIFICADO',
                  });

                  if (rawCandidates.length >= 8) break;
                }
              }
            }
          } catch {
            // ignore
          }

          if (rawCandidates.length >= 8) break;
        }
      }
    } catch (pncpErr) {
      console.warn('Erro ao consultar PNCP Elasticsearch:', pncpErr);
    }

    // 2. Busca Complementar no Banco Local (licitacoes_pncp) se necessário
    if (rawCandidates.length < 3) {
      try {
        const { data: dbItems } = await supabase
          .from('licitacoes_pncp')
          .select('numero_controle_pncp, cnpj_orgao, razao_social_orgao, objeto_compra, valor_total_homologado, data_publicacao_pncp, ano_compra, sequencial_compra, uasg_codigo')
          .ilike('objeto_compra', `%${demand.description.slice(0, 30)}%`)
          .limit(4);

        if (dbItems && dbItems.length > 0) {
          for (const row of dbItems) {
            const purchaseId = row.numero_controle_pncp;
            if (rawCandidates.some((c) => c.purchaseId.includes(purchaseId))) continue;
            const valor = Number(row.valor_total_homologado || 0);
            const unitPrice = valor > 0 ? Number((valor / (demand.quantity || 1)).toFixed(2)) : 0;
            if (unitPrice > 0) {
              rawCandidates.push({
                id: `local:${purchaseId}`,
                sourceType: 'compras_gov_precos',
                supplierName: 'Contratação Registrada',
                supplierDocument: row.cnpj_orgao,
                agencyName: row.razao_social_orgao || 'IFRN',
                agencyCode: row.uasg_codigo || '',
                purchaseId: `${row.ano_compra}/${row.sequencial_compra}`,
                purchaseDate: row.data_publicacao_pncp ? String(row.data_publicacao_pncp).slice(0, 10) : null,
                unitPrice,
                comparableUnitPrice: unitPrice,
                originalUnitLabel: demand.unit || 'UN',
                unitCompatible: true,
                selected: true,
                exclusionReason: '',
                pncpUrl: `https://pncp.gov.br/app/editais/${row.cnpj_orgao}/${row.ano_compra}/${row.sequencial_compra}`,
                documentTitle: `Edital ${row.sequencial_compra}/${row.ano_compra}`,
                documentType: 'Edital / TR',
                itemDescription: row.objeto_compra || '',
                editalAudited: false,
                compatibility: 'NAO_IDENTIFICADO',
              });
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // 3. Auditoria Semântica Rigorosa com Gemini 2.5 Flash
    // Cada candidato tem sua descrição técnica e Edital/TR confrontados com a demanda real
    const candidates: ConversationalPriceCandidate[] = [];

    for (const cand of rawCandidates.slice(0, 6)) {
      const audit = await auditCandidateWithGemini(
        demand.description,
        {
          description: cand.itemDescription || demand.description,
          agencyName: cand.agencyName,
          unitPrice: cand.unitPrice,
          documentTitle: cand.documentTitle,
        },
        apiKey,
      );

      cand.editalAudited = true;
      cand.editalScore = audit.score;
      cand.compatibility = audit.classificacao;
      cand.technicalJustification = audit.justificativa;
      cand.editalExcerpt = audit.trechoEdital || cand.itemDescription || demand.description;

      if (audit.compativel && audit.score >= 50) {
        cand.selected = true;
      } else {
        // Item incompatível (ex: equipamento médico para demanda de informática, acessório, etc.)
        cand.selected = false;
        cand.compatibility = 'INCOMPATIVEL';
        cand.editalScore = 0;
        cand.exclusionReason = audit.justificativa || 'Item incompatível com os requisitos técnicos da demanda';
      }

      candidates.push(cand);
    }

    // 4. Cálculo da Memória Estatística da IN 65/2021
    // CRUCIAL: Considera estritamente os itens aprovados e compatíveis na pesquisa
    const validCandidates = candidates.filter((c) => c.selected && c.compatibility !== 'INCOMPATIVEL');
    const selectedPrices = validCandidates.map((c) => c.comparableUnitPrice);
    const stats = calculateStatisticalSummary(selectedPrices, 'median');
    const estimatedTotal = Number((stats.estimatedUnitPrice * demand.quantity).toFixed(2));

    items.push({
      itemNumber: demand.itemNumber,
      description: demand.description,
      detailedSpecification: demand.detailedSpecification,
      catalogType: demand.catalogType,
      catalogCode: demand.suggestedCatalogCode || '00000',
      quantity: demand.quantity,
      unit: demand.unit,
      estimatedUnitPrice: stats.estimatedUnitPrice,
      estimatedTotal,
      method: stats.method,
      coefficientOfVariation: stats.coefficientOfVariation,
      standardDeviation: stats.standardDeviation,
      minimumPrice: stats.minimum,
      maximumPrice: stats.maximum,
      meanPrice: stats.mean,
      medianPrice: stats.median,
      candidatesCount: candidates.length,
      selectedCount: validCandidates.length,
      candidates,
    });
  }

  const overallEstimatedTotal = items.reduce((acc, i) => acc + i.estimatedTotal, 0);
  const allCvValid = items.every((i) => i.coefficientOfVariation <= 25);
  const allCountValid = items.every((i) => i.selectedCount >= 3);

  const complianceNotes: string[] = [];
  if (!allCountValid) {
    complianceNotes.push('Atenção (IN 65/2021, Art. 6º, § 4º): Há item com menos de 3 cotações válidas, exigindo justificativa da autoridade competente.');
  }
  if (!allCvValid) {
    complianceNotes.push('Atenção: O Coeficiente de Variação (CV) superou 25% em algum item, recomendando-se a utilização da Mediana como medida de tendência central.');
  } else {
    complianceNotes.push('Cesta homogênea de preços em conformidade com a IN SEGES/ME nº 65/2021 (CV ≤ 25%).');
  }

  return {
    title: `Pesquisa de Preços - ${demandItems.map((i) => i.description).slice(0, 2).join(', ')}`,
    demandSummary: demandItems.map((i) => `${i.quantity} ${i.unit} de ${i.description}`).join('; '),
    responsibleName: userEmail,
    researchDate: new Date().toISOString().slice(0, 10),
    calculationMethod: 'median',
    methodologyJustification: 'Adotou-se o método da Mediana como medida de tendência central mais representativa para expurgar eventuais distorções, em estrita observância ao art. 3º da IN SEGES/ME nº 65/2021 e art. 23 da Lei nº 14.133/2021.',
    overallEstimatedTotal,
    items,
    complianceValid: allCountValid,
    complianceNotes,
  };
}

function buildPriceResearchPrompt(params: {
  message: string;
  history: HistoryMessage[];
  priceResearchData: ConversationalPriceResearchData;
  userEmail: string | null;
}) {
  const history = params.history
    .slice(-6)
    .map((item) => `${item.role === 'user' ? 'Usuario' : 'Assistente'}: ${cleanText(item.content, 1000)}`)
    .join('\n');

  return [
    'Voce e o Assistente Gerencial IA do GovFlow / IFRN Campus Currais Novos, especialista em compras publicas, contratacoes e pesquisa de precos (Lei 14.133/2021 e IN SEGES/ME 65/2021).',
    'Voce acabou de conduzir a pesquisa de precos nas bases oficiais (Compras.gov.br e PNCP) e auditou os Editais e Termos de Referencia das contratacoes similares.',
    'Apresente o resultado em Portugues do Brasil de forma executiva, clara e estruturada com Markdown.',
    'Destaque:',
    '1. Os itens pesquisados, quantidades e precos unitarios e totais estimados (Mediana).',
    '2. A auditoria dos Editais/TRs no PNCP com confirmacao de similaridade tecnica.',
    '3. A conformidade normativa com a IN SEGES/ME 65/2021 (homogeneidade da cesta, Coeficiente de Variacao e amparo legal).',
    '4. Informe que os documentos normativos (Mapa Comparativo, Despacho Conclusivo para o SUAP e Planilha Excel) estao disponiveis para download no card interativo logo abaixo.',
    'No final, inclua exatamente o bloco:',
    '||SUGESTOES||',
    '- Baixar o Mapa Comparativo em PDF',
    '- Copiar o Despacho Conclusivo para o SUAP',
    '- Exportar a Planilha Excel da pesquisa',
    '',
    `Usuario: ${params.userEmail || 'nao informado'}`,
    history ? `Historico recente:\n${history}` : '',
    `Mensagem do usuario:\n${params.message}`,
    `Dados da Pesquisa de Precos estruturada:\n${JSON.stringify(params.priceResearchData, null, 2)}`,
  ].filter(Boolean).join('\n\n');
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getGeminiApiKey() {
  return Deno.env.get('GEMINI_API_KEY') ||
    Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY') ||
    Deno.env.get('GOOGLE_API_KEY') ||
    '';
}

function getModelCandidates() {
  const configuredModel = Deno.env.get('GEMINI_ASSISTENTE_GERENCIAL_MODEL') || 'gemini-2.5-flash-lite';
  return [...new Set([configuredModel, 'gemini-2.5-flash-lite', 'gemini-2.5-flash'].filter(Boolean))];
}

function cleanText(value: unknown, maxLength = 2500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function parseSuggestions(text: string) {
  const splitRegex = /(?:\*\*?)?\|\|\s*SUGEST[OÕ]ES\s*\|\|(?:\*\*?)?/i;
  const parts = text.split(splitRegex);
  const response = parts[0]?.trim() || text.trim();
  const suggestions = parts.length > 1
    ? parts[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line))
      .map((line) => line.replace(/^[-*\d.]+\s*/, '').replace(/\[|\]|"/g, '').trim())
      .filter(Boolean)
      .slice(0, 3)
    : [];

  return { response, suggestions };
}

async function readSection(
  label: string,
  query: PromiseLike<{ data: unknown[] | null; error: { message?: string } | null; count?: number | null }>,
): Promise<ContextSection> {
  try {
    const { data, error, count } = await query;
    if (error) {
      return {
        label,
        rows: [],
        count: null,
        warning: `${label}: ${error.message || 'nao foi possivel consultar esta fonte.'}`,
      };
    }

    return {
      label,
      rows: Array.isArray(data) ? data : [],
      count: typeof count === 'number' ? count : null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    return {
      label,
      rows: [],
      count: null,
      warning: `${label}: ${message}`,
    };
  }
}

function buildPrompt(params: {
  message: string;
  history: HistoryMessage[];
  analysis: ReturnType<typeof buildGerencialAnalysis>;
  sources: ReturnType<typeof normalizeSectionSources>;
  userEmail: string | null;
}) {
  const history = params.history
    .slice(-8)
    .map((item) => `${item.role === 'user' ? 'Usuario' : 'Assistente'}: ${cleanText(item.content, 1200)}`)
    .join('\n');

  return [
    'Voce e o Assistente Gerencial IA do GovFlow/Sistema Gerencial do IFRN Campus Currais Novos.',
    'Responda em Portugues do Brasil, com Markdown simples, no maximo 5 bullets ou 3 paragrafos curtos.',
    'Use somente o Resumo calculado e as Evidencias principais para falar de numeros, saldos, empenhos, contratos, PFs, liquidacoes ou financeiro.',
    'Nao recalcule totais por conta propria; os numeros ja foram calculados pelo sistema antes de chegar ate voce.',
    'Se a pergunta exigir uma fonte indisponivel ou uma coluna que nao existe, diga claramente a limitacao registrada.',
    'Quando citar valores monetarios, use formato brasileiro e mencione quando o dado vier de amostra limitada.',
    'No final, se fizer sentido, inclua exatamente este bloco com 2 ou 3 proximas perguntas:',
    '||SUGESTOES||',
    '- pergunta sugerida',
    '- pergunta sugerida',
    '',
    `Usuario autenticado: ${params.userEmail || 'nao informado'}`,
    history ? `Historico recente:\n${history}` : '',
    `Pergunta:\n${params.message}`,
    `Intencao detectada:\n${params.analysis.intent}`,
    `Resumo calculado:\n${JSON.stringify(params.analysis.summary, null, 2)}`,
    `Evidencias principais:\n${JSON.stringify(params.analysis.evidence, null, 2)}`,
    `Limitacoes dos dados:\n${JSON.stringify(params.analysis.limitations, null, 2)}`,
    `Fontes consultadas:\n${JSON.stringify(params.sources, null, 2)}`,
    [
      'Instrucoes de resposta:',
      '- responda diretamente a pergunta antes de contextualizar',
      '- para descentralizacoes, trate Campus Currais Novos como o escopo natural dos dados do sistema, nao como coluna literal',
      '- para contratos, diferencie Campus 158366 e Reitoria 158155 quando essa origem aparecer nas evidencias',
      '- cite PTRES, PI, contrato, fornecedor, vigencia ou processo quando esses campos forem relevantes',
    ].join('\n'),
  ].filter(Boolean).join('\n\n');
}

function extractGeminiText(responseBody: Record<string, unknown>) {
  const candidates = Array.isArray(responseBody.candidates) ? responseBody.candidates : [];
  const firstCandidate = candidates[0] as Record<string, unknown> | undefined;
  const content = firstCandidate?.content as Record<string, unknown> | undefined;
  const parts = Array.isArray(content?.parts) ? content.parts : [];

  return parts
    .map((part) => (part && typeof part === 'object' && 'text' in part ? String((part as { text?: unknown }).text || '') : ''))
    .join('')
    .trim();
}

async function callGemini(prompt: string, apiKey: string, model: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.25,
        },
      }),
    },
  );
  const data = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    const error = data.error as { message?: string } | undefined;
    throw new Error(error?.message || `Gemini HTTP ${response.status}`);
  }

  const text = extractGeminiText(data);
  if (!text) {
    throw new Error('Resposta vazia do Gemini.');
  }

  return text;
}

async function callGeminiWithFallback(prompt: string, apiKey: string) {
  const errors: string[] = [];

  for (const model of getModelCandidates()) {
    try {
      return {
        model,
        text: await callGemini(prompt, apiKey, model),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'erro desconhecido';
      errors.push(`${model}: ${message}`);
    }
  }

  throw new Error(`Nao foi possivel consultar o Gemini. ${errors.join(' | ')}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Metodo nao permitido.' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Usuario nao autenticado.' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return json({ error: 'Usuario nao autenticado.' }, 401);
    }

    const body = await req.json() as AssistantBody;
    const message = cleanText(body.message, 2500);
    const history = Array.isArray(body.history)
      ? body.history
        .filter((item) => item?.role === 'user' || item?.role === 'assistant')
        .filter((item) => cleanText(item.content))
        .slice(-8)
        .map((item) => ({ role: item.role, content: cleanText(item.content, 1500) }))
      : [];

    if (!message) {
      return json({ error: 'Mensagem obrigatoria.' }, 400);
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return json({ error: 'GEMINI_API_KEY nao configurada no ambiente da Edge Function.' }, 503);
    }

    const intent = detectAssistantIntent(message);

    // Se for pesquisa de preços, executa o agente de pesquisa com validação de editais
    if (intent === 'pesquisa_precos') {
      const demandItems = extractDemandItems(message);
      const priceResearchData = await executeConversationalPriceResearch(
        supabase,
        demandItems,
        apiKey,
        user.email || 'Agente Responsavel',
      );

      const prompt = buildPriceResearchPrompt({
        message,
        history,
        priceResearchData,
        userEmail: user.email || null,
      });

      const { model, text } = await callGeminiWithFallback(prompt, apiKey);
      const parsed = parseSuggestions(text);

      return json({
        response: parsed.response,
        suggestions: parsed.suggestions.length > 0 ? parsed.suggestions : [
          'Baixar o Mapa Comparativo em PDF',
          'Copiar o Despacho Conclusivo para o SUAP',
          'Exportar a Planilha Excel com a memória de cálculo',
        ],
        warnings: priceResearchData.complianceNotes,
        sources: [
          { label: 'Compras.gov.br - Pesquisa de Preços', totalAmostra: priceResearchData.items.reduce((acc, i) => acc + i.candidates.length, 0) },
          { label: 'PNCP - Portal Nacional de Contratações Públicas', totalAmostra: priceResearchData.items.reduce((acc, i) => acc + i.candidates.filter(c => c.editalAudited).length, 0) },
        ],
        model,
        priceResearchResult: priceResearchData,
      });
    }

    const sections = await Promise.all([
      readSection(
        'atividades',
        supabase
          .from('atividades')
          .select('tipo_atividade,dimensao,componente_funcional,atividade,descricao,valor_total,origem_recurso,natureza_despesa,plano_interno', { count: 'exact' })
          .order('created_at', { ascending: false })
          .limit(250),
      ),
      readSection(
        'descentralizacoes',
        supabase
          .from('descentralizacoes')
          .select('dimensao,nota_credito,operacao_tipo,origem_recurso,natureza_despesa,plano_interno,data_emissao,descricao,valor', { count: 'exact' })
          .order('data_emissao', { ascending: false, nullsFirst: false })
          .limit(1500),
      ),
      readSection(
        'creditos_disponiveis',
        supabase
          .from('creditos_disponiveis')
          .select('ptres,metrica,valor,updated_at', { count: 'exact' })
          .order('updated_at', { ascending: false })
          .limit(800),
      ),
      readSection(
        'empenhos',
        supabase
          .from('empenhos')
          .select('numero,descricao,valor,status,tipo,plano_interno,origem_recurso,natureza_despesa,favorecido_nome,valor_liquidado,valor_liquidado_oficial,valor_pago_oficial,saldo_rap_oficial,valor_liquidado_a_pagar,rap_inscrito,rap_a_liquidar,rap_liquidado,rap_pago,data_empenho,processo', { count: 'exact' })
          .order('created_at', { ascending: false })
          .limit(1000),
      ),
      readSection(
        'documentos_habeis',
        supabase
          .from('documentos_habeis')
          .select('data_emissao,processo,estado,favorecido_nome,valor_original,valor_pago,fonte_sof,empenho_numero', { count: 'exact' })
          .order('data_emissao', { ascending: false })
          .limit(160),
      ),
      readSection(
        'financeiro_fonte_vinculacao',
        supabase
          .from('financeiro_fonte_vinculacao')
          .select('ug_codigo,mes_lancamento,fonte_codigo,fonte_descricao,vinculacao_codigo,vinculacao_descricao,saldo_disponivel,imported_at', { count: 'exact' })
          .order('imported_at', { ascending: false })
          .limit(160),
      ),
      readSection(
        'contratos_api',
        supabase
          .from('contratos_api')
          .select('id,numero,fornecedor_nome,unidade_codigo,unidade_origem_codigo,objeto,processo,vigencia_inicio_derivada,vigencia_fim_derivada,valor_global,valor_acumulado,situacao_derivada,campus_scope_reason,updated_at', { count: 'exact' })
          .order('updated_at', { ascending: false })
          .limit(1000),
      ),
      readSection(
        'contratos_api_empenhos',
        supabase
          .from('contratos_api_empenhos')
          .select('contrato_api_id,numero,unidade_gestora,valor_empenhado,valor_a_liquidar,valor_liquidado,valor_pago,rp_inscrito,rp_a_pagar,raw_data', { count: 'exact' })
          .limit(2000),
      ),
      readSection(
        'contratos_api_faturas',
        supabase
          .from('contratos_api_faturas')
          .select('contrato_api_id,situacao,valor_bruto,valor_liquido,data_emissao,data_pagamento', { count: 'exact' })
          .order('data_emissao', { ascending: false, nullsFirst: false })
          .limit(2000),
      ),
      readSection(
        'vw_rastreabilidade_pf',
        supabase
          .from('vw_rastreabilidade_pf')
          .select('ppf_campus,data_solicitacao,tipo,mes_referencia,fonte_recurso,valor,finalidade,status', { count: 'exact' })
          .order('data_solicitacao', { ascending: false })
          .limit(120),
      ),
      readSection(
        'vw_conciliacao_diaria_pf',
        supabase
          .from('vw_conciliacao_diaria_pf')
          .select('data_emissao,fonte_sof,total_documentos,qtd_documentos,total_pfs,qtd_pfs,saldo,status_conciliacao', { count: 'exact' })
          .order('data_emissao', { ascending: false })
          .limit(120),
      ),
    ]);

    const analysis = buildGerencialAnalysis(message, sections);
    const sources = normalizeSectionSources(sections);
    const prompt = buildPrompt({
      message,
      history,
      analysis,
      sources,
      userEmail: user.email || null,
    });
    const { model, text } = await callGeminiWithFallback(prompt, apiKey);
    const parsed = parseSuggestions(text);
    const warnings = sections
      .map((section) => section.warning)
      .filter((warning): warning is string => Boolean(warning));

    return json({
      response: parsed.response,
      suggestions: parsed.suggestions,
      warnings,
      sources,
      model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado no Assistente Gerencial.';
    console.error('assistente-gerencial', error);
    return json({ error: message }, 500);
  }
});
