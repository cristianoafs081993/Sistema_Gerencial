import * as pdfjsLib from 'pdfjs-dist';
import * as pdfWorkerAsset from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { createPdfOcrSession } from './pdfOcrService';

const bundledWorkerUrl = (pdfWorkerAsset as { default?: unknown }).default;
pdfjsLib.GlobalWorkerOptions.workerSrc = typeof bundledWorkerUrl === 'string'
  ? bundledWorkerUrl
  : new URL('../../node_modules/pdfjs-dist/build/pdf.worker.min.js', import.meta.url).href;

export interface BolsistaPdfRecord {
  cpf: string;
  nome: string;
  banco: string;
  agencia: string;
  conta: string;
  sourceFile: string;
  valor?: number;
  /** true quando algum dado do registro veio de OCR (pagina escaneada) e precisa de conferencia. */
  ocr?: boolean;
  /** true quando o registro foi extraido por IA (o script nao leu o documento) e precisa de conferencia. */
  ia?: boolean;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

// Texto de paginas lidas por OCR e delimitado por caracteres de uso privado para que o parser saiba
// quais registros dependem de OCR. Os marcadores sao removidos antes de qualquer regex.
const OCR_START = '';
const OCR_END = '';

function wrapOcrText(text: string): string {
  return `${OCR_START}${text}${OCR_END}`;
}

function splitOcrMarkers(raw: string): { text: string; ocrRanges: Array<[number, number]> } {
  if (!raw.includes(OCR_START)) return { text: raw, ocrRanges: [] };

  let text = '';
  let rangeStart = -1;
  const ocrRanges: Array<[number, number]> = [];
  for (const char of raw) {
    if (char === OCR_START) {
      rangeStart = text.length;
    } else if (char === OCR_END) {
      if (rangeStart >= 0) ocrRanges.push([rangeStart, text.length]);
      rangeStart = -1;
    } else {
      text += char;
    }
  }
  return { text, ocrRanges };
}

// Agencia e conta so tem digitos (e hifen/X): troca as confusoes tipicas de OCR entre letras e numeros.
function fixOcrDigits(value: string): string {
  return value.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1');
}

// O OCR erra os separadores do CPF ("709.443 .734-02", "709,443.734-02"). Sem o formato exato o CPF nao e
// reconhecido e o aluno some do resultado, entao os separadores sao normalizados antes do parser.
const OCR_DIGIT = '[\\dOoIl|]';
const OCR_CPF_AFTER_LABEL = new RegExp(
  `\\bCPF\\b[\\s:]*(${OCR_DIGIT}{3})[\\s.,]*(${OCR_DIGIT}{3})[\\s.,]*(${OCR_DIGIT}{3})[\\s.,\\-\\u2013\\u2014]*(${OCR_DIGIT}{2})(?!\\d)`,
  'gi',
);
const OCR_CPF_WITH_SEPARATORS = /(\d{3})\s*[.,]\s*(\d{3})\s*[.,]\s*(\d{3})\s*[-–—]\s*(\d{2})/g;

function normalizeOcrText(text: string): string {
  return text
    .replace(OCR_CPF_AFTER_LABEL, (_match, a: string, b: string, c: string, d: string) =>
      `CPF ${fixOcrDigits(a)}.${fixOcrDigits(b)}.${fixOcrDigits(c)}-${fixOcrDigits(d)}`)
    .replace(OCR_CPF_WITH_SEPARATORS, '$1.$2.$3-$4');
}

// "... relativa à 5 (cinco) bolsas ..." — total de bolsistas declarado no oficio, usado para detectar alunos nao lidos.
export function findExpectedBolsasCount(text: string): number | undefined {
  const match = text.match(/(\d{1,3})\s*\(\s*[A-Za-zÀ-ÿ\s-]+?\s*\)\s*bolsas?\b/i);
  const count = match ? parseInt(match[1], 10) : NaN;
  return Number.isFinite(count) && count > 0 ? count : undefined;
}

// Para o primeiro bolsista, o contexto inclui o fim do paragrafo anterior ("... Laboratorio 3 TAL.  Ana Larissia ...").
// Remove esse final de frase: o pdfjs separa os itens por 2+ espacos e siglas em maiusculas terminam em ponto.
function stripLeadingSentence(candidate: string): string {
  const afterSentence = candidate.split(/\.\s{2,}/).pop() ?? candidate;
  return normalizeWhitespace(afterSentence).replace(/^.*?\b[A-ZÀ-Ý]{2,}\.\s+(?=\S)/, '');
}

function extractNameNear(text: string, start: number, end: number): string {
  const context = text.slice(Math.max(0, start), Math.max(start, end));
  const matriculaMatches = [...context.matchAll(/([A-ZÀ-ÿ][A-Za-zÀ-ÿ'`´\s.-]{6,}?)\s*\(\d{6,}\)/g)];
  if (matriculaMatches.length) {
    // No texto do oficio eletronico (HTML do SUAP) o nome fica em linha propria: o que vem antes da
    // quebra de linha e o fim do bloco anterior ("... TAL", "Conta 12.345-X") e nao faz parte do nome.
    const rawCandidate = matriculaMatches[matriculaMatches.length - 1]?.[1] || '';
    const candidate = rawCandidate.split('\n').map((line) => line.trim()).filter(Boolean).pop() || '';
    if (candidate) return stripLeadingSentence(candidate);
  }

  const lines = context
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (line.length < 6) continue;
    if (/^\d+$/.test(line)) continue;
    if (/^(CPF|Banco|Ag[êe]ncia|Conta|Empenho|Curso|E-mail|Endere[çc]o)\b/i.test(line)) continue;
    if (/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(line)) continue;
    return line;
  }

  return '';
}

function extractFieldAfterLabel(segment: string, labelRegex: RegExp): string {
  const match = segment.match(labelRegex);
  if (!match?.[1]) return '';
  return normalizeWhitespace(match[1]);
}

function normalizeForDetection(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function parseCurrencyValue(value: string): number {
  return parseFloat(value.replace(/\./g, '').replace(',', '.'));
}

// Marcadores de rodape no fim do nome: sobrescritos (\u00b9\u00b2\u00b3), caractere de substituicao e asteriscos (*, **, ***).
function cleanStudentName(value: string): string {
  return normalizeWhitespace(value).replace(/\s*[\u00b9\u00b2\u00b3\uFFFD*]+$/g, '').trim();
}

function extractPafeTableRows(text: string, sourceFile: string): BolsistaPdfRecord[] {
  const headerProbe = normalizeForDetection(text);
  const hasPafeHeader =
    /VR\s*R\$/.test(headerProbe) &&
    /\bCPF\b/.test(headerProbe) &&
    /DADOS\s+BANC.RIOS/.test(headerProbe) &&
    /\bBANCO\b/.test(headerProbe) &&
    /AG.NCIA/.test(headerProbe) &&
    /\bOP\./.test(headerProbe) &&
    /\bCONTA\b/.test(headerProbe);

  if (!hasPafeHeader) return [];

  const rows: BolsistaPdfRecord[] = [];
  const normalizedText = normalizeWhitespace(text);
  const rowRegex = /(?:^|\s)(\d{1,3})\s+(.+?)\s+(\d{10,15})\s+(.+?)\s+(MAT\.|VESP\.|NOT\.)\s+R\$\s*([0-9.,]+)\s+(\d{3}\.\d{3}\.\d{3}-\d{2})\s+(\d{2,4})\s+([0-9A-Za-z.-]+)\s+(?:(\d{1,4})\s+)?([0-9A-Za-z.-]+)(?=\s+\d{1,3}\s+|\s+Total\b|\s+INSTITUTO\b|$)/gi;

  for (const match of normalizedText.matchAll(rowRegex)) {
    rows.push({
      nome: cleanStudentName(match[2]),
      cpf: match[7],
      banco: match[8],
      agencia: match[9],
      conta: match[11],
      sourceFile,
      valor: parseCurrencyValue(match[6]),
    });
  }

  return rows;
}

export function extractFromText(rawText: string, sourceFile: string): BolsistaPdfRecord[] {
  const { text, ocrRanges } = splitOcrMarkers(rawText);
  const hasOcr = ocrRanges.length > 0;
  // Nos layouts de tabela o texto e normalizado (indices mudam), entao qualquer pagina OCR marca todos os registros.
  const markOcr = (rows: BolsistaPdfRecord[]) => (hasOcr ? rows.map((row) => ({ ...row, ocr: true })) : rows);
  const overlapsOcr = (from: number, to: number) => ocrRanges.some(([start, end]) => start < to && end > from);

  const cleanText = text.replace(/\s+/g, ' ');
  const found: BolsistaPdfRecord[] = [];
  const pafeRows = extractPafeTableRows(text, sourceFile);
  if (pafeRows.length) return markOcr(pafeRows);

  // Layout 1: Old table — headers like "MATRÍCULA CPF BANCO" or "VALOR REFERÊNCIA"
  // Columns: Seq Nome Matrícula CPF Banco Agência [OP] Conta [Valor]
  const isOldTableFormat = /MATRÍCULA\s+CPF\s+BANCO/i.test(text) || /VALOR\s+REFERÊNCIA/i.test(text);

  // Layout 2: New table — headers with "VR R$" and "MATRÍCULA"
  // Columns: N° Nome Matrícula Setor Turno Valor R$ CPF Banco Agência [OP] Conta
  const isNewTableFormat = !isOldTableFormat && /VR\s+R\$/i.test(text) && /MATRÍCULA/i.test(text);

  if (isOldTableFormat) {
    const studentRegex = /(\d+)\s+([A-ZÀ-ÿ][A-Za-zÀ-ÿ'`´\s.*-]{4,80}?)\s+(\d{10,15})\s+(\d{3}\.\d{3}\.\d{3}-\d{2})\s+(\d{2,4})\s+([0-9A-Za-z.-]+)\s+(?:([0-9A-Za-z.-]+)\s+)?([0-9A-Za-z.-]+)\s+(?:R\$\s*)?([0-9.,]+)/g;
    const matches = [...cleanText.matchAll(studentRegex)];
    
    for (const m of matches) {
      const cpf = m[4];
      const nome = cleanStudentName(m[2]);
      const banco = m[5];
      const agencia = m[6];
      const conta = m[8];
      const valorStr = m[9].replace(/\./g, '').replace(',', '.');
      const valor = parseFloat(valorStr);

      found.push({ cpf, nome, banco, agencia, conta, sourceFile, valor });
    }
  } else if (isNewTableFormat) {
    // Regex: seq  nome  matrícula  setor  turno  valor R$  CPF  banco  agência  [op]  conta
    const studentRegex = /(\d{1,3})\s+([A-ZÀ-ÿ][A-Za-zÀ-ÿ'`´\s.²¹³*-]{4,80}?)\s+(\d{10,15})\s+([A-Za-zÀ-ÿ.\s]+?)\s+(?:MAT\.|VESP\.|NOT\.)\s+([0-9.,]+)\s*R\$\s+(\d{3}\.\d{3}\.\d{3}-\d{2})\s+(\d{2,4})\s+([0-9A-Za-z-]+)\s+(?:(\d{3,4})\s+)?([0-9A-Za-z.-]+)/g;
    const matches = [...cleanText.matchAll(studentRegex)];

    for (const m of matches) {
      const cpf = m[6];
      const nome = cleanStudentName(m[2]);
      const banco = m[7];
      const agencia = m[8];
      const conta = m[10];
      const valorStr = m[5].replace(/\./g, '').replace(',', '.');
      const valor = parseFloat(valorStr);

      found.push({ cpf, nome, banco, agencia, conta, sourceFile, valor });
    }
  } else {
    // Layout 3: Labeled format — individual fields with labels like "CPF", "Banco", "Agência", "Conta"
    let docValor: number | undefined = undefined;
    const valorMatch = text.match(/(?:valor de|corresponde a|individual de)\s*R\$\s*([0-9.,]+)/i) || text.match(/R\$\s*([0-9.,]+)/i);
    if (valorMatch?.[1]) {
      docValor = parseFloat(valorMatch[1].replace(/\./g, '').replace(',', '.'));
    }

    const cpfRegex = /\d{3}\.\d{3}\.\d{3}-\d{2}/g;
    const matches = [...text.matchAll(cpfRegex)];
    const seen = new Set<string>();

    for (let i = 0; i < matches.length; i += 1) {
      const match = matches[i];
      const cpf = match[0];
      const idx = match.index ?? 0;
      const key = `${sourceFile}|${cpf}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const prevCpfIndex = i > 0 ? (matches[i - 1].index ?? 0) : Math.max(0, idx - 350);
      const nextCpfIndex = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : Math.min(text.length, idx + 450);
      const segment = text.slice(idx, nextCpfIndex);

      const fromOcr = overlapsOcr(prevCpfIndex, nextCpfIndex);

      const nome = extractNameNear(text, prevCpfIndex, idx);
      const banco = extractFieldAfterLabel(segment, /Banco\s+(.+?)(?:\s+Dados\b|\s+Empenho\b|\s+Ag[êe]ncia\b|\s+Conta\b|$)/i);
      // Separadores como "—" ou "|" aparecem entre o rotulo e o valor quando a celula vem de OCR ("Agência — 0001").
      const agencia = extractFieldAfterLabel(segment, /Ag[êe]ncia[\s—–|:]*([0-9A-Za-z-]+)/i);
      // Contas com ponto ("12.345-X") aparecem no oficio eletronico; o ponto final da frase nao entra.
      const conta = extractFieldAfterLabel(segment, /Conta[\s—–|:]*([0-9A-Za-z](?:[0-9A-Za-z.-]*[0-9A-Za-z])?)/i);

      found.push({
        cpf,
        nome,
        banco,
        agencia: fromOcr ? fixOcrDigits(agencia) : agencia,
        conta: fromOcr ? fixOcrDigits(conta) : conta,
        sourceFile,
        valor: docValor,
        ...(fromOcr ? { ocr: true } : {}),
      });
    }
  }

  return isOldTableFormat || isNewTableFormat ? markOcr(found) : found;
}

export interface BolsistaPdfWarning {
  sourceFile: string;
  /**
   * `ocr_failed`: o OCR falhou nas paginas escaneadas; `ocr_disabled`: OCR desligado na chamada;
   * `count_mismatch`: o oficio declara mais bolsas do que os bolsistas identificados.
   */
  reason: 'ocr_failed' | 'ocr_disabled' | 'count_mismatch';
  /** Paginas (1-based) sem texto selecionavel que contem imagem (escaneadas) e que NAO foram lidas. */
  imageOnlyPages?: number[];
  /** Somente em `count_mismatch`: total de bolsas declarado no documento e quantos bolsistas foram identificados. */
  expected?: number;
  found?: number;
}

export interface BolsistaOcrProgress {
  sourceFile: string;
  /** Pagina (1-based) que sera lida agora. */
  page: number;
  /** Quantas paginas escaneadas ja foram concluidas neste arquivo. */
  done: number;
  total: number;
}

export interface ExtractBolsistasOptions {
  /** Chamado quando paginas escaneadas nao puderam ser lidas. */
  onWarning?: (warning: BolsistaPdfWarning) => void;
  /** Chamado antes de cada pagina escaneada ser enviada ao OCR (a leitura leva alguns segundos por pagina). */
  onOcrProgress?: (progress: BolsistaOcrProgress) => void;
  /** Le paginas escaneadas por OCR. Padrao: true. */
  ocr?: boolean;
}

type PdfPageLike = {
  getOperatorList: () => Promise<{ fnArray: number[] }>;
};

async function pageHasImage(page: PdfPageLike): Promise<boolean> {
  const ops = (pdfjsLib as unknown as { OPS?: Record<string, number> }).OPS;
  if (!ops) return false;
  const imageOps = new Set(
    [ops.paintImageXObject, ops.paintInlineImageXObject, ops.paintJpegXObject, ops.paintImageMaskXObject]
      .filter((op): op is number => typeof op === 'number'),
  );
  const { fnArray } = await page.getOperatorList();
  return fnArray.some((fn) => imageOps.has(fn));
}

/**
 * Le os PDFs de pagamento. Paginas com texto usam a camada de texto do PDF; paginas que so tem
 * imagem (escaneadas) passam por OCR e os registros delas saem com `ocr: true`, pedindo conferencia.
 * Se o OCR nao puder ser feito, `onWarning` informa as paginas nao lidas.
 */
export async function extractBolsistasFromPdfFiles(
  files: File[],
  options: ExtractBolsistasOptions = {},
): Promise<BolsistaPdfRecord[]> {
  const { onWarning, onOcrProgress, ocr = true } = options;
  const all: BolsistaPdfRecord[] = [];

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      verbosity: (pdfjsLib as unknown as { VerbosityLevel?: { ERRORS?: number } }).VerbosityLevel?.ERRORS ?? 0,
    }).promise;
    const pageTexts: string[] = [];
    const imageOnlyPages: Array<{ number: number; page: Awaited<ReturnType<typeof pdf.getPage>> }> = [];

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      pageTexts.push(pageText);

      if (!pageText.trim() && (await pageHasImage(page))) imageOnlyPages.push({ number: i, page });
    }

    if (imageOnlyPages.length) {
      const unreadPages: number[] = [];

      if (!ocr) {
        unreadPages.push(...imageOnlyPages.map((item) => item.number));
        onWarning?.({ sourceFile: file.name, imageOnlyPages: unreadPages, reason: 'ocr_disabled' });
      } else {
        const session = createPdfOcrSession();
        try {
          for (const [done, item] of imageOnlyPages.entries()) {
            onOcrProgress?.({ sourceFile: file.name, page: item.number, done, total: imageOnlyPages.length });
            try {
              const recognized = await session.recognizePage(item.page);
              pageTexts[item.number - 1] = wrapOcrText(normalizeOcrText(recognized));
            } catch (error) {
              console.error(`Falha no OCR da pagina ${item.number} de ${file.name}:`, error);
              unreadPages.push(item.number);
            }
          }
        } finally {
          await session.dispose();
        }
        if (unreadPages.length) onWarning?.({ sourceFile: file.name, imageOnlyPages: unreadPages, reason: 'ocr_failed' });
      }
    }

    const fileText = pageTexts.map((text) => `${text}\n`).join('');
    const fileRecords = extractFromText(fileText, file.name);

    // Rede de seguranca: se o documento declara mais bolsas do que os bolsistas lidos, algum ficou de fora.
    const expected = findExpectedBolsasCount(splitOcrMarkers(fileText).text);
    if (expected !== undefined && fileRecords.length < expected) {
      onWarning?.({ sourceFile: file.name, reason: 'count_mismatch', expected, found: fileRecords.length });
    }

    all.push(...fileRecords);
  }

  return all;
}
