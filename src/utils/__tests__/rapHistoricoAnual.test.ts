import {
  buildRapHistoricoAnualEvolution,
  parseRapHistoricoAnualTable,
} from '@/utils/rapHistoricoAnual';

describe('rapHistoricoAnual', () => {
  it('parseia o layout agregado anual com cabecalho apos linhas de filtro e ignora total', () => {
    const rows = parseRapHistoricoAnualTable([
      ['2016: RPNP + RPP Anteriores a 2013'],
      ['Filtro do relatorio: ano >= 2019'],
      [],
      ['UG Executora', '', 'NE CCor - Ano Emissão', 'Métrica', 'Item Informação', '', ''],
      ['158366', 'INST.FED. DO RN/CAMPUS CURRAIS NOVOS', '2019', 'Saldo - Moeda Origem (Conta Contábil)', '35', 'RESTOS A PAGAR PROCESSADOS INSCRITOS', '530,97'],
      ['158366', 'INST.FED. DO RN/CAMPUS CURRAIS NOVOS', '2019', 'Saldo - Moeda Origem (Conta Contábil)', '40', 'RESTOS A PAGAR NAO PROCESSADOS INSCRITOS', '2.061.122,70'],
      ['158366', 'INST.FED. DO RN/CAMPUS CURRAIS NOVOS', '2019', 'Saldo - Moeda Origem (Conta Contábil)', '41', 'RESTOS A PAGAR NAO PROCESSADOS REINSCRITOS', '317.875,99'],
      ['158366', 'INST.FED. DO RN/CAMPUS CURRAIS NOVOS', '2019', 'Saldo - Moeda Origem (Conta Contábil)', '50', 'RESTOS A PAGAR INSCRITOS (PROC E N PROC)', '2.379.529,66'],
      ['158366', 'INST.FED. DO RN/CAMPUS CURRAIS NOVOS', '2025', 'Saldo - Moeda Origem (Conta Contábil)', '50', 'RESTOS A PAGAR INSCRITOS (PROC E N PROC)', '1.536.898,22'],
      ['158366', 'INST.FED. DO RN/CAMPUS CURRAIS NOVOS', 'Total', 'Saldo - Moeda Origem (Conta Contábil)', 'Total', '', '31.804.641,43'],
    ]);

    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({
      ugExecutora: '158366',
      ugNome: 'INST.FED. DO RN/CAMPUS CURRAIS NOVOS',
      ano: 2019,
      metrica: 'Saldo - Moeda Origem (Conta Contábil)',
      itemInformacaoCodigo: '35',
      itemInformacaoNome: 'RESTOS A PAGAR PROCESSADOS INSCRITOS',
      valor: 530.97,
    });
    expect(rows.map((row) => row.ano)).toEqual([2019, 2019, 2019, 2019, 2025]);
  });

  it('monta a evolucao anual com total explicito e fallback pela soma dos componentes', () => {
    const rows = parseRapHistoricoAnualTable([
      ['UG Executora', '', 'NE CCor - Ano Emissão', 'Métrica', 'Item Informação', '', ''],
      ['158366', 'Campus', '2024', 'Saldo', '35', 'RESTOS A PAGAR PROCESSADOS INSCRITOS', '100,00'],
      ['158366', 'Campus', '2024', 'Saldo', '40', 'RESTOS A PAGAR NAO PROCESSADOS INSCRITOS', '300,00'],
      ['158366', 'Campus', '2024', 'Saldo', '41', 'RESTOS A PAGAR NAO PROCESSADOS REINSCRITOS', '50,00'],
      ['158366', 'Campus', '2024', 'Saldo', '50', 'RESTOS A PAGAR INSCRITOS (PROC E N PROC)', '500,00'],
      ['158366', 'Campus', '2025', 'Saldo', '35', 'RESTOS A PAGAR PROCESSADOS INSCRITOS', '25,00'],
      ['158366', 'Campus', '2025', 'Saldo', '40', 'RESTOS A PAGAR NAO PROCESSADOS INSCRITOS', '75,00'],
      ['158366', 'Campus', '2025', 'Saldo', '41', 'RESTOS A PAGAR NAO PROCESSADOS REINSCRITOS', '0,00'],
      ['152711', 'Outra UG', '2025', 'Saldo', '50', 'RESTOS A PAGAR INSCRITOS (PROC E N PROC)', '999,00'],
    ]);

    expect(buildRapHistoricoAnualEvolution(rows, '158366')).toEqual([
      {
        ano: 2024,
        processadoInscrito: 100,
        naoProcessadoInscrito: 300,
        naoProcessadoReinscrito: 50,
        total: 500,
      },
      {
        ano: 2025,
        processadoInscrito: 25,
        naoProcessadoInscrito: 75,
        naoProcessadoReinscrito: 0,
        total: 100,
      },
    ]);
  });
});
