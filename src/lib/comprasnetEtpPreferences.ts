import { comprasnetEtpQuestions } from '@/lib/comprasnetEtpQuestionnaire';

export const COMPRASNET_ETP_PREFERENCES_VERSION = 1;
export const COMPRASNET_ETP_PREFERENCES_STORAGE_KEY = 'siages-comprasnet-etp-generation-preferences-v1';

export const comprasnetEtpLengthOptions = ['curto', 'padrao', 'detalhado'] as const;
export const comprasnetEtpFormatOptions = ['corrido', 'corrido_topicos', 'topicos'] as const;
export const comprasnetEtpEmphasisOptions = ['tecnica', 'economica', 'operacional', 'sustentabilidade', 'competitividade'] as const;
export const comprasnetEtpSourceOptions = ['processo', 'anexos', 'conteudo_atual'] as const;
export const comprasnetEtpExistingTextOptions = ['complementar', 'melhorar', 'reescrever'] as const;

export type ComprasnetEtpLength = (typeof comprasnetEtpLengthOptions)[number];
export type ComprasnetEtpFormat = (typeof comprasnetEtpFormatOptions)[number];
export type ComprasnetEtpEmphasis = (typeof comprasnetEtpEmphasisOptions)[number];
export type ComprasnetEtpSource = (typeof comprasnetEtpSourceOptions)[number];
export type ComprasnetEtpExistingTextMode = (typeof comprasnetEtpExistingTextOptions)[number];

export const comprasnetEtpSectionChecklists: Record<string, string[]> = {
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

export type ComprasnetEtpSectionPreferences = {
  checklist: string[];
};

export type ComprasnetEtpGenerationPreferences = {
  version: number;
  length: ComprasnetEtpLength;
  paragraphCount: number;
  itemCount: number;
  format: ComprasnetEtpFormat;
  emphases: ComprasnetEtpEmphasis[];
  sources: ComprasnetEtpSource[];
  existingTextMode: ComprasnetEtpExistingTextMode;
  sectionOverrides: Record<string, ComprasnetEtpSectionPreferences>;
};

const asAllowed = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : fallback;

const asAllowedList = <T extends string>(value: unknown, allowed: readonly T[], fallback: T[]) => {
  if (!Array.isArray(value)) return fallback;
  const values = [...new Set(value.filter((item): item is T => typeof item === 'string' && (allowed as readonly string[]).includes(item)))];
  return values.length ? values : fallback;
};

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, Math.round(numeric))) : fallback;
};

export const defaultComprasnetEtpGenerationPreferences: ComprasnetEtpGenerationPreferences = {
  version: COMPRASNET_ETP_PREFERENCES_VERSION,
  length: 'padrao',
  paragraphCount: 3,
  itemCount: 5,
  format: 'corrido',
  emphases: ['tecnica', 'operacional'],
  sources: ['processo', 'anexos', 'conteudo_atual'],
  existingTextMode: 'complementar',
  sectionOverrides: {},
};

export function normalizeComprasnetEtpGenerationPreferences(value: unknown): ComprasnetEtpGenerationPreferences {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawOverrides = input.sectionOverrides && typeof input.sectionOverrides === 'object'
    ? input.sectionOverrides as Record<string, unknown> : {};
  const sectionOverrides = Object.fromEntries(
    comprasnetEtpQuestions.map((question) => {
      const raw = rawOverrides[question.id];
      if (!raw || typeof raw !== 'object') return null;
      const allowed = comprasnetEtpSectionChecklists[question.id] || [];
      const checklist = asAllowedList((raw as Record<string, unknown>).checklist, allowed, []);
      return checklist.length ? [question.id, { checklist }] : null;
    }).filter((entry): entry is [string, ComprasnetEtpSectionPreferences] => Boolean(entry)),
  );

  return {
    version: COMPRASNET_ETP_PREFERENCES_VERSION,
    length: asAllowed(input.length, comprasnetEtpLengthOptions, defaultComprasnetEtpGenerationPreferences.length),
    paragraphCount: clamp(input.paragraphCount, 1, 8, defaultComprasnetEtpGenerationPreferences.paragraphCount),
    itemCount: clamp(input.itemCount, 3, 12, defaultComprasnetEtpGenerationPreferences.itemCount),
    format: asAllowed(input.format, comprasnetEtpFormatOptions, defaultComprasnetEtpGenerationPreferences.format),
    emphases: asAllowedList(input.emphases, comprasnetEtpEmphasisOptions, defaultComprasnetEtpGenerationPreferences.emphases),
    sources: asAllowedList(input.sources, comprasnetEtpSourceOptions, defaultComprasnetEtpGenerationPreferences.sources),
    existingTextMode: asAllowed(input.existingTextMode, comprasnetEtpExistingTextOptions, defaultComprasnetEtpGenerationPreferences.existingTextMode),
    sectionOverrides,
  };
}
