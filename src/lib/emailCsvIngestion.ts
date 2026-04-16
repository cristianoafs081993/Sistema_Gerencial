export type SupportedEmailCsvPipeline =
  | 'financeiro'
  | 'lc'
  | 'retencoes_efd_reinf'
  | 'descentralizacoes'
  | 'documentos_habeis'
  | 'liquidacoes'
  | 'ordens_bancarias'
  | 'situacoes_documentos'
  | 'creditos_disponiveis'
  | 'siafi_empenhos';

export type EmailCsvPipelineHint = SupportedEmailCsvPipeline | 'auto';

export interface FinanceiroRegistro {
  ugCodigo: string;
  ugNome: string;
  mesLancamento: string;
  fonteCodigo: string;
  fonteDescricao: string;
  vinculacaoCodigo: string;
  vinculacaoDescricao: string;
  saldo: number;
}

export interface LCRegistro {
  obListaCredores: string;
  sequencial: number;
  favorecidoDocumento: string;
  favorecidoNome: string;
  bancoCodigo: string;
  bancoNome: string;
  agenciaCodigo: string;
  agenciaNome: string;
  contaBancaria: string;
}

export interface RetencaoEfdReinfRegistro {
  sourceIndex: number;
  documentoHabil: string;
  dhProcesso: string;
  dhEstado: string;
  dhUgPagadora: string;
  dhItemUgPagadora: string;
  dhCredorDocumento: string;
  dhCredorNome: string;
  dhSituacao: string;
  dhDataEmissaoDocOrigem: string | null;
  dhDiaPagamento: string | null;
  dhItemDiaVencimento: string | null;
  dhItemDiaPagamento: string | null;
  dhItemLiquidado: boolean | null;
  dhValorDocOrigem: number;
  metrica: string;
  valorRetencao: number;
}

export interface DescentralizacaoImportRow {
  baseKey: string;
  rowKey: string;
  notaCredito: string;
  operacaoTipo: string;
  dimensao: string;
  origemRecurso: string;
  naturezaDespesa: string;
  planoInterno: string;
  dataEmissao: string | null;
  descricao: string;
  valor: number;
}

export interface DocumentoHabilImportDocument {
  id: string;
  valor_original: number;
  processo: string;
  estado: string;
  favorecido_documento: string;
  favorecido_nome: string;
  data_emissao: string;
}

export interface DocumentoHabilImportSituacao {
  documento_habil_id: string;
  situacao_codigo: string;
  valor: number;
  is_retencao: boolean;
}

export interface DocumentoHabilImportItem {
  id: string;
  documento_habil_id: string;
  doc_tipo: string;
  valor: number;
  data_emissao: string;
  observacao: string;
}

export interface LiquidacaoImportUpdate {
  documentoHabilId: string;
  empenhoNumero?: string;
  fonteSof?: string;
}

export interface OrdemBancariaImportItem {
  id: string;
  documento_habil_id: string;
  doc_tipo: string;
  valor: number;
  data_emissao: string;
  observacao: string;
}

export interface OrdemBancariaParentUpdate {
  documentoHabilId: string;
  empenhoNumero?: string;
}

export interface SituacaoDocumentoImportRow {
  documento_habil_id: string;
  situacao_codigo: string;
  valor: number;
  is_retencao: boolean;
}

export interface CreditoDisponivelImportRow {
  ptres: string;
  metrica: string;
  valor: number;
}

export interface SiafiEmpenhoData {
  numeroCompleto: string;
  numeroResumido: string;
  processo: string;
  favorecidoNome: string;
  favorecidoDocumento: string;
  descricao: string;
  naturezaDespesa: string;
  planoInterno: string;
  ptres: string;
  isRap: boolean;
  valorLiquidadoOficial: number;
  valorPagoOficial: number;
  valorEmpenhado: number;
  rapInscrito: number;
  rapALiquidar: number;
  rapLiquidado: number;
  rapPago: number;
  rapAPagar: number;
  valorLiquidadoAPagar: number;
  saldoRapOficial?: number;
  rapSaldoOnly?: boolean;
}

export type ParsedEmailCsvImport =
  | {
      pipeline: 'financeiro';
      rowCount: number;
      rows: FinanceiroRegistro[];
    }
  | {
      pipeline: 'lc';
      rowCount: number;
      rows: LCRegistro[];
    }
  | {
      pipeline: 'retencoes_efd_reinf';
      rowCount: number;
      rows: RetencaoEfdReinfRegistro[];
    }
  | {
      pipeline: 'descentralizacoes';
      rowCount: number;
      rows: DescentralizacaoImportRow[];
    }
  | {
      pipeline: 'documentos_habeis';
      rowCount: number;
      documentos: DocumentoHabilImportDocument[];
      situacoes: DocumentoHabilImportSituacao[];
      itens: DocumentoHabilImportItem[];
    }
  | {
      pipeline: 'liquidacoes';
      rowCount: number;
      updates: LiquidacaoImportUpdate[];
      empenhoNumbers: string[];
    }
  | {
      pipeline: 'ordens_bancarias';
      rowCount: number;
      items: OrdemBancariaImportItem[];
      parentUpdates: OrdemBancariaParentUpdate[];
      empenhoNumbers: string[];
    }
  | {
      pipeline: 'situacoes_documentos';
      rowCount: number;
      rows: SituacaoDocumentoImportRow[];
    }
  | {
      pipeline: 'creditos_disponiveis';
      rowCount: number;
      rows: CreditoDisponivelImportRow[];
    }
  | {
      pipeline: 'siafi_empenhos';
      rowCount: number;
      rows: SiafiEmpenhoData[];
    };

type HeaderCandidate = {
  index: number;
  separator: string;
  cells: string[];
  normalizedKeys: string[];
  normalizedJoined: string;
};

type NormalizedCsvParse = {
  rows: Record<string, string>[];
  headers: string[];
};

const PIPELINE_HINT_REGEX = /\[(?:pipeline|import):\s*([a-z0-9_]+)\s*\]/i;
const SUPPORTED_PIPELINES = new Set<SupportedEmailCsvPipeline>([
  'financeiro',
  'lc',
  'retencoes_efd_reinf',
  'descentralizacoes',
  'documentos_habeis',
  'liquidacoes',
  'ordens_bancarias',
  'situacoes_documentos',
  'creditos_disponiveis',
  'siafi_empenhos',
]);
const CANDIDATE_SEPARATORS = ['\t', ';', ',', '|'];

const PI_DIMENSAO_MAP: Record<string, string> = {
  AD: 'AD - Administracao',
  AE: 'AE - Atividades Estudantis',
  CI: 'CI - Comunicacao Institucional',
  EN: 'EN - Ensino',
  EX: 'EX - Extensao',
  GE: 'GE - Gestao Estrategica e Desenvolvimento Institucional',
  GO: 'GO - Governanca',
  GP: 'GP - Gestao de Pessoas',
  IE: 'IE - Infraestrutura',
  IN: 'IN - Internacionalizacao',
  PI: 'PI - Pesquisa, Pos-Graduacao e Inovacao',
  TI: 'TI - Tecnologia da Informacao e Comunicacao',
};

const NC_RESUMIDA_REGEX = /(\d{4}NC\d+)/i;
const ANULACAO_DESCENTRALIZACAO = 'ANULACAO DE DESCENTRALIZACAO DE CREDITO';
const DEVOLUCAO = 'DEVOLUCAO';

function splitCsvLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === separator && !inQuotes) {
      result.push(current.replace(/^"|"$/g, '').trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.replace(/^"|"$/g, '').trim());
  return result;
}

function normalizeText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeImportText(value?: string) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function normalizeSiafiHeader(value: string) {
  return normalizeText(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function summarizeNotaCredito(value?: string) {
  const normalizedValue = normalizeImportText(value).replace(/\s+/g, '');
  if (!normalizedValue) return '';

  const match = normalizedValue.match(NC_RESUMIDA_REGEX);
  return match?.[1] ?? normalizedValue;
}

function shouldImportDescentralizacaoAsNegative({
  operationType,
  description,
}: {
  operationType?: string;
  description?: string;
}) {
  const normalizedOperationType = normalizeImportText(operationType);
  if (normalizedOperationType.includes(ANULACAO_DESCENTRALIZACAO)) {
    return true;
  }

  return normalizeImportText(description).includes(DEVOLUCAO);
}

function createDescentralizacaoImportIdentity({
  dateKey,
  planoInterno,
  origemRecurso,
  naturezaDespesa,
  valor,
  notaCredito,
}: {
  dateKey: string;
  planoInterno: string;
  origemRecurso: string;
  naturezaDespesa: string;
  valor: number;
  notaCredito?: string;
}) {
  const baseKey = `${dateKey}|${planoInterno}|${origemRecurso}|${naturezaDespesa}|${valor}`;
  const rowKey = notaCredito ? `${baseKey}|${notaCredito}` : baseKey;
  return { baseKey, rowKey };
}

function normalizeKey(value: unknown) {
  return normalizeText(value).replace(/["']/g, '').replace(/[^a-z0-9]/g, '');
}

function parseCurrency(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const cleaned = String(value)
    .replace(/R\$\s*/gi, '')
    .replace(/\s/g, '')
    .trim();

  if (!cleaned) return 0;
  if (cleaned === '0') return 0;

  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      return Number.parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return Number.parseFloat(cleaned.replace(/,/g, '')) || 0;
  }

  if (cleaned.includes(',')) {
    return Number.parseFloat(cleaned.replace(',', '.')) || 0;
  }

  return Number.parseFloat(cleaned) || 0;
}

function normalizeDocId(id: string | undefined) {
  if (!id) return '';
  const trimmed = id.trim();
  return trimmed.length > 12 ? trimmed.slice(-12) : trimmed;
}

function stripBom(text: string) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseLines(text: string) {
  return stripBom(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}

function toIsoDate(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const dateOnly = raw.split(' ')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return dateOnly;
  }

  const brMatch = dateOnly.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return dateOnly.length >= 10 ? dateOnly.slice(0, 10) : null;
}

function formatDateForImports(value: unknown) {
  return toIsoDate(value) || new Date().toISOString().slice(0, 10);
}

function toBooleanLiquidado(value: unknown): boolean | null {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized) return null;
  if (normalized === 'SIM' || normalized === 'S') return true;
  if (normalized === 'NAO' || normalized === 'N') return false;
  return null;
}

function getHeaderCandidates(text: string, maxLines = 20): HeaderCandidate[] {
  const lines = parseLines(text).slice(0, maxLines);
  const candidates: HeaderCandidate[] = [];

  lines.forEach((line, index) => {
    for (const separator of CANDIDATE_SEPARATORS) {
      const cells = splitCsvLine(line, separator);
      if (cells.length < 2) continue;
      const normalizedKeys = cells.map(normalizeKey);
      candidates.push({
        index,
        separator,
        cells,
        normalizedKeys,
        normalizedJoined: cells.map(normalizeText).join(' | '),
      });
    }
  });

  return candidates;
}

function pickBestHeaderCandidate(text: string, expectedFields: string[]) {
  const expected = expectedFields.map(normalizeKey);
  const candidates = getHeaderCandidates(text);
  const best = candidates.reduce(
    (current, candidate) => {
      const score = expected.filter((field) => candidate.normalizedKeys.includes(field)).length;
      if (score > current.score) {
        return { score, candidate };
      }
      return current;
    },
    { score: 0, candidate: null as HeaderCandidate | null },
  );

  return best.candidate;
}

function parseNormalizedCsv(text: string, expectedFields: string[]): NormalizedCsvParse {
  const header = pickBestHeaderCandidate(text, expectedFields);
  if (!header) {
    throw new Error(`Nao foi possivel localizar o cabecalho esperado para: ${expectedFields.join(', ')}.`);
  }

  const lines = parseLines(text);
  const headers = header.cells.map((cell, index) => normalizeKey(cell) || `empty_${index}`);
  const rows = lines.slice(header.index + 1).map((line) => {
    const values = splitCsvLine(line, header.separator);
    const row: Record<string, string> = {};
    headers.forEach((key, index) => {
      row[key] = values[index] || '';
    });
    return row;
  });

  return { rows, headers };
}

function findMatrixHeader(
  text: string,
  matcher: (candidate: HeaderCandidate) => boolean,
): HeaderCandidate | null {
  return getHeaderCandidates(text).find(matcher) || null;
}

function findValue(row: Record<string, string>, patterns: RegExp[], fallbacks: string[] = []) {
  for (const key of fallbacks) {
    if (row[key] != null && String(row[key]).trim() !== '') return row[key];
  }

  for (const key of Object.keys(row)) {
    if (patterns.some((pattern) => pattern.test(key))) {
      const value = row[key];
      if (value != null && String(value).trim() !== '') return value;
    }
  }

  return '';
}

function deriveDimensaoFromPI(planoInterno: string) {
  const normalized = planoInterno.trim().toUpperCase();
  if (normalized.length < 3) return '';
  const suffix = normalized.substring(normalized.length - 3, normalized.length - 1);
  return PI_DIMENSAO_MAP[suffix] || '';
}

function formatDocumento(value: string) {
  const cleanDoc = value.replace(/\D/g, '');
  if (!cleanDoc) return value;
  if (cleanDoc.length === 14) {
    return cleanDoc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (cleanDoc.length === 11) {
    return cleanDoc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  if (cleanDoc.length > 11 && cleanDoc.length < 14) {
    const padded = cleanDoc.padStart(14, '0');
    return padded.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (cleanDoc.length >= 9 && cleanDoc.length <= 10) {
    const padded = cleanDoc.padStart(11, '0');
    return padded.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return cleanDoc;
}

function explicitPipelineHint(value?: string | null): SupportedEmailCsvPipeline | null {
  const match = value?.match(PIPELINE_HINT_REGEX);
  if (!match) return null;
  const hint = match[1]?.trim().toLowerCase() as SupportedEmailCsvPipeline;
  return SUPPORTED_PIPELINES.has(hint) ? hint : null;
}

function inferredPipelineByFileName(fileName: string): SupportedEmailCsvPipeline | null {
  const normalized = normalizeText(fileName);

  if (normalized.includes('financeiro')) return 'financeiro';
  if (normalized.includes('reinf') || normalized.includes('retenc')) return 'retencoes_efd_reinf';
  if (normalized.includes('credito') && normalized.includes('dispon')) return 'creditos_disponiveis';
  if (normalized.includes('ordens') && normalized.includes('banc')) return 'ordens_bancarias';
  if (normalized.includes('liquid') || (normalized.includes('fonte') && normalized.includes('sof'))) {
    return 'liquidacoes';
  }
  if (normalized.includes('documentos') && normalized.includes('habil')) return 'documentos_habeis';
  if (normalized.includes('situac') || normalized.includes('retencoes')) return 'situacoes_documentos';
  if (normalized.includes('descentraliz')) return 'descentralizacoes';
  if (normalized.includes('exec_ne_exercicio_rap') || normalized.includes('siafi')) return 'siafi_empenhos';

  const lcToken = normalized.match(/(^|[^a-z])lc([^a-z]|$)/);
  if (lcToken) return 'lc';

  return null;
}

function autoDetectPipeline(text: string, fileName: string, subject?: string) {
  const subjectHint = explicitPipelineHint(subject);
  if (subjectHint) return subjectHint;

  const fileNameHint = inferredPipelineByFileName(fileName);
  if (fileNameHint) return fileNameHint;

  const candidates = getHeaderCandidates(text);
  const hasHeader = (predicate: (candidate: HeaderCandidate) => boolean) => candidates.some(predicate);

  if (
    hasHeader(
      (candidate) =>
        candidate.normalizedJoined.includes('ug executora') &&
        candidate.normalizedJoined.includes('saldo - r$'),
    )
  ) {
    return 'financeiro';
  }

  if (
    hasHeader(
      (candidate) =>
        candidate.normalizedJoined.includes('ob - lista credores') &&
        candidate.normalizedJoined.includes('ob/lc - sequencial'),
    )
  ) {
    return 'lc';
  }

  if (
    hasHeader(
      (candidate) =>
        candidate.normalizedKeys.includes('documentohabil') &&
        candidate.normalizedKeys.includes('dhsituacao') &&
        candidate.normalizedKeys.includes('valorretencao'),
    )
  ) {
    return 'retencoes_efd_reinf';
  }

  if (
    hasHeader(
      (candidate) =>
        candidate.normalizedKeys.includes('nccelulaptres') &&
        candidate.normalizedKeys.includes('nccelulavalor'),
    )
  ) {
    return 'descentralizacoes';
  }

  if (
    hasHeader(
      (candidate) =>
        (candidate.normalizedKeys.includes('neccor') && candidate.normalizedKeys.includes('metrica')) ||
        candidate.normalizedKeys.includes('despesasempenhadascontroleempenho') ||
        candidate.normalizedKeys.includes('restosapagarinscritos'),
    )
  ) {
    return 'siafi_empenhos';
  }

  if (
    hasHeader(
      (candidate) =>
        candidate.normalizedKeys.includes('documentohabil') &&
        candidate.normalizedKeys.includes('dhprocesso') &&
        candidate.normalizedKeys.includes('dhestado'),
    )
  ) {
    return 'documentos_habeis';
  }

  if (
    hasHeader(
      (candidate) =>
        candidate.normalizedKeys.includes('neccor') &&
        candidate.normalizedKeys.includes('documentoorigem') &&
        (candidate.normalizedKeys.includes('fontesof') || candidate.normalizedKeys.includes('fonte')),
    )
  ) {
    return 'liquidacoes';
  }

  if (
    hasHeader(
      (candidate) =>
        candidate.normalizedKeys.includes('documento') &&
        candidate.normalizedKeys.includes('documentoorigem') &&
        (candidate.normalizedKeys.includes('despesaspagas') ||
          candidate.normalizedKeys.includes('restosapagarpagos')),
    )
  ) {
    return 'ordens_bancarias';
  }

  if (
    hasHeader(
      (candidate) =>
        candidate.normalizedKeys.includes('documentohabil') &&
        candidate.normalizedKeys.includes('dhsituacao') &&
        candidate.normalizedKeys.includes('dhvalordocorigem'),
    )
  ) {
    return 'situacoes_documentos';
  }

  if (
    hasHeader(
      (candidate) =>
        candidate.normalizedKeys.includes('ptres') &&
        candidate.normalizedKeys.includes('metrica') &&
        candidate.normalizedKeys.includes('valor'),
    )
  ) {
    return 'creditos_disponiveis';
  }

  throw new Error(`Nao foi possivel identificar automaticamente o pipeline do arquivo ${fileName}.`);
}

function parseFinanceiro(text: string): ParsedEmailCsvImport {
  const header = findMatrixHeader(
    text,
    (candidate) =>
      candidate.normalizedJoined.includes('ug executora') &&
      candidate.normalizedJoined.includes('saldo - r$'),
  );

  if (!header) {
    throw new Error('Nao foi possivel localizar o cabecalho do arquivo financeiro.');
  }

  const lines = parseLines(text);
  const rows = lines
    .slice(header.index + 1)
    .map((line) => splitCsvLine(line, header.separator))
    .map((row): FinanceiroRegistro | null => {
      const ugCodigo = String(row[0] || '').trim();
      const mesLancamento = String(row[2] || '').trim();
      const fonteCodigo = String(row[3] || '').trim();
      const vinculacaoCodigo = String(row[5] || '').trim();

      if (!ugCodigo || !mesLancamento || !fonteCodigo || !vinculacaoCodigo) return null;

      return {
        ugCodigo,
        ugNome: String(row[1] || '').trim(),
        mesLancamento,
        fonteCodigo,
        fonteDescricao: String(row[4] || '').trim(),
        vinculacaoCodigo,
        vinculacaoDescricao: String(row[6] || '').trim(),
        saldo: parseCurrency(row[7]),
      };
    })
    .filter((row): row is FinanceiroRegistro => row !== null);

  return { pipeline: 'financeiro', rowCount: rows.length, rows };
}

function parseLc(text: string): ParsedEmailCsvImport {
  const header = findMatrixHeader(
    text,
    (candidate) =>
      candidate.normalizedJoined.includes('ob - lista credores') &&
      candidate.normalizedJoined.includes('ob/lc - sequencial'),
  );

  if (!header) {
    throw new Error('Nao foi possivel localizar o cabecalho do arquivo LC.');
  }

  const lines = parseLines(text);
  const rows = lines
    .slice(header.index + 1)
    .map((line) => splitCsvLine(line, header.separator))
    .map((row): LCRegistro | null => {
      const obListaCredores = String(row[0] || '').trim();
      const sequencialRaw = String(row[1] || '').trim();
      const favorecidoDocumento = String(row[2] || '').trim();
      if (!obListaCredores || obListaCredores === '-9') return null;
      if (!sequencialRaw || sequencialRaw === '-9') return null;
      if (!favorecidoDocumento || favorecidoDocumento === '-9') return null;

      const sequencial = Number(sequencialRaw);
      if (!Number.isFinite(sequencial)) return null;

      return {
        obListaCredores,
        sequencial,
        favorecidoDocumento,
        favorecidoNome: String(row[3] || '').trim(),
        bancoCodigo: String(row[4] || '').trim(),
        bancoNome: String(row[5] || '').trim(),
        agenciaCodigo: String(row[6] || '').trim(),
        agenciaNome: String(row[7] || '').trim(),
        contaBancaria: String(row[8] || '').trim(),
      };
    })
    .filter((row): row is LCRegistro => row !== null);

  return { pipeline: 'lc', rowCount: rows.length, rows };
}

function parseRetencoesEfdReinf(text: string): ParsedEmailCsvImport {
  const parsed = parseNormalizedCsv(text, [
    'Documento Habil',
    'DH - Processo',
    'DH - Estado',
    'DH - UG Pagadora',
    'DH Item - UG Pagadora',
    'DH - Credor Documento',
    'DH - Credor Nome',
    'DH - Situacao',
    'DH - Data Emissao Doc.Origem',
    'DH - Dia Pagamento',
    'DH Item - Dia Vencimento',
    'DH Item - Dia Pagamento',
    'DH Item - Liquidado',
    'DH - Valor Doc.Origem',
    'Metrica',
    'Valor Retencao',
  ]);

  const rows = parsed.rows
    .map((row, index): RetencaoEfdReinfRegistro | null => {
      const documentoHabil = String(row.documentohabil || '').trim();
      if (!documentoHabil) return null;

      return {
        sourceIndex: index + 1,
        documentoHabil,
        dhProcesso: String(row.dhprocesso || '').trim(),
        dhEstado: String(row.dhestado || '').trim(),
        dhUgPagadora: String(row.dhugpagadora || '').trim(),
        dhItemUgPagadora: String(row.dhitemugpagadora || '').trim(),
        dhCredorDocumento: String(row.dhcredordocumento || '').trim(),
        dhCredorNome: String(row.dhcredornome || '').trim(),
        dhSituacao: String(row.dhsituacao || '').trim().toUpperCase(),
        dhDataEmissaoDocOrigem: toIsoDate(row.dhdataemissaodocorigem),
        dhDiaPagamento: toIsoDate(row.dhdiapagamento),
        dhItemDiaVencimento: toIsoDate(row.dhitemdiavencimento),
        dhItemDiaPagamento: toIsoDate(row.dhitemdiapagamento),
        dhItemLiquidado: toBooleanLiquidado(row.dhitemliquidado),
        dhValorDocOrigem: parseCurrency(row.dhvalordocorigem),
        metrica: String(row.metrica || '').trim(),
        valorRetencao: parseCurrency(row.valorretencao),
      };
    })
    .filter((row): row is RetencaoEfdReinfRegistro => row !== null);

  return { pipeline: 'retencoes_efd_reinf', rowCount: rows.length, rows };
}

function parseDescentralizacoes(text: string): ParsedEmailCsvImport {
  const parsed = parseNormalizedCsv(text, [
    'NC',
    'NC - Operacao (Tipo)',
    'NC - Dia Emissao',
    'NC - Descricao',
    'NC Celula - PTRES',
    'NC Celula - Natureza Despesa',
    'NC Celula - Plano Interno',
    'NC Celula - Valor',
  ]);

  const rows = parsed.rows
    .map((row): DescentralizacaoImportRow | null => {
      const notaCredito = summarizeNotaCredito(
        findValue(row, [/^nc$/i, /notacredito/i, /notadecredito/i], ['nc', 'notacredito', 'notadecredito']),
      );
      const operacaoTipo = findValue(
        row,
        [/operacaotip/i, /tipooperacao/i, /operacao/i],
        ['ncoperacaotipo', 'operacaotipo', 'tipooperacao'],
      );
      const planoInterno = findValue(
        row,
        [/planointern/i, /plano/i],
        ['nccelulaplanointerno', 'planointerno', 'plano_interno', 'plano'],
      )
        .trim()
        .toUpperCase();
      const origemRecurso = findValue(
        row,
        [/ptres/i, /origemrecurso/i, /origem/i],
        ['nccelulaptres', 'origemrecurso', 'origem_recurso', 'ptres'],
      ).trim();
      const naturezaDespesa = findValue(
        row,
        [/naturezadesp/i, /natureza/i],
        ['nccelulanaturezadespesa', 'naturezadespesa', 'natureza_despesa', 'natureza'],
      ).trim();
      const descricao = findValue(row, [/descr/i], ['ncdescricao', 'descricao']).trim();
      const dataEmissao = toIsoDate(
        findValue(row, [/diaemiss/i, /dataemiss/i, /data/i], ['ncdiaemissao', 'dataemissao', 'data_emissao']),
      );

      let valor = parseCurrency(findValue(row, [/valor/i], ['nccelulavalor', 'valor']));

      if (shouldImportDescentralizacaoAsNegative({ operationType: operacaoTipo, description: descricao })) {
        valor = -Math.abs(valor);
      }

      if (!planoInterno || !origemRecurso || !naturezaDespesa || valor === 0) {
        return null;
      }

      const { baseKey, rowKey } = createDescentralizacaoImportIdentity({
        dateKey: dataEmissao || '',
        planoInterno,
        origemRecurso,
        naturezaDespesa,
        valor,
        notaCredito,
      });

      return {
        baseKey,
        rowKey,
        notaCredito,
        operacaoTipo: operacaoTipo.trim(),
        dimensao: deriveDimensaoFromPI(planoInterno),
        origemRecurso,
        naturezaDespesa,
        planoInterno,
        dataEmissao,
        descricao,
        valor,
      };
    })
    .filter((row): row is DescentralizacaoImportRow => row !== null);

  return { pipeline: 'descentralizacoes', rowCount: rows.length, rows };
}

function parseDocumentosHabeis(text: string): ParsedEmailCsvImport {
  const parsed = parseNormalizedCsv(text, [
    'Documento Habil',
    'DH - Valor Doc.Origem',
    'DH - Processo',
    'DH - Estado',
    'DH - Credor',
  ]);

  const docsMap = new Map<
    string,
    {
      doc: DocumentoHabilImportDocument;
      situacoes: Map<string, DocumentoHabilImportSituacao>;
      itens: Map<string, DocumentoHabilImportItem>;
    }
  >();

  parsed.rows.forEach((row) => {
    const rawId = row.documentohabil || row.dhdocumentohabil || row.documento_habil || '';
    const id = normalizeDocId(rawId);
    if (!id) return;

    if (!docsMap.has(id)) {
      let favorecidoNome = row.favorecidonome || '';
      if (!favorecidoNome) {
        const credorIndex = parsed.headers.findIndex((headerName) => headerName === 'dhcredor' || headerName === 'credor');
        const candidate = credorIndex >= 0 ? parsed.headers[credorIndex + 1] : '';
        if (candidate?.startsWith('empty_')) {
          favorecidoNome = row[candidate] || '';
        }
      }

      docsMap.set(id, {
        doc: {
          id,
          valor_original: parseCurrency(row.dhvalordocorigem || row.valor || '0'),
          processo: row.dhprocesso || row.processo || '',
          estado: row.dhestado || row.estado || 'PENDENTE',
          favorecido_documento: row.dhcredor || row.credor || '',
          favorecido_nome: favorecidoNome,
          data_emissao: formatDateForImports(
            row.dhdataemissaodocorigem || row.data_emissao_doc_origem || row.dataemissao,
          ),
        },
        situacoes: new Map<string, DocumentoHabilImportSituacao>(),
        itens: new Map<string, DocumentoHabilImportItem>(),
      });
    }

    const current = docsMap.get(id);
    if (!current) return;

    const situacaoCodigo = row.dhsituacao || '';
    const situacaoValor = parseCurrency(row.metricavalor || row.dhvalordocorigem || row.valor || '0');

    if (situacaoCodigo && !['OB', 'NS', 'NC', 'DR', 'GR'].includes(situacaoCodigo)) {
      const key = `${situacaoCodigo}-${situacaoValor}`;
      current.situacoes.set(key, {
        documento_habil_id: id,
        situacao_codigo: situacaoCodigo,
        valor: situacaoValor,
        is_retencao:
          situacaoCodigo.startsWith('DDF') ||
          situacaoCodigo.startsWith('DDU') ||
          situacaoCodigo === 'DOB001' ||
          situacaoCodigo === 'DOB035',
      });
    }

    const itemTipo = row.dhitem || situacaoCodigo;
    const itemId = normalizeDocId(row.dhdocorigem || '');
    if (['OB', 'NS', 'NC', 'DR', 'GR'].includes(itemTipo)) {
      const itemValor = parseCurrency(row.dhvalordocorigem || row.valor || '0');
      const finalItemId = itemId || `${id}-${itemTipo}-${itemValor}`;
      current.itens.set(finalItemId, {
        id: finalItemId,
        documento_habil_id: id,
        doc_tipo: itemTipo,
        valor: itemValor,
        data_emissao: current.doc.data_emissao,
        observacao: row.observacao || row.docobservacao || '',
      });
    }
  });

  return {
    pipeline: 'documentos_habeis',
    rowCount: parsed.rows.length,
    documentos: Array.from(docsMap.values()).map((value) => value.doc),
    situacoes: Array.from(docsMap.values()).flatMap((value) => Array.from(value.situacoes.values())),
    itens: Array.from(docsMap.values()).flatMap((value) => Array.from(value.itens.values())),
  };
}

function parseLiquidacoes(text: string): ParsedEmailCsvImport {
  const parsed = parseNormalizedCsv(text, ['NE CCor', 'Documento Origem', 'Fonte SOF', 'Fonte']);
  const updatesMap = new Map<string, LiquidacaoImportUpdate>();
  const empenhoNumbers = new Set<string>();

  parsed.rows.forEach((row) => {
    const documentoHabilId = normalizeDocId(
      row.documentoorigem || row['documento origem'] || row.neccor || row.documento || '',
    );
    if (!documentoHabilId) return;

    const empenhoNumero = (row['ne ccor'] || row.neccor || row.empenho || '').trim();
    const fonteSof = (row.fontesof || row.fonte || row.fontedorecurso || '').trim();

    const update = updatesMap.get(documentoHabilId) || { documentoHabilId };
    if (empenhoNumero) {
      update.empenhoNumero = empenhoNumero;
      empenhoNumbers.add(empenhoNumero);
    }
    if (fonteSof && !['158366', '26435'].includes(fonteSof)) {
      update.fonteSof = fonteSof;
    }
    updatesMap.set(documentoHabilId, update);
  });

  return {
    pipeline: 'liquidacoes',
    rowCount: parsed.rows.length,
    updates: Array.from(updatesMap.values()),
    empenhoNumbers: Array.from(empenhoNumbers),
  };
}

function parseOrdensBancarias(text: string): ParsedEmailCsvImport {
  const parsed = parseNormalizedCsv(text, [
    'Documento',
    'Documento Origem',
    'DESPESAS PAGAS',
    'RESTOS A PAGAR PAGOS',
    'Dia Lancamento',
  ]);

  const itemsMap = new Map<string, OrdemBancariaImportItem>();
  const parentUpdates = new Map<string, OrdemBancariaParentUpdate>();
  const empenhoNumbers = new Set<string>();

  parsed.rows.forEach((row) => {
    const itemId = normalizeDocId(row.documento || '');
    const documentoHabilId = normalizeDocId(row.documentoorigem || row['documento origem'] || '');
    if (!itemId || !documentoHabilId) return;

    const empenhoNumero = (row['ne ccor'] || row.neccor || row.empenho || '').trim();
    if (empenhoNumero) {
      parentUpdates.set(documentoHabilId, {
        documentoHabilId,
        empenhoNumero,
      });
      empenhoNumbers.add(empenhoNumero);
    }

    const valor = parseCurrency(row.despesaspagas || row.restosapagarpagosprocenproc || row.valor || '0');
    const current = itemsMap.get(itemId);
    if (current) {
      current.valor += valor;
      return;
    }

    itemsMap.set(itemId, {
      id: itemId,
      documento_habil_id: documentoHabilId,
      doc_tipo: row.doctipo || 'OB',
      valor,
      data_emissao: formatDateForImports(row.dialancamento),
      observacao: row.docobservacao || '',
    });
  });

  return {
    pipeline: 'ordens_bancarias',
    rowCount: parsed.rows.length,
    items: Array.from(itemsMap.values()),
    parentUpdates: Array.from(parentUpdates.values()),
    empenhoNumbers: Array.from(empenhoNumbers),
  };
}

function parseSituacoesDocumentos(text: string): ParsedEmailCsvImport {
  const parsed = parseNormalizedCsv(text, ['Documento Habil', 'DH - Situacao', 'DH - Valor Doc.Origem']);
  const rows = parsed.rows
    .map((row): SituacaoDocumentoImportRow | null => {
      const documento_habil_id = normalizeDocId(row.documentohabil);
      const situacao_codigo = String(row.dhsituacao || '').trim();
      if (!documento_habil_id || !situacao_codigo) return null;

      return {
        documento_habil_id,
        situacao_codigo,
        valor: parseCurrency(row.dhvalordocorigem),
        is_retencao:
          situacao_codigo.startsWith('DDF') ||
          situacao_codigo.startsWith('DDU') ||
          situacao_codigo === 'DOB001' ||
          situacao_codigo === 'DOB035',
      };
    })
    .filter((row): row is SituacaoDocumentoImportRow => row !== null);

  return { pipeline: 'situacoes_documentos', rowCount: rows.length, rows };
}

function parseCreditosDisponiveis(text: string): ParsedEmailCsvImport {
  const parsed = parseNormalizedCsv(text, ['PTRES', 'Metrica', 'Valor']);
  const updatesMap = new Map<string, CreditoDisponivelImportRow>();

  parsed.rows.forEach((row) => {
    const ptres = String(row.ptres || '').trim();
    if (!ptres) return;

    const metrica = String(row.metrica || '').trim();
    const valor = parseCurrency(row.valor_disponivel || row.valor_diponivel || row.valor || '');
    const current = updatesMap.get(ptres);
    if (current) {
      current.valor += valor;
      return;
    }

    updatesMap.set(ptres, { ptres, metrica, valor });
  });

  return {
    pipeline: 'creditos_disponiveis',
    rowCount: Array.from(updatesMap.values()).length,
    rows: Array.from(updatesMap.values()),
  };
}

function parseSiafiEmpenhos(text: string): ParsedEmailCsvImport {
  const rapSaldoHeader = findMatrixHeader(
    text,
    (candidate) =>
      candidate.normalizedKeys.includes('neccor') &&
      candidate.normalizedKeys.includes('metrica') &&
      !candidate.normalizedKeys.includes('despesasempenhadascontroleempenho'),
  );

  if (rapSaldoHeader) {
    const lines = parseLines(text);
    const headers = splitCsvLine(lines[rapSaldoHeader.index], rapSaldoHeader.separator);
    const findCol = (...keywords: string[]) => {
      for (const keyword of keywords) {
        const normalizedKeyword = normalizeSiafiHeader(keyword);
        const index = headers.findIndex((headerCell) =>
          normalizeSiafiHeader(headerCell).includes(normalizedKeyword),
        );
        if (index !== -1) return index;
      }

      return -1;
    };

    const colNE = headers.findIndex((headerCell) => normalizeSiafiHeader(headerCell) === 'NECCOR');
    const colMetrica = findCol('Metrica');
    const colValor = findCol('Valor', 'Saldo', 'Saldo - Moeda Origem');

    if (colNE === -1 || colMetrica === -1) {
      throw new Error('Colunas "NE CCor" e "Metrica" sao obrigatorias no CSV de saldo de RAP.');
    }

    const rows = lines
      .slice(rapSaldoHeader.index + 1)
      .map((line) => splitCsvLine(line, rapSaldoHeader.separator))
      .map((cols): SiafiEmpenhoData | null => {
        const numeroCompleto = String(cols[colNE] || '').trim();
        if (!numeroCompleto || !numeroCompleto.includes('NE')) return null;

        const metrica = String(cols[colMetrica] || '').trim();
        if (metrica && !normalizeImportText(metrica).includes('SALDO')) return null;

        const fallbackValue = cols.find(
          (value, index) => index !== colNE && index !== colMetrica && String(value || '').trim(),
        );
        const saldoRapOficial = parseCurrency(colValor >= 0 ? cols[colValor] : fallbackValue || '');
        const numeroResumido = numeroCompleto.match(/(\d{4}NE\d+)/)?.[1] || numeroCompleto;

        return {
          numeroCompleto,
          numeroResumido,
          processo: '',
          favorecidoNome: '',
          favorecidoDocumento: '',
          descricao: '',
          naturezaDespesa: '',
          planoInterno: '',
          ptres: '',
          isRap: true,
          valorEmpenhado: 0,
          valorLiquidadoOficial: 0,
          valorPagoOficial: 0,
          valorLiquidadoAPagar: 0,
          rapInscrito: 0,
          rapALiquidar: 0,
          rapLiquidado: 0,
          rapPago: 0,
          rapAPagar: saldoRapOficial,
          saldoRapOficial,
          rapSaldoOnly: true,
        };
      })
      .filter((row): row is SiafiEmpenhoData => row !== null);

    return { pipeline: 'siafi_empenhos', rowCount: rows.length, rows };
  }

  const header = findMatrixHeader(
    text,
    (candidate) =>
      candidate.normalizedKeys.includes('neccor') &&
      (candidate.normalizedKeys.includes('despesasempenhadascontroleempenho') ||
        candidate.normalizedKeys.includes('restosapagarinscritos')),
  );

  if (!header) {
    throw new Error('Coluna "NE CCor" nao encontrada nas primeiras linhas do arquivo SIAFI.');
  }

  const lines = parseLines(text);
  const headers = splitCsvLine(lines[header.index], header.separator);
  const findCol = (...keywords: string[]) => {
    for (const keyword of keywords) {
      const normalizedKeyword = normalizeSiafiHeader(keyword);
      const index = headers.findIndex((headerCell) =>
        normalizeSiafiHeader(headerCell).includes(normalizedKeyword),
      );
      if (index !== -1) return index;
    }

    return -1;
  };

  const colNE = headers.findIndex((headerCell) => normalizeSiafiHeader(headerCell) === 'NECCOR');
  const colProcesso = findCol('Num. Processo');
  const colFavorecidoNome = findCol('Favorecido Nome');
  const colFavorecidoNumero = findCol('Favorecido Numero');
  const colDescricao = findCol('Descricao', 'Observacao', 'Historico');
  const colNatureza = findCol('Natureza Despesa');
  const colPlanoInterno = findCol('PI Codigo') !== -1 ? findCol('PI Codigo') : findCol('Plano Interno');
  const colPtres = findCol('PTRES');
  const colEmpenhadas = findCol('DESPESAS EMPENHADAS (CONTROLE EMPENHO)');
  const colLiquidadas = findCol('DESPESAS LIQUIDADAS (CONTROLE EMPENHO)');
  const colPagas = findCol('DESPESAS PAGAS (CONTROLE EMPENHO)');
  const colLiquidadasAPagar = findCol('DESPESAS LIQUIDADAS A PAGAR (CONTROLE EMPENHO)');
  const colRapInscritos = findCol('RESTOS A PAGAR INSCRITOS');
  const colRapALiquidar = findCol(
    'RESTOS A PAGAR NAO PROCESSADOS A LIQUIDAR',
    'RESTOS A PAGAR NAO PROCESSADOS REINSCRITOS',
  );
  const colRapLiquidadoAPagar = findCol(
    'RESTOS A PAGAR NAO PROCES. LIQUIDADOS A PAGAR',
    'RESTOS A PAGAR NAO PROCESSADOS LIQUIDADOS A PAGAR',
  );
  const colRapPagos = findCol('RESTOS A PAGAR PAGOS');
  const colRapAPagar = findCol('RESTOS A PAGAR A PAGAR');

  if (colNE === -1) {
    throw new Error('Coluna "NE CCor" nao encontrada no arquivo SIAFI.');
  }

  let currentYear = 0;
  for (let index = header.index + 1; index < lines.length; index += 1) {
    const match = lines[index].match(/(\d{4})NE\d+/);
    if (!match) continue;
    const year = Number.parseInt(match[1], 10);
    if (year > currentYear) currentYear = year;
  }
  if (!currentYear) currentYear = new Date().getFullYear();

  const rows = lines
    .slice(header.index + 1)
    .map((line) => splitCsvLine(line, header.separator))
    .map((cols): SiafiEmpenhoData | null => {
      const numeroCompleto = String(cols[colNE] || '').trim();
      if (!numeroCompleto || !numeroCompleto.includes('NE')) return null;

      const numeroResumido = numeroCompleto.match(/(\d{4}NE\d+)/)?.[1] || numeroCompleto;
      const anoEmpenho = Number.parseInt(numeroResumido.slice(0, 4), 10);
      const isRap = anoEmpenho < currentYear;
      const safeValue = (index: number) => (index >= 0 && index < cols.length ? cols[index] : '');

      const valorEmpenhado = parseCurrency(safeValue(colEmpenhadas));
      const valorLiquidadoOficial = parseCurrency(safeValue(colLiquidadas));
      const valorPagoOficial = parseCurrency(safeValue(colPagas));
      const valorLiquidadoAPagar = isRap
        ? parseCurrency(safeValue(colRapLiquidadoAPagar))
        : colLiquidadasAPagar !== -1
          ? parseCurrency(safeValue(colLiquidadasAPagar))
          : valorLiquidadoOficial - valorPagoOficial;

      const rapInscrito = parseCurrency(safeValue(colRapInscritos));
      const rapALiquidar = parseCurrency(safeValue(colRapALiquidar));
      const rapPago = parseCurrency(safeValue(colRapPagos));
      const rapAPagar = parseCurrency(safeValue(colRapAPagar));
      const rapLiquidado = Math.max(0, rapInscrito - rapALiquidar);

      return {
        numeroCompleto,
        numeroResumido,
        processo: String(safeValue(colProcesso) || '').trim(),
        favorecidoNome: String(safeValue(colFavorecidoNome) || '').trim(),
        favorecidoDocumento: formatDocumento(String(safeValue(colFavorecidoNumero) || '').trim()),
        descricao: String(safeValue(colDescricao) || '').trim(),
        naturezaDespesa: String(safeValue(colNatureza) || '').trim(),
        planoInterno: String(safeValue(colPlanoInterno) || '').trim(),
        ptres: String(safeValue(colPtres) || '').trim(),
        isRap,
        valorEmpenhado,
        valorLiquidadoOficial,
        valorPagoOficial,
        valorLiquidadoAPagar,
        rapInscrito,
        rapALiquidar,
        rapLiquidado,
        rapPago,
        rapAPagar,
      };
    })
    .filter((row): row is SiafiEmpenhoData => row !== null);

  return { pipeline: 'siafi_empenhos', rowCount: rows.length, rows };
}

export function decodeCsvBytes(bytes: Uint8Array) {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes);
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes);
  }

  const utf8 = new TextDecoder('utf-8').decode(bytes);
  if (utf8.includes('\ufffd')) {
    return new TextDecoder('iso-8859-1').decode(bytes);
  }

  return utf8;
}

export function extractEmailAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return normalizeText(match?.[1] || value);
}

export function parseEmailCsvImport({
  fileName,
  text,
  pipelineHint = 'auto',
  subject,
}: {
  fileName: string;
  text: string;
  pipelineHint?: EmailCsvPipelineHint;
  subject?: string;
}): ParsedEmailCsvImport {
  const normalizedText = stripBom(text);
  const pipeline =
    pipelineHint !== 'auto'
      ? pipelineHint
      : autoDetectPipeline(normalizedText, fileName, subject);

  switch (pipeline) {
    case 'financeiro':
      return parseFinanceiro(normalizedText);
    case 'lc':
      return parseLc(normalizedText);
    case 'retencoes_efd_reinf':
      return parseRetencoesEfdReinf(normalizedText);
    case 'descentralizacoes':
      return parseDescentralizacoes(normalizedText);
    case 'documentos_habeis':
      return parseDocumentosHabeis(normalizedText);
    case 'liquidacoes':
      return parseLiquidacoes(normalizedText);
    case 'ordens_bancarias':
      return parseOrdensBancarias(normalizedText);
    case 'situacoes_documentos':
      return parseSituacoesDocumentos(normalizedText);
    case 'creditos_disponiveis':
      return parseCreditosDisponiveis(normalizedText);
    case 'siafi_empenhos':
      return parseSiafiEmpenhos(normalizedText);
    default:
      throw new Error(`Pipeline nao suportado: ${pipeline satisfies never}`);
  }
}
