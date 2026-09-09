import { describe, expect, it } from 'vitest';
import { contractDaysRemaining, formatContractDate } from '../contractPresentation';

describe('vigência como data civil', () => {
  it.each(['2026-07-16', '2026-07-16T00:00:00Z', new Date('2026-07-16T00:00:00Z')])('preserva o dia informado: %s', value => {
    expect(formatContractDate(value)).toBe('16/07/2026');
  });
  it.each([null, undefined, '', 'inválido', '2026-02-31', new Date('inválido')])('trata data ausente ou inválida: %s', value => {
    expect(formatContractDate(value)).toBe('—');
    expect(contractDaysRemaining(value)).toBeNull();
  });
  it('compara dias civis, incluindo hoje e o limite de 90 dias', () => {
    const today = new Date('2026-07-16T23:59:59');
    expect(contractDaysRemaining('2026-07-16', today)).toBe(0);
    expect(contractDaysRemaining('2026-07-15', today)).toBe(-1);
    expect(contractDaysRemaining('2026-10-14', today)).toBe(90);
    expect(contractDaysRemaining('2026-10-15', today)).toBe(91);
  });
});
