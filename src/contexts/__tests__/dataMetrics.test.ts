import {
  getADescentralizar,
  getResumoOrcamentario,
  getSaldoTotal,
  getTotalDescentralizado,
  getTotalEmpenhado,
  getTotalPlanejado,
} from '@/contexts/dataMetrics';

describe('dataMetrics', () => {
  const atividades = [
    {
      id: 'atividade-en',
      dimensao: 'EN - Ensino',
      componenteFuncional: 'Ensino Base',
      tipoAtividade: 'sistemico',
      atividade: 'Atividade ensino',
      descricao: 'Descricao',
      valorTotal: 120,
      origemRecurso: 'Tesouro',
      naturezaDespesa: '339039',
      planoInterno: 'PI-EN',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
    {
      id: 'atividade-ad',
      dimensao: 'AD - Administracao',
      componenteFuncional: 'Gestao',
      tipoAtividade: 'campus',
      atividade: 'Atividade administracao',
      descricao: 'Descricao',
      valorTotal: 80,
      origemRecurso: 'Tesouro',
      naturezaDespesa: '339039',
      planoInterno: 'PI-AD',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
  ];

  const empenhos = [
    {
      id: 'empenho-en',
      numero: '2026NE0001',
      descricao: 'Empenho ensino',
      valor: 30,
      dimensao: 'EN - Ensino',
      componenteFuncional: 'Ensino Base',
      origemRecurso: 'Tesouro',
      naturezaDespesa: '339039',
      planoInterno: 'PIEN',
      tipo: 'exercicio' as const,
      dataEmpenho: new Date('2026-02-01'),
      status: 'pendente' as const,
      createdAt: new Date('2026-02-01'),
      updatedAt: new Date('2026-02-01'),
    },
    {
      id: 'empenho-cancelado',
      numero: '2026NE0002',
      descricao: 'Empenho cancelado',
      valor: 999,
      dimensao: 'EN - Ensino',
      componenteFuncional: 'Ensino Base',
      origemRecurso: 'Tesouro',
      naturezaDespesa: '339039',
      planoInterno: 'PIEN',
      tipo: 'exercicio' as const,
      dataEmpenho: new Date('2026-02-02'),
      status: 'cancelado' as const,
      createdAt: new Date('2026-02-02'),
      updatedAt: new Date('2026-02-02'),
    },
  ];

  const descentralizacoes = [
    {
      id: 'desc-en',
      dimensao: 'EN - Ensino',
      origemRecurso: 'Tesouro',
      valor: 50,
      createdAt: new Date('2026-01-10'),
      updatedAt: new Date('2026-01-10'),
    },
  ];

  it('calcula totais e resumo ignorando empenhos cancelados', () => {
    expect(getTotalPlanejado(atividades)).toBe(200);
    expect(getTotalEmpenhado(empenhos)).toBe(30);
    expect(getTotalDescentralizado(descentralizacoes)).toBe(50);
    expect(getADescentralizar(atividades, descentralizacoes)).toBe(150);
    expect(getSaldoTotal(atividades, empenhos)).toBe(170);

    expect(getResumoOrcamentario(atividades, empenhos)).toEqual([
      {
        dimensao: 'EN - Ensino',
        origemRecurso: 'Tesouro',
        valorPlanejado: 120,
        valorEmpenhado: 30,
        saldoDisponivel: 90,
        percentualExecutado: 25,
      },
      {
        dimensao: 'AD - Administracao',
        origemRecurso: 'Tesouro',
        valorPlanejado: 80,
        valorEmpenhado: 0,
        saldoDisponivel: 80,
        percentualExecutado: 0,
      },
    ]);
  });
});
