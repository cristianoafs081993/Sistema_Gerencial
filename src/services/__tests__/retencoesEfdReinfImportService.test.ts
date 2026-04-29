import {
  formatRetencaoEfdReinfDate,
  loadRetencoesEfdReinfObPaymentDates,
  parseRetencoesEfdReinfCsv,
  type RetencaoEfdReinfRegistro,
  validateRetencaoEfdReinfRow,
} from '@/services/retencoesEfdReinfImportService';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

function createTsvFile(content: string, name = 'retencoes.csv') {
  const file = new File([content], name, { type: 'text/csv' });
  const buffer = new TextEncoder().encode(content).buffer;
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => Promise.resolve(buffer),
  });
  return file;
}

function createRegistro(overrides: Partial<RetencaoEfdReinfRegistro> = {}): RetencaoEfdReinfRegistro {
  return {
    sourceIndex: 1,
    documentoHabil: '158366264352026NP000421',
    dhProcesso: '230010001',
    dhEstado: 'RN',
    dhUgPagadora: '153103',
    dhItemUgPagadora: '158155',
    dhCredorDocumento: '12345678000190',
    dhCredorNome: 'Fornecedor A',
    dhSituacao: 'DDF025',
    dhDataEmissaoDocOrigem: '2026-01-01',
    dhDiaPagamento: '2026-03-15',
    dhItemDiaVencimento: '2026-02-20',
    dhItemDiaPagamento: '2026-02-20',
    dhItemLiquidado: true,
    dhValorDocOrigem: 1000,
    metrica: 'INSS',
    valorRetencao: 110,
    ...overrides,
  };
}

describe('retencoesEfdReinfImportService', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
  });

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
    const validation = validateRetencaoEfdReinfRow(createRegistro({
      documentoHabil: '2026DH0001',
      dhItemUgPagadora: '999999',
      dhDiaPagamento: '2026-03-15',
      dhItemDiaVencimento: '2026-04-21',
      dhItemDiaPagamento: '2026-04-21',
    }));

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

  it.each(['DDR001', 'DGR001'])(
    'ignora a regra de UG critica quando DH - Situacao for %s',
    (dhSituacao) => {
      const validation = validateRetencaoEfdReinfRow(createRegistro({
        documentoHabil: '2026DH0001',
        dhItemUgPagadora: '999999',
        dhSituacao,
      }));

      expect(validation).toMatchObject({
        severity: 'ok',
        hasCriticalUgPagadora: false,
        hasWarningPrazo: false,
        expectedDate: null,
        expectedRule: null,
      });
      expect(validation.issues).not.toContain('DH Item - UG Pagadora deve ser 158155.');
    },
  );

  it('usa a data da OB de pagamento como base da DDF025', () => {
    const validation = validateRetencaoEfdReinfRow(createRegistro(), {
      obPaymentDates: new Map([['2026NP000421', '2026-01-08']]),
    });

    expect(validation).toMatchObject({
      severity: 'ok',
      hasWarningPrazo: false,
      expectedDate: '2026-02-20',
      expectedRule: 'DDF025',
      paymentDateSource: 'ob',
      paymentDateUsed: '2026-01-08',
    });
  });

  it('ignora DH - Dia Pagamento para DDF025 quando ha OB vinculada', () => {
    const validation = validateRetencaoEfdReinfRow(createRegistro({
      dhDiaPagamento: '2026-12-31',
      dhItemDiaVencimento: '2026-02-20',
      dhItemDiaPagamento: '2026-02-20',
    }), {
      obPaymentDates: new Map([['2026NP000421', '2026-01-08']]),
    });

    expect(validation.hasWarningPrazo).toBe(false);
    expect(validation.expectedDate).toBe('2026-02-20');
  });

  it('alerta quando vencimento ou pagamento divergir da data esperada pela OB', () => {
    const validation = validateRetencaoEfdReinfRow(createRegistro({
      dhItemDiaVencimento: '2026-02-21',
      dhItemDiaPagamento: '2026-02-20',
    }), {
      obPaymentDates: new Map([['2026NP000421', '2026-01-08']]),
    });

    expect(validation).toMatchObject({
      severity: 'warning',
      hasWarningPrazo: true,
      expectedDate: '2026-02-20',
      paymentDateSource: 'ob',
    });
    expect(validation.issues).toContain('DDF025 deve vencer e pagar no dia 20 do mes seguinte a OB de pagamento da NP.');
  });

  it('alerta quando DDF025 nao tiver OB de pagamento localizada', () => {
    const validation = validateRetencaoEfdReinfRow(createRegistro(), {
      obPaymentDates: new Map(),
    });

    expect(validation).toMatchObject({
      severity: 'warning',
      hasWarningPrazo: true,
      expectedDate: null,
      paymentDateSource: 'missing-ob',
      paymentDateUsed: null,
    });
    expect(validation.issues).toContain('DDF025 sem OB de pagamento localizada para calcular o vencimento esperado.');
  });

  it('carrega a primeira OB de pagamento por NP e usa retencao apenas como fallback', async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: '2026OB000002',
          documento_habil_id: '2026NP000421',
          data_emissao: '2026-01-07',
          observacao: 'RETENCAO DE ISS DA NF 2294',
        },
        {
          id: '2026OB000001',
          documento_habil_id: '2026NP000421',
          data_emissao: '2026-01-08',
          observacao: 'PGTO DO(S) INSTR.(S) DE COBRANCA(S)',
        },
        {
          id: '2026OB000003',
          documento_habil_id: '2026NP000422',
          data_emissao: '2026-01-09',
          observacao: 'RETENCAO DE ISS',
        },
      ],
      error: null,
    });
    const eqMock = vi.fn(() => ({ order: orderMock }));
    const inMock = vi.fn(() => ({ eq: eqMock }));
    const selectMock = vi.fn(() => ({ in: inMock }));
    supabaseMock.from.mockReturnValue({ select: selectMock });

    const paymentDates = await loadRetencoesEfdReinfObPaymentDates([
      createRegistro({ documentoHabil: '158366264352026NP000421' }),
      createRegistro({ documentoHabil: '158366264352026NP000422' }),
    ]);

    expect(paymentDates.get('2026NP000421')).toBe('2026-01-08');
    expect(paymentDates.get('2026NP000422')).toBe('2026-01-09');
    expect(supabaseMock.from).toHaveBeenCalledWith('documentos_habeis_itens');
    expect(inMock).toHaveBeenCalledWith('documento_habil_id', ['2026NP000421', '2026NP000422']);
    expect(eqMock).toHaveBeenCalledWith('doc_tipo', 'OB');
  });

  it('formata datas ISO para exibicao brasileira', () => {
    expect(formatRetencaoEfdReinfDate('2026-04-20')).toBe('20/04/2026');
    expect(formatRetencaoEfdReinfDate(null)).toBe('-');
  });
});
