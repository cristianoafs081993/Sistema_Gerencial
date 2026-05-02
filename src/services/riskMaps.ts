import type { DocumentContextSnippet } from '@/lib/documentContextSnippets';
import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseFunctionErrors';
import { supabase } from '@/lib/supabase';
import type { SuapProcesso } from '@/types';

export type RiskMapDraftRisk = {
  phase: string;
  risk: string;
  cause: string;
  damage: string;
  probability: 'Baixa' | 'Media' | 'Alta';
  impact: 'Baixo' | 'Medio' | 'Alto';
  level: 'Baixo' | 'Medio' | 'Alto' | 'Critico';
  preventiveAction: string;
  contingencyAction: string;
  owner: string;
};

export type RiskMapDraftResult = {
  status: 'generated' | 'blocked';
  title: string;
  subtitle?: string;
  html?: string;
  risks: RiskMapDraftRisk[];
  warnings: string[];
  blockedReason?: string;
  model?: string;
};

export type GenerateRiskMapParams = {
  processo?: SuapProcesso | null;
  manualObject?: string;
  etpContextSnippets?: DocumentContextSnippet[];
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function objectLabel(params: GenerateRiskMapParams) {
  return (
    params.processo?.assunto ||
    params.manualObject ||
    params.etpContextSnippets?.find((snippet) => snippet.excerpt.trim())?.excerpt.slice(0, 180) ||
    'Contratacao publica'
  );
}

export function buildRiskMapHtml(risks: RiskMapDraftRisk[], params: GenerateRiskMapParams) {
  const processoLabel = params.processo?.numProcesso || params.processo?.suapId;
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
    <p><strong>Objeto:</strong> ${escapeHtml(objectLabel(params))}</p>
    <h2>1. Identificacao e contexto</h2>
    <p>Este mapa consolida riscos do planejamento da contratacao a partir do ETP revisado e deve ser atualizado durante a selecao do fornecedor e a gestao contratual.</p>
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
    <h2>3. Revisao</h2>
    <p>[CAMPO PENDENTE] Validar responsaveis, datas de acompanhamento e evidencias de mitigacao antes da instrucao final do processo.</p>
  `;
}

export function buildLocalRiskMapDraft(params: GenerateRiskMapParams): RiskMapDraftResult {
  const object = objectLabel(params);
  const risks: RiskMapDraftRisk[] = [
    {
      phase: 'Planejamento',
      risk: 'Definicao insuficiente da necessidade',
      cause: 'Objeto, quantitativos ou requisitos nao detalhados no ETP.',
      damage: 'Contratacao desalinhada com a demanda publica ou necessidade de retrabalho.',
      probability: 'Media',
      impact: 'Alto',
      level: 'Alto',
      preventiveAction: 'Revisar justificativa, requisitos e estimativas antes da abertura da fase externa.',
      contingencyAction: 'Suspender a instrucao para complementacao tecnica e nova validacao da area demandante.',
      owner: 'Equipe de planejamento',
    },
    {
      phase: 'Selecao do fornecedor',
      risk: 'Restricao indevida de competitividade',
      cause: 'Especificacoes excessivas, criterios pouco objetivos ou pesquisa de mercado limitada.',
      damage: 'Impugnacoes, baixa competitividade ou preco acima do mercado.',
      probability: 'Media',
      impact: 'Alto',
      level: 'Alto',
      preventiveAction: 'Conferir requisitos com justificativas tecnicas e ampliar evidencias da pesquisa de precos.',
      contingencyAction: 'Revisar edital/TR e republicar os itens afetados quando necessario.',
      owner: 'Agente de contratacao',
    },
    {
      phase: 'Gestao contratual',
      risk: 'Falha na fiscalizacao da execucao',
      cause: 'Responsaveis, indicadores ou rotinas de aceite pouco claros.',
      damage: 'Pagamento por entrega inadequada ou interrupcao do servico.',
      probability: 'Media',
      impact: 'Medio',
      level: 'Medio',
      preventiveAction: 'Definir papeis, indicadores, prazos de saneamento e evidencias de aceite no TR.',
      contingencyAction: 'Acionar notificacao formal, glosa, penalidade ou plano de correcao conforme contrato.',
      owner: 'Fiscal e gestor do contrato',
    },
  ];

  return {
    status: 'generated',
    title: 'Mapa de Risco da Licitacao',
    subtitle: params.processo?.numProcesso ? `Processo ${params.processo.numProcesso}` : object,
    html: buildRiskMapHtml(risks, params),
    risks,
    warnings: ['Mapa de Risco gerado localmente. Revise e ajuste os riscos especificos do objeto.'],
    model: 'local-fallback',
  };
}

function normalizeRiskMapResult(value: unknown, params: GenerateRiskMapParams): RiskMapDraftResult {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  if (raw.status === 'blocked') {
    return {
      status: 'blocked',
      title: typeof raw.title === 'string' ? raw.title : 'Mapa de Risco da Licitacao',
      risks: [],
      warnings: Array.isArray(raw.warnings) ? raw.warnings.filter((item): item is string => typeof item === 'string') : [],
      blockedReason: typeof raw.blockedReason === 'string' ? raw.blockedReason : 'Nao foi possivel gerar o Mapa de Risco.',
      model: typeof raw.model === 'string' ? raw.model : undefined,
    };
  }

  const fallback = buildLocalRiskMapDraft(params);
  const risks = Array.isArray(raw.risks) && raw.risks.length > 0
    ? raw.risks.map((item) => item as RiskMapDraftRisk)
    : fallback.risks;

  return {
    status: 'generated',
    title: typeof raw.title === 'string' ? raw.title : fallback.title,
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : fallback.subtitle,
    html: typeof raw.html === 'string' && raw.html.trim() ? raw.html : buildRiskMapHtml(risks, params),
    risks,
    warnings: Array.isArray(raw.warnings) ? raw.warnings.filter((item): item is string => typeof item === 'string') : [],
    model: typeof raw.model === 'string' ? raw.model : undefined,
  };
}

export const riskMapsService = {
  async generateDraft(params: GenerateRiskMapParams): Promise<RiskMapDraftResult> {
    try {
      const { data, error } = await supabase.functions.invoke('gerar-mapa-riscos-licitacao', {
        body: {
          processo: params.processo,
          manualObject: params.manualObject,
          etpContextSnippets: params.etpContextSnippets || [],
        },
      });

      if (error) throw new Error(getSupabaseFunctionErrorMessage(error));
      return normalizeRiskMapResult(data, params);
    } catch (error) {
      console.warn('Falha ao gerar Mapa de Risco pela function. Usando fallback local.', error);
      return buildLocalRiskMapDraft(params);
    }
  },
};
