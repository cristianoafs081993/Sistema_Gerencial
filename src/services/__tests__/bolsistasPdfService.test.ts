import { describe, it, expect } from 'vitest';
import { extractFromText } from '../bolsistasPdfService';

describe('bolsistasPdfService', () => {
  describe('extractFromText in Table Layout (Format B)', () => {
    it('should correctly parse standard student records', () => {
      const text = `
        Nº   NOME   MATRÍCULA   CPF   BANCO   AGÊNCIA   OP.   CONTA  VALOR  REFERÊNCIA
        1   Alison Rafael da Silva Pereira   20241034010039   168.469.274-17   001   0075-2   20920-1   91,00 R$
      `;
      const results = extractFromText(text, 'test.pdf');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        cpf: '168.469.274-17',
        nome: 'Alison Rafael da Silva Pereira',
        banco: '001',
        agencia: '0075-2',
        conta: '20920-1',
        sourceFile: 'test.pdf',
        valor: 91.00,
      });
    });

    it('should parse students with very long names (up to 80 characters)', () => {
      const text = `
        Nº   NOME   MATRÍCULA   CPF   BANCO   AGÊNCIA   OP.   CONTA  VALOR  REFERÊNCIA
        1   Hevelly Mariana Conceição Fernandes da Silva   20261030480025   711.521.464-67   260   0001   985864867-1   55,00 R$
      `;
      const results = extractFromText(text, 'test.pdf');
      expect(results).toHaveLength(1);
      expect(results[0].nome).toBe('Hevelly Mariana Conceição Fernandes da Silva');
      expect(results[0].cpf).toBe('711.521.464-67');
    });

    it('should parse bank codes with 2 digits (e.g. Banco Inter - 77)', () => {
      const text = `
        Nº   NOME   MATRÍCULA   CPF   BANCO   AGÊNCIA   OP.   CONTA  VALOR  REFERÊNCIA
        1   Ana Cecilya Alves da Costa   20231031160064   711.783.284-30   77   0001   28299072-0   91,00 R$
      `;
      const results = extractFromText(text, 'test.pdf');
      expect(results).toHaveLength(1);
      expect(results[0].banco).toBe('77');
      expect(results[0].conta).toBe('28299072-0');
    });

    it('should parse accounts containing dots (e.g. 22.606-8)', () => {
      const text = `
        Nº   NOME   MATRÍCULA   CPF   BANCO   AGÊNCIA   OP.   CONTA  VALOR  REFERÊNCIA
        1   Alicia Beatriz Medeiros de Almeida Silva   20261031160065   700.651.344-86   001   0075-2   22.606-8   91,00 R$
      `;
      const results = extractFromText(text, 'test.pdf');
      expect(results).toHaveLength(1);
      expect(results[0].conta).toBe('22.606-8');
    });

    it('should parse multiple students correctly', () => {
      const text = `
        MATRÍCULA   CPF   BANCO   AGÊNCIA   OP.   CONTA  VALOR  REFERÊNCIA
        1   Alicia Beatriz Medeiros de Almeida Silva   20261031160065   700.651.344-86   001   0075-2   22.606-8   91,00 R$
        2   Alison Rafael da Silva Pereira   20241034010039   168.469.274-17   001   0075-2   20920-1   91,00 R$
        3   Ana Cecilya Alves da Costa   20231031160064   711.783.284-30   77   0001   28299072-0   91,00 R$
      `;
      const results = extractFromText(text, 'test.pdf');
      expect(results).toHaveLength(3);
      expect(results[0].cpf).toBe('700.651.344-86');
      expect(results[1].cpf).toBe('168.469.274-17');
      expect(results[2].cpf).toBe('711.783.284-30');
    });
  });
});
