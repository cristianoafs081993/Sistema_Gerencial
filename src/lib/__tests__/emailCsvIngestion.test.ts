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
      origemRecurso: '123456',
      naturezaDespesa: '339030',
      planoInterno: 'PI123ADN',
      dataEmissao: '2026-04-08',
      valor: -500,
    });
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

  it('parseia o layout SIAFI virgulado com colunas RAP PROC E N PROC sem perder totais do exercicio', () => {
    const parsed = parseEmailCsvImport({
      fileName: 'Empenhos (3).csv',
      text: [
        '"NE CCor","NE CCor - Núm. Processo","UG Responsável","Fonte Recursos Detalhada","PTRES","PI Código PI","PI Nome","Natureza Despesa","NE CCor - Favorecido Número","NE CCor - Favorecido Nome","NE CCor - Descrição","DESPESAS EMPENHADAS (CONTROLE EMPENHO)","DESPESAS EMPENHADAS A LIQUIDAR (CONTROLE EMP)","DESPESAS LIQUIDADAS (CONTROLE EMPENHO)","DESPESAS LIQUIDADAS A PAGAR(CONTROLE EMPENHO)","DESPESAS PAGAS (CONTROLE EMPENHO)","RESTOS A PAGAR NAO PROCESSADOS REINSCRITOS","RESTOS A PAGAR INSCRITOS (PROC E N PROC)","RESTOS A PAGAR PAGOS (PROC E N PROC)","RESTOS A PAGAR A PAGAR (PROC E N PROC)"',
        '"158366264352024NE000010","23035.000105.2024-42","151606","1000000000","231796","L20RLP99CIN","DICI-COMUNIC E EVENTOS OUTRAS DESPESAS","339039","33083309000141","VITA SERVICOS DE CERIMONIAL E EVENTOS LTDA","RAP antigo","","","","","","3.570,00","3.570,00","","3.570,00"',
        '"158366264352026NE000003","23035.000003.2026-11","151606","1000000000","231796","L20RLP99ADN","PROAD-GESTAO ADMINISTRATIVA","339039","11111111000111","Fornecedor A","Empenho existente","6.095,00","4.345,41","1.749,59","0,00","1.749,59","","","",""',
        '"158366264352026NE000017","23035.000017.2026-11","151606","1000000000","231796","L20RLP99IEN","DIENG-CONTRATOS CONTINUADOS-INFRAESTRUTURA","339039","22222222000122","Fornecedor B","Empenho pago","105.812,82","88.177,35","17.635,47","3.606,45","14.029,02","","","",""',
        '"158366264352026NE000024","23035.000024.2026-11","151606","1000000000","231796","L20RLP99ADN","PROAD-GESTAO ADMINISTRATIVA","339039","33333333000133","Fornecedor C","Empenho novo","3.217,50","3.217,50","0,00","0,00","0,00","","","",""',
      ].join('\n'),
    });

    expect(parsed.pipeline).toBe('siafi_empenhos');
    if (parsed.pipeline !== 'siafi_empenhos') {
      throw new Error('pipeline inesperado');
    }

    const exercicioRows = parsed.rows.filter((row) => !row.isRap);
    expect(exercicioRows).toHaveLength(3);
    expect(exercicioRows.reduce((total, row) => total + row.valorLiquidadoOficial, 0)).toBeCloseTo(19385.06);
    expect(exercicioRows.reduce((total, row) => total + row.valorPagoOficial, 0)).toBeCloseTo(15778.61);

    expect(parsed.rows.find((row) => row.numeroResumido === '2026NE000017')).toMatchObject({
      valorPagoOficial: 14029.02,
    });
    expect(parsed.rows.find((row) => row.numeroResumido === '2024NE000010')).toMatchObject({
      isRap: true,
      rapInscrito: 3570,
      rapPago: 0,
      rapAPagar: 3570,
    });
  });

  it('faz fallback para ISO-8859-1 quando UTF-8 vier corrompido', () => {
    const bytes = new Uint8Array([0x43, 0x72, 0xe9, 0x64, 0x69, 0x74, 0x6f]);
    expect(decodeCsvBytes(bytes)).toBe('Crédito');
  });
});
