import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type RiskMapRequest = {
  processo?: Record<string, unknown> | null;
  manualObject?: string;
  etpContextSnippets?: Array<{
    label?: string;
    excerpt?: string;
    sourceType?: string;
    sourceLabel?: string;
  }>;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match?.[0] || '{}';
}

function normalizeChoice(value: unknown, allowed: string[], fallback: string) {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback;
}

function normalizeRisks(value: unknown) {
  const list = Array.isArray(value) ? value : [];
  return list.slice(0, 12).map((item) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      phase: typeof record.phase === 'string' ? record.phase : 'Planejamento',
      risk: typeof record.risk === 'string' ? record.risk : 'Risco a revisar',
      cause: typeof record.cause === 'string' ? record.cause : '[CAMPO PENDENTE]',
      damage: typeof record.damage === 'string' ? record.damage : '[CAMPO PENDENTE]',
      probability: normalizeChoice(record.probability, ['Baixa', 'Media', 'Alta'], 'Media'),
      impact: normalizeChoice(record.impact, ['Baixo', 'Medio', 'Alto'], 'Medio'),
      level: normalizeChoice(record.level, ['Baixo', 'Medio', 'Alto', 'Critico'], 'Medio'),
      preventiveAction: typeof record.preventiveAction === 'string' ? record.preventiveAction : '[CAMPO PENDENTE]',
      contingencyAction: typeof record.contingencyAction === 'string' ? record.contingencyAction : '[CAMPO PENDENTE]',
      owner: typeof record.owner === 'string' ? record.owner : 'Equipe de planejamento',
    };
  });
}

function buildHtml(risks: ReturnType<typeof normalizeRisks>, request: RiskMapRequest) {
  const processo = request.processo || {};
  const processoLabel = typeof processo.numProcesso === 'string'
    ? processo.numProcesso
    : typeof processo.suapId === 'string'
      ? processo.suapId
      : '';
  const object = typeof processo.assunto === 'string' && processo.assunto.trim()
    ? processo.assunto
    : request.manualObject || 'Contratacao publica';
  const rows = risks.map((risk, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(risk.phase)}</td>
      <td>${escapeHtml(risk.risk)}</td>
      <td>${escapeHtml(risk.cause)}</td>
      <td>${escapeHtml(risk.damage)}</td>
      <td>${escapeHtml(risk.probability)}</td>
      <td>${escapeHtml(risk.impact)}</td>
      <td>${escapeHtml(risk.level)}</td>
      <td>${escapeHtml(risk.preventiveAction)}</td>
      <td>${escapeHtml(risk.contingencyAction)}</td>
      <td>${escapeHtml(risk.owner)}</td>
    </tr>`).join('');

  return `
    <h1>Mapa de Risco da Licitacao</h1>
    ${processoLabel ? `<p><strong>Processo:</strong> ${escapeHtml(processoLabel)}</p>` : ''}
    <p><strong>Objeto:</strong> ${escapeHtml(object)}</p>
    <h2>1. Identificacao e contexto</h2>
    <p>Mapa elaborado a partir do ETP revisado, com foco em riscos de planejamento, selecao do fornecedor e gestao contratual.</p>
    <h2>2. Matriz de riscos</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Fase</th>
          <th>Risco</th>
          <th>Causa</th>
          <th>Dano</th>
          <th>Probabilidade</th>
          <th>Impacto</th>
          <th>Nivel</th>
          <th>Acao preventiva</th>
          <th>Acao de contingencia</th>
          <th>Responsavel</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <h2>3. Monitoramento</h2>
    <p>[CAMPO PENDENTE] Registrar periodicidade de revisao e evidencias de acompanhamento dos riscos.</p>
  `;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const request = await req.json() as RiskMapRequest;
    const apiKey =
      Deno.env.get('GEMINI_API_KEY') ||
      Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY') ||
      Deno.env.get('GOOGLE_API_KEY');

    if (!apiKey) {
      return jsonResponse({ error: 'GEMINI_API_KEY nao configurado.' }, 500);
    }

    const model = Deno.env.get('GEMINI_RISK_MAP_MODEL') || 'gemini-2.5-flash-lite';
    const snippets = (request.etpContextSnippets || [])
      .slice(0, 14)
      .map((snippet, index) => `Trecho ${index + 1} - ${snippet.label || snippet.sourceLabel || 'ETP'}:\n${snippet.excerpt || ''}`)
      .join('\n\n');

    const prompt = [
      'Gere um mapa de riscos para contratacao publica brasileira com base no ETP revisado.',
      'Use linguagem objetiva, sem inventar dados concretos ausentes.',
      'Responda somente JSON valido, sem markdown.',
      'Formato exato:',
      '{"status":"generated","title":"Mapa de Risco da Licitacao","subtitle":"...","warnings":["..."],"risks":[{"phase":"Planejamento|Selecao do fornecedor|Gestao contratual","risk":"...","cause":"...","damage":"...","probability":"Baixa|Media|Alta","impact":"Baixo|Medio|Alto","level":"Baixo|Medio|Alto|Critico","preventiveAction":"...","contingencyAction":"...","owner":"..."}]}',
      '',
      `Processo/objeto: ${JSON.stringify({ processo: request.processo || null, manualObject: request.manualObject || null }, null, 2)}`,
      '',
      `ETP revisado:\n${snippets || 'Sem trechos estruturados.'}`,
    ].join('\n');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.25,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return jsonResponse({ error: `Gemini retornou erro: ${errorText}` }, 500);
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(extractJsonObject(text));
    const risks = normalizeRisks(parsed.risks);
    const html = buildHtml(risks, request);

    return jsonResponse({
      status: 'generated',
      title: typeof parsed.title === 'string' ? parsed.title : 'Mapa de Risco da Licitacao',
      subtitle: typeof parsed.subtitle === 'string' ? parsed.subtitle : undefined,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter((item: unknown) => typeof item === 'string') : [],
      risks,
      html,
      model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado ao gerar Mapa de Risco.';
    return jsonResponse({ error: message }, 500);
  }
});
