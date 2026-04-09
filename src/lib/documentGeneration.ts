import { supabase } from '@/lib/supabase';
import { fetchSupabaseRestRows } from '@/lib/supabaseRest';
import { formatCurrency, formatDocumentoId, formatarDocumento, parseCurrency } from '@/lib/utils';
import type {
  Contrato,
  ContratoEmpenho,
  DocumentoDespesa,
  Empenho,
  SuapDadosCompletos,
  SuapProcesso,
} from '@/types';

export type SupportedDocumentType = 'despacho-liquidacao';
export type IntentLookupType = 'processo' | 'cpf' | 'cnpj';
export type ContextFieldStatus = 'confirmed' | 'inferred' | 'missing';
export type ContextFieldKey =
  | 'documento'
  | 'processo'
  | 'favorecido'
  | 'documentoFavorecido'
  | 'contrato'
  | 'empenho'
  | 'valor'
  | 'objeto'
  | 'edital'
  | 'projeto';

type DocumentoRow = Pick<
  DocumentoDespesa,
  | 'id'
  | 'valor_original'
  | 'valor_pago'
  | 'estado'
  | 'processo'
  | 'favorecido_nome'
  | 'favorecido_documento'
  | 'data_emissao'
  | 'fonte_sof'
  | 'empenho_id'
>;

type SuapProcessoLite = Pick<
  SuapProcesso,
  'id' | 'suapId' | 'status' | 'numProcesso' | 'beneficiario' | 'cpfCnpj' | 'assunto' | 'contrato' | 'dadosCompletos'
>;

type SuapProcessoLiteRow = {
  id: string;
  suap_id: string;
  status: string;
  num_processo?: string | null;
  beneficiario?: string | null;
  cpf_cnpj?: string | null;
  assunto?: string | null;
  contrato?: string | null;
  dados_completos?: SuapDadosCompletos | null;
};

type ContratoApiLite = {
  id: string;
  numero: string;
  fornecedor_nome: string | null;
  fornecedor_documento: string | null;
  objeto: string | null;
  processo: string | null;
  valor_global: number | null;
  valor_acumulado: number | null;
};

type ContratoApiEmpenhoLite = {
  contrato_api_id: string;
  numero: string;
  valor_empenhado: number | null;
  valor_a_liquidar: number | null;
  valor_liquidado: number | null;
  valor_pago: number | null;
};

export type DocumentIntent = {
  documentType: SupportedDocumentType;
  lookupType: IntentLookupType;
  lookupValue: string;
  rawPrompt: string;
};

export type ParseIntentResult =
  | { ok: true; intent: DocumentIntent }
  | { ok: false; error: string };

export type DocumentFieldState = {
  key: ContextFieldKey;
  label: string;
  value?: string;
  source: string;
  status: ContextFieldStatus;
};

export type ResolvedDocumentContext = {
  documentType: SupportedDocumentType;
  candidateId: string;
  title: string;
  subtitle: string;
  documentoHabilId?: string;
  processo?: string;
  favorecido?: string;
  documentoFavorecido?: string;
  tipoPessoa: 'PF' | 'PJ';
  contrato?: string;
  empenho?: string;
  valor?: number;
  objeto?: string;
  projeto?: string;
  edital?: string;
  fields: DocumentFieldState[];
  missingRequiredFields: string[];
  warnings: string[];
  matchedFrom: string[];
};

export type ResolveIntentResult =
  | {
      status: 'resolved';
      intent: DocumentIntent;
      context: ResolvedDocumentContext;
    }
  | {
      status: 'ambiguous';
      intent: DocumentIntent;
      candidates: ResolvedDocumentContext[];
      message: string;
    }
  | {
      status: 'not_found';
      intent: DocumentIntent;
      message: string;
    };

export type ResolverResources = {
  empenhos: Empenho[];
  contratos: Contrato[];
  contratosEmpenhos: ContratoEmpenho[];
};

export const documentDefinitions = [
  {
    id: 'despacho-liquidacao' as const,
    name: 'Despacho de Liquidacao',
    acceptedLookups: ['processo'] as const,
    quickPrompt: 'Gerar despacho de liquidacao do processo ',
  },
];

const DOCUMENTOS_SELECT =
  'id,valor_original,valor_pago,estado,processo,favorecido_nome,favorecido_documento,data_emissao,fonte_sof,empenho_id';
const PROCESSOS_SELECT =
  'id,suap_id,status,num_processo,beneficiario,cpf_cnpj,assunto,contrato,dados_completos';
const CONTRATOS_API_SELECT =
  'id,numero,fornecedor_nome,fornecedor_documento,objeto,processo,valor_global,valor_acumulado';
const CONTRATOS_API_EMPENHOS_SELECT =
  'contrato_api_id,numero,valor_empenhado,valor_a_liquidar,valor_liquidado,valor_pago';

const collapseSpaces = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizeDigits = (value: string) => value.replace(/\D/g, '');
const normalizeProcessValue = (value: string) => value.replace(/\D/g, '');

const normalizeLookupValue = (lookupType: IntentLookupType, value: string) => {
  if (lookupType === 'processo') return collapseSpaces(value);
  return normalizeDigits(value);
};

const processPattern = /\d{5}\.?\d{6}(?:\/|\.)\d{4}-\d{2}/g;

export function extractProcessNumbers(input: string): string[] {
  const matches = input.match(processPattern) || [];
  return Array.from(new Set(matches.map((item) => normalizeLookupValue('processo', item))));
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const badgePlaceholder = (label: string) =>
  `<span style="display:inline-block;background:#FEE2E2;color:#B91C1C;padding:0 4px;border-radius:4px;font-weight:bold;">[${escapeHtml(label)}]</span>`;

const htmlValue = (value: string | undefined, placeholder: string, options?: { uppercase?: boolean; bold?: boolean }) => {
  if (!value) return badgePlaceholder(placeholder);
  const content = escapeHtml(options?.uppercase ? value.toUpperCase() : value);
  return options?.bold ? `<b>${content}</b>` : content;
};

const htmlCurrency = (value: number | undefined, placeholder: string) => {
  if (value == null || Number.isNaN(value)) return badgePlaceholder(placeholder);
  return `<b>${escapeHtml(formatCurrency(value))}</b>`;
};

const htmlQuoted = (value: string | undefined, placeholder: string) => {
  if (!value) return badgePlaceholder(placeholder);
  return `<b>"${escapeHtml(value)}"</b>`;
};

const normalizeEmpenhoDisplay = (value: string | undefined) => {
  if (!value) return undefined;
  const normalized = collapseSpaces(value).toUpperCase();
  const match = normalized.match(/\d{4}NE\d{6}/);
  return match?.[0] || normalized;
};

const cleanObjectReference = (value: string | undefined, contrato: string | undefined) => {
  if (!value) return undefined;

  let cleaned = collapseSpaces(value);
  const contratoEscaped = contrato?.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  if (contratoEscaped) {
    cleaned = cleaned.replace(new RegExp(`(?:[\\s,.;-]|^)CONTRATO\\s*${contratoEscaped}(?=[\\s,.;-]|$)`, 'gi'), ' ');
    cleaned = cleaned.replace(new RegExp(`(?:[\\s,.;-]|^)${contratoEscaped}(?=[\\s,.;-]|$)`, 'gi'), ' ');
  }

  cleaned = cleaned
    .replace(/\s+[.,;:]/g, (match) => match.trim())
    .replace(/[.;,:-]{2,}/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^[,.;:\-]\s*/, '')
    .replace(/\s*[,.;:\-]$/, '')
    .trim();

  return cleaned || undefined;
};

const simplifyObjectForCategory = (
  value: string | undefined,
  categoria: 'bolsa' | 'aquisicao' | 'servico',
) => {
  if (!value) return undefined;

  let simplified = collapseSpaces(value);

  simplified = simplified
    .replace(/^pagamento\s+de\s+/i, '')
    .replace(/^liquidacao\s+da\s+despesa\s+referente\s+a\s+/i, '')
    .replace(/^liquidacao\s+referente\s+a\s+/i, '');

  if (categoria === 'aquisicao') {
    simplified = simplified
      .replace(/^fornecimento\s+de\s+/i, '')
      .replace(/^aquisicao\s+de\s+/i, '')
      .replace(/^compra\s+de\s+/i, '');
  }

  if (categoria === 'servico') {
    simplified = simplified
      .replace(/^prestacao\s+de\s+servicos\s+de\s+/i, '')
      .replace(/^prestacao\s+de\s+/i, '')
      .replace(/^servicos?\s+de\s+/i, '');
  }

  return simplified.trim() || undefined;
};

const sortByDateDesc = <T extends { data_emissao?: string }>(items: T[]) =>
  [...items].sort((left, right) => {
    const leftTime = left.data_emissao ? new Date(left.data_emissao).getTime() : 0;
    const rightTime = right.data_emissao ? new Date(right.data_emissao).getTime() : 0;
    return rightTime - leftTime;
  });

const sortByCreatedDesc = <T extends { updated_at?: string; created_at?: string }>(items: T[]) =>
  [...items].sort((left, right) => {
    const leftTime = new Date(left.updated_at || left.created_at || 0).getTime();
    const rightTime = new Date(right.updated_at || right.created_at || 0).getTime();
    return rightTime - leftTime;
  });

const dedupeBy = <T>(items: T[], getKey: (item: T) => string) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const documentoMatchesLookup = (documento: string | undefined, lookupValue: string) => {
  const normalizedDocumento = normalizeDigits(documento || '');
  const normalizedLookup = normalizeDigits(lookupValue);
  if (!normalizedDocumento || !normalizedLookup) return false;
  return normalizedDocumento === normalizedLookup;
};

const processoMatchesLookup = (processo: string | undefined, lookupValue: string) => {
  const normalizedProcesso = normalizeProcessValue(processo || '');
  const normalizedLookup = normalizeProcessValue(lookupValue);
  if (!normalizedProcesso || !normalizedLookup) return false;
  return normalizedProcesso === normalizedLookup;
};

const inferTipoPessoa = (documento: string | undefined): 'PF' | 'PJ' => {
  const digits = normalizeDigits(documento || '');
  return digits.length === 11 ? 'PF' : 'PJ';
};

const inferObjetoCategoria = (context: {
  tipoPessoa: 'PF' | 'PJ';
  objeto?: string;
  projeto?: string;
}) => {
  const haystack = `${context.objeto || ''} ${context.projeto || ''}`.toLowerCase();

  if (context.tipoPessoa === 'PF' || /\bbolsa\b|\bbolsista\b|\bauxilio\b|\bprojeto\b/.test(haystack)) {
    return 'bolsa';
  }

  if (/\baquisi|material|equipamento|produto|fornecimento|compra\b/.test(haystack)) {
    return 'aquisicao';
  }

  return 'servico';
};

const pickFirstString = (...values: Array<string | undefined | null>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

const pickFirstNumber = (...values: Array<number | undefined | null>) => {
  for (const value of values) {
    if (typeof value === 'number' && !Number.isNaN(value) && value > 0) return value;
  }
  return undefined;
};

const getContextField = (
  key: ContextFieldKey,
  label: string,
  value: string | undefined,
  source: string,
  status: ContextFieldStatus,
): DocumentFieldState => ({ key, label, value, source, status });

const toSourceLabel = (tableName: string) => {
  switch (tableName) {
    case 'documentos_habeis':
      return 'Documentos habeis';
    case 'processos':
      return 'Espelho SUAP';
    case 'contratos_api':
      return 'Contratos API';
    case 'empenhos':
      return 'Empenhos';
    case 'contratos':
      return 'Contratos locais';
    default:
      return tableName;
  }
};

const mapSuapProcessoLite = (row: SuapProcessoLiteRow): SuapProcessoLite => ({
  id: row.id,
  suapId: row.suap_id,
  status: row.status,
  numProcesso: row.num_processo || undefined,
  beneficiario: row.beneficiario || undefined,
  cpfCnpj: row.cpf_cnpj || undefined,
  assunto: row.assunto || undefined,
  contrato: row.contrato || undefined,
  dadosCompletos: row.dados_completos || undefined,
});

const fetchSuapProcessosBroad = async () => {
  try {
    const broad = await supabase
      .from('processos')
      .select(PROCESSOS_SELECT)
      .limit(250);

    if (broad.error) {
      throw broad.error;
    }

    if (broad.data && broad.data.length > 0) {
      return (broad.data || []).map((row) => mapSuapProcessoLite(row as SuapProcessoLiteRow));
    }

    console.warn('documentGeneration.fetchSuapProcessosBroad: resultado vazio via supabase-js, consultando REST');
  } catch (error) {
    console.warn('documentGeneration.fetchSuapProcessosBroad: fallback para Supabase REST', error);
  }

  const fallbackData = await fetchSupabaseRestRows<SuapProcessoLiteRow>('processos', PROCESSOS_SELECT, {
    limit: 250,
  });

  return fallbackData.map(mapSuapProcessoLite);
};

const findEmpenhoLocally = (
  resources: ResolverResources,
  criteria: {
    processo?: string;
    documentoFavorecido?: string;
    empenho?: string;
  },
) => {
  const sorted = [...resources.empenhos].sort((left, right) => {
    const leftTime = left.dataEmpenho instanceof Date ? left.dataEmpenho.getTime() : new Date(left.dataEmpenho).getTime();
    const rightTime = right.dataEmpenho instanceof Date ? right.dataEmpenho.getTime() : new Date(right.dataEmpenho).getTime();
    return rightTime - leftTime;
  });

  const byExplicit = sorted.find(
    (empenho) =>
      criteria.empenho &&
      (String(empenho.id) === criteria.empenho || String(empenho.numero) === criteria.empenho),
  );
  if (byExplicit) return byExplicit;

  const byProcesso = sorted.find(
    (empenho) => criteria.processo && processoMatchesLookup(empenho.processo, criteria.processo),
  );
  if (byProcesso) return byProcesso;

  return sorted.find(
    (empenho) =>
      criteria.documentoFavorecido &&
      documentoMatchesLookup(empenho.favorecidoDocumento, criteria.documentoFavorecido),
  );
};

const findContratoLocal = (
  resources: ResolverResources,
  criteria: {
    numero?: string;
    empenhoId?: string;
  },
) => {
  const byNumero = resources.contratos.find(
    (contrato) => criteria.numero && contrato.numero.trim() === criteria.numero.trim(),
  );
  if (byNumero) return byNumero;

  if (!criteria.empenhoId) return undefined;

  const link = resources.contratosEmpenhos.find((item) => item.empenho_id === criteria.empenhoId);
  if (!link) return undefined;

  return resources.contratos.find((contrato) => contrato.id === link.contrato_id);
};

const buildFieldStates = (context: {
  documentoHabilId?: string;
  processo?: string;
  favorecido?: string;
  documentoFavorecido?: string;
  contrato?: string;
  empenho?: string;
  valor?: number;
  objeto?: string;
  edital?: string;
  projeto?: string;
  sourceMap: Partial<Record<ContextFieldKey, { source: string; status: ContextFieldStatus }>>;
}) => {
  const fields: DocumentFieldState[] = [
    getContextField(
      'documento',
      'Documento habil',
      context.documentoHabilId ? formatDocumentoId(context.documentoHabilId) : undefined,
      context.sourceMap.documento?.source || 'Nao localizado',
      context.sourceMap.documento?.status || 'missing',
    ),
    getContextField(
      'processo',
      'Processo',
      context.processo,
      context.sourceMap.processo?.source || 'Nao localizado',
      context.sourceMap.processo?.status || 'missing',
    ),
    getContextField(
      'favorecido',
      'Favorecido',
      context.favorecido,
      context.sourceMap.favorecido?.source || 'Nao localizado',
      context.sourceMap.favorecido?.status || 'missing',
    ),
    getContextField(
      'documentoFavorecido',
      'CPF/CNPJ',
      context.documentoFavorecido ? formatarDocumento(context.documentoFavorecido) : undefined,
      context.sourceMap.documentoFavorecido?.source || 'Nao localizado',
      context.sourceMap.documentoFavorecido?.status || 'missing',
    ),
    getContextField(
      'contrato',
      'Contrato',
      context.contrato,
      context.sourceMap.contrato?.source || 'Nao localizado',
      context.sourceMap.contrato?.status || 'missing',
    ),
    getContextField(
      'empenho',
      'Empenho',
      context.empenho,
      context.sourceMap.empenho?.source || 'Nao localizado',
      context.sourceMap.empenho?.status || 'missing',
    ),
    getContextField(
      'valor',
      'Valor',
      context.valor != null ? formatCurrency(context.valor) : undefined,
      context.sourceMap.valor?.source || 'Nao localizado',
      context.sourceMap.valor?.status || 'missing',
    ),
    getContextField(
      'objeto',
      'Objeto / referencia',
      context.objeto,
      context.sourceMap.objeto?.source || 'Nao localizado',
      context.sourceMap.objeto?.status || 'missing',
    ),
  ];

  if (context.projeto || context.sourceMap.projeto) {
    fields.push(
      getContextField(
        'projeto',
        'Projeto',
        context.projeto,
        context.sourceMap.projeto?.source || 'Nao localizado',
        context.sourceMap.projeto?.status || 'missing',
      ),
    );
  }

  if (context.edital || context.sourceMap.edital) {
    fields.push(
      getContextField(
        'edital',
        'Edital',
        context.edital,
        context.sourceMap.edital?.source || 'Nao localizado',
        context.sourceMap.edital?.status || 'missing',
      ),
    );
  }

  return fields;
};

const buildMissingFields = (fields: DocumentFieldState[]) =>
  fields
    .filter((field) => ['processo', 'favorecido', 'empenho', 'valor'].includes(field.key) && !field.value)
    .map((field) => field.label);

const buildSubtitle = (context: {
  favorecido?: string;
  valor?: number;
  processo?: string;
  contrato?: string;
}) => {
  const parts = [
    context.favorecido,
    context.valor != null ? formatCurrency(context.valor) : undefined,
    context.processo ? `Processo ${context.processo}` : undefined,
    context.contrato ? `Contrato ${context.contrato}` : undefined,
  ].filter(Boolean);

  return parts.join(' | ');
};

const buildContextFromDocumento = (
  documento: DocumentoRow,
  related: {
    suap?: SuapProcessoLite;
    contratoApi?: ContratoApiLite;
    contratoApiEmpenho?: ContratoApiEmpenhoLite;
    empenhoLocal?: Empenho;
    contratoLocal?: Contrato;
  },
): ResolvedDocumentContext => {
  const documentoFavorecido = pickFirstString(documento.favorecido_documento, related.suap?.cpfCnpj, related.contratoApi?.fornecedor_documento || undefined);
  const tipoPessoa = inferTipoPessoa(documentoFavorecido);
  const processo = pickFirstString(documento.processo, related.suap?.numProcesso, related.contratoApi?.processo || undefined, related.empenhoLocal?.processo);
  const favorecido = pickFirstString(
    documento.favorecido_nome,
    related.suap?.beneficiario,
    related.contratoApi?.fornecedor_nome || undefined,
    related.empenhoLocal?.favorecidoNome,
    related.contratoLocal?.contratada,
  );
  const contrato = pickFirstString(
    related.suap?.contrato,
    related.suap?.dadosCompletos?.contrato_numero,
    related.contratoApi?.numero || undefined,
    related.contratoLocal?.numero,
  );
  const empenho = pickFirstString(
    documento.empenho_id,
    related.empenhoLocal?.numero,
    related.suap?.dadosCompletos?.empenhos?.[0],
    related.contratoApiEmpenho?.numero,
  );
  const valor = pickFirstNumber(
    documento.valor_original,
    parseCurrency(related.suap?.dadosCompletos?.val_nf || 0),
    related.contratoApiEmpenho?.valor_a_liquidar || undefined,
    related.empenhoLocal?.valorLiquidadoAPagar,
    related.empenhoLocal?.valorLiquidadoOficial,
    related.empenhoLocal?.valorLiquidado,
    related.contratoApi?.valor_global || undefined,
  );
  const objeto = pickFirstString(
    related.contratoApi?.objeto || undefined,
    related.empenhoLocal?.descricao,
    related.suap?.assunto,
  );
  const projeto = pickFirstString(related.suap?.assunto, related.contratoApi?.objeto || undefined);
  const sourceMap: Partial<Record<ContextFieldKey, { source: string; status: ContextFieldStatus }>> = {
    documento: { source: toSourceLabel('documentos_habeis'), status: 'confirmed' },
    processo: {
      source: documento.processo ? toSourceLabel('documentos_habeis') : related.suap?.numProcesso ? toSourceLabel('processos') : 'Nao localizado',
      status: documento.processo ? 'confirmed' : related.suap?.numProcesso ? 'confirmed' : 'missing',
    },
    favorecido: {
      source: documento.favorecido_nome
        ? toSourceLabel('documentos_habeis')
        : related.suap?.beneficiario
          ? toSourceLabel('processos')
          : related.contratoApi?.fornecedor_nome
            ? toSourceLabel('contratos_api')
            : 'Nao localizado',
      status: documento.favorecido_nome || related.suap?.beneficiario ? 'confirmed' : related.contratoApi?.fornecedor_nome ? 'inferred' : 'missing',
    },
    documentoFavorecido: {
      source: documento.favorecido_documento
        ? toSourceLabel('documentos_habeis')
        : related.suap?.cpfCnpj
          ? toSourceLabel('processos')
          : related.contratoApi?.fornecedor_documento
            ? toSourceLabel('contratos_api')
            : 'Nao localizado',
      status: documento.favorecido_documento || related.suap?.cpfCnpj ? 'confirmed' : related.contratoApi?.fornecedor_documento ? 'inferred' : 'missing',
    },
    contrato: {
      source: related.suap?.contrato || related.suap?.dadosCompletos?.contrato_numero
        ? toSourceLabel('processos')
        : related.contratoApi?.numero
          ? toSourceLabel('contratos_api')
          : related.contratoLocal?.numero
            ? toSourceLabel('contratos')
            : 'Nao localizado',
      status: related.suap?.contrato || related.suap?.dadosCompletos?.contrato_numero || related.contratoApi?.numero ? 'confirmed' : related.contratoLocal?.numero ? 'inferred' : 'missing',
    },
    empenho: {
      source: documento.empenho_id
        ? toSourceLabel('documentos_habeis')
        : related.empenhoLocal?.numero
          ? toSourceLabel('empenhos')
          : related.suap?.dadosCompletos?.empenhos?.[0]
            ? toSourceLabel('processos')
            : related.contratoApiEmpenho?.numero
              ? toSourceLabel('contratos_api')
              : 'Nao localizado',
      status: documento.empenho_id ? 'confirmed' : related.empenhoLocal?.numero || related.suap?.dadosCompletos?.empenhos?.[0] ? 'inferred' : related.contratoApiEmpenho?.numero ? 'inferred' : 'missing',
    },
    valor: {
      source: documento.valor_original
        ? toSourceLabel('documentos_habeis')
        : related.suap?.dadosCompletos?.val_nf
          ? toSourceLabel('processos')
          : related.contratoApiEmpenho?.valor_a_liquidar
            ? toSourceLabel('contratos_api')
            : related.empenhoLocal?.valorLiquidado
              ? toSourceLabel('empenhos')
              : 'Nao localizado',
      status: documento.valor_original || related.suap?.dadosCompletos?.val_nf ? 'confirmed' : related.contratoApiEmpenho?.valor_a_liquidar || related.empenhoLocal?.valorLiquidado ? 'inferred' : 'missing',
    },
    objeto: {
      source: related.contratoApi?.objeto
        ? toSourceLabel('contratos_api')
        : related.empenhoLocal?.descricao
          ? toSourceLabel('empenhos')
          : related.suap?.assunto
            ? toSourceLabel('processos')
            : 'Nao localizado',
      status: related.contratoApi?.objeto || related.empenhoLocal?.descricao ? 'confirmed' : related.suap?.assunto ? 'inferred' : 'missing',
    },
    projeto: {
      source: related.suap?.assunto ? toSourceLabel('processos') : 'Nao localizado',
      status: related.suap?.assunto ? 'inferred' : 'missing',
    },
    edital: {
      source: 'Nao localizado',
      status: 'missing',
    },
  };
  const fields = buildFieldStates({
    documentoHabilId: documento.id,
    processo,
    favorecido,
    documentoFavorecido,
    contrato,
    empenho,
    valor,
    objeto,
    projeto,
    sourceMap,
  });

  return {
    documentType: 'despacho-liquidacao',
    candidateId: `documento-${documento.id}`,
    title: `DH ${formatDocumentoId(documento.id)}`,
    subtitle: buildSubtitle({ favorecido, valor, processo, contrato }),
    documentoHabilId: documento.id,
    processo,
    favorecido,
    documentoFavorecido,
    tipoPessoa,
    contrato,
    empenho,
    valor,
    objeto,
    projeto,
    fields,
    missingRequiredFields: buildMissingFields(fields),
    warnings: [
      ...(documento.estado && documento.estado.toUpperCase() !== 'REALIZADO'
        ? [`Estado do documento: ${documento.estado}`]
        : []),
    ],
    matchedFrom: dedupeBy(
      [
        toSourceLabel('documentos_habeis'),
        related.suap ? toSourceLabel('processos') : '',
        related.contratoApi ? toSourceLabel('contratos_api') : '',
        related.empenhoLocal ? toSourceLabel('empenhos') : '',
        related.contratoLocal ? toSourceLabel('contratos') : '',
      ].filter(Boolean),
      (item) => item,
    ),
  };
};

const buildContextFromSuap = (
  processo: SuapProcessoLite,
  related: {
    contratoApi?: ContratoApiLite;
    contratoApiEmpenho?: ContratoApiEmpenhoLite;
    empenhoLocal?: Empenho;
    contratoLocal?: Contrato;
  },
): ResolvedDocumentContext => {
  const documentoFavorecido = pickFirstString(processo.cpfCnpj, related.contratoApi?.fornecedor_documento || undefined, related.empenhoLocal?.favorecidoDocumento);
  const tipoPessoa = inferTipoPessoa(documentoFavorecido);
  const contrato = pickFirstString(
    processo.contrato,
    processo.dadosCompletos?.contrato_numero,
    related.contratoApi?.numero || undefined,
    related.contratoLocal?.numero,
  );
  const empenho = pickFirstString(
    processo.dadosCompletos?.empenhos?.[0],
    related.empenhoLocal?.numero,
    related.contratoApiEmpenho?.numero,
  );
  const valor = pickFirstNumber(
    parseCurrency(processo.dadosCompletos?.val_nf || 0),
    related.contratoApiEmpenho?.valor_a_liquidar || undefined,
    related.empenhoLocal?.valorLiquidadoAPagar,
    related.empenhoLocal?.valorLiquidado,
    related.contratoApi?.valor_global || undefined,
  );
  const objeto = pickFirstString(related.contratoApi?.objeto || undefined, processo.assunto, related.empenhoLocal?.descricao);
  const sourceMap: Partial<Record<ContextFieldKey, { source: string; status: ContextFieldStatus }>> = {
    processo: { source: toSourceLabel('processos'), status: processo.numProcesso ? 'confirmed' : 'missing' },
    favorecido: { source: toSourceLabel('processos'), status: processo.beneficiario ? 'confirmed' : 'missing' },
    documentoFavorecido: { source: toSourceLabel('processos'), status: processo.cpfCnpj ? 'confirmed' : 'missing' },
    contrato: {
      source: processo.contrato || processo.dadosCompletos?.contrato_numero
        ? toSourceLabel('processos')
        : related.contratoApi?.numero
          ? toSourceLabel('contratos_api')
          : related.contratoLocal?.numero
            ? toSourceLabel('contratos')
            : 'Nao localizado',
      status: processo.contrato || processo.dadosCompletos?.contrato_numero ? 'confirmed' : related.contratoApi?.numero || related.contratoLocal?.numero ? 'inferred' : 'missing',
    },
    empenho: {
      source: processo.dadosCompletos?.empenhos?.[0]
        ? toSourceLabel('processos')
        : related.empenhoLocal?.numero
          ? toSourceLabel('empenhos')
          : related.contratoApiEmpenho?.numero
            ? toSourceLabel('contratos_api')
            : 'Nao localizado',
      status: processo.dadosCompletos?.empenhos?.[0] ? 'confirmed' : related.empenhoLocal?.numero || related.contratoApiEmpenho?.numero ? 'inferred' : 'missing',
    },
    valor: {
      source: processo.dadosCompletos?.val_nf
        ? toSourceLabel('processos')
        : related.contratoApiEmpenho?.valor_a_liquidar
          ? toSourceLabel('contratos_api')
          : related.empenhoLocal?.valorLiquidado
            ? toSourceLabel('empenhos')
            : 'Nao localizado',
      status: processo.dadosCompletos?.val_nf ? 'confirmed' : related.contratoApiEmpenho?.valor_a_liquidar || related.empenhoLocal?.valorLiquidado ? 'inferred' : 'missing',
    },
    objeto: {
      source: related.contratoApi?.objeto
        ? toSourceLabel('contratos_api')
        : processo.assunto
          ? toSourceLabel('processos')
          : related.empenhoLocal?.descricao
            ? toSourceLabel('empenhos')
            : 'Nao localizado',
      status: related.contratoApi?.objeto || processo.assunto ? 'confirmed' : related.empenhoLocal?.descricao ? 'inferred' : 'missing',
    },
    projeto: {
      source: processo.assunto ? toSourceLabel('processos') : 'Nao localizado',
      status: processo.assunto ? 'inferred' : 'missing',
    },
    edital: { source: 'Nao localizado', status: 'missing' },
  };
  const fields = buildFieldStates({
    processo: processo.numProcesso,
    favorecido: processo.beneficiario,
    documentoFavorecido,
    contrato,
    empenho,
    valor,
    objeto,
    projeto: processo.assunto,
    sourceMap,
  });

  return {
    documentType: 'despacho-liquidacao',
    candidateId: `suap-${processo.id}`,
    title: processo.numProcesso || `Processo SUAP ${processo.suapId}`,
    subtitle: buildSubtitle({
      favorecido: processo.beneficiario,
      valor,
      processo: processo.numProcesso,
      contrato,
    }),
    processo: processo.numProcesso,
    favorecido: processo.beneficiario,
    documentoFavorecido,
    tipoPessoa,
    contrato,
    empenho,
    valor,
    objeto,
    projeto: processo.assunto,
    fields,
    missingRequiredFields: buildMissingFields(fields),
    warnings: [],
    matchedFrom: dedupeBy(
      [
        toSourceLabel('processos'),
        related.contratoApi ? toSourceLabel('contratos_api') : '',
        related.empenhoLocal ? toSourceLabel('empenhos') : '',
        related.contratoLocal ? toSourceLabel('contratos') : '',
      ].filter(Boolean),
      (item) => item,
    ),
  };
};

const buildContextFromContrato = (
  contratoApi: ContratoApiLite,
  related: {
    contratoApiEmpenho?: ContratoApiEmpenhoLite;
    empenhoLocal?: Empenho;
    contratoLocal?: Contrato;
  },
): ResolvedDocumentContext => {
  const documentoFavorecido = pickFirstString(contratoApi.fornecedor_documento || undefined, related.empenhoLocal?.favorecidoDocumento);
  const tipoPessoa = inferTipoPessoa(documentoFavorecido);
  const empenho = pickFirstString(related.contratoApiEmpenho?.numero, related.empenhoLocal?.numero);
  const valor = pickFirstNumber(
    related.contratoApiEmpenho?.valor_a_liquidar || undefined,
    related.empenhoLocal?.valorLiquidadoAPagar,
    contratoApi.valor_global || undefined,
    contratoApi.valor_acumulado || undefined,
  );
  const sourceMap: Partial<Record<ContextFieldKey, { source: string; status: ContextFieldStatus }>> = {
    processo: { source: contratoApi.processo ? toSourceLabel('contratos_api') : 'Nao localizado', status: contratoApi.processo ? 'confirmed' : 'missing' },
    favorecido: { source: contratoApi.fornecedor_nome ? toSourceLabel('contratos_api') : 'Nao localizado', status: contratoApi.fornecedor_nome ? 'confirmed' : 'missing' },
    documentoFavorecido: { source: contratoApi.fornecedor_documento ? toSourceLabel('contratos_api') : 'Nao localizado', status: contratoApi.fornecedor_documento ? 'confirmed' : 'missing' },
    contrato: { source: toSourceLabel('contratos_api'), status: contratoApi.numero ? 'confirmed' : 'missing' },
    empenho: { source: related.contratoApiEmpenho?.numero ? toSourceLabel('contratos_api') : related.empenhoLocal?.numero ? toSourceLabel('empenhos') : 'Nao localizado', status: related.contratoApiEmpenho?.numero || related.empenhoLocal?.numero ? 'inferred' : 'missing' },
    valor: { source: related.contratoApiEmpenho?.valor_a_liquidar ? toSourceLabel('contratos_api') : contratoApi.valor_global ? toSourceLabel('contratos_api') : 'Nao localizado', status: related.contratoApiEmpenho?.valor_a_liquidar || contratoApi.valor_global ? 'inferred' : 'missing' },
    objeto: { source: contratoApi.objeto ? toSourceLabel('contratos_api') : 'Nao localizado', status: contratoApi.objeto ? 'confirmed' : 'missing' },
  };
  const fields = buildFieldStates({
    processo: contratoApi.processo || undefined,
    favorecido: contratoApi.fornecedor_nome || undefined,
    documentoFavorecido,
    contrato: contratoApi.numero,
    empenho,
    valor,
    objeto: contratoApi.objeto || undefined,
    sourceMap,
  });

  return {
    documentType: 'despacho-liquidacao',
    candidateId: `contrato-api-${contratoApi.id}`,
    title: `Contrato ${contratoApi.numero}`,
    subtitle: buildSubtitle({
      favorecido: contratoApi.fornecedor_nome || undefined,
      valor,
      processo: contratoApi.processo || undefined,
      contrato: contratoApi.numero,
    }),
    processo: contratoApi.processo || undefined,
    favorecido: contratoApi.fornecedor_nome || undefined,
    documentoFavorecido,
    tipoPessoa,
    contrato: contratoApi.numero,
    empenho,
    valor,
    objeto: contratoApi.objeto || undefined,
    fields,
    missingRequiredFields: buildMissingFields(fields),
    warnings: ['Minuta montada sem documento habil localizado. Revise com mais cuidado antes de finalizar.'],
    matchedFrom: dedupeBy(
      [
        toSourceLabel('contratos_api'),
        related.contratoApiEmpenho ? toSourceLabel('contratos_api') : '',
        related.empenhoLocal ? toSourceLabel('empenhos') : '',
        related.contratoLocal ? toSourceLabel('contratos') : '',
      ].filter(Boolean),
      (item) => item,
    ),
  };
};

const filterByNormalizedProcess = <T>(items: T[], getProcesso: (item: T) => string | undefined, lookupValue: string) =>
  items.filter((item) => processoMatchesLookup(getProcesso(item), lookupValue));

const filterByNormalizedDocumento = <T>(items: T[], getDocumento: (item: T) => string | undefined, lookupValue: string) =>
  items.filter((item) => documentoMatchesLookup(getDocumento(item), lookupValue));

const fetchDocumentosByIntent = async (intent: DocumentIntent) => {
  if (intent.lookupType === 'processo') {
    return [] as DocumentoRow[];
  }

  const lookupVariants = Array.from(new Set([intent.lookupValue, formatarDocumento(intent.lookupValue)]));
  try {
    const { data, error } = await supabase
      .from('documentos_habeis')
      .select(DOCUMENTOS_SELECT)
      .in('favorecido_documento', lookupVariants)
      .order('data_emissao', { ascending: false })
      .limit(12);

    if (!error) return (data || []) as DocumentoRow[];
  } catch {
    // cai para a estrategia tolerante abaixo
  }

  const broad = await supabase
    .from('documentos_habeis')
    .select(DOCUMENTOS_SELECT)
    .order('data_emissao', { ascending: false })
    .limit(250);

  if (broad.error) throw broad.error;

  return filterByNormalizedDocumento((broad.data || []) as DocumentoRow[], (item) => item.favorecido_documento, intent.lookupValue).slice(0, 12);
};

const fetchSuapProcessosByIntent = async (intent: DocumentIntent) => {
  if (intent.lookupType === 'processo') {
    const broad = await fetchSuapProcessosBroad();
    return filterByNormalizedProcess(
      broad,
      (item) => item.numProcesso,
      intent.lookupValue,
    ).slice(0, 12);
  }

  const lookupVariants = Array.from(new Set([intent.lookupValue, formatarDocumento(intent.lookupValue)]));
  try {
    const { data, error } = await supabase
      .from('processos')
      .select(PROCESSOS_SELECT)
      .in('cpf_cnpj', lookupVariants)
      .limit(12);

    if (!error) return (data || []).map((row) => mapSuapProcessoLite(row as SuapProcessoLiteRow));
  } catch {
    // cai para a estrategia tolerante abaixo
  }

  const broad = await fetchSuapProcessosBroad();
  return filterByNormalizedDocumento(
    broad,
    (item) => item.cpfCnpj,
    intent.lookupValue,
  ).slice(0, 12);
};

const fetchContratosApiByIntent = async (intent: DocumentIntent) => {
  if (intent.lookupType === 'processo') {
    const broad = await supabase
      .from('contratos_api')
      .select(CONTRATOS_API_SELECT)
      .limit(250);

    if (broad.error) throw broad.error;

    return filterByNormalizedProcess((broad.data || []) as ContratoApiLite[], (item) => item.processo || undefined, intent.lookupValue).slice(0, 12);
  }

  const lookupVariants = Array.from(new Set([intent.lookupValue, formatarDocumento(intent.lookupValue)]));
  try {
    const { data, error } = await supabase
      .from('contratos_api')
      .select(CONTRATOS_API_SELECT)
      .in('fornecedor_documento', lookupVariants)
      .limit(12);

    if (!error) return (data || []) as ContratoApiLite[];
  } catch {
    // cai para a estrategia tolerante abaixo
  }

  const broad = await supabase
    .from('contratos_api')
    .select(CONTRATOS_API_SELECT)
    .limit(250);

  if (broad.error) throw broad.error;

  return filterByNormalizedDocumento((broad.data || []) as ContratoApiLite[], (item) => item.fornecedor_documento || undefined, intent.lookupValue).slice(0, 12);
};

const fetchContratoApiEmpenhos = async (contratoApiIds: string[]) => {
  if (contratoApiIds.length === 0) return [] as ContratoApiEmpenhoLite[];

  const { data, error } = await supabase
    .from('contratos_api_empenhos')
    .select(CONTRATOS_API_EMPENHOS_SELECT)
    .in('contrato_api_id', contratoApiIds);

  if (error) throw error;
  return (data || []) as ContratoApiEmpenhoLite[];
};

const buildRelatedMaps = (
  resources: ResolverResources,
  suapProcessos: SuapProcessoLite[],
  contratosApi: ContratoApiLite[],
  contratosApiEmpenhos: ContratoApiEmpenhoLite[],
) => {
  const byProcessoSuap = new Map(
    suapProcessos
      .filter((item) => item.numProcesso)
      .map((item) => [normalizeProcessValue(item.numProcesso || ''), item]),
  );
  const byDocumentoSuap = new Map(
    suapProcessos
      .filter((item) => item.cpfCnpj)
      .map((item) => [normalizeDigits(item.cpfCnpj || ''), item]),
  );
  const byProcessoContratoApi = new Map(
    contratosApi
      .filter((item) => item.processo)
      .map((item) => [normalizeProcessValue(item.processo || ''), item]),
  );
  const byDocumentoContratoApi = new Map(
    contratosApi
      .filter((item) => item.fornecedor_documento)
      .map((item) => [normalizeDigits(item.fornecedor_documento || ''), item]),
  );
  const contratoApiEmpenhosByContratoId = new Map<string, ContratoApiEmpenhoLite[]>();
  contratosApiEmpenhos.forEach((item) => {
    const current = contratoApiEmpenhosByContratoId.get(item.contrato_api_id) || [];
    current.push(item);
    contratoApiEmpenhosByContratoId.set(item.contrato_api_id, current);
  });

  return {
    forDocumento(documento: DocumentoRow) {
      const suap =
        byProcessoSuap.get(normalizeProcessValue(documento.processo || '')) ||
        byDocumentoSuap.get(normalizeDigits(documento.favorecido_documento || ''));
      const contratoApi =
        byProcessoContratoApi.get(normalizeProcessValue(documento.processo || '')) ||
        byDocumentoContratoApi.get(normalizeDigits(documento.favorecido_documento || ''));
      const contratoApiEmpenho = contratoApi
        ? (contratoApiEmpenhosByContratoId.get(contratoApi.id) || []).sort(
            (left, right) => (right.valor_a_liquidar || 0) - (left.valor_a_liquidar || 0),
          )[0]
        : undefined;
      const empenhoLocal = findEmpenhoLocally(resources, {
        processo: documento.processo,
        documentoFavorecido: documento.favorecido_documento,
        empenho: documento.empenho_id,
      });
      const contratoLocal = findContratoLocal(resources, {
        numero: pickFirstString(suap?.contrato, suap?.dadosCompletos?.contrato_numero, contratoApi?.numero || undefined),
        empenhoId: empenhoLocal?.id,
      });

      return { suap, contratoApi, contratoApiEmpenho, empenhoLocal, contratoLocal };
    },
    forSuap(suap: SuapProcessoLite) {
      const contratoApi =
        byProcessoContratoApi.get(normalizeProcessValue(suap.numProcesso || '')) ||
        byDocumentoContratoApi.get(normalizeDigits(suap.cpfCnpj || ''));
      const contratoApiEmpenho = contratoApi
        ? (contratoApiEmpenhosByContratoId.get(contratoApi.id) || []).sort(
            (left, right) => (right.valor_a_liquidar || 0) - (left.valor_a_liquidar || 0),
          )[0]
        : undefined;
      const empenhoLocal = findEmpenhoLocally(resources, {
        processo: suap.numProcesso,
        documentoFavorecido: suap.cpfCnpj,
        empenho: suap.dadosCompletos?.empenhos?.[0],
      });
      const contratoLocal = findContratoLocal(resources, {
        numero: pickFirstString(suap.contrato, suap.dadosCompletos?.contrato_numero, contratoApi?.numero || undefined),
        empenhoId: empenhoLocal?.id,
      });

      return { contratoApi, contratoApiEmpenho, empenhoLocal, contratoLocal };
    },
    forContratoApi(contratoApi: ContratoApiLite) {
      const contratoApiEmpenho = (contratoApiEmpenhosByContratoId.get(contratoApi.id) || []).sort(
        (left, right) => (right.valor_a_liquidar || 0) - (left.valor_a_liquidar || 0),
      )[0];
      const empenhoLocal = findEmpenhoLocally(resources, {
        processo: contratoApi.processo || undefined,
        documentoFavorecido: contratoApi.fornecedor_documento || undefined,
        empenho: contratoApiEmpenho?.numero,
      });
      const contratoLocal = findContratoLocal(resources, {
        numero: contratoApi.numero,
        empenhoId: empenhoLocal?.id,
      });

      return { contratoApiEmpenho, empenhoLocal, contratoLocal };
    },
  };
};

export function parseDocumentIntent(input: string): ParseIntentResult {
  const normalized = collapseSpaces(input);

  if (!normalized) {
    return { ok: false, error: 'Informe pelo menos um numero de processo para gerar a minuta.' };
  }

  const lower = normalized
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const isDespachoLiquidacao =
    lower.includes('despacho de liquidacao') ||
    lower.includes('liquidacao');

  if (!isDespachoLiquidacao) {
    return { ok: false, error: 'Por enquanto, esta tela gera apenas o despacho de liquidacao.' };
  }

  const processos = extractProcessNumbers(normalized);
  if (processos.length > 0) {
    return {
      ok: true,
      intent: {
        documentType: 'despacho-liquidacao',
        lookupType: 'processo',
        lookupValue: processos[0],
        rawPrompt: normalized,
      },
    };
  }

  return {
    ok: false,
    error: 'Nao encontrei um numero de processo valido no comando informado.',
  };
}

export async function resolveDocumentIntent(
  intent: DocumentIntent,
  resources: ResolverResources,
): Promise<ResolveIntentResult> {
  const [documentos, suapProcessos, contratosApi] = await Promise.all([
    fetchDocumentosByIntent(intent),
    fetchSuapProcessosByIntent(intent),
    fetchContratosApiByIntent(intent),
  ]);
  const contratosApiEmpenhos = await fetchContratoApiEmpenhos(contratosApi.map((item) => item.id));
  const relatedMaps = buildRelatedMaps(resources, suapProcessos, contratosApi, contratosApiEmpenhos);

  const documentoCandidates = sortByDateDesc(documentos).map((documento) =>
    buildContextFromDocumento(documento, relatedMaps.forDocumento(documento)),
  );

  if (documentoCandidates.length === 1) {
    return { status: 'resolved', intent, context: documentoCandidates[0] };
  }

  if (documentoCandidates.length > 1) {
    return {
      status: 'ambiguous',
      intent,
      candidates: documentoCandidates,
      message: 'Encontrei mais de um documento habil compativel. Escolha qual minuta deseja abrir.',
    };
  }

  const suapCandidates = dedupeBy(
    suapProcessos.map((processo) => buildContextFromSuap(processo, relatedMaps.forSuap(processo))),
    (item) => item.candidateId,
  );

  if (suapCandidates.length === 1) {
    return { status: 'resolved', intent, context: suapCandidates[0] };
  }

  if (suapCandidates.length > 1) {
    return {
      status: 'ambiguous',
      intent,
      candidates: suapCandidates,
      message: 'Encontrei mais de um processo SUAP compativel. Escolha o caso correto para montar a minuta.',
    };
  }

  const contratoCandidates = dedupeBy(
    contratosApi.map((contratoApi) => buildContextFromContrato(contratoApi, relatedMaps.forContratoApi(contratoApi))),
    (item) => item.candidateId,
  );

  if (contratoCandidates.length === 1) {
    return { status: 'resolved', intent, context: contratoCandidates[0] };
  }

  if (contratoCandidates.length > 1) {
    return {
      status: 'ambiguous',
      intent,
      candidates: contratoCandidates,
      message: 'Encontrei mais de um contrato compativel. Escolha o caso correto para seguir.',
    };
  }

  return {
    status: 'not_found',
    intent,
    message: 'Nao encontrei dados suficientes para gerar a minuta. Tente informar um processo, CPF ou CNPJ mais especifico.',
  };
}

export async function buildResolvedContextFromSuapProcess(
  processo: SuapProcesso,
  resources: ResolverResources,
): Promise<ResolvedDocumentContext> {
  const processoLite = mapSuapProcessoLite({
    id: processo.id,
    suap_id: processo.suapId,
    status: processo.status,
    num_processo: processo.numProcesso,
    beneficiario: processo.beneficiario,
    cpf_cnpj: processo.cpfCnpj,
    assunto: processo.assunto,
    contrato: processo.contrato,
    dados_completos: processo.dadosCompletos,
  });

  const intent: DocumentIntent = {
    documentType: 'despacho-liquidacao',
    lookupType: 'processo',
    lookupValue: processo.numProcesso || processo.suapId,
    rawPrompt: processo.numProcesso || processo.suapId,
  };

  const contratosApi = await fetchContratosApiByIntent(intent);
  const contratosApiEmpenhos = await fetchContratoApiEmpenhos(contratosApi.map((item) => item.id));
  const relatedMaps = buildRelatedMaps(resources, [processoLite], contratosApi, contratosApiEmpenhos);

  return buildContextFromSuap(processoLite, relatedMaps.forSuap(processoLite));
}

export function buildDespachoLiquidacaoHtml(context: ResolvedDocumentContext) {
  const categoria = inferObjetoCategoria(context);
  const favorecidoHtml = htmlValue(context.favorecido, 'favorecido', { uppercase: true, bold: true });
  const processoHtml = htmlValue(context.processo, 'numero do processo', { bold: true });
  const empenhoHtml = htmlValue(normalizeEmpenhoDisplay(context.empenho), 'empenho', { uppercase: true, bold: true });
  const valorHtml = htmlCurrency(context.valor, 'valor da liquidacao');
  const objetoLimpo = simplifyObjectForCategory(cleanObjectReference(context.objeto, context.contrato), categoria);
  const objetoHtml = htmlValue(
    objetoLimpo,
    categoria === 'aquisicao' ? 'objeto da aquisicao' : categoria === 'bolsa' ? 'referencia do projeto' : 'objeto do servico',
    { bold: true },
  );
  const shouldInlineContrato = categoria !== 'bolsa' && !!context.contrato;
  const contratoHtml = context.contrato && !shouldInlineContrato
    ? `<div style="margin-bottom: 12px;"><b>Contrato:</b> ${htmlValue(context.contrato, 'numero do contrato', { bold: true })}</div>`
    : '';

  let htmlTexto = '';

  if (categoria === 'bolsa') {
    const projetoHtml = htmlQuoted(context.projeto || objetoLimpo || context.objeto, 'nome do projeto');
    const editalHtml = htmlValue(context.edital, 'numero do edital', { bold: true });
    htmlTexto = `Considerando a regularidade da documenta&ccedil;&atilde;o apresentada e o ateste da execu&ccedil;&atilde;o das atividades pelo(s) bolsista(s) ${favorecidoHtml}, no &acirc;mbito do projeto ${projetoHtml}, aprovado no Edital n&ordm; ${editalHtml} (Processo n&ordm; ${processoHtml}), <b>AUTORIZO</b> a liquida&ccedil;&atilde;o da despesa no valor de ${valorHtml}, referente ao empenho ${empenhoHtml}.`;
  } else {
    const trechoObjeto =
      categoria === 'aquisicao'
        ? `do fornecimento de ${objetoHtml}`
        : `da presta&ccedil;&atilde;o de servi&ccedil;os de ${objetoHtml}`;
    const trechoContrato = shouldInlineContrato
      ? `, referente ao contrato ${htmlValue(context.contrato, 'numero do contrato', { bold: true })}`
      : '';

    htmlTexto = `Considerando a regularidade da documenta&ccedil;&atilde;o apresentada e o ateste ${trechoObjeto}${trechoContrato}, no &acirc;mbito do <i>Campus</i> Currais Novos (Processo n&ordm; ${processoHtml}), <b>AUTORIZO</b> a liquida&ccedil;&atilde;o da despesa no valor de ${valorHtml}, referente ao empenho ${empenhoHtml}, em favor de ${favorecidoHtml}.`;
  }

  return `
    <div style="font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; text-align: justify; color: black;">
      <div>À Coordenação de Finanças e Contratos do <i>Campus</i> Currais Novos</div>
      <div style="font-weight: bold; margin-top: 30px;">Assunto: Autoriza&ccedil;&atilde;o para a Liquida&ccedil;&atilde;o da Despesa</div>
      <div style="text-indent: 2.5cm; margin-top: 30px; margin-bottom: 25px;">${htmlTexto}</div>
      ${contratoHtml}
      <div style="margin-top: 25px;">Na sequ&ecirc;ncia, encaminhe-se o processo &agrave; Dire&ccedil;&atilde;o-Geral para an&aacute;lise e posterior autoriza&ccedil;&atilde;o do pagamento, em conformidade com o cronograma e a disponibilidade or&ccedil;ament&aacute;ria desta unidade.</div>
      <div style="margin-top: 40px;">Atenciosamente,</div>
    </div>
  `;
}

