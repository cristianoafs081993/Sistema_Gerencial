import { describe, expect, it } from 'vitest';

import {
  getPortalEmpenhoAvailableBalance,
  matchesPortalEmpenhoCacheStage,
} from '../../../supabase/functions/_shared/portal_itens_cache';

describe('portal itens cache discovery helpers', () => {
  it('calcula saldo positivo de empenho do exercicio com a regra oficial', () => {
    expect(
      getPortalEmpenhoAvailableBalance({
        tipo: 'exercicio',
        valor: 1000,
        valor_liquidado_a_pagar: 200,
        valor_pago_oficial: 100,
      }),
    ).toBe(700);
  });

  it('prioriza saldo oficial de RAP e calcula fallback quando ele nao existe', () => {
    expect(getPortalEmpenhoAvailableBalance({ tipo: 'rap', saldo_rap_oficial: 450, rap_pago: 10 })).toBe(450);
    expect(getPortalEmpenhoAvailableBalance({ tipo: 'rap', rap_a_liquidar: 700, rap_pago: 125 })).toBe(575);
  });

  it('separa RAP de exercicio e exclui saldo zerado', () => {
    expect(matchesPortalEmpenhoCacheStage({ tipo: 'rap' }, 'rap')).toBe(true);
    expect(matchesPortalEmpenhoCacheStage({ tipo: 'exercicio' }, 'rap')).toBe(false);
    expect(matchesPortalEmpenhoCacheStage({ tipo: null }, 'exercicio')).toBe(true);
    expect(getPortalEmpenhoAvailableBalance({ tipo: 'exercicio', valor: 100, valor_pago_oficial: 100 })).toBe(0);
  });
});
