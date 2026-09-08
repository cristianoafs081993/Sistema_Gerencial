import { describe, expect, it } from 'vitest';

import {
  DEFAULT_IFRN_CAMPUS_UASG,
  IFRN_CAMPUSES,
  getIfrnCampus,
  isIfrnCampusUasg,
} from '@/lib/ifrnCampuses';

describe('catálogo de campi IFRN', () => {
  it('mantém Currais Novos como campus padrão e o catálogo com 19 UASGs', () => {
    expect(DEFAULT_IFRN_CAMPUS_UASG).toBe('158366');
    expect(IFRN_CAMPUSES).toHaveLength(19);
    expect(getIfrnCampus(DEFAULT_IFRN_CAMPUS_UASG)?.nome).toBe('Currais Novos');
  });

  it('aceita somente UASGs do catálogo IFRN', () => {
    expect(isIfrnCampusUasg('158370')).toBe(true);
    expect(isIfrnCampusUasg('999999')).toBe(false);
    expect(isIfrnCampusUasg(null)).toBe(false);
  });
});
