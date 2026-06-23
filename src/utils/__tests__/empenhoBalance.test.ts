import { describe, expect, it } from 'vitest';

import type { Empenho } from '@/types';
import { getEmpenhoAvailableBalance, hasSufficientEmpenhoBalance } from '@/utils/empenhoBalance';

const baseEmpenho = {
  id: 'emp-1', numero: '2026NE000001', descricao: '', valor: 1000, dimensao: '', componenteFuncional: '',
  origemRecurso: '', naturezaDespesa: '', tipo: 'exercicio', dataEmpenho: new Date('2026-01-01'), status: 'pendente',
  createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
} satisfies Empenho;

describe('empenhoBalance', () => {
  it('desconta valores liquidados a pagar e pagos do empenho do exercicio', () => {
    const empenho = { ...baseEmpenho, valorLiquidadoAPagar: 200, valorPagoOficial: 300 };
    expect(getEmpenhoAvailableBalance(empenho)).toBe(500);
    expect(hasSufficientEmpenhoBalance(empenho, 500)).toBe(true);
    expect(hasSufficientEmpenhoBalance(empenho, 500.01)).toBe(false);
  });

  it('prioriza o saldo oficial de RAP', () => {
    const empenho: Empenho = { ...baseEmpenho, tipo: 'rap', saldoRapOficial: 275 };
    expect(getEmpenhoAvailableBalance(empenho, 2026)).toBe(275);
  });
});
