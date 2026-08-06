import {
  formatRetencaoEfdReinfDate,
  loadRetencoesEfdReinfObPaymentDates,
  parseRetencoesEfdReinfCsv,
  type RetencaoEfdReinfRegistro,
  updateRetencaoEfdReinfCorrecaoRealizada,
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
    dhItemUgPagadora: '158366',
    dhCredorDocumento: '12345678000190',
    dhCredorNome: 'Fornecedor A',
    dhSituacao: 'DDF025',
    dhDataEmissaoDocOrigem: '2026-01-01',
    dhDiaPagamento: '2026-01-15',
    dhItemDiaVencimento: '2026-02-20',
    dhItemDiaPagamento: '2026-02-20',
    dhItemLiquidado: true,
    dhValorDocOrigem: 1000,
    metrica: 'INSS',
    valorRetencao: 110,
    correcaoRealizada: false,
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
        '2026DH0001\t230010001\tRN\t153103\t158366\t12345678000190\tFornecedor A\tDDF025\t01/03/2026\t15/03/2026\t20/04/2026\t20/04/2026\tSim\t1.000,00\tINSS\t110,00',
      ].join('\n'),
    );

    await expect(parseRetencoesEfdReinfCsv(file)).resolves.toEqual([
      {
        sourceIndex: 1,
        documentoHabil: '2026DH0001',
        dhProcesso: '230010001',
        dhEstado: 'RN',
        dhUgPagadora: '153103',
        dhItemUgPagadora: '158366',
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
        correcaoRealizada: false,
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
    expect(validation.issues).toContain('DH Item - UG Pagadora deve ser 158366.');
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
      expect(validation.issues).not.toContain('DH Item - UG Pagadora deve ser 158366.');
    },
  );

  it('aceita DDF025 quando vencimento e pagamento ficam entre DH pgto e o dia 20 do mes seguinte', () => {
    const validation = validateRetencaoEfdReinfRow(createRegistro(), {
      obPaymentDates: new Map([['2026NP000421', '2026-01-08']]),
    });

    expect(validation).toMatchObject({
      severity: 'ok',
      hasWarningPrazo: false,
      expectedDate: '2026-02-20',
      expectedRule: 'DDF025',
      paymentDateSource: 'dh',
      paymentDateUsed: '2026-01-15',
    });
  });

  it('aplica a regra de prazo de DDF025 tambem para DDF055', () => {
    const validation = validateRetencaoEfdReinfRow(createRegistro({
      dhSituacao: 'DDF055',
      dhDiaPagamento: '2026-01-15',
      dhItemDiaVencimento: '2026-02-21',
      dhItemDiaPagamento: '2026-02-20',
    }));

    expect(validation).toMatchObject({
      severity: 'warning',
      hasWarningPrazo: true,
      expectedDate: '2026-02-20',
      expectedRule: 'DDF055',
      paymentDateSource: 'dh',
    });
    expect(validation.issues).toContain('DDF055 deve vencer e pagar entre DH - Dia Pagamento e o dia 20 do mes seguinte.');
  });

  it('ignora OB vinculada na regra de prazo e usa DH - Dia Pagamento', () => {
    const validation = validateRetencaoEfdReinfRow(createRegistro({
      dhDiaPagamento: '2026-03-15',
      dhItemDiaVencimento: '2026-04-20',
      dhItemDiaPagamento: '2026-04-20',
    }), {
      obPaymentDates: new Map([['2026NP000421', '2026-01-08']]),
    });

    expect(validation.hasWarningPrazo).toBe(false);
    expect(validation.expectedDate).toBe('2026-04-20');
    expect(validation.paymentDateUsed).toBe('2026-03-15');
  });

  it('alerta quando vencimento ou pagamento for posterior ao dia 20 do mes seguinte ao DH pgto', () => {
    const validation = validateRetencaoEfdReinfRow(createRegistro({
      dhDiaPagamento: '2026-01-15',
      dhItemDiaVencimento: '2026-02-21',
      dhItemDiaPagamento: '2026-02-20',
    }));

    expect(validation).toMatchObject({
      severity: 'warning',
      hasWarningPrazo: true,
      expectedDate: '2026-02-20',
      paymentDateSource: 'dh',
    });
    expect(validation.issues).toContain('DDF025 deve vencer e pagar entre DH - Dia Pagamento e o dia 20 do mes seguinte.');
  });

  it('alerta quando vencimento ou pagamento for anterior ao DH pgto', () => {
    const validation = validateRetencaoEfdReinfRow(createRegistro({
      dhDiaPagamento: '2026-01-15',
      dhItemDiaVencimento: '2026-01-14',
      dhItemDiaPagamento: '2026-02-20',
    }));

    expect(validation).toMatchObject({
      severity: 'warning',
      hasWarningPrazo: true,
      expectedDate: '2026-02-20',
      paymentDateSource: 'dh',
    });
    expect(validation.issues).toContain('DDF025 deve vencer e pagar entre DH - Dia Pagamento e o dia 20 do mes seguinte.');
  });

  it('nao depende de OB de pagamento localizada para validar prazo', () => {
    const validation = validateRetencaoEfdReinfRow(createRegistro(), {
      obPaymentDates: new Map(),
    });

    expect(validation).toMatchObject({
      severity: 'ok',
      hasWarningPrazo: false,
      expectedDate: '2026-02-20',
      paymentDateSource: 'dh',
      paymentDateUsed: '2026-01-15',
    });
  });

  it('aplica a mesma janela por DH pgto para DDF021', () => {
    const validation = validateRetencaoEfdReinfRow(createRegistro({
      dhSituacao: 'DDF021',
      dhDiaPagamento: '2026-03-15',
      dhItemDiaVencimento: '2026-04-20',
      dhItemDiaPagamento: '2026-04-21',
    }));

    expect(validation).toMatchObject({
      severity: 'warning',
      hasWarningPrazo: true,
      expectedDate: '2026-04-20',
      expectedRule: 'DDF021',
      paymentDateSource: 'dh',
      paymentDateUsed: '2026-03-15',
    });
    expect(validation.issues).toContain('DDF021 deve vencer e pagar entre DH - Dia Pagamento e o dia 20 do mes seguinte.');
  });

  it('aplica a regra de prazo de DDF021 tambem para DDF050', () => {
    const validation = validateRetencaoEfdReinfRow(createRegistro({
      dhSituacao: 'DDF050',
      dhDiaPagamento: '2026-03-15',
      dhItemDiaVencimento: '2026-04-20',
      dhItemDiaPagamento: '2026-04-21',
    }));

    expect(validation).toMatchObject({
      severity: 'warning',
      hasWarningPrazo: true,
      expectedDate: '2026-04-20',
      expectedRule: 'DDF050',
      paymentDateSource: 'dh',
      paymentDateUsed: '2026-03-15',
    });
    expect(validation.issues).toContain('DDF050 deve vencer e pagar entre DH - Dia Pagamento e o dia 20 do mes seguinte.');
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

    expect(paymentDates.get('2026NP000421')).toEqual({ date: '2026-01-08', obNumber: '2026OB000001' });
    expect(paymentDates.get('2026NP000422')).toEqual({ date: '2026-01-09', obNumber: '2026OB000003' });
    expect(supabaseMock.from).toHaveBeenCalledWith('documentos_habeis_itens');
    expect(inMock).toHaveBeenCalledWith('documento_habil_id', ['2026NP000421', '2026NP000422']);
    expect(eqMock).toHaveBeenCalledWith('doc_tipo', 'OB');
  });

  it('marca a correcao de uma retencao como realizada', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    supabaseMock.from.mockReturnValue({ update: updateMock });

    await expect(updateRetencaoEfdReinfCorrecaoRealizada('row-id', true)).resolves.toBe('remote');

    expect(supabaseMock.from).toHaveBeenCalledWith('retencoes_efd_reinf');
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ correcao_realizada: true }));
    expect(eqMock).toHaveBeenCalledWith('id', 'row-id');
  });

  it('usa fallback local quando o banco remoto ainda nao possui correcao_realizada', async () => {
    const eqMock = vi.fn().mockResolvedValue({
      error: { message: "Could not find the 'correcao_realizada' column of 'retencoes_efd_reinf' in the schema cache" },
    });
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    supabaseMock.from.mockReturnValue({ update: updateMock });

    await expect(updateRetencaoEfdReinfCorrecaoRealizada('row-id-local', true)).resolves.toBe('local');
    expect(window.localStorage.getItem('retencoes-efd-reinf:correcoes-realizadas')).toContain('row-id-local');
  });

  it('formata datas ISO para exibicao brasileira', () => {
    expect(formatRetencaoEfdReinfDate('2026-04-20')).toBe('20/04/2026');
    expect(formatRetencaoEfdReinfDate(null)).toBe('-');
  });
});
