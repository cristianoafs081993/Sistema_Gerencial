import * as CFB from 'cfb';
import { describe, expect, it } from 'vitest';

import { applyDocxTemplatePlan, parseDocxTemplateArrayBuffer } from '@/lib/docxDocumentTemplate';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function readDocumentXmlFromDocx(bytes: Uint8Array) {
  const cfb = CFB.read(bytes, { type: 'array' });
  const fullPath = cfb.FullPaths.find((entry) => entry.toLowerCase().endsWith('word/document.xml'));
  const documentEntry = fullPath ? CFB.find(cfb, fullPath) : null;
  return new TextDecoder('utf-8').decode(
    documentEntry?.content instanceof Uint8Array ? documentEntry.content : Uint8Array.from(documentEntry?.content || []),
  );
}

function readDocxEntry(bytes: Uint8Array, suffix: string) {
  const cfb = CFB.read(bytes, { type: 'array' });
  const fullPath = cfb.FullPaths.find((entry) => entry.toLowerCase().endsWith(suffix.toLowerCase()));
  const entry = fullPath ? CFB.find(cfb, fullPath) : null;
  return new TextDecoder('utf-8').decode(
    entry?.content instanceof Uint8Array ? entry.content : Uint8Array.from(entry?.content || []),
  );
}

function buildMinimalDocxBytes() {
  const xml = [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<w:document xmlns:w="${WORD_NS}">`,
    '<w:body>',
    '<w:p><w:r><w:t>TERMO DE REFERENCIA</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Os bens objeto desta contratacao sao caracterizados como comuns.</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>OU</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Os bens objeto desta contratacao sao caracterizados como especiais.</w:t></w:r></w:p>',
    '<w:p><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>[INSERIR OBJETO]</w:t></w:r></w:p>',
    '<w:tbl>',
    '<w:tr>',
    '<w:tc><w:p><w:r><w:t>Item</w:t></w:r></w:p></w:tc>',
    '<w:tc><w:p><w:r><w:t>Descricao</w:t></w:r></w:p></w:tc>',
    '<w:tc><w:p><w:r><w:t>Quantidade</w:t></w:r></w:p></w:tc>',
    '<w:tc><w:p><w:r><w:t>Valor total</w:t></w:r></w:p></w:tc>',
    '</w:tr>',
    '<w:tr>',
    '<w:tc><w:p><w:r><w:t>[ITEM]</w:t></w:r></w:p></w:tc>',
    '<w:tc><w:p><w:r><w:t>[DESCRICAO]</w:t></w:r></w:p></w:tc>',
    '<w:tc><w:p><w:r><w:t>[QTD]</w:t></w:r></w:p></w:tc>',
    '<w:tc><w:p><w:r><w:t>[TOTAL]</w:t></w:r></w:p></w:tc>',
    '</w:tr>',
    '</w:tbl>',
    '<w:sectPr />',
    '</w:body>',
    '</w:document>',
  ].join('');

  const cfb = CFB.utils.cfb_new();
  CFB.utils.cfb_add(cfb, 'word/document.xml', new TextEncoder().encode(xml));

  return Uint8Array.from(CFB.write(cfb, { type: 'array', fileType: 'zip', compression: true }));
}

function buildGroupedOuDocxBytes() {
  const xml = [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<w:document xmlns:w="${WORD_NS}">`,
    '<w:body>',
    '<w:p><w:r><w:t>TERMO DE REFERENCIA</w:t></w:r></w:p>',
    '<w:p><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>2.2. O objeto da contratacao esta previsto no Plano de Contratacoes Anual [ANO], conforme detalhamento a seguir.</w:t></w:r></w:p>',
    '<w:p><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>I) ID PCA no PNCP: [...];</w:t></w:r></w:p>',
    '<w:p><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>II) Data de publicacao no PNCP: [...];</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>OU</w:t></w:r></w:p>',
    '<w:p><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>2.3. O objeto da contratacao esta previsto no Plano de Contratacoes Anual [ANO], conforme consta das informacoes basicas deste Termo de Referencia.</w:t></w:r></w:p>',
    '<w:sectPr />',
    '</w:body>',
    '</w:document>',
  ].join('');

  const cfb = CFB.utils.cfb_new();
  CFB.utils.cfb_add(cfb, 'word/document.xml', new TextEncoder().encode(xml));

  return Uint8Array.from(CFB.write(cfb, { type: 'array', fileType: 'zip', compression: true }));
}

describe('docxDocumentTemplate', () => {
  it('extrai blocos editaveis do DOCX', async () => {
    const bytes = buildMinimalDocxBytes();
    const parsed = await parseDocxTemplateArrayBuffer(bytes.buffer);

    expect(parsed.templateText).toContain('TERMO DE REFERENCIA');
    expect(parsed.editableBlocks).toHaveLength(2);
    expect(parsed.editableBlocks[0]).toMatchObject({
      kind: 'paragraph',
      blockIndex: 4,
      hasPlaceholder: true,
    });
    expect(parsed.editableBlocks[1]).toMatchObject({
      kind: 'table',
      blockIndex: 5,
    });
  });

  it('detecta perguntas de clausula OU e campos previstos no modelo', async () => {
    const bytes = buildMinimalDocxBytes();
    const parsed = await parseDocxTemplateArrayBuffer(bytes.buffer);

    expect(parsed.questionnaireSchema.questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'exclusive',
          blockIndexes: [1, 3, 4],
        }),
        expect.objectContaining({
          kind: 'exclusive',
          options: [
            expect.objectContaining({
              blockIndexes: [1],
            }),
            expect.objectContaining({
              blockIndexes: [3, 4],
            }),
          ],
        }),
      ]),
    );
  });

  it('agrupa clausulas alternativas com multiplos paragrafos antes do OU', async () => {
    const bytes = buildGroupedOuDocxBytes();
    const parsed = await parseDocxTemplateArrayBuffer(bytes.buffer);
    const exclusiveQuestion = parsed.questionnaireSchema.questions.find((question) => question.kind === 'exclusive');

    expect(exclusiveQuestion).toMatchObject({
      blockIndexes: [1, 2, 3, 5],
      blockIds: ['block-1', 'block-2', 'block-3', 'block-5'],
    });
    expect(exclusiveQuestion?.options).toEqual([
      expect.objectContaining({
        blockIndexes: [1, 2, 3],
        blockIds: ['block-1', 'block-2', 'block-3'],
        blockTexts: [
          '2.2. O objeto da contratacao esta previsto no Plano de Contratacoes Anual [ANO], conforme detalhamento a seguir.',
          'I) ID PCA no PNCP: [...];',
          'II) Data de publicacao no PNCP: [...];',
        ],
      }),
      expect.objectContaining({
        blockIndexes: [5],
        blockIds: ['block-5'],
        blockTexts: [
          '2.3. O objeto da contratacao esta previsto no Plano de Contratacoes Anual [ANO], conforme consta das informacoes basicas deste Termo de Referencia.',
        ],
      }),
    ]);
  });

  it('aplica o plano de exportacao preservando a estrutura do DOCX', async () => {
    const bytes = buildMinimalDocxBytes();
    const templateBase64 = btoa(String.fromCharCode(...bytes));

    const result = await applyDocxTemplatePlan(templateBase64, {
      paragraphReplacements: [
        {
          blockId: 'block-1',
          blockIndex: 4,
          paragraphs: ['Objeto: aquisicao de notebooks para laboratorios.'],
          review: {
            status: 'ai_generated',
            comment: 'Preenchido pela IA.',
          },
        },
        {
          blockId: 'block-3',
          blockIndex: 3,
          paragraphs: ['Os bens objeto desta contratacao sao caracterizados como especiais.'],
          review: {
            status: 'not_adopted',
            comment: 'Trecho nao adotado no teste.',
          },
        },
      ],
      tableReplacements: [
        {
          blockId: 'block-2',
          blockIndex: 5,
          rows: [
            ['1', 'Notebook educacional', '20', '100000,00'],
            ['2', 'Mouse USB', '20', '500,00'],
          ],
        },
      ],
    });

    const xml = readDocumentXmlFromDocx(result);

    expect(xml).toContain('Objeto: aquisicao de notebooks para laboratorios.');
    expect(xml).toContain('Notebook educacional');
    expect(xml).toContain('Mouse USB');
    expect(xml).toContain('<w:highlight');
    expect(xml).toContain('<w:strike');
    expect(xml).not.toContain('[INSERIR OBJETO]');
    expect(xml).not.toContain('[DESCRICAO]');
    expect(readDocxEntry(result, 'word/comments.xml')).toContain('Trecho nao adotado no teste.');
  });
});
