import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface BolsistaPdfRecord {
  cpf: string;
  nome: string;
  banco: string;
  agencia: string;
  conta: string;
  sourceFile: string;
  valor?: number;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractNameNear(text: string, start: number, end: number): string {
  const context = text.slice(Math.max(0, start), Math.max(start, end));
  const matriculaMatches = [...context.matchAll(/([A-ZÀ-ÿ][A-Za-zÀ-ÿ'`´\s.-]{6,}?)\s*\(\d{6,}\)/g)];
  if (matriculaMatches.length) {
    const candidate = matriculaMatches[matriculaMatches.length - 1]?.[1] || '';
    if (candidate) return normalizeWhitespace(candidate);
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

export function extractFromText(text: string, sourceFile: string): BolsistaPdfRecord[] {
  const isTableFormat = /MATRÍCULA\s+CPF\s+BANCO/i.test(text) || /VALOR\s+REFERÊNCIA/i.test(text);
  const found: BolsistaPdfRecord[] = [];

  if (isTableFormat) {
    const cleanText = text.replace(/\s+/g, ' ');
    const studentRegex = /(\d+)\s+([A-ZÀ-ÿ][A-Za-zÀ-ÿ'`´\s.-]{4,80}?)\s+(\d{10,15})\s+(\d{3}\.\d{3}\.\d{3}-\d{2})\s+(\d{2,4})\s+([0-9A-Za-z.-]+)\s+(?:([0-9A-Za-z.-]+)\s+)?([0-9A-Za-z.-]+)\s+(?:R\$\s*)?([0-9.,]+)/g;
    const matches = [...cleanText.matchAll(studentRegex)];
    
    for (const m of matches) {
      const cpf = m[4];
      const nome = m[2].trim();
      const banco = m[5];
      const agencia = m[6];
      const conta = m[7] ? `${m[7]}-${m[8]}` : m[8]; 
      const valorStr = m[9].replace(/\./g, '').replace(',', '.');
      const valor = parseFloat(valorStr);

      found.push({
        cpf,
        nome,
        banco,
        agencia,
        conta,
        sourceFile,
        valor
      });
    }
  } else {
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

      const nome = extractNameNear(text, prevCpfIndex, idx);
      const banco = extractFieldAfterLabel(segment, /Banco\s+(.+?)(?:\s+Dados\b|\s+Ag[êe]ncia\b|\s+Conta\b|$)/i);
      const agencia = extractFieldAfterLabel(segment, /Ag[êe]ncia\s+([0-9A-Za-z-]+)/i);
      const conta = extractFieldAfterLabel(segment, /Conta\s+([0-9A-Za-z-]+)/i);

      found.push({ 
        cpf, 
        nome, 
        banco, 
        agencia, 
        conta, 
        sourceFile,
        valor: docValor
      });
    }
  }

  return found;
}

export async function extractBolsistasFromPdfFiles(files: File[]): Promise<BolsistaPdfRecord[]> {
  const all: BolsistaPdfRecord[] = [];

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      verbosity: (pdfjsLib as unknown as { VerbosityLevel?: { ERRORS?: number } }).VerbosityLevel?.ERRORS ?? 0,
    }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      fullText += `${pageText}\n`;
    }

    all.push(...extractFromText(fullText, file.name));
  }

  return all;
}
