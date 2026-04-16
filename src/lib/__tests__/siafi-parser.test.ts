const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { parseSiafiCsvText, syncSiafiDataToDb } from '@/lib/siafi-parser';

describe('siafi-parser', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('parseia a coluna abreviada de RAP liquidado a pagar e aceita variacoes de pontuacao', () => {
    const rows = parseSiafiCsvText(
      [
        'NE CCor;Num. Processo;Favorecido Nome;Favorecido Numero;Descricao;Natureza Despesa;PI Codigo;PTRES;DESPESAS EMPENHADAS (CONTROLE EMPENHO);DESPESAS LIQUIDADAS (CONTROLE EMPENHO);DESPESAS LIQUIDADAS A PAGAR(CONTROLE EMPENHO);DESPESAS PAGAS (CONTROLE EMPENHO);RESTOS A PAGAR INSCRITOS;RESTOS A PAGAR NAO PROCESSADOS REINSCRITOS;RESTOS A PAGAR NAO PROCES. LIQUIDADOS A PAGAR;RESTOS A PAGAR PAGOS;RESTOS A PAGAR A PAGAR',
        '158366264352026NE000010;23001.000010/2026-11;Fornecedor B;12345678000190;Empenho exercicio;339039;PI123ADN;123456;2.000,00;1.500,00;500,00;1.000,00;0,00;0,00;0,00;0,00;0,00',
        '158366264352025NE000011;23001.000011/2025-11;Fornecedor C;98765432000190;Empenho RAP;339030;PI456ADN;654321;0,00;0,00;0,00;0,00;3.000,00;1.000,00;300,00;500,00;2.500,00',
      ].join('\n'),
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      numeroResumido: '2026NE000010',
      isRap: false,
      valorLiquidadoAPagar: 500,
    });
    expect(rows[1]).toMatchObject({
      numeroResumido: '2025NE000011',
      isRap: true,
      valorLiquidadoAPagar: 300,
      rapPago: 500,
      rapAPagar: 2500,
    });
  });

  it('usa zero quando a coluna nova nao vier no CSV RAP', () => {
    const rows = parseSiafiCsvText(
      [
        'NE CCor;Num. Processo;Favorecido Nome;Favorecido Numero;Descricao;Natureza Despesa;PI Codigo;PTRES;DESPESAS EMPENHADAS (CONTROLE EMPENHO);DESPESAS LIQUIDADAS (CONTROLE EMPENHO);DESPESAS PAGAS (CONTROLE EMPENHO);RESTOS A PAGAR INSCRITOS;RESTOS A PAGAR NAO PROCESSADOS REINSCRITOS;RESTOS A PAGAR PAGOS;RESTOS A PAGAR A PAGAR',
        '158366264352026NE000010;23001.000010/2026-11;Fornecedor B;12345678000190;Empenho exercicio;339039;PI123ADN;123456;2.000,00;1.500,00;1.000,00;0,00;0,00;0,00;0,00',
        '158366264352025NE000011;23001.000011/2025-11;Fornecedor C;98765432000190;Empenho RAP;339030;PI456ADN;654321;0,00;0,00;0,00;3.000,00;1.000,00;500,00;2.500,00',
      ].join('\n'),
    );

    expect(rows[1]).toMatchObject({
      numeroResumido: '2025NE000011',
      valorLiquidadoAPagar: 0,
    });
  });

  it('parseia o CSV especifico de saldo de RAP e marca a linha como saldo direto', () => {
    const rows = parseSiafiCsvText(
      [
        '"NE CCor"\t"Metrica"\t""',
        '"158366264352024NE000010"\t"Saldo - Moeda Origem (Conta Contabil)"\t"3.570,00"',
      ].join('\n'),
    );

    expect(rows).toEqual([
      expect.objectContaining({
        numeroResumido: '2024NE000010',
        isRap: true,
        saldoRapOficial: 3570,
        rapSaldoOnly: true,
        valorLiquidadoAPagar: 0,
      }),
    ]);
  });

  it('persiste saldo RAP ajustado e status liquidado quando ha valor liquidado a pagar sem pagamento', async () => {
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn(() => ({ eq: updateEqMock }));
    const limitMock = vi.fn().mockResolvedValue({ data: [{ id: 'rap-1', tipo: 'rap' }] });
    const eqMock = vi.fn(() => ({ limit: limitMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));

    fromMock.mockReturnValue({
      select: selectMock,
      update: updateMock,
    });

    await syncSiafiDataToDb([
      {
        numeroCompleto: '158366264352025NE000011',
        numeroResumido: '2025NE000011',
        processo: '23001.000011/2025-11',
        favorecidoNome: 'Fornecedor C',
        favorecidoDocumento: '98.765.432/0001-90',
        descricao: 'Empenho RAP',
        naturezaDespesa: '339030',
        planoInterno: 'PI456ADN',
        ptres: '654321',
        isRap: true,
        valorLiquidadoOficial: 0,
        valorPagoOficial: 0,
        valorEmpenhado: 0,
        rapInscrito: 3000,
        rapALiquidar: 1000,
        rapLiquidado: 2000,
        rapPago: 0,
        rapAPagar: 300,
        valorLiquidadoAPagar: 300,
      },
    ]);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        valor_liquidado_a_pagar: 300,
        saldo_rap_oficial: 0,
        status: 'liquidado',
        rap_pago: 0,
      }),
    );
    expect(updateEqMock).toHaveBeenCalledWith('id', 'rap-1');
  });

  it('atualiza apenas o saldo oficial quando o CSV de RAP trouxer somente saldo', async () => {
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn(() => ({ eq: updateEqMock }));
    const limitMock = vi.fn().mockResolvedValue({ data: [{ id: 'rap-2', tipo: 'rap', status: 'liquidado' }] });
    const eqMock = vi.fn(() => ({ limit: limitMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));

    fromMock.mockReturnValue({
      select: selectMock,
      update: updateMock,
    });

    await syncSiafiDataToDb([
      {
        numeroCompleto: '158366264352024NE000010',
        numeroResumido: '2024NE000010',
        processo: '',
        favorecidoNome: '',
        favorecidoDocumento: '',
        descricao: '',
        naturezaDespesa: '',
        planoInterno: '',
        ptres: '',
        isRap: true,
        valorLiquidadoOficial: 0,
        valorPagoOficial: 0,
        valorEmpenhado: 0,
        rapInscrito: 0,
        rapALiquidar: 0,
        rapLiquidado: 0,
        rapPago: 0,
        rapAPagar: 3570,
        valorLiquidadoAPagar: 0,
        saldoRapOficial: 3570,
        rapSaldoOnly: true,
      },
    ]);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        saldo_rap_oficial: 3570,
        status: 'liquidado',
        tipo: 'rap',
      }),
    );
    expect(updateMock.mock.calls[0][0]).not.toHaveProperty('valor_liquidado_a_pagar');
    expect(updateMock.mock.calls[0][0]).not.toHaveProperty('rap_inscrito');
    expect(updateEqMock).toHaveBeenCalledWith('id', 'rap-2');
  });
});
