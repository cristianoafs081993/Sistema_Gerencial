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

export type SuapLcAutoBuildDeps = {
  requestDocuments: () => Promise<SuapExtensionLcDocument[]>;
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

/** Mesmo criterio do mapa BPMN de bolsas (suapProcessFlow): assunto ou tipo com "bolsa"/"bolsista". */
export function isBolsaProcess(info: Pick<SuapLcProcessInfo, 'assunto' | 'tipoProcesso'>): boolean {
  return /\bbolsas?\b|\bbolsistas?\b/.test(`${normalize(info.assunto)} ${normalize(info.tipoProcesso)}`);
}

const hasBankData = (record: BolsistaPdfRecord) => Boolean(record.agencia?.trim() && record.conta?.trim());

function dedupeByCpf(records: BolsistaPdfRecord[]): BolsistaPdfRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = record.cpf.replace(/\D/g, '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
      mentionsBolsa: /bolsas?|bolsistas?/i.test(text),
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

/** Documento enviado a IA quando o script falha: o que declara o total de bolsas, o que fala de bolsa, ou o primeiro. */
function pickAiCandidate(readings: DocumentReading[], best?: DocumentReading): DocumentReading | undefined {
  const usable = readings.filter((reading) => !reading.document.error && (reading.document.text || reading.document.bytes));
  if (best && best.records.length > 0) return best;
  return usable.find((reading) => reading.expected !== undefined)
    ?? usable.find((reading) => reading.mentionsBolsa)
    ?? usable[0];
}

function buildListName(info: SuapLcProcessInfo): string {
  const processLabel = info.processNumber || `SUAP ${info.suapId}`;
  const assunto = (info.assunto || '').replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim();
  return (assunto ? `${assunto} — ${processLabel}` : `Processo ${processLabel}`).slice(0, 160);
}

function statusFromList(suapId: string, list: LcSavedList<LcGridRow>, stage: 'ready' | 'existing', message: string): SuapExtensionLcStatus {
  const extraction = list.extraction;
  return {
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
  bolsistas?: Array<{ nome?: string; cpf?: string; banco?: string; agencia?: string; conta?: string; valor?: number }>;
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
      banco: item.banco || '',
      agencia: item.agencia || '',
      conta: item.conta || '',
      sourceFile: document.title,
      ...(typeof item.valor === 'number' ? { valor: item.valor } : {}),
    })),
    ...(data?.declaredCount ? { declaredCount: data.declaredCount } : {}),
  };
}
