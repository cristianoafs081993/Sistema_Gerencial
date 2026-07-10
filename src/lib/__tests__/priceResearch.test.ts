import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';

import {
  analyzePriceResearchCompliance,
  calculatePriceStatistics,
  getEstimatedUnitPrice,
  getSelectedStatistics,
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

function createReport(item = createItem(), patch: Partial<PriceResearchReportData> = {}): PriceResearchReportData {
  return {
    title: 'Pesquisa',
    processNumber: '',
    objectDescription: 'Aquisição de café',
    responsibleName: 'Agente responsável',
    researchDate: '2026-06-09',
    method: 'median',
    methodologyJustification: 'Mediana adotada após análise crítica da cesta.',
    notes: '',
    sourceFile: 'custos.xlsx',
    items: [item],
    ...patch,
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
    expect(result.weightedMean).toBe(12);
    expect(result.sanitizedMean).toBe(12);
    expect(result.excludedCount).toBe(0);
    expect(result.standardDeviation).toBeCloseTo(1.63299, 4);
    expect(result.coefficientOfVariation).toBeCloseTo(13.6082, 3);
  });

  it('calcula média ponderada por quantidade e mantém exclusões na estatística saneada', () => {
    const weighted = calculatePriceStatistics([10, 20], [1, 3]);
    expect(weighted.weightedMean).toBe(17.5);

    const item = createItem();
    item.candidates[0].quantity = 1;
    item.candidates[1].quantity = 3;
    item.candidates[2].selected = false;
    item.candidates[2].exclusionReason = 'Valor desconsiderado na análise crítica.';

    const stats = getSelectedStatistics(item);
    expect(stats.mean).toBe(11);
    expect(stats.weightedMean).toBe(11.5);
    expect(stats.sanitizedMean).toBe(11);
    expect(stats.excludedCount).toBe(1);
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
    const report = createReport(item, { methodologyJustification: 'Mediana.' });

    expect(validatePriceResearchReport(report)).toEqual(expect.arrayContaining([
      expect.stringContaining('menos de três preços selecionados'),
      expect.stringContaining('preços excluídos sem justificativa'),
    ]));
  });

  it('não gera achados bloqueantes para pesquisa oficial válida', () => {
    const findings = analyzePriceResearchCompliance(createReport());

    expect(findings.filter((finding) => finding.severity === 'error')).toHaveLength(0);
  });

  it('alerta variação alta entre preços selecionados', () => {
    const item = createItem();
    item.candidates[0].comparableUnitPrice = 10;
    item.candidates[0].originalUnitPrice = 10;
    item.candidates[1].comparableUnitPrice = 100;
    item.candidates[1].originalUnitPrice = 100;
    item.candidates[2].comparableUnitPrice = 190;
    item.candidates[2].originalUnitPrice = 190;

    const findings = analyzePriceResearchCompliance(createReport(item, {
      notes: 'Valores mantidos por refletirem especificações e condições comerciais distintas.',
    }));

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'warning',
        message: expect.stringContaining('variação crítica'),
      }),
    ]));
  });

  it('alerta preço selecionado outlier sem justificativa', () => {
    const item = createItem();
    item.candidates[0].comparableUnitPrice = 10;
    item.candidates[0].originalUnitPrice = 10;
    item.candidates[1].comparableUnitPrice = 12;
    item.candidates[1].originalUnitPrice = 12;
    item.candidates[2].comparableUnitPrice = 100;
    item.candidates[2].originalUnitPrice = 100;

    const findings = analyzePriceResearchCompliance(createReport(item));

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'warning',
        message: expect.stringContaining('distante da mediana'),
      }),
    ]));
  });

  it('aponta fornecedor direto incompleto', () => {
    const item = createItem();
    item.candidates = [{
      ...item.candidates[0],
      id: 'custom-1',
      sourceType: 'custom',
      sourceLabel: 'Fornecedor Local',
      supplierName: 'Fornecedor sem documento',
      supplierDocument: '',
      purchaseDate: null,
      resultDate: null,
      selected: true,
    }];

    const findings = analyzePriceResearchCompliance(createReport(item));

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        message: expect.stringContaining('cotação direta com fornecedor sem dados mínimos'),
      }),
    ]));
  });

  it('aponta fonte de internet sem data de acesso', () => {
    const item = createItem();
    item.candidates = [{
      ...item.candidates[0],
      id: 'market-1',
      sourceType: 'amazon',
      sourceLabel: 'Amazon',
      sourceUrl: 'https://example.test/produto',
      purchaseDate: null,
      resultDate: null,
      evidenceCapturedAt: undefined,
      selected: true,
    }];

    const findings = analyzePriceResearchCompliance(createReport(item));

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        message: expect.stringContaining('fonte de internet sem data/hora de acesso'),
      }),
    ]));
  });

  it('bloqueia base oficial única com estimativa acima da mediana', () => {
    const item = createItem();
    item.candidates[0].comparableUnitPrice = 10;
    item.candidates[0].originalUnitPrice = 10;
    item.candidates[1].comparableUnitPrice = 12;
    item.candidates[1].originalUnitPrice = 12;
    item.candidates[2].comparableUnitPrice = 100;
    item.candidates[2].originalUnitPrice = 100;

    const findings = analyzePriceResearchCompliance(createReport(item, { method: 'mean' }));

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        message: expect.stringContaining('preço estimado acima da mediana'),
      }),
    ]));
  });

  it('aplica reajuste monetário e calcula divergência percentual e amplitude da cesta', () => {
    const item = createItem();
    // Preços originais base
    item.candidates[0].comparableUnitPrice = 100;
    item.candidates[0].originalUnitPrice = 100;
    item.candidates[1].comparableUnitPrice = 100;
    item.candidates[1].originalUnitPrice = 100;
    item.candidates[2].comparableUnitPrice = 100;
    item.candidates[2].originalUnitPrice = 100;

    // Aplica IPCA na primeira cotação
    item.candidates[0].monetaryAdjustmentEnabled = true;
    item.candidates[0].monetaryAdjustmentIndex = 'IPCA';
    item.candidates[0].monetaryAdjustmentFactor = 1.05; // 5% de correção
    item.candidates[0].monetaryAdjustedPrice = 105;

    // Mantém as outras sem reajuste (monetaryAdjustedPrice será igual ao comparável base)
    item.candidates[1].monetaryAdjustedPrice = 100;
    item.candidates[2].monetaryAdjustedPrice = 100;

    // As estatísticas do item devem considerar os preços ajustados: 105, 100, 100
    const stats = getSelectedStatistics(item);
    expect(stats.minimum).toBe(100);
    expect(stats.maximum).toBe(105);
    expect(stats.mean).toBeCloseTo(101.6667, 3);
    expect(stats.median).toBe(100);
    
    // Amplitude = ((105 - 100) / 100) * 100 = 5%
    expect(stats.amplitudeDivergence).toBeCloseTo(5, 2);

    // O preço original (comparableUnitPrice) deve permanecer intacto (100)
    expect(item.candidates[0].comparableUnitPrice).toBe(100);
  });
});
