import { describe, expect, it } from 'vitest';

import { cnpjValido, validarChaveNfe } from '@/utils/nfeChave';

describe('validarChaveNfe (web)', () => {
  it('ignora campo vazio e classifica códigos que não são NF-e', () => {
    expect(validarChaveNfe('')).toBeNull();
    expect(validarChaveNfe('ABC123')?.estado).toBe('nao-nfe');
  });

  it('sinaliza chaves incompletas ou com dígitos a mais', () => {
    expect(validarChaveNfe('1'.repeat(40))?.estado).toBe('incompleta');
    expect(validarChaveNfe('1'.repeat(46))?.estado).toBe('inconsistente');
  });

  it('rejeita CNPJ inválido', () => {
    expect(cnpjValido('11.111.111/1111-11')).toBe(false);
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
  });
});
