import { decodeCsvBytes, parseEmailCsvImport } from '@/lib/emailCsvIngestion';

describe('emailCsvIngestion', () => {
  it('detecta e parseia o CSV financeiro automaticamente', () => {
    const parsed = parseEmailCsvImport({
      fileName: '4 - Financeiro.csv',
      text: [
        'linha ignorada;;;;;;;',
        'UG Executora;Nome UG;Mes Lancamento;Fonte;Fonte Desc;Vinculacao;Vinculacao Desc;Saldo - R$',
        '153103;Reitoria;MAR/2026;0100;Tesouro;144;Custeio;1.234,56',
      ].join('\n'),
    });

    expect(parsed.pipeline).toBe('financeiro');
    expect(parsed.rowCount).toBe(1);
    if (parsed.pipeline !== 'financeiro') {
      throw new Error('pipeline inesperado');
    }

    expect(parsed.rows[0]).toMatchObject({
      ugCodigo: '153103',
      ugNome: 'Reitoria',
      fonteCodigo: '0100',
      vinculacaoCodigo: '144',
      saldo: 1234.56,
    });
  });

  it('monta documentos habeis com situacoes e itens a partir do CSV tabulado', () => {
    const parsed = parseEmailCsvImport({
      fileName: 'documentos-habeis.csv',
      text: [
        'Documento Habil\tDH - Valor Doc.Origem\tDH - Processo\tDH - Estado\tDH - Credor\tFavorecido Nome\tDH - Situacao\tDH - Item\tDH - Doc Origem\tObservacao',
        '158366264352026DH000001\t1.250,00\t23001.000001/2026-01\tPENDENTE\t12345678000190\tFornecedor A\tDDF025\t\t\t',
        '158366264352026DH000001\t1.250,00\t23001.000001/2026-01\tPENDENTE\t12345678000190\tFornecedor A\t\tOB\tOB2026001\tPagamento principal',
      ].join('\n'),
    });

    expect(parsed.pipeline).toBe('documentos_habeis');
    if (parsed.pipeline !== 'documentos_habeis') {
      throw new Error('pipeline inesperado');
    }

    expect(parsed.documentos).toHaveLength(1);
    expect(parsed.documentos[0]).toMatchObject({
      id: '2026DH000001',
      valor_original: 1250,
      processo: '23001.000001/2026-01',
      estado: 'PENDENTE',
      favorecido_documento: '12345678000190',
      favorecido_nome: 'Fornecedor A',
    });
    expect(parsed.situacoes).toHaveLength(1);
    expect(parsed.situacoes[0]).toMatchObject({
      documento_habil_id: '2026DH000001',
      situacao_codigo: 'DDF025',
      is_retencao: true,
    });
    expect(parsed.itens).toHaveLength(1);
    expect(parsed.itens[0]).toMatchObject({
      id: 'OB2026001',
      documento_habil_id: '2026DH000001',
      doc_tipo: 'OB',
      valor: 1250,
    });
  });

  it('interpreta anulacao de descentralizacao como valor negativo', () => {
    const parsed = parseEmailCsvImport({
      fileName: 'descentralizacoes.csv',
      text: [
        'NC\tNC - Operacao (Tipo)\tNC - Dia Emissao\tNC - Descricao\tNC Celula - PTRES\tNC Celula - Natureza Despesa\tNC Celula - Plano Interno\tNC Celula - Valor',
        '2026NC000001\tANULACAO DE DESCENTRALIZACAO DE CREDITO\t08/04/2026\tAnulacao de credito\t123456\t339030\tPI123ADN\t500,00',
      ].join('\n'),
    });

    expect(parsed.pipeline).toBe('descentralizacoes');
    if (parsed.pipeline !== 'descentralizacoes') {
      throw new Error('pipeline inesperado');
    }

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      notaCredito: '2026NC000001',
      operacaoTipo: 'ANULACAO DE DESCENTRALIZACAO DE CREDITO',
      origemRecurso: '123456',
      naturezaDespesa: '339030',
      planoInterno: 'PI123ADN',
      dataEmissao: '2026-04-08',
      valor: -500,
    });
  });

  it('mantem linhas distintas quando a mesma NC vier quebrada em planos internos diferentes', () => {
    const parsed = parseEmailCsvImport({
      fileName: 'descentralizacoes.csv',
      text: [
        'NC\tNC - Operacao (Tipo)\tNC - Dia Emissao\tNC - Descricao\tNC Celula - PTRES\tNC Celula - Natureza Despesa\tNC Celula - Plano Interno\tNC Celula - Valor',
        '158155264352026NC000179\tANULACAO DE DESCENTRALIZACAO DE CREDITO\t19/03/2026\tESTORNO PARA AJUSTE NO PI\t231798\t339000\tL21B3P19ENN\t3217,5',
        '158155264352026NC000179\tANULACAO DE DESCENTRALIZACAO DE CREDITO\t19/03/2026\tESTORNO PARA AJUSTE NO PI\t231798\t339000\tL21B3P21EXN\t3217,5',
      ].join('\n'),
    });

    expect(parsed.pipeline).toBe('descentralizacoes');
    if (parsed.pipeline !== 'descentralizacoes') {
      throw new Error('pipeline inesperado');
    }

    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].notaCredito).toBe('2026NC000179');
    expect(parsed.rows[1].notaCredito).toBe('2026NC000179');
    expect(parsed.rows[0].planoInterno).toBe('L21B3P19ENN');
    expect(parsed.rows[1].planoInterno).toBe('L21B3P21EXN');
    expect(parsed.rows[0].rowKey).not.toBe(parsed.rows[1].rowKey);
    expect(parsed.rows[0].valor).toBe(-3217.5);
    expect(parsed.rows[1].valor).toBe(-3217.5);
  });

  it('diferencia FD-Reinf de situacoes simples pelo cabecalho', () => {
    const parsed = parseEmailCsvImport({
      fileName: 'retencoes-efd-reinf.csv',
      text: [
        'Documento Habil\tDH - Processo\tDH - Estado\tDH - UG Pagadora\tDH Item - UG Pagadora\tDH - Credor Documento\tDH - Credor Nome\tDH - Situacao\tDH - Data Emissao Doc.Origem\tDH - Dia Pagamento\tDH Item - Dia Vencimento\tDH Item - Dia Pagamento\tDH Item - Liquidado\tDH - Valor Doc.Origem\tMetrica\tValor Retencao',
        '2026DH0001\t230010001\tRN\t153103\t158155\t12345678000190\tFornecedor A\tDDF025\t01/03/2026\t15/03/2026\t20/04/2026\t20/04/2026\tSim\t1.000,00\tINSS\t110,00',
      ].join('\n'),
    });

    expect(parsed.pipeline).toBe('retencoes_efd_reinf');
    if (parsed.pipeline !== 'retencoes_efd_reinf') {
      throw new Error('pipeline inesperado');
    }

    expect(parsed.rows[0]).toMatchObject({
      documentoHabil: '2026DH0001',
      dhSituacao: 'DDF025',
      dhItemLiquidado: true,
      valorRetencao: 110,
    });
  });

  it('agrega creditos disponiveis por PTRES', () => {
    const parsed = parseEmailCsvImport({
      fileName: 'credito-disponivel.csv',
      text: [
        'PTRES;Metrica;Valor',
        '123456;Disponivel;100,00',
        '123456;Disponivel;50,00',
      ].join('\n'),
    });

    expect(parsed.pipeline).toBe('creditos_disponiveis');
    if (parsed.pipeline !== 'creditos_disponiveis') {
      throw new Error('pipeline inesperado');
    }

    expect(parsed.rows).toEqual([
      {
        ptres: '123456',
        metrica: 'Disponivel',
        valor: 150,
      },
    ]);
  });

  it('parseia o CSV do SIAFI com valores de exercicio e RAP', () => {
    const parsed = parseEmailCsvImport({
      fileName: 'Exec_NE_Exercicio_RAP_UG_Executora.csv',
      text: [
        'NE CCor;Num. Processo;Favorecido Nome;Favorecido Numero;Descricao;Natureza Despesa;PI Codigo;PTRES;DESPESAS EMPENHADAS (CONTROLE EMPENHO);DESPESAS LIQUIDADAS (CONTROLE EMPENHO);DESPESAS PAGAS (CONTROLE EMPENHO);RESTOS A PAGAR INSCRITOS;RESTOS A PAGAR NAO PROCESSADOS A LIQUIDAR;RESTOS A PAGAR PAGOS;RESTOS A PAGAR A PAGAR',
        '158366264352026NE000010;23001.000010/2026-11;Fornecedor B;12345678000190;Empenho exercicio;339039;PI123ADN;123456;2.000,00;1.500,00;1.000,00;0,00;0,00;0,00;0,00',
        '158366264352025NE000011;23001.000011/2025-11;Fornecedor C;98765432000190;Empenho RAP;339030;PI456ADN;654321;0,00;0,00;0,00;3.000,00;1.000,00;500,00;2.500,00',
      ].join('\n'),
    });

    expect(parsed.pipeline).toBe('siafi_empenhos');
    if (parsed.pipeline !== 'siafi_empenhos') {
      throw new Error('pipeline inesperado');
    }

    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      numeroResumido: '2026NE000010',
      isRap: false,
      valorEmpenhado: 2000,
      valorLiquidadoOficial: 1500,
      valorPagoOficial: 1000,
    });
    expect(parsed.rows[1]).toMatchObject({
      numeroResumido: '2025NE000011',
      isRap: true,
      rapInscrito: 3000,
      rapALiquidar: 1000,
      rapPago: 500,
      rapAPagar: 2500,
    });
  });

  it('faz fallback para ISO-8859-1 quando UTF-8 vier corrompido', () => {
    const bytes = new Uint8Array([0x43, 0x72, 0xe9, 0x64, 0x69, 0x74, 0x6f]);
    expect(decodeCsvBytes(bytes)).toBe('Crédito');
  });
});
