import { describe, expect, it } from 'vitest';

import {
  buildReferenceTermOptionPreview,
  buildReferenceTermOptionFields,
  buildReferenceTermFieldInstruction,
  sanitizeReferenceTermQuestionnaireSchema,
  summarizeReferenceTermDisplayText,
} from '@/lib/referenceTermQuestionnaire';
import type { DocumentTemplateEditableBlock, DocumentTemplateQuestionnaireSchema } from '@/services/documentTemplates';

const editableBlocks: DocumentTemplateEditableBlock[] = [
  {
    id: 'block-objeto',
    kind: 'paragraph',
    blockIndex: 1,
    text: '[INSERIR OBJETO]',
    excerpt: '[INSERIR OBJETO]',
    isInstructional: true,
    hasPlaceholder: true,
  },
  {
    id: 'block-ano',
    kind: 'paragraph',
    blockIndex: 2,
    text: 'O objeto da contratacao esta previsto no Plano de Contratacoes Anual [ANO], conforme detalhamento a seguir.',
    excerpt: 'O objeto da contratacao esta previsto no Plano de Contratacoes Anual [ANO], conforme detalhamento a seguir.',
    isInstructional: true,
    hasPlaceholder: true,
  },
  {
    id: 'block-pncp',
    kind: 'paragraph',
    blockIndex: 3,
    text: 'ID PCA no PNCP: [...];',
    excerpt: 'ID PCA no PNCP: [...];',
    isInstructional: true,
    hasPlaceholder: true,
  },
  {
    id: 'block-invalido',
    kind: 'paragraph',
    blockIndex: 4,
    text: '[...];',
    excerpt: '[...];',
    isInstructional: true,
    hasPlaceholder: true,
  },
];

describe('referenceTermQuestionnaire', () => {
  it('mantem campos semanticamente claros para o objeto', () => {
    const instruction = buildReferenceTermFieldInstruction(
      {
        id: 'field-1-inserir-objeto',
        kind: 'field',
        title: 'Campo previsto no modelo',
        prompt: 'Preencha [INSERIR OBJETO] ou pule para manter o campo pendente.',
        placeholder: '[INSERIR OBJETO]',
      },
      '[INSERIR OBJETO]',
    );

    expect(instruction).toMatchObject({
      label: 'Objeto da contratacao',
      modelField: 'INSERIR OBJETO',
    });
  });

  it('usa o contexto do bloco para rotular campos genericos e descartar placeholders vazios', () => {
    const schema: DocumentTemplateQuestionnaireSchema = {
      version: 1,
      generatedAt: new Date().toISOString(),
      questions: [
        {
          id: 'field-ano',
          kind: 'field',
          title: 'Campo previsto no modelo',
          prompt: 'Preencha [ANO] ou pule para manter o campo pendente.',
          blockId: 'block-ano',
          blockIndex: 2,
          placeholder: '[ANO]',
        },
        {
          id: 'field-pncp',
          kind: 'field',
          title: 'Campo previsto no modelo',
          prompt: 'Preencha [...] ou pule para manter o campo pendente.',
          blockId: 'block-pncp',
          blockIndex: 3,
          placeholder: '[...]',
        },
        {
          id: 'field-invalido',
          kind: 'field',
          title: 'Campo previsto no modelo',
          prompt: 'Preencha [...] ou pule para manter o campo pendente.',
          blockId: 'block-invalido',
          blockIndex: 4,
          placeholder: '[...]',
        },
      ],
    };

    const sanitized = sanitizeReferenceTermQuestionnaireSchema(schema, editableBlocks);

    expect(sanitized?.questions).toHaveLength(2);
    expect(sanitized?.questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'field-ano',
          title: 'Ano do Plano de Contratacoes Anual',
          guidance: 'Campo do modelo: Ano do Plano de Contratacoes Anual.',
        }),
        expect.objectContaining({
          id: 'field-pncp',
          title: 'ID PCA no PNCP',
          guidance: 'Campo do modelo: ID PCA no PNCP.',
        }),
      ]),
    );
    expect(sanitized?.questions.find((question) => question.id === 'field-invalido')).toBeUndefined();
  });

  it('resume clausulas longas na tela sem perder o texto original do TR', () => {
    const originalText =
      'O prazo de vigencia da contratacao e de [indicar o prazo] contados do(a) [indicar o termo inicial da vigencia], na forma do artigo 105 da Lei n° 14.133, de 2021.';

    expect(summarizeReferenceTermDisplayText(originalText)).toBe(
      'O prazo de vigencia da contratacao e de [indicar o prazo] contados do(a) [indicar o termo inicial da vigencia].',
    );

    expect(
      buildReferenceTermOptionPreview({
        label: 'Prazo de vigencia',
        text: originalText,
      }),
    ).toEqual({
      summary:
        'O prazo de vigencia da contratacao e de [indicar o prazo] contados do(a) [indicar o termo inicial da vigencia].',
      originalText,
    });
  });

  it('extrai campos inline de clausulas alternativas com placeholders', () => {
    expect(
      buildReferenceTermOptionFields({
        text: 'O prazo de entrega dos bens e de [indicar o prazo] dias, contados do(a) [indicar o termo inicial da vigencia], em remessa unica.',
      }),
    ).toEqual([
      expect.objectContaining({
        placeholder: '[indicar o prazo]',
        instruction: expect.objectContaining({
          label: 'Prazo e vigencia',
        }),
      }),
      expect.objectContaining({
        placeholder: '[indicar o termo inicial da vigencia]',
        instruction: expect.objectContaining({
          label: 'Termo inicial da vigencia',
        }),
      }),
    ]);
  });

  it('transforma alternativas documentais inline em escolha, sem abrir dois campos de texto', () => {
    expect(
      buildReferenceTermOptionFields({
        text: 'O fornecimento de bens e enquadrado como continuado, considerando [...] OU [o Estudo Tecnico Preliminar] OU [os termos da Nota Tecnica].',
      }),
    ).toEqual([
      expect.objectContaining({
        kind: 'input',
        placeholder: '[...]',
      }),
      expect.objectContaining({
        kind: 'choice',
        label: 'Documento de referencia',
        choices: [
          expect.objectContaining({
            placeholder: '[o Estudo Tecnico Preliminar]',
            label: 'o Estudo Tecnico Preliminar',
          }),
          expect.objectContaining({
            placeholder: '[os termos da Nota Tecnica]',
            label: 'os termos da Nota Tecnica',
          }),
        ],
      }),
    ]);
  });

  it('mantem placeholders repetidos de blocos agrupados como campos distintos por inciso', () => {
    expect(
      buildReferenceTermOptionFields({
        text: '2.2. O objeto da contratacao esta previsto no Plano de Contratacoes Anual [ANO], conforme detalhamento a seguir.\nI) ID PCA no PNCP: [...];\nII) Data de publicacao no PNCP: [...];\nIII) Id do item no PCA: [...];\nIV) Classe/Grupo: [...];\nV) Identificador da Futura Contratacao: [...].',
        blockIds: ['block-2-2', 'block-2-2-i', 'block-2-2-ii', 'block-2-2-iii', 'block-2-2-iv', 'block-2-2-v'],
        blockTexts: [
          '2.2. O objeto da contratacao esta previsto no Plano de Contratacoes Anual [ANO], conforme detalhamento a seguir.',
          'I) ID PCA no PNCP: [...];',
          'II) Data de publicacao no PNCP: [...];',
          'III) Id do item no PCA: [...];',
          'IV) Classe/Grupo: [...];',
          'V) Identificador da Futura Contratacao: [...].',
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        kind: 'input',
        key: 'block-2-2::0::[ANO]',
        instruction: expect.objectContaining({
          label: 'Ano do Plano de Contratacoes Anual',
        }),
      }),
      expect.objectContaining({
        kind: 'input',
        key: 'block-2-2-i::0::[...]',
        instruction: expect.objectContaining({
          label: 'ID PCA no PNCP',
        }),
      }),
      expect.objectContaining({
        kind: 'input',
        key: 'block-2-2-ii::0::[...]',
        instruction: expect.objectContaining({
          label: 'Data de publicacao no PNCP',
        }),
      }),
      expect.objectContaining({
        kind: 'input',
        key: 'block-2-2-iii::0::[...]',
        instruction: expect.objectContaining({
          label: 'ID do item no PCA',
        }),
      }),
      expect.objectContaining({
        kind: 'input',
        key: 'block-2-2-iv::0::[...]',
        instruction: expect.objectContaining({
          label: 'Classe ou grupo do PCA',
        }),
      }),
      expect.objectContaining({
        kind: 'input',
        key: 'block-2-2-v::0::[...]',
        instruction: expect.objectContaining({
          label: 'Identificador da futura contratacao',
        }),
      }),
    ]);
  });
});
