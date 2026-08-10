import { describe, expect, it } from 'vitest';
import {
  extractDimensionCode,
  extractDimensionCodeFromPlanInternal,
  matchesDimensionFilter,
  resolveRecordDimensionCode,
} from '../dimensionFilters';

describe('dimensionFilters', () => {
  it('extracts the code from full dimension labels', () => {
    expect(extractDimensionCode('AD - Administracao')).toBe('AD');
    expect(extractDimensionCode('AE - Atividades Estudantis')).toBe('AE');
    expect(extractDimensionCode('ad - administracao')).toBe('AD');
    expect(extractDimensionCode('\u0041dministra\u00e7\u00e3o')).toBe('AD');
  });

  it('extracts the code from plan internal suffixes', () => {
    expect(extractDimensionCodeFromPlanInternal('L20RLP01ADN')).toBe('AD');
    expect(extractDimensionCodeFromPlanInternal('L2994P23AEN')).toBe('AE');
    expect(extractDimensionCodeFromPlanInternal('L20RLP99TIN')).toBe('TI');
  });

  it('resolves the dimension from plan internal when the field is blank', () => {
    expect(
      resolveRecordDimensionCode({
        dimensionValue: '',
        planInternal: 'L20RLP01ADN',
        description: 'REQUISICAO MACROPROCESSO AD-ADMINISTRACAO',
      }),
    ).toBe('AD');
  });

  it('matches records even when the dimension must be inferred', () => {
    expect(
      matchesDimensionFilter({
        dimensionValue: '',
        planInternal: 'L20RLP99GON',
        description: 'MACROPROCESSO GO-GOVERNANCA',
        filterValue: 'GO',
      }),
    ).toBe(true);
  });

  it('accepts the full dimension label as the selected filter', () => {
    expect(
      matchesDimensionFilter({
        dimensionValue: 'AD - Administracao',
        filterValue: 'AD - Administra\u00e7\u00e3o',
      }),
    ).toBe(true);
  });

  it('does not match unrelated dimensions', () => {
    expect(
      matchesDimensionFilter({
        dimensionValue: 'EN - Ensino',
        planInternal: 'L20RLP19ENN',
        description: 'PROCESSO 23421.001697.2026-28',
        filterValue: 'AD',
      }),
    ).toBe(false);
  });
});
