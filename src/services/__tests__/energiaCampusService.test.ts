import * as XLSX from 'xlsx';
import {
  parseEnergiaCampusWorkbook,
  parseEnergiaDate,
  parseEnergiaNumber,
} from '@/services/energiaCampusService';

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}));

function createWorkbookFile(sheets: Record<string, unknown[][]>, name = 'energia.xlsx') {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([sheetName, rows]) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  });
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const file = new File([buffer], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => Promise.resolve(buffer),
  });
  return file;
}

describe('energiaCampusService', () => {
  it('converte números monetários e datas em formatos mistos', () => {
    expect(parseEnergiaNumber(' R$ 13,334.48 ')).toBe(13334.48);
    expect(parseEnergiaNumber('1.234,56')).toBe(1234.56);
    expect(parseEnergiaNumber('-')).toBeNull();

    expect(parseEnergiaDate('1/21/19')).toBe('2019-01-21');
    expect(parseEnergiaDate('21/01/2019')).toBe('2019-01-21');
  });

  it('faz parse das abas principais da planilha de energia', async () => {
    const file = createWorkbookFile({
      Consumo: [
        ['Período de leitura', '', 'Consumo ativo', '', 'TOTAL DE CONSUMO ATIVO (kwh)', 'Sub-estação', 'Fatura', 'PARCELA', 'Processo', 'COMPETÊNCIA/ANO', 'ANO', 'Valor'],
        ['Início', 'Final', 'Consumo ativo FP (KWH)', 'Consumo ativo NP (KWH)'],
        ['12/10/18', '1/9/19', '14848.56', '', '14848.56', 'SUB I - CTq', '18078973', '30.1', '23035.000001/2019-00', '01/2019', '', ' R$ 11,385.74 '],
        ['12/9/25', '1/10/26', '13285.85', '', '13285.85', 'SUB I - CTq', '151769556', '55.1', '23035.000365.2026-80', '', '', ' R$ 23,444.78 '],
        ['', '', '', '', '', '', '', '', '', '', '', '', 'Trimestre', 'Periodo - 2026', 'Consumo ativo (kwh)', 'Geração (kwh)'],
        ['', '', '', '', '', '', '', '', '', '', '', '', '1° Tr', 'Jan', '1000', '12021'],
      ],
      'Previsão - Mercatto': [
        ['', '', '', '', '', '2025NE000009'],
        ['', '', 'Previsão', 'Março de 2026', '', 'Saldo empenhado', ' R$ 57,355.23 '],
        [],
        ['Sub I', '', '', '', '', '', '', '', '', 'Sub II'],
        ['Processo', 'Parcela', 'Competência', ' Valor ', ' Leitura ', '', 'Vencimento', 'Orçamento', '', 'Processo', 'Parcela', 'Competência', ' Valor ', ' Leitura ', '', 'Vencimento', 'Orçamento'],
        ['23035.003169.2025-86', '52.1', '08/2025', ' R$ 13,334.48 ', '9/10/25', '10/9/25', '11/21/25', '2025', '', '-', '52.2', '09/2025', ' R$ 16,500.00 ', '8/31/25', '9/30/2025', '1/22/26', '2025'],
      ],
      "UFV's": [
        ['UFV - 01/03', '', '', '', 'UFV - 02/03', '', '', '', 'UFV - 03/03'],
        ['Ano', 'Energia Produzida (kwh)', 'Obs', '', 'Ano', 'Energia Produzida (kwh)', 'Obs', '', 'Ano', 'Energia Produzida (kwh)', 'Obs'],
        ['2024', '75643.30', 'Normal', '', '2024', '79397.7', 'Normal', '', '2025', '', 'Inicio'],
      ],
      'Valor Executado': [
        ['Contrato 82/2021 - COSERN'],
        [],
        ['Parcela', ' Valor Executado ', 'Valor Previsto', 'Percentual'],
        ['1', ' R$ 11,385.74 ', ' R$ 31,932.21 ', '35.7%'],
      ],
      '2021': [
        ['', '', '', 'Mês', 'Trimestre', 'Geração_UFV (kwh)'],
        ['', '', '', 'Janeiro', '1° Tr', '12021'],
      ],
    });

    const parsed = await parseEnergiaCampusWorkbook(file);

    expect(parsed.consumoFaturas).toHaveLength(4);
    expect(parsed.consumoFaturas[0]).toMatchObject({
      fonte: 'cosern',
      competencia: '2019-01-01',
      consumoTotalKwh: 14848.56,
      valorFaturado: 11385.74,
    });
    expect(parsed.consumoFaturas[1]).toMatchObject({
      fonte: 'mercatto',
      competencia: '2026-01-01',
      valorFaturado: 23444.78,
      consumoTotalKwh: 13285.85,
    });
    expect(parsed.consumoFaturas[2]).toMatchObject({
      fonte: 'mercatto',
      competencia: '2025-08-01',
      valorFaturado: 13334.48,
      consumoTotalKwh: null,
    });
    expect(parsed.solarGeracao).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ufvNome: 'UFV 01', ano: 2024, energiaGeradaKwh: 75643.3 }),
        expect.objectContaining({ ufvNome: 'UFVs Campus', ano: 2021, mes: 1, granularidade: 'mensal' }),
        expect.objectContaining({ ufvNome: 'UFVs Campus', ano: 2026, mes: 1, granularidade: 'mensal', energiaGeradaKwh: 12021 }),
      ]),
    );
    expect(parsed.contratoExecucoes[0]).toMatchObject({
      parcela: '1',
      valorExecutado: 11385.74,
    });
    expect(parsed.contratoExecucoes[0].percentualExecucao).toBeCloseTo(0.357);
    expect(parsed.warnings.join(' ')).not.toContain('Mercado Livre será exibido como N/D');
  });

  it('registra aviso quando abas esperadas não existem', async () => {
    const file = createWorkbookFile({
      Consumo: [
        ['Período de leitura', '', 'Consumo ativo', '', 'TOTAL DE CONSUMO ATIVO (kwh)', 'Sub-estação', 'Fatura'],
        ['Início', 'Final'],
      ],
    });

    const parsed = await parseEnergiaCampusWorkbook(file);

    expect(parsed.warnings).toEqual(expect.arrayContaining(['Aba ausente: Previsão - Mercatto.']));
  });
});
