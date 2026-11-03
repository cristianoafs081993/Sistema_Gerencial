// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_IFRN_CAMPUS_UASG,
  IFRN_CAMPUSES,
  getIfrnCampus,
  isIfrnCampusUasg,
} from '@/lib/ifrnCampuses';

describe('catálogo de campi IFRN', () => {
  it('mantém Currais Novos como campus padrão e o catálogo com 24 UASGs', () => {
    expect(DEFAULT_IFRN_CAMPUS_UASG).toBe('158366');
    expect(IFRN_CAMPUSES).toHaveLength(24);
    expect(getIfrnCampus(DEFAULT_IFRN_CAMPUS_UASG)?.nome).toBe('Currais Novos');
  });

  it('inclui as UGs dos campi novos e avançados que emitem NE no SIAFI', () => {
    expect(
      ['158882', '158887', '158896', '158897', '158898'].map((uasg) => getIfrnCampus(uasg)?.nome),
    ).toEqual(['Parelhas', 'Lajes', 'Touros', 'São Miguel', 'Umarizal']);
    expect(IFRN_CAMPUSES.map((campus) => campus.codigo)).toEqual(
      Array.from(new Set(IFRN_CAMPUSES.map((campus) => campus.codigo))),
    );
  });

  it('aceita somente UASGs do catálogo IFRN', () => {
    expect(isIfrnCampusUasg('158370')).toBe(true);
    expect(isIfrnCampusUasg('999999')).toBe(false);
    expect(isIfrnCampusUasg(null)).toBe(false);
  });
});
