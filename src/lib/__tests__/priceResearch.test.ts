import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';

import {
  calculatePriceStatistics,
  getEstimatedUnitPrice,
  parsePriceResearchFile,
  parsePriceResearchRows,
  validatePriceResearchReport,
  type PriceResearchItem,
  type PriceResearchReportData,
} from '@/lib/priceResearch';

function createWorkbookFile(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Itens');
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buffer], 'custos.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function createItem(): PriceResearchItem {
  return {
    localId: 'item-1',
    itemNumber: '1',
    description: 'Café torrado e moído, pacote de 500 g',
    catalogType: 'material',
    catalogCode: '606523',
    quantity: 100,
    unit: 'PCT',
    targetCapacity: 500,
    targetMeasureUnit: 'G',
    referenceUnitCost: null,
    searchStatus: 'success',
    candidates: [10, 12, 14].map((price, index) => ({
      id: `candidate-${index}`,
      sourceType: 'compras_gov_precos',
      sourceLabel: 'Compras.gov.br - Pesquisa de Preços',
      sourceUrl: 'https://dadosabertos.compras.gov.br',
      purchaseId: `purchase-${index}`,
      purchaseItemId: `item-${index}`,
      purchaseDate: '2026-05-01',
      resultDate: '2026-05-02',
      supplierDocument: null,
      supplierName: `Fornecedor ${index}`,
      agencyCode: '158366',
      agencyName: 'IFRN',
      state: 'RN',
      municipality: 'Currais Novos',
      description: 'Café torrado e moído',
      detailedDescription: null,
      brand: null,
      quantity: 100,
      originalUnitPrice: price,
      comparableUnitPrice: price,
      originalUnitLabel: 'PCT 500 G',
      unitCompatible: true,
      aiScore: 90,
      aiReason: 'Compatível',
      selected: true,
      exclusionReason: '',
      rawData: {},
    })),
  };
}

describe('priceResearch', () => {
  it('importa planilha XLSX e identifica CATMAT, capacidade e valores brasileiros', async () => {
    const file = createWorkbookFile([
      ['Relatório de custos'],
      ['Item', 'Descrição', 'Quantidade', 'Unidade', 'CATMAT', 'Custo unitário'],
      [1, 'Café torrado e moído, pacote de 500 g', '100', 'PCT', '606523', '28,90'],
    ]);

    const result = await parsePriceResearchFile(file);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      itemNumber: '1',
      catalogType: 'material',
      catalogCode: '606523',
      quantity: 100,
      unit: 'PCT',
      targetCapacity: 500,
      targetMeasureUnit: 'G',
      referenceUnitCost: 28.9,
    });
  });

  it('calcula média, mediana, desvio padrão e coeficiente de variação', () => {
    const result = calculatePriceStatistics([10, 12, 14]);

    expect(result.count).toBe(3);
    expect(result.mean).toBe(12);
    expect(result.median).toBe(12);
    expect(result.minimum).toBe(10);
    expect(result.maximum).toBe(14);
    expect(result.standardDeviation).toBeCloseTo(1.63299, 4);
    expect(result.coefficientOfVariation).toBeCloseTo(13.6082, 3);
  });

  it('normaliza linhas tabulares extraídas de PDF', () => {
    const result = parsePriceResearchRows([
      ['Item', 'Descrição', 'Quantidade', 'Unidade', 'CATMAT'],
      ['1', 'Café torrado e moído, pacote de 500 g', '100', 'PCT', '606523'],
    ]);

    expect(result[0]).toMatchObject({
      catalogCode: '606523',
      quantity: 100,
      targetCapacity: 500,
      targetMeasureUnit: 'G',
    });
  });

  it('aplica o método escolhido apenas sobre preços selecionados', () => {
    const item = createItem();
    item.candidates[2].selected = false;
    item.candidates[2].exclusionReason = 'Valor excessivamente elevado após análise crítica.';

    expect(getEstimatedUnitPrice(item, 'mean')).toBe(11);
    expect(getEstimatedUnitPrice(item, 'median')).toBe(11);
    expect(getEstimatedUnitPrice(item, 'minimum')).toBe(10);
  });

  it('exige três preços e justificativa para exclusões no relatório', () => {
    const item = createItem();
    item.candidates[1].selected = false;
    item.candidates[2].selected = false;
    const report: PriceResearchReportData = {
      title: 'Pesquisa',
      processNumber: '',
      objectDescription: 'Aquisição de café',
      responsibleName: 'Agente responsável',
      researchDate: '2026-06-09',
      method: 'median',
      methodologyJustification: 'Mediana.',
      notes: '',
      sourceFile: 'custos.xlsx',
      items: [item],
    };

    expect(validatePriceResearchReport(report)).toEqual(expect.arrayContaining([
      expect.stringContaining('selecione ao menos três preços'),
      expect.stringContaining('justifique todas as exclusões'),
    ]));
  });
});
