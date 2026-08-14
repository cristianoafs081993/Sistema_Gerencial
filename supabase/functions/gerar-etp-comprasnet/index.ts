const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EtpQuestion = {
  id: string;
  sectionTitle?: string;
  title: string;
  prompt: string;
  guidance?: string;
  required?: boolean;
};

type EtpAnswer = {
  questionId: string;
  value?: string;
  skipped?: boolean;
  origin?: 'user' | 'ai' | 'system';
};

type ContextSnippet = {
  id: string;
  kind: string;
  label: string;
  pageNumber?: number;
  excerpt: string;
  sourceType?: 'processo' | 'anexo' | 'etp' | 'institucional';
  sourceName?: string;
  sourceLabel?: string;
};

type EtpRequest = {
  manualObject?: string;
  processo?: { id?: string; suapId?: string; numProcesso?: string | null; assunto?: string | null } | null;
  questions?: EtpQuestion[];
  questionnaireAnswers?: EtpAnswer[];
  contextSnippets?: ContextSnippet[];
  analysisWarnings?: string[];
  generationPreferences?: unknown;
};

type EtpSection = { id: string; title: string; html: string };

type GenerationPreferences = {
  version: 1;
  length: 'curto' | 'padrao' | 'detalhado';
  paragraphCount: number;
  itemCount: number;
  format: 'corrido' | 'corrido_topicos' | 'topicos';
  emphases: Array<'tecnica' | 'economica' | 'operacional' | 'sustentabilidade' | 'competitividade'>;
  sources: Array<'processo' | 'anexos' | 'conteudo_atual'>;
  existingTextMode: 'complementar' | 'melhorar' | 'reescrever';
  sectionOverrides: Record<string, { checklist: string[] }>;
};

const SECTION_CHECKLISTS: Record<string, string[]> = {
  necessidade: ['impacto_sem_contratar', 'publico_afetado', 'evidencias_problema'],
  requisitos: ['criterios_tecnicos', 'criterios_operacionais', 'requisitos_legais', 'criterios_aceitacao'],
  mercado: ['alternativas', 'comparacao_tecnico_economica', 'justificativa_escolha'],
  solucao: ['escopo_integrado', 'execucao_vigencia', 'resultados_esperados'],
  quantitativos: ['memoria_calculo', 'metodologia_estimativa', 'restricao_sem_numeros_inventados'],
  estimativa_valor: ['metodologia_pesquisa', 'fontes_consultadas', 'restricao_sem_valores_inventados'],
  parcelamento: ['viabilidade_tecnica', 'viabilidade_economica', 'competitividade'],
  correlatas: ['contratacoes_relacionadas', 'dependencias', 'inexistencia_confirmada'],
  planejamento: ['pca', 'planejamento_institucional', 'alinhamento_estrategico'],
  resultados: ['beneficios_publicos', 'eficiencia', 'indicadores_resultado'],
  providencias: ['equipe_fiscalizacao', 'capacitacao', 'adequacoes_previas'],
  ambiental: ['ciclo_vida', 'residuos_consumo', 'criterios_sustentabilidade'],
  conclusao: ['viabilidade', 'condicionantes', 'pendencias_remanescentes'],
};

const DEFAULT_PREFERENCES: GenerationPreferences = {
  version: 1, length: 'padrao', paragraphCount: 3, itemCount: 5, format: 'corrido',
  emphases: ['tecnica', 'operacional'], sources: ['processo', 'anexos', 'conteudo_atual'],
  existingTextMode: 'complementar', sectionOverrides: {},
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const collapseSpaces = (value?: string | null) => (value || '').replace(/\s+/g, ' ').trim();
const stripJsonFence = (value: string) => value.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();

function normalizePreferences(value: unknown): GenerationPreferences {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const select = <T extends string>(raw: unknown, allowed: readonly T[], fallback: T) => typeof raw === 'string' && allowed.includes(raw as T) ? raw as T : fallback;
  const list = <T extends string>(raw: unknown, allowed: readonly T[], fallback: T[]) => {
    const selected = Array.isArray(raw) ? [...new Set(raw.filter((item): item is T => typeof item === 'string' && allowed.includes(item as T)))] : [];
    return selected.length ? selected : fallback;
  };
  const clamp = (raw: unknown, min: number, max: number, fallback: number) => Number.isFinite(Number(raw)) ? Math.min(max, Math.max(min, Math.round(Number(raw)))) : fallback;
  const rawOverrides = input.sectionOverrides && typeof input.sectionOverrides === 'object' ? input.sectionOverrides as Record<string, unknown> : {};
  const sectionOverrides = Object.fromEntries(Object.entries(SECTION_CHECKLISTS).map(([sectionId, allowed]) => {
    const raw = rawOverrides[sectionId];
    const checklist = raw && typeof raw === 'object' ? list((raw as Record<string, unknown>).checklist, allowed, []) : [];
    return checklist.length ? [sectionId, { checklist }] : null;
  }).filter((entry): entry is [string, { checklist: string[] }] => Boolean(entry)));
  return {
    version: 1,
    length: select(input.length, ['curto', 'padrao', 'detalhado'], DEFAULT_PREFERENCES.length),
    paragraphCount: clamp(input.paragraphCount, 1, 8, DEFAULT_PREFERENCES.paragraphCount),
    itemCount: clamp(input.itemCount, 3, 12, DEFAULT_PREFERENCES.itemCount),
    format: select(input.format, ['corrido', 'corrido_topicos', 'topicos'], DEFAULT_PREFERENCES.format),
    emphases: list(input.emphases, ['tecnica', 'economica', 'operacional', 'sustentabilidade', 'competitividade'], DEFAULT_PREFERENCES.emphases),
    sources: list(input.sources, ['processo', 'anexos', 'conteudo_atual'], DEFAULT_PREFERENCES.sources),
    existingTextMode: select(input.existingTextMode, ['complementar', 'melhorar', 'reescrever'], DEFAULT_PREFERENCES.existingTextMode),
    sectionOverrides,
  };
}

async function requireAuthenticatedUser(request: Request) {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('Sessão do SIAGES ausente.');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('Configuração de autenticação do Supabase ausente.');
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!response.ok) throw new Error('Sessão do SIAGES inválida ou expirada.');
}

function parseGeminiJson(content: string): Record<string, unknown> {
  const stripped = stripJsonFence(content);
  try {
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    const firstBrace = stripped.indexOf('{');
    const lastBrace = stripped.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) return JSON.parse(stripped.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
  }
  throw new Error('A IA retornou JSON inválido ao gerar o ETP do Comprasnet.');
}

function extractGeminiText(body: Record<string, unknown>) {
  const candidate = Array.isArray(body.candidates) && body.candidates[0] && typeof body.candidates[0] === 'object'
    ? body.candidates[0] as Record<string, unknown> : null;
  const content = candidate?.content && typeof candidate.content === 'object' ? candidate.content as Record<string, unknown> : null;
  const part = Array.isArray(content?.parts) && content.parts[0] && typeof content.parts[0] === 'object'
    ? content.parts[0] as Record<string, unknown> : null;
  return typeof part?.text === 'string' ? part.text : '';
}

function getGeminiApiKey() {
  return Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY') || Deno.env.get('GOOGLE_API_KEY') || '';
}

function getModelCandidates() {
  const configured = Deno.env.get('GEMINI_ETP_MODEL') || 'gemini-2.5-flash-lite';
  return [...new Set([configured, 'gemini-2.5-flash-lite', 'gemini-2.5-flash'].filter(Boolean))];
}

function normalizeQuestions(request: EtpRequest) {
  return Array.isArray(request.questions)
    ? request.questions.filter((question) => question?.id && question?.title && question?.prompt).slice(0, 20)
    : [];
}

function answerMap(request: EtpRequest) {
  return new Map((request.questionnaireAnswers || []).map((answer) => [answer.questionId, answer]));
}

function answerValue(answer?: EtpAnswer) {
  return answer?.skipped ? '' : collapseSpaces(answer?.value);
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function fallbackSections(request: EtpRequest, questions: EtpQuestion[]) {
  const answers = answerMap(request);
  return questions.map((question): EtpSection => ({
    id: question.id,
    title: question.title,
    html: `<p>${escapeHtml(answerValue(answers.get(question.id)) || `[CAMPO PENDENTE: ${question.title}]`)}</p>`,
  }));
}

function missingRequiredFields(request: EtpRequest, questions: EtpQuestion[]) {
  const answers = answerMap(request);
  return questions.filter((question) => question.required && !answerValue(answers.get(question.id))).map((question) => question.title);
}

function normalizeSections(raw: unknown, questions: EtpQuestion[]) {
  if (!Array.isArray(raw)) return [];
  const allowed = new Map(questions.map((question) => [question.id, question]));
  return raw.map((item) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    const html = typeof record.html === 'string' ? record.html.trim() : '';
    if (!allowed.has(id) || !title || !html) return null;
    return { id, title, html };
  }).filter((value): value is EtpSection => Boolean(value));
}

function normalizeAiResult(raw: Record<string, unknown>, request: EtpRequest, questions: EtpQuestion[], model?: string) {
  const fallback = fallbackSections(request, questions);
  const sections = normalizeSections(raw.sections, questions);
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim()) : [];
  const answers = answerMap(request);
  return {
    status: 'generated',
    title: 'Estudo Técnico Preliminar',
    subtitle: request.processo?.numProcesso ? `Processo ${request.processo.numProcesso}` : 'Rascunho para revisão',
    sections: sections.length ? sections : fallback,
    warnings: [...new Set([...(request.analysisWarnings || []), ...warnings])],
    missingRequiredFields: missingRequiredFields(request, questions),
    fields: questions.map((question) => {
      const value = answerValue(answers.get(question.id));
      return { key: question.id, label: question.title, value: value || undefined, status: value ? 'confirmed' : 'missing', source: answers.get(question.id)?.origin === 'ai' ? 'IA revisada pelo usuário' : 'contexto do Comprasnet' };
    }),
    model,
  };
}

function buildPrompt(request: EtpRequest, questions: EtpQuestion[]) {
  const preferences = normalizePreferences(request.generationPreferences);
  const useProcess = preferences.sources.includes('processo');
  const useAttachments = preferences.sources.includes('anexos');
  const contextSnippets = (request.contextSnippets || []).filter((snippet) => {
    if (snippet.sourceType === 'institucional' || snippet.kind === 'institucional') return true;
    if (snippet.sourceType === 'anexo') return useAttachments;
    return useProcess;
  });
  const institutional = contextSnippets.filter((snippet) => snippet.sourceType === 'institucional' || snippet.kind === 'institucional');
  const evidence = contextSnippets.filter((snippet) => !institutional.includes(snippet));
  const existingText = preferences.sources.includes('conteudo_atual') ? request.questionnaireAnswers || [] : [];
  return [
    'Você é um assistente especializado em contratações públicas brasileiras.',
    'Gere uma prévia de Estudo Técnico Preliminar geral para preenchimento posterior no Comprasnet, com base na Lei nº 14.133/2021 e na IN SEGES nº 58/2022.',
    'A resposta será revisada por servidor antes de ser aplicada. Escreva em português formal, claro, objetivo e editável.',
    'Não invente números, datas, valores, nomes, locais, quantitativos, fontes ou fatos. Quando faltar informação concreta, use [CAMPO PENDENTE: ...].',
    'Responda somente às seções e perguntas fornecidas. Não gere informações básicas, área requisitante, responsáveis, anexos, categoria ou outros campos estruturados.',
    'Use apenas as fontes permitidas nas preferências. Não transforme anexos em resumo; use-os somente para confirmar dados pontuais.',
    'Quando houver conflito entre fontes, preserve o dado explicitamente informado pelo usuário/processo e registre a necessidade de validação.',
    `Preferências de redação validadas: ${JSON.stringify(preferences)}.`,
    `Respeite o formato ${preferences.format}; use aproximadamente ${preferences.paragraphCount} parágrafo(s) em texto corrido ou ${preferences.itemCount} item(ns) em tópicos, sem alongar texto sem evidência.`,
    `Tratamento do conteúdo existente: ${preferences.existingTextMode}. Se faltar base para melhorar ou reescrever, mantenha a lacuna como [CAMPO PENDENTE: ...].`,
    'Responda apenas JSON válido no formato: {"status":"generated","warnings":["..."],"sections":[{"id":"...","title":"...","html":"<p>...</p>"}]}',
    `Processo: ${JSON.stringify(request.processo || {})}`,
    `Objeto ou contexto informado: ${request.manualObject || ''}`,
    `Perguntas e seções: ${JSON.stringify(questions)}`,
    `Conteúdo textual já existente no ETP: ${JSON.stringify(existingText)}`,
    `Contexto institucional: ${JSON.stringify(institutional)}`,
    `Trechos do processo e anexos auxiliares: ${JSON.stringify(evidence)}`,
  ].join('\n\n');
}

async function callGemini(prompt: string, key: string, model: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.25, responseMimeType: 'application/json' } }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(typeof body?.error?.message === 'string' ? body.error.message : 'O Gemini recusou a geração do ETP.');
  const text = extractGeminiText(body as Record<string, unknown>);
  if (!text) throw new Error('A resposta do Gemini veio vazia.');
  return text;
}

async function callGeminiWithFallback(prompt: string, key: string, models: string[]) {
  const errors: string[] = [];
  for (const model of models) {
    try { return { content: await callGemini(prompt, key, model), model }; }
    catch (error) { errors.push(`${model}: ${error instanceof Error ? error.message : 'falha desconhecida'}`); }
  }
  throw new Error(`Não foi possível gerar o ETP com os modelos configurados. ${errors.join(' | ')}`);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    await requireAuthenticatedUser(request);
    const body = await request.json() as EtpRequest;
    const questions = normalizeQuestions(body);
    if (!questions.length) return jsonResponse({ status: 'blocked', title: 'Estudo Técnico Preliminar', warnings: [], missingRequiredFields: [], fields: [], blockedReason: 'As seções textuais do ETP não foram enviadas.' });

    const key = getGeminiApiKey();
    if (!key) return jsonResponse(normalizeAiResult({}, body, questions, 'fallback-local'));
    const result = await callGeminiWithFallback(buildPrompt(body, questions), key, getModelCandidates());
    return jsonResponse(normalizeAiResult(parseGeminiJson(result.content), body, questions, result.model));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado ao gerar o ETP do Comprasnet.';
    console.error('gerar-etp-comprasnet', error);
    return jsonResponse({ error: message }, /Sessão do SIAGES/.test(message) ? 401 : 500);
  }
});
