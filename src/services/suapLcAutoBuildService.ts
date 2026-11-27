import type { SupabaseClient } from '@supabase/supabase-js';

import type { LcSavedList, LcSavedListExtraction } from '@/lib/lcSavedLists';
import type { SuapExtensionLcDocument, SuapExtensionLcStatus } from '@/lib/suapExtensionDispatch';
import {
  extractFromText,
  findExpectedBolsasCount,
  type BolsistaPdfRecord,
} from './bolsistasPdfService';
import type { LCRegistro } from './lcImportService';
import type { SaveSharedLcListInput } from './lcSavedListsService';
import { buildLcGridRows, countLcGridPendencias, type LcGridRow } from './lcWorkListBuilder';

export const LC_BOLSISTAS_AI_FUNCTION = 'extrair-bolsistas-documento';

export type SuapLcProcessInfo = {
  suapId: string;
  processNumber?: string;
  assunto?: string;
  tipoProcesso?: string;
};

export type PdfExtractionResult = {
  records: BolsistaPdfRecord[];
  expected?: number;
  warnings: string[];
  /** Paginas so com imagem (escaneadas): sem OCR no iframe, ficam para a IA. */
  imageOnlyPages?: number;
};

/** Prazo para ler um PDF: um PDF problematico nao pode travar a montagem. */
export const LC_PDF_READ_TIMEOUT_MS = 60_000;

export type AiExtractionInput = {
  document: SuapExtensionLcDocument;
  processNumber?: string;
  expectedCount?: number;
};

export type AiExtractionResult = {
  records: BolsistaPdfRecord[];
  declaredCount?: number;
};

/** Aluno encontrado no SUAP pela matricula (pagina /edu/aluno/<matricula>/). */
export type AlunoPorMatricula = { cpf: string; nome?: string };

export type SuapLcAutoBuildDeps = {
  requestDocuments: () => Promise<SuapExtensionLcDocument[]>;
  /**
   * Busca o CPF dos alunos que o documento identifica so pela matricula (o servidor informou a matricula
   * no lugar do CPF). Sem essa dep, as linhas ficam sem CPF e com pendencia.
   */
  resolveMatriculas?: (matriculas: string[]) => Promise<Map<string, AlunoPorMatricula>>;
  extractFromPdf: (document: SuapExtensionLcDocument) => Promise<PdfExtractionResult>;
  extractWithAi: (input: AiExtractionInput) => Promise<AiExtractionResult>;
  loadLcRows: () => Promise<LCRegistro[]>;
  findExisting: (suapId: string) => Promise<LcSavedList<LcGridRow> | null>;
  save: (input: SaveSharedLcListInput<LcGridRow>) => Promise<LcSavedList<LcGridRow>>;
  onStatus: (status: SuapExtensionLcStatus) => void;
  contaPagadora: string;
  now?: () => Date;
  pdfReadTimeoutMs?: number;
};

type DocumentReading = {
  document: SuapExtensionLcDocument;
  records: BolsistaPdfRecord[];
  complete: number;
  expected?: number;
  mentionsBolsa: boolean;
  warnings: string[];
};

const normalize = (value: string | undefined) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Pagamentos a estudantes com lista de credores: bolsas e auxilios da assistencia estudantil
// (ex.: Tipo "Pagamento de Auxílio-Transporte", "Auxílio-moradia", assunto "Programa de Auxílio Transporte").
const STUDENT_PAYMENT_PATTERN = new RegExp([
  '\\bbolsas?\\b',
  '\\bbolsistas?\\b',
  '\\bauxilios?[\\s-]*(?:estudantil|transporte|moradia|alimentacao|permanencia|creche|emergencial|didatico|material|saude|digital|conectividade|internet|inclusao)\\b',
  '\\bprograma de auxilio\\b',
  '\\bassistencia estudantil\\b',
  '\\bpafe\\b',
].join('|'));

/** Processo de pagamento a estudantes (bolsa ou auxilio estudantil) pelo assunto ou tipo do SUAP. */
export function isBolsaProcess(info: Pick<SuapLcProcessInfo, 'assunto' | 'tipoProcesso'>): boolean {
  return STUDENT_PAYMENT_PATTERN.test(`${normalize(info.assunto)} ${normalize(info.tipoProcesso)}`);
}

/** Titulo/tipo de documento que costuma trazer a relacao de alunos (a planilha anexa ao oficio). */
const LIST_DOCUMENT_PATTERN = /\b(?:planilha|folha|relacao|lista|listagem|bolsistas|beneficiarios|estudantes|alunos)\b/;
const isListDocument = (document: SuapExtensionLcDocument) =>
  LIST_DOCUMENT_PATTERN.test(normalize(`${document.type} ${document.title}`));

const hasBankData = (record: BolsistaPdfRecord) => Boolean(record.agencia?.trim() && record.conta?.trim());

const onlyDigits = (value: string | undefined) => String(value || '').replace(/\D/g, '');

/** Remove repetidos pelo CPF ou, sem CPF, pela matricula; registro sem nenhum dos dois e descartado. */
function dedupeByCpf(records: BolsistaPdfRecord[]): BolsistaPdfRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const cpf = onlyDigits(record.cpf);
    const matricula = onlyDigits(record.matricula);
    const key = cpf ? `cpf:${cpf}` : matricula ? `mat:${matricula}` : '';
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const formatCpf = (digits: string) => `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;

/**
 * Preenche o CPF (e o nome oficial) dos alunos identificados so pela matricula, consultando o SUAP.
 * Os que nao forem encontrados seguem sem CPF, com aviso: a grade os marca como pendencia.
 */
async function resolveRecordsByMatricula(
  records: BolsistaPdfRecord[],
  deps: SuapLcAutoBuildDeps,
  warnings: string[],
): Promise<BolsistaPdfRecord[]> {
  const pending = records.filter((record) => !onlyDigits(record.cpf) && onlyDigits(record.matricula));
  if (!pending.length) return records;

  let found = new Map<string, AlunoPorMatricula>();
  if (deps.resolveMatriculas) {
    try {
      found = await deps.resolveMatriculas([...new Set(pending.map((record) => onlyDigits(record.matricula)))]);
    } catch (error) {
      warnings.push(`Não foi possível consultar os alunos no SUAP: ${error instanceof Error ? error.message : 'falha desconhecida'}.`);
    }
  }

  const resolved = records.map((record) => {
    const matricula = onlyDigits(record.matricula);
    if (onlyDigits(record.cpf) || !matricula) return record;
    const aluno = found.get(matricula);
    const cpf = onlyDigits(aluno?.cpf);
    if (cpf.length !== 11) {
      warnings.push(`O documento traz a matrícula ${matricula}${record.nome ? ` (${record.nome})` : ''} no lugar do CPF e o CPF não foi encontrado no SUAP. Preencha na grade.`);
      return record;
    }
    // O nome do cadastro do aluno no SUAP e o oficial; o do documento pode vir com o nome de quem assina.
    return { ...record, cpf: formatCpf(cpf), nome: aluno?.nome?.trim() || record.nome };
  });
  const resolvedCount = pending.length - resolved.filter((record) => !onlyDigits(record.cpf)).length;
  if (resolvedCount > 0) {
    warnings.push(`${resolvedCount} aluno(s) identificado(s) pela matrícula: CPF obtido do cadastro do aluno no SUAP.`);
  }
  return dedupeByCpf(resolved);
}

async function readDocument(document: SuapExtensionLcDocument, deps: SuapLcAutoBuildDeps): Promise<DocumentReading> {
  const empty = { document, records: [], complete: 0, mentionsBolsa: false, warnings: [] as string[] };
  if (document.error) return { ...empty, warnings: [`${document.title}: ${document.error}`] };

  if (document.kind === 'text') {
    const text = document.text || '';
    const records = dedupeByCpf(extractFromText(text, document.title));
    return {
      document,
      records,
      complete: records.filter(hasBankData).length,
      expected: findExpectedBolsasCount(text),
      mentionsBolsa: STUDENT_PAYMENT_PATTERN.test(normalize(text)),
      warnings: [],
    };
  }

  if (!document.bytes) return empty;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('leitura do PDF excedeu o tempo limite.')), deps.pdfReadTimeoutMs ?? LC_PDF_READ_TIMEOUT_MS);
    });
    const result = await Promise.race([deps.extractFromPdf(document), timeout]);
    const records = dedupeByCpf(result.records);
    return {
      document,
      records,
      complete: records.filter(hasBankData).length,
      expected: result.expected,
      // PDF escaneado sem alunos lidos e candidato natural para a IA.
      mentionsBolsa: records.length > 0 || Boolean(result.imageOnlyPages),
      warnings: result.warnings,
    };
  } catch (error) {
    return { ...empty, warnings: [`${document.title}: ${error instanceof Error ? error.message : 'falha ao ler o PDF.'}`] };
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

/** A lista ja esta completa: ha alunos com dados bancarios e nenhum total declarado maior. */
function isSatisfied(readings: DocumentReading[]): boolean {
  const best = pickBest(readings);
  if (!best || best.complete === 0) return false;
  const expected = best.expected ?? readings.find((reading) => reading.expected !== undefined)?.expected;
  return expected === undefined || best.complete >= expected;
}

function pickBest(readings: DocumentReading[]): DocumentReading | undefined {
  return [...readings].sort((a, b) => b.complete - a.complete || b.records.length - a.records.length)[0];
}

/**
 * Documento enviado a IA quando o script falha. Ordem: o que declara o total de bolsas, a planilha/relacao
 * de alunos (o oficio costuma dizer "conforme planilha em anexo"), o que fala de bolsa/auxilio, o primeiro PDF.
 */
function pickAiCandidate(readings: DocumentReading[], best?: DocumentReading): DocumentReading | undefined {
  const usable = readings.filter((reading) => !reading.document.error && (reading.document.text || reading.document.bytes));
  if (best && best.records.length > 0) return best;
  return usable.find((reading) => reading.expected !== undefined)
    ?? usable.find((reading) => isListDocument(reading.document))
    ?? usable.find((reading) => reading.mentionsBolsa)
    ?? usable.find((reading) => reading.document.kind === 'pdf')
    ?? usable[0];
}

function buildListName(info: SuapLcProcessInfo): string {
  const processLabel = info.processNumber || `SUAP ${info.suapId}`;
  const assunto = (info.assunto || '').replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim();
  return (assunto ? `${assunto} — ${processLabel}` : `Processo ${processLabel}`).slice(0, 160);
}

function statusFromList(suapId: string, list: LcSavedList<LcGridRow>, stage: 'ready' | 'existing', message: string): SuapExtensionLcStatus {
  const extraction = list.extraction;
  // Com um aluno so, ele e o beneficiario do processo (o card Beneficiario do painel usa este dado
  // no lugar do extrator geral, que pode ter escolhido o servidor que abriu o processo).
  const single = list.rows.length === 1 ? list.rows[0] : undefined;
  const singleCpf = onlyDigits(single?.cpf);
  const singleNome = single?.nome?.trim() || '';
  const beneficiario = single && (singleNome || singleCpf)
    ? { nome: singleNome, cpf: singleCpf.length === 11 ? formatCpf(singleCpf) : singleCpf }
    : undefined;
  return {
    ...(beneficiario ? { beneficiario } : {}),
    suapId,
    stage,
    message,
    listId: list.id,
    listName: list.name,
    found: list.rows.length,
    pendencias: countLcGridPendencias(list.rows),
    ...(extraction?.expected !== undefined ? { expected: extraction.expected } : {}),
    ...(extraction?.method ? { method: extraction.method } : {}),
    ...(extraction?.warnings?.length ? { warnings: extraction.warnings } : {}),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: string }).code === '23505');
}

/**
 * Monta e salva a lista de trabalho da LC de um processo de bolsa do SUAP.
 * Sem `force`, uma lista ja existente para o processo e mantida (pode ter sido editada).
 * Retorna o status final, ou `null` quando o processo nao e de bolsa.
 */
export async function runSuapLcAutoBuild(
  info: SuapLcProcessInfo,
  deps: SuapLcAutoBuildDeps,
  options: { force?: boolean } = {},
): Promise<SuapExtensionLcStatus | null> {
  if (!isBolsaProcess(info)) return null;
  const { suapId } = info;
  const emit = (status: SuapExtensionLcStatus) => {
    deps.onStatus(status);
    return status;
  };

  try {
    const existing = await deps.findExisting(suapId);
    if (existing && !options.force) {
      return emit(statusFromList(suapId, existing, 'existing', 'Lista de credores já montada para este processo.'));
    }

    emit({ suapId, stage: 'collecting', message: 'Procurando a lista de alunos nos documentos do processo...' });
    const documents = await deps.requestDocuments();
    if (!documents.length) {
      return emit({ suapId, stage: 'empty', message: 'Nenhum documento legível foi encontrado no processo.', retryable: true });
    }

    // Texto primeiro (o oficio com os alunos e documento eletronico) e PDFs so se ainda faltar aluno:
    // assim um PDF anexado sem relacao (ex.: captura do SIAFI) nem chega a ser lido.
    const ordered = [...documents.filter((doc) => doc.kind === 'text'), ...documents.filter((doc) => doc.kind !== 'text')];
    const readings: DocumentReading[] = [];
    for (const [index, document] of ordered.entries()) {
      if (isSatisfied(readings)) break;
      emit({ suapId, stage: 'reading', message: `Lendo ${document.title} (${index + 1} de ${ordered.length})...` });
      readings.push(await readDocument(document, deps));
    }

    const warnings = readings.flatMap((reading) => reading.warnings);
    const best = pickBest(readings);
    let records = best?.records.filter(hasBankData) ?? [];
    let method: 'script' | 'ia' = 'script';
    let expected = best?.expected ?? readings.find((reading) => reading.expected !== undefined)?.expected;
    let sourceReading = best && records.length ? best : undefined;

    const scriptFailed = records.length === 0 || (expected !== undefined && records.length < expected);
    if (scriptFailed) {
      const candidate = pickAiCandidate(readings, best);
      if (candidate) {
        emit({ suapId, stage: 'ai', message: 'O script não leu todos os alunos; extraindo por IA...' });
        try {
          const ai = await deps.extractWithAi({ document: candidate.document, processNumber: info.processNumber, expectedCount: expected });
          const aiRecords = dedupeByCpf(ai.records).filter(hasBankData).map((record) => ({ ...record, ia: true }));
          expected = expected ?? ai.declaredCount;
          if (aiRecords.length > records.length) {
            records = aiRecords;
            method = 'ia';
            sourceReading = candidate;
          }
        } catch (error) {
          warnings.push(`IA indisponível: ${error instanceof Error ? error.message : 'falha desconhecida'}.`);
        }
      }
    }

    if (!records.length || !sourceReading) {
      return emit({
        suapId,
        stage: 'empty',
        message: 'Nenhum aluno com dados bancários foi identificado nos documentos do processo.',
        ...(warnings.length ? { warnings } : {}),
        retryable: true,
      });
    }

    if (records.some((record) => !onlyDigits(record.cpf))) {
      emit({ suapId, stage: 'reading', message: 'Buscando no SUAP o CPF dos alunos informados pela matrícula...' });
      records = await resolveRecordsByMatricula(records, deps, warnings);
    }

    if (expected !== undefined && records.length < expected) {
      warnings.push(`O documento declara ${expected} bolsa(s), mas só ${records.length} aluno(s) foram identificados. Confira o documento.`);
    }
    if (records.some((record) => record.ocr)) warnings.push('Há alunos lidos por OCR: confira CPF, agência e conta.');
    if (method === 'ia') warnings.push('Alunos extraídos por IA: confira CPF, agência e conta antes de gerar a macro.');

    emit({ suapId, stage: 'saving', message: 'Cruzando com a Lista de Credores e salvando...' });
    const lcRows = await deps.loadLcRows();
    const rows = buildLcGridRows(records, lcRows, deps.contaPagadora);
    const extraction: LcSavedListExtraction = {
      method,
      documents: [{ id: sourceReading.document.id, title: sourceReading.document.title, kind: sourceReading.document.kind }],
      ...(expected !== undefined ? { expected } : {}),
      found: rows.length,
      pendencias: countLcGridPendencias(rows),
      warnings,
      builtAt: (deps.now?.() ?? new Date()).toISOString(),
    };
    const input: SaveSharedLcListInput<LcGridRow> = {
      id: existing?.id ?? null,
      name: existing?.name || buildListName(info),
      sourcePdfNames: [sourceReading.document.title],
      rows,
      suapId,
      processNumber: info.processNumber || null,
      origin: 'extensao',
      extraction,
    };

    let saved: LcSavedList<LcGridRow>;
    try {
      saved = await deps.save(input);
    } catch (error) {
      // Outra aba (ou colega) montou a lista ao mesmo tempo: usa a que ficou salva.
      if (!isUniqueViolation(error)) throw error;
      const concurrent = await deps.findExisting(suapId);
      if (!concurrent) throw error;
      return emit(statusFromList(suapId, concurrent, 'existing', 'Lista de credores já montada para este processo.'));
    }

    return emit(statusFromList(suapId, saved, 'ready', `Lista de credores montada com ${rows.length} aluno(s).`));
  } catch (error) {
    return emit({
      suapId,
      stage: 'error',
      message: error instanceof Error ? error.message : 'Não foi possível montar a lista de credores.',
      retryable: true,
    });
  }
}

function arrayBufferToBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode(...view.subarray(i, i + chunk));
  }
  return btoa(binary);
}

type AiFunctionResponse = {
  bolsistas?: Array<{ nome?: string; cpf?: string; matricula?: string; banco?: string; agencia?: string; conta?: string; valor?: number }>;
  declaredCount?: number;
  error?: string;
};

/** Chama a Edge Function de IA de reserva com o documento (texto ou PDF). */
export async function extractBolsistasWithAi(input: AiExtractionInput, client: SupabaseClient): Promise<AiExtractionResult> {
  const { document } = input;
  const body: Record<string, unknown> = {
    title: document.title,
    processNumber: input.processNumber || '',
    ...(input.expectedCount ? { expectedCount: input.expectedCount } : {}),
  };
  if (document.kind === 'text' && document.text) body.text = document.text;
  else if (document.bytes) body.pdfBase64 = arrayBufferToBase64(document.bytes);
  else throw new Error('Documento sem conteúdo para a IA.');

  const { data, error } = await client.functions.invoke<AiFunctionResponse>(LC_BOLSISTAS_AI_FUNCTION, { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return {
    records: (data?.bolsistas ?? []).map((item) => ({
      nome: item.nome || '',
      cpf: item.cpf || '',
      ...(item.matricula ? { matricula: item.matricula } : {}),
      banco: item.banco || '',
      agencia: item.agencia || '',
      conta: item.conta || '',
      sourceFile: document.title,
      ...(typeof item.valor === 'number' ? { valor: item.valor } : {}),
    })),
    ...(data?.declaredCount ? { declaredCount: data.declaredCount } : {}),
  };
}
