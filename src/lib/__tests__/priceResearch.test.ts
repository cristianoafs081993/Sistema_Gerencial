import * as XLSX from 'xlsx';
import { describe, expect, it, vi } from 'vitest';

vi.mock('xlsx', async () => {
  const actual = await vi.importActual<typeof import('xlsx')>('xlsx');
  return {
    ...actual,
    writeFile: vi.fn(),
  };
});

import {
  analyzePriceResearchCompliance,
  buildDespachoConclusivoSuapText,
  buildPriceResearchAbcCurve,
  buildPriceResearchAuthenticationPayload,
  buildPriceResearchComparisonMap,
  buildPriceResearchReportHtml,
  buildPriceResearchManagementSummary,
  calculatePriceStatistics,
  filterPriceResearchCandidates,
  getPriceResearchCandidateBooleanFlag,
  exportPriceResearchCsvBundle,
  exportPriceResearchWorkbook,
  getEstimatedUnitPrice,
  getSelectedStatistics,
  parsePriceResearchPurchaseInfo,
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


  it('normaliza e aplica filtros avançados sobre candidatos oficiais', () => {
    const item = createItem();
    const candidate = {
      ...item.candidates[0],
      purchaseId: '15836605000122026',
      supplierDocument: '12.345.678/0001-90',
      agencyCode: '158366',
      agencyName: 'IFRN Campus Currais Novos',
      state: 'RN',
      brand: 'Marca Alfa',
      quantity: 120,
      rawData: {
        codigoItemCatalogo: '606523',
        modalidadeCompra: 'Pregão Eletrônico',
        compraSrp: 'Sim',
        porteFornecedor: 'ME/EPP',
        itemSustentavel: 'Sim',
        dataAdjudicacao: '2026-05-03',
        dataHomologacao: '2026-05-04',
        observacao: 'Critério técnico adicional',
      },
    };

    expect(parsePriceResearchPurchaseInfo(candidate)).toMatchObject({
      uasg: '158366',
      number: '12',
      year: '2026',
    });
    expect(getPriceResearchCandidateBooleanFlag(candidate, 'srp')).toBe(true);
    expect(getPriceResearchCandidateBooleanFlag({ ...candidate, rawData: {} }, 'srp')).toBeNull();

    const result = filterPriceResearchCandidates([candidate], {
      description: 'currais novos',
      catalogCode: '606523',
      startDate: '2026-05-01',
      endDate: '2026-05-31',
      purchaseNumber: '12/2026',
      uasg: '158366',
      agencyName: 'ifrn',
      supplierDocument: '12345678000190',
      quantityMin: 100,
      quantityMax: 130,
      unit: 'PCT',
      state: 'RN',
      region: 'Nordeste',
      modality: 'pregão',
      brand: 'alfa',
      srp: 'yes',
      meEpp: 'yes',
      sustainable: 'yes',
      adjudicationStartDate: '2026-05-01',
      adjudicationEndDate: '2026-05-10',
      homologationStartDate: '2026-05-01',
      homologationEndDate: '2026-05-10',
      rawDataText: 'critério técnico',
    });

    expect(result).toHaveLength(1);
    expect(filterPriceResearchCandidates([candidate], { state: 'SP' })).toHaveLength(0);
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

  it('gera resumo gerencial, curva ABC, mapa comparativo e hash de autenticacao', () => {
    const firstItem = createItem();
    firstItem.quantity = 10;
    firstItem.candidates.forEach((entry) => {
      entry.comparableUnitPrice = 100;
      entry.originalUnitPrice = 100;
    });

    const secondItem = createItem();
    secondItem.localId = 'item-2';
    secondItem.itemNumber = '2';
    secondItem.description = 'Acucar cristal';
    secondItem.quantity = 2;
    secondItem.candidates.forEach((entry) => {
      entry.id = `item-2-${entry.id}`;
      entry.comparableUnitPrice = 50;
      entry.originalUnitPrice = 50;
    });
    secondItem.candidates[2].selected = false;
    secondItem.candidates[2].exclusionReason = 'Preco desconsiderado por baixa comparabilidade.';

    const report = createReport(firstItem, {
      items: [firstItem, secondItem],
      institutionName: 'IFRN',
      institutionUnit: 'Campus Currais Novos',
      institutionDetails: 'CNPJ 00.000.000/0001-00',
      institutionLogo: 'data:image/png;base64,logo',
      reportServers: [{
        id: 'server-1',
        name: 'Maria Silva',
        role: 'Equipe de apoio',
        registration: '1234567',
        email: 'maria.silva@ifrn.edu.br',
      }],
    });
    const summary = buildPriceResearchManagementSummary(report);
    const abc = buildPriceResearchAbcCurve(report);
    const map = buildPriceResearchComparisonMap(report);
    const authentication = buildPriceResearchAuthenticationPayload(report, {
      origin: 'https://app.example.test',
      researchId: 'research-1',
      generatedAt: '2026-07-10T12:00:00.000Z',
    });

    expect(summary).toMatchObject({
      itemsCount: 2,
      selectedQuotesCount: 5,
      excludedQuotesCount: 1,
      officialQuotesCount: 6,
      estimatedTotal: 1100,
    });
    expect(abc.map((row) => [row.itemNumber, row.abcClass])).toEqual([
      ['1', 'A'],
      ['2', 'B'],
    ]);
    expect(map).toHaveLength(6);
    expect(map[0]).toMatchObject({
      itemNumber: '1',
      selected: true,
      estimatedUnitPrice: 100,
      deviationPercentage: 0,
    });
    expect(authentication.snapshotHash).toMatch(/^[0-9a-f]{16}$/);
    expect(authentication.verificationUrl).toContain('https://app.example.test/pesquisa-precos/validar?auth=');
    expect(authentication.verificationUrl).toContain('&id=research-1');
    expect(authentication.qrCodeUrl).toContain('api.qrserver.com');
    expect(authentication.qrCodeUrl).toContain(encodeURIComponent(authentication.verificationUrl));

    const html = buildPriceResearchReportHtml(report);
    expect(html).toContain('IFRN');
    expect(html).toContain('Campus Currais Novos');
    expect(html).toContain('Maria Silva');
    expect(html).toContain('data:image/png;base64,logo');
    expect(html).not.toContain('Verificação automática de irregularidades');
    expect(html).not.toContain('Nenhum indício objetivo de irregularidade identificado.');
  });

  it('gera a mesma autenticação no HTML quando o snapshot e as opções são mantidos', () => {
    const report = createReport();
    const options = {
      origin: 'https://app.example.test',
      researchId: 'research-1',
      generatedAt: '2026-07-12T12:00:00.000Z',
    };

    const previewHtml = buildPriceResearchReportHtml(report, options);
    const exportedHtml = buildPriceResearchReportHtml(report, options);

    expect(previewHtml).toBe(exportedHtml);
    expect(previewHtml).toContain('price-research-management-v1');
  });

  it('não inclui conformidade nas exportações XLSX e CSV', async () => {
    const report = createReport();
    const writeFileMock = vi.mocked(XLSX.writeFile);
    writeFileMock.mockClear();
    const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    const downloadedFiles: string[] = [];
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function captureDownload() {
      downloadedFiles.push(this.download);
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:price-research'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });

    try {
      await exportPriceResearchWorkbook(report, { generatedAt: '2026-07-12T12:00:00.000Z' });
      const workbook = writeFileMock.mock.calls[0]?.[0];
      expect(workbook?.SheetNames).not.toContain('Conformidade');

      exportPriceResearchCsvBundle(report, { generatedAt: '2026-07-12T12:00:00.000Z' });
      expect(downloadedFiles).not.toContain('relatorio-pesquisa-precos-conformidade.csv');
      expect(downloadedFiles).toContain('relatorio-pesquisa-precos-autenticacao.csv');
    } finally {
      clickSpy.mockRestore();
      if (originalCreateObjectUrl) Object.defineProperty(URL, 'createObjectURL', originalCreateObjectUrl);
      else delete (URL as { createObjectURL?: typeof URL.createObjectURL }).createObjectURL;
      if (originalRevokeObjectUrl) Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectUrl);
      else delete (URL as { revokeObjectURL?: typeof URL.revokeObjectURL }).revokeObjectURL;
    }
  });

  it('gera texto formatado do Despacho Conclusivo de Pesquisa de Precos para o SUAP', () => {
    const despacho = buildDespachoConclusivoSuapText({
      processNumber: '23001.000123/2026-01',
      responsibleName: 'Servidor Responsavel',
      calculationMethod: 'median',
      overallEstimatedTotal: 55000,
      items: [
        {
          itemNumber: '1',
          description: 'Monitor 27 pol 4K',
          quantity: 50,
          unit: 'UN',
          estimatedUnitPrice: 1100,
          estimatedTotal: 55000,
          coefficientOfVariation: 8.5,
        },
      ],
    });

    expect(despacho).toContain('DESPACHO CONCLUSIVO - PESQUISA DE PREÇOS');
    expect(despacho).toContain('23001.000123/2026-01');
    expect(despacho).toContain('Mediana');
    expect(despacho).toContain('55.000,00');
    expect(despacho).toContain('Instrução Normativa SEGES/ME nº 65');
    expect(despacho).toContain('Lei nº 14.133');
  });
});
