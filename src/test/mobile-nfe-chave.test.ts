// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { cnpjValido, validarChaveNfe } from '../../mobile/src/lib/nfeChave';

const CHAVE_VALIDA = '43260737028928000194550010000018081298898520';

describe('mobile — validação da chave de acesso da NF-e', () => {
  it('aceita uma chave bem formada e coerente com a fatura', () => {
    expect(validarChaveNfe(CHAVE_VALIDA, { fornecedorCnpj: '37.028.928/0001-94', numeroDocumento: '1.808' })).toEqual({
      estado: 'valida',
      motivo: null,
    });
  });

  it('aceita chave com espaços e pontuação, e NF3-e (modelo 66) de energia', () => {
    expect(validarChaveNfe('4326 0737 0289 2800 0194 5500 1000 0018 0812 9889 8520')?.estado).toBe('valida');
    expect(validarChaveNfe('24260708324196000181660001632384721086871950')?.estado).toBe('valida');
  });

  it('não devolve nada para campo vazio', () => {
    expect(validarChaveNfe('')).toBeNull();
    expect(validarChaveNfe(null)).toBeNull();
    expect(validarChaveNfe('   ')).toBeNull();
  });

  it('aponta dígito verificador, CNPJ e placeholders zerados como inconsistentes', () => {
    expect(validarChaveNfe(CHAVE_VALIDA.slice(0, 43) + '1')).toMatchObject({ estado: 'inconsistente', motivo: 'Dígito verificador não confere' });
    expect(validarChaveNfe('14926557300000000000000000000000000000000000')?.estado).toBe('inconsistente');
    expect(validarChaveNfe('53001081237763946000110000000000164326091789491843')).toMatchObject({ estado: 'inconsistente' });
  });

  it('cruza a chave com o fornecedor e o número da fatura', () => {
    expect(validarChaveNfe(CHAVE_VALIDA, { fornecedorCnpj: '11.222.333/0001-81' })).toMatchObject({
      estado: 'inconsistente',
      motivo: 'O CNPJ da chave é diferente do fornecedor da fatura',
    });
    expect(validarChaveNfe(CHAVE_VALIDA, { numeroDocumento: '1809' })?.estado).toBe('inconsistente');
    expect(validarChaveNfe(CHAVE_VALIDA, { numeroDocumento: '001.808' })?.estado).toBe('valida');
  });

  it('marca chaves cortadas como incompletas', () => {
    expect(validarChaveNfe('2426 0321 5886 5500 0100 5500 1000 0128 5415')).toMatchObject({
      estado: 'incompleta',
      motivo: 'Chave incompleta: 36 dígitos de 44',
    });
  });

  it('não trata NFS-e e números curtos como chave de NF-e', () => {
    expect(validarChaveNfe('B2ISLCF59')?.estado).toBe('nao-nfe');
    expect(validarChaveNfe('163919039')?.estado).toBe('nao-nfe');
    expect(validarChaveNfe('153V.3557.9461.2413099-S')?.estado).toBe('nao-nfe');
  });

  it('valida o CNPJ pelos dígitos verificadores', () => {
    expect(cnpjValido('37.028.928/0001-94')).toBe(true);
    expect(cnpjValido('37.028.928/0001-95')).toBe(false);
    expect(cnpjValido('00000000000000')).toBe(false);
  });
});
