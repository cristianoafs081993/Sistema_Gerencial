import { describe, expect, it } from 'vitest';

import type { Empenho } from '@/types';
import { filterAndRankRequisicaoEmpenhos } from '@/utils/requisicaoEmpenhoSelector';

const buildEmpenho = (patch: Partial<Empenho>): Empenho => ({
  id: 'emp-1',
  numero: '2026NE000001',
  descricao: 'Material de consumo',
  valor: 1000,
  dimensao: '',
  componenteFuncional: '',
  origemRecurso: '',
  naturezaDespesa: '',
  tipo: 'exercicio',
  status: 'pendente',
  dataEmpenho: new Date('2026-07-01T12:00:00Z'),
  createdAt: new Date('2026-07-01T12:00:00Z'),
  updatedAt: new Date('2026-07-01T12:00:00Z'),
  ...patch,
});

describe('requisicaoEmpenhoSelector', () => {
  it('prioriza a NE exata mesmo quando ela nao era o primeiro resultado', () => {
    const empenhos = [
      buildEmpenho({ id: 'partial', numero: '2026NE0000729' }),
      buildEmpenho({ id: 'exact', numero: '2026NE000072' }),
      buildEmpenho({ id: 'other', numero: '2026NE000017' }),
    ];

    expect(filterAndRankRequisicaoEmpenhos(empenhos, { busca: '2026-ne-000072' }).map((item) => item.id))
      .toEqual(['exact', 'partial']);
  });

  it('filtra por favorecido ignorando acentos e caixa', () => {
    const empenhos = [
      buildEmpenho({ id: 'mercado', favorecidoNome: 'Comércio São José Ltda.' }),
      buildEmpenho({ id: 'outro', favorecidoNome: 'Fornecedor Norte' }),
    ];

    expect(filterAndRankRequisicaoEmpenhos(empenhos, { favorecido: 'comercio sao jose' }).map((item) => item.id))
      .toEqual(['mercado']);
  });

  it('mantem a NE sem saldo disponivel entre as opcoes', () => {
    const empenhos = [buildEmpenho({ id: 'saldo-zero', valor: 0 })];

    expect(filterAndRankRequisicaoEmpenhos(empenhos).map((item) => item.id)).toEqual(['saldo-zero']);
  });
});
