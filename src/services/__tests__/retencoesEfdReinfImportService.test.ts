import {
  formatRetencaoEfdReinfDate,
  parseRetencoesEfdReinfCsv,
  validateRetencaoEfdReinfRow,
} from '@/services/retencoesEfdReinfImportService';

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}));

function createTsvFile(content: string, name = 'retencoes.csv') {
  const file = new File([content], name, { type: 'text/csv' });
  const buffer = new TextEncoder().encode(content).buffer;
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => Promise.resolve(buffer),
  });
  return file;
}

describe('retencoesEfdReinfImportService', () => {
  it('faz parse do arquivo tabulado preservando datas, booleanos e valores monetarios', async () => {
    const file = createTsvFile(
      [
        'linha ignorada',
        'Documento Habil\tDH - Processo\tDH - Estado\tDH - UG Pagadora\tDH Item - UG Pagadora\tDH - Credor Documento\tDH - Credor Nome\tDH - Situacao\tDH - Data Emissao Doc.Origem\tDH - Dia Pagamento\tDH Item - Dia Vencimento\tDH Item - Dia Pagamento\tDH Item - Liquidado\tDH - Valor Doc.Origem\tMetrica\tValor Retencao',
        '2026DH0001\t230010001\tRN\t153103\t158155\t12345678000190\tFornecedor A\tDDF025\t01/03/2026\t15/03/2026\t20/04/2026\t20/04/2026\tSim\t1.000,00\tINSS\t110,00',
      ].join('\n'),
    );

    await expect(parseRetencoesEfdReinfCsv(file)).resolves.toEqual([
      {
        sourceIndex: 1,
        documentoHabil: '2026DH0001',
        dhProcesso: '230010001',
        dhEstado: 'RN',
        dhUgPagadora: '153103',
        dhItemUgPagadora: '158155',
        dhCredorDocumento: '12345678000190',
        dhCredorNome: 'Fornecedor A',
        dhSituacao: 'DDF025',
        dhDataEmissaoDocOrigem: '2026-03-01',
        dhDiaPagamento: '2026-03-15',
        dhItemDiaVencimento: '2026-04-20',
        dhItemDiaPagamento: '2026-04-20',
        dhItemLiquidado: true,
        dhValorDocOrigem: 1000,
        metrica: 'INSS',
        valorRetencao: 110,
      },
    ]);
  });

  it('classifica linha critica quando a UG pagadora estiver incorreta', () => {
    const validation = validateRetencaoEfdReinfRow({
      sourceIndex: 1,
      documentoHabil: '2026DH0001',
      dhProcesso: '230010001',
      dhEstado: 'RN',
      dhUgPagadora: '153103',
      dhItemUgPagadora: '999999',
      dhCredorDocumento: '12345678000190',
      dhCredorNome: 'Fornecedor A',
      dhSituacao: 'DDF025',
      dhDataEmissaoDocOrigem: '2026-03-01',
      dhDiaPagamento: '2026-03-15',
      dhItemDiaVencimento: '2026-04-21',
      dhItemDiaPagamento: '2026-04-21',
      dhItemLiquidado: true,
      dhValorDocOrigem: 1000,
      metrica: 'INSS',
      valorRetencao: 110,
    });

    expect(validation).toMatchObject({
      severity: 'critical',
      hasCriticalUgPagadora: true,
      hasWarningPrazo: true,
      expectedDate: '2026-04-20',
      expectedRule: 'DDF025',
      percentualRetencao: 11,
    });
    expect(validation.issues).toContain('DH Item - UG Pagadora deve ser 158155.');
  });

  it('formata datas ISO para exibicao brasileira', () => {
    expect(formatRetencaoEfdReinfDate('2026-04-20')).toBe('20/04/2026');
    expect(formatRetencaoEfdReinfDate(null)).toBe('-');
  });
});
