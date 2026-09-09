import { describe, expect, it } from 'vitest';
import { matchesPlanoInternoFilter, normalizePlanoInterno } from '@/utils/planoInternoFilters';

describe('planoInternoFilters', () => {
  describe('normalizePlanoInterno', () => {
    it('normaliza para maiúsculas e remove espaços das bordas', () => {
      expect(normalizePlanoInterno('  l20rlp0100n  ')).toBe('L20RLP0100N');
    });

    it('retorna string vazia para valores nulos ou indefinidos', () => {
      expect(normalizePlanoInterno(null)).toBe('');
      expect(normalizePlanoInterno(undefined)).toBe('');
    });
  });

  describe('matchesPlanoInternoFilter', () => {
    it('retorna true quando o filtro é "all" ou vazio', () => {
      expect(matchesPlanoInternoFilter({ planoInterno: 'L20RLP0100N', filterValue: 'all' })).toBe(true);
      expect(matchesPlanoInternoFilter({ planoInterno: 'L20RLP0100N', filterValue: '' })).toBe(true);
      expect(matchesPlanoInternoFilter({ planoInterno: undefined, filterValue: 'all' })).toBe(true);
    });

    it('retorna false quando o registro não possui plano interno e o filtro está ativo', () => {
      expect(matchesPlanoInternoFilter({ planoInterno: null, filterValue: 'L20RLP0100N' })).toBe(false);
      expect(matchesPlanoInternoFilter({ planoInterno: '', filterValue: 'L20RLP0100N' })).toBe(false);
    });

    it('faz match exato ignorando case', () => {
      expect(matchesPlanoInternoFilter({ planoInterno: 'l20rlp0100n', filterValue: 'L20RLP0100N' })).toBe(true);
      expect(matchesPlanoInternoFilter({ planoInterno: 'L20RLP0100N', filterValue: 'l20rlp0100n' })).toBe(true);
    });

    it('faz match quando o registro possui descrição além do código PI', () => {
      expect(
        matchesPlanoInternoFilter({
          planoInterno: 'L20RLP0100N - Coordenação de Cursos',
          filterValue: 'L20RLP0100N',
        }),
      ).toBe(true);

      expect(
        matchesPlanoInternoFilter({
          planoInterno: 'L20RLP0100N',
          filterValue: 'L20RLP0100N - Coordenação de Cursos',
        }),
      ).toBe(true);
    });

    it('faz match para variações alfanuméricas como "PI-EN" e "PIEN"', () => {
      expect(
        matchesPlanoInternoFilter({
          planoInterno: 'PI-EN',
          filterValue: 'PIEN',
        }),
      ).toBe(true);

      expect(
        matchesPlanoInternoFilter({
          planoInterno: 'PIEN',
          filterValue: 'PI-EN',
        }),
      ).toBe(true);
    });

    it('retorna false para códigos distintos', () => {
      expect(
        matchesPlanoInternoFilter({
          planoInterno: 'L20RLP0100N',
          filterValue: 'L20RLP0200N',
        }),
      ).toBe(false);
    });
  });
});
