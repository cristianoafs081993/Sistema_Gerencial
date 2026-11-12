// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { resolveBancoCodigo } from '../bancoCodigo';

describe('resolveBancoCodigo', () => {
  it.each([
    ['001', '001'],
    ['1', '001'],
    ['77', '077'],
    ['104 - Caixa', '104'],
    ['Banco do Brasil S.A', '001'],
    ['BANCO DO BRASIL S.A.', '001'],
    ['Caixa Econômica Federal', '104'],
    ['Nu Pagamentos S.A. (Nubank)', '260'],
    ['Banco Inter S.A.', '077'],
    ['Itaú Unibanco', '341'],
    ['Banco Bradesco S.A.', '237'],
    ['Banco Santander (Brasil) S.A.', '033'],
    ['Banco do Nordeste do Brasil', '004'],
    ['PagSeguro Internet', '290'],
    ['Mercado Pago', '323'],
    ['C6 Bank', '336'],
  ])('%s -> %s', (input, expected) => {
    expect(resolveBancoCodigo(input)).toBe(expected);
  });

  it('retorna vazio quando nao reconhece o banco', () => {
    expect(resolveBancoCodigo('Banco Desconhecido Ltda')).toBe('');
    expect(resolveBancoCodigo('')).toBe('');
    expect(resolveBancoCodigo(undefined)).toBe('');
  });
});
