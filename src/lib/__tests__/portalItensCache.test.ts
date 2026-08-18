import {
  DEFAULT_UASG,
  extractUasgFromDescricao,
  extractUasgFromProcesso,
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

  it('extrai UASG a partir do prefixo do processo institucional', () => {
    expect(DEFAULT_UASG).toBe('158366');
    expect(extractUasgFromProcesso('23035001276.2026-51')).toBe('158366');
    expect(extractUasgFromProcesso('23035.001276.2026-51')).toBe('158366');
    expect(extractUasgFromProcesso('23421.000123.2026-00')).toBe('158155');
    expect(extractUasgFromProcesso('23134.009999.2025-11')).toBe('158369');
    expect(extractUasgFromProcesso('99999.000000.2026-00')).toBeNull();
    expect(extractUasgFromProcesso('')).toBeNull();
    expect(extractUasgFromProcesso(null)).toBeNull();
  });

  it('extrai UASG a partir da descricao do empenho ou informacao complementar', () => {
    expect(extractUasgFromDescricao('EMPENHO PARA ATENDER DEMANDA DA UASG: 158366 DO CAMPUS')).toBe('158366');
    expect(extractUasgFromDescricao('CONFORME UG 158155')).toBe('158155');
    expect(extractUasgFromDescricao('UASG MINUTA 158369')).toBe('158369');
    expect(extractUasgFromDescricao('SEM INFORMACAO DE UNIDADE')).toBeNull();
    expect(extractUasgFromDescricao(null)).toBeNull();
  });
});

