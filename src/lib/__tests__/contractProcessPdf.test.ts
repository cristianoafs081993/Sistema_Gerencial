import { describe, expect, it } from 'vitest';

import { analyzeContractPdfPages } from '@/lib/contractProcessPdf';

describe('analyzeContractPdfPages', () => {
  it('identifica um modelo de contrato e trechos de apoio sem engolir documentos seguintes', () => {
    const result = analyzeContractPdfPages([
      {
        pageNumber: 18,
        text:
          'Contrato n: 068/2023 - PROAD/IFRN TERMO DE CONTRATO DE PRESTACAO DE SERVICOS QUE FAZEM ENTRE SI O IFRN CAMPUS CURRAIS NOVOS E A EMPRESA SUPREMA PROMOCAO DE EVENTOS LTDA. CONTRATANTE. CONTRATADA. CLAUSULA PRIMEIRA - OBJETO. Processo administrativo 23035.002342.2022-86. CNPJ 11.569.395/0001-64.',
      },
      {
        pageNumber: 19,
        text:
          'CLAUSULA SEGUNDA - VIGENCIA. CLAUSULA TERCEIRA - PRECO. O valor mensal da contratacao e de R$ 16.158,24, perfazendo o valor total de R$ 193.898,88.',
      },
      {
        pageNumber: 20,
        text:
          'Termo de Referencia. Objeto da contratacao. Valor total anual estimado. Proposta vencedora vinculada ao edital.',
      },
      {
        pageNumber: 21,
        text: 'Homologacao do certame e adjudicacao do objeto para a proposta classificada em primeiro lugar.',
      },
    ]);

    expect(result.templateCandidates).toHaveLength(1);
    expect(result.templateCandidates[0].pageStart).toBe(18);
    expect(result.templateCandidates[0].pageEnd).toBe(19);
    expect(result.templateCandidates[0].title).toContain('068/2023');
    expect(result.snippets.map((snippet) => snippet.kind)).toEqual(
      expect.arrayContaining(['termo-referencia', 'proposta-vencedora', 'homologacao', 'adjudicacao', 'planilha', 'fornecedor']),
    );
  });

  it('avisa quando encontra mais de um modelo contratual possivel', () => {
    const result = analyzeContractPdfPages([
      {
        pageNumber: 8,
        text: 'MINUTA DE CONTRATO. CONTRATANTE. CONTRATADA. CLAUSULA PRIMEIRA - OBJETO. Processo administrativo 23035.000001/2026-11.',
      },
      {
        pageNumber: 9,
        text: 'CLAUSULA SEGUNDA - VIGENCIA. CLAUSULA TERCEIRA - PRECO.',
      },
      {
        pageNumber: 44,
        text: 'TERMO DE CONTRATO. CONTRATANTE. CONTRATADA. CLAUSULA PRIMEIRA - OBJETO. CNPJ 00.000.000/0001-99.',
      },
      {
        pageNumber: 45,
        text: 'CLAUSULA SEGUNDA - VIGENCIA. CLAUSULA TERCEIRA - PRECO.',
      },
    ]);

    expect(result.templateCandidates).toHaveLength(2);
    expect(result.warnings).toContain('Encontrei mais de um modelo de contrato possivel. Selecione o correto antes de gerar.');
  });

  it('bloqueia pdf sem texto pesquisavel', () => {
    const result = analyzeContractPdfPages([
      { pageNumber: 1, text: '  ' },
      { pageNumber: 2, text: '' },
    ]);

    expect(result.searchablePageCount).toBe(0);
    expect(result.templateCandidates).toHaveLength(0);
    expect(result.warnings).toContain('O PDF do processo nao trouxe texto pesquisavel. Esta versao ainda nao faz OCR.');
    expect(result.warnings).toContain('Nao encontrei uma minuta ou termo de contrato claro dentro do processo.');
  });
});
