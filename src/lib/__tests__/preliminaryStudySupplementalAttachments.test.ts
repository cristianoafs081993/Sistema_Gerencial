import * as CFB from 'cfb';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';

import {
  analyzePreliminaryStudySupplementalAttachmentFile,
  analyzePreliminaryStudySupplementalPdfPages,
  PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILES,
  PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILE_SIZE,
} from '@/lib/preliminaryStudySupplementalAttachments';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function fileFromBytes(bytes: Uint8Array, name: string, type: string) {
  const file = new File([bytes], name, { type });
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });
  return file;
}

function buildWorkbookBytes() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Item', 'Descricao', 'Valor'],
      ['1', 'Planilha de custos com piso salarial da categoria', 'R$ 1.500,00'],
      ['2', 'Vale alimentacao e vale transporte', 'R$ 700,00'],
    ]),
    'Custos',
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Local', 'Quantidade'],
      ['Campus central', '4 postos de trabalho com jornada de trabalho de 44 horas'],
    ]),
    'Quantitativos',
  );

  const output = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer | number[];
  return output instanceof ArrayBuffer ? new Uint8Array(output) : Uint8Array.from(output);
}

function buildDocxBytes() {
  const xml = [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<w:document xmlns:w="${WORD_NS}">`,
    '<w:body>',
    '<w:p><w:r><w:t>Contratacao de servicos continuos com dedicacao exclusiva.</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>A planilha de custos considera piso salarial e vale alimentacao.</w:t></w:r></w:p>',
    '<w:sectPr />',
    '</w:body>',
    '</w:document>',
  ].join('');
  const cfb = CFB.utils.cfb_new();
  CFB.utils.cfb_add(cfb, 'word/document.xml', new TextEncoder().encode(xml));

  return Uint8Array.from(CFB.write(cfb, { type: 'array', fileType: 'zip', compression: true }));
}

describe('preliminaryStudySupplementalAttachments', () => {
  it('identifica trechos uteis de PDF preservando arquivo e pagina', () => {
    const result = analyzePreliminaryStudySupplementalPdfPages('cct-limpeza.pdf', [
      {
        pageNumber: 1,
        text: 'Convencao coletiva. Piso salarial da categoria profissional de limpeza e jornada de trabalho de 44 horas.',
      },
      {
        pageNumber: 2,
        text: 'Auxilio alimentacao, vale transporte e adicional noturno previstos para os trabalhadores.',
      },
    ]);

    expect(result.fileName).toBe('cct-limpeza.pdf');
    expect(result.fileType).toBe('PDF');
    expect(result.searchablePageCount).toBe(2);
    expect(result.snippets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'anexo',
          sourceName: 'cct-limpeza.pdf',
          sourceLabel: 'cct-limpeza.pdf, pagina 1',
          pageNumber: 1,
        }),
      ]),
    );
  });

  it('extrai trechos de XLSX com multiplas abas preservando aba e linhas', async () => {
    const result = await analyzePreliminaryStudySupplementalAttachmentFile(
      fileFromBytes(
        buildWorkbookBytes(),
        'planilha-custos.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
    );

    expect(result.fileType).toBe('Planilha');
    expect(result.snippets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceName: 'planilha-custos.xlsx',
          sourceLabel: 'planilha-custos.xlsx, aba Custos, linhas 1-3',
          excerpt: expect.stringContaining('piso salarial'),
        }),
        expect.objectContaining({
          sourceLabel: 'planilha-custos.xlsx, aba Quantitativos, linhas 1-2',
          excerpt: expect.stringContaining('4 postos de trabalho'),
        }),
      ]),
    );
  });

  it('extrai trechos de CSV separado por ponto e virgula', async () => {
    const csv = new TextEncoder().encode('Descricao;Valor\nPlanilha de custos;R$ 100,00\nPiso salarial;R$ 1500,00');
    const result = await analyzePreliminaryStudySupplementalAttachmentFile(
      fileFromBytes(csv, 'custos.csv', 'text/csv'),
    );

    expect(result.fileType).toBe('CSV');
    expect(result.snippets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceLabel: 'custos.csv, aba Sheet1, linhas 1-3',
          excerpt: expect.stringContaining('Piso salarial'),
        }),
      ]),
    );
  });

  it('extrai trechos de TXT e MD em blocos', async () => {
    const text = [
      'A necessidade da contratacao e manter a limpeza predial do campus.',
      '',
      'A estimativa do valor sera baseada em pesquisa de precos e planilha de custos.',
    ].join('\n');
    const result = await analyzePreliminaryStudySupplementalAttachmentFile(
      fileFromBytes(new TextEncoder().encode(text), 'apoio.md', 'text/markdown'),
    );

    expect(result.fileType).toBe('Texto');
    expect(result.snippets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceLabel: 'apoio.md, blocos 1-2',
          excerpt: expect.stringContaining('necessidade da contratacao'),
        }),
      ]),
    );
  });

  it('extrai texto de DOCX minimo', async () => {
    const result = await analyzePreliminaryStudySupplementalAttachmentFile(
      fileFromBytes(
        buildDocxBytes(),
        'memoria.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    );

    expect(result.fileType).toBe('DOCX');
    expect(result.snippets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceLabel: 'memoria.docx, blocos 1-1',
          excerpt: expect.stringContaining('piso salarial'),
        }),
      ]),
    );
  });

  it('rejeita DOC legado com mensagem de conversao', async () => {
    await expect(
      analyzePreliminaryStudySupplementalAttachmentFile(
        fileFromBytes(new TextEncoder().encode('conteudo'), 'modelo.doc', 'application/msword'),
      ),
    ).rejects.toThrow('Converta para DOCX ou PDF');
  });

  it('expoe limites operacionais do upload auxiliar', () => {
    expect(PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILES).toBe(5);
    expect(PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILE_SIZE).toBe(20 * 1024 * 1024);
  });
});
