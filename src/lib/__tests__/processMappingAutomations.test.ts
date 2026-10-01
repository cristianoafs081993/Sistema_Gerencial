import { describe, expect, it } from 'vitest';

import { getNodeAutomations } from '../processMappingAutomations';

const auto = (title: string) => ({ enabled: true, title, action: 'advance_step' as const });

describe('getNodeAutomations', () => {
  it('trata o campo legado `automation` como lista de um item', () => {
    expect(getNodeAutomations({ automation: auto('A') })).toEqual([auto('A')]);
  });

  it('prefere `automations` quando existe', () => {
    expect(getNodeAutomations({ automation: auto('A'), automations: [auto('B'), auto('C')] })).toHaveLength(2);
  });

  it('retorna lista vazia sem automações', () => {
    expect(getNodeAutomations({})).toEqual([]);
    expect(getNodeAutomations(null)).toEqual([]);
  });
});
