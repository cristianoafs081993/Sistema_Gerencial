import { describe, expect, it } from 'vitest';

import { isAllowedSuapProxyPath } from '../../../supabase/functions/_shared/suap_proxy_paths';

describe('proxy do Plano 8 do SUAP', () => {
  it('permite somente a página canônica sem query string', () => {
    expect(isAllowedSuapProxyPath('/plan_estrategico/plano_concluido/8/')).toBe(true);
    expect(isAllowedSuapProxyPath('/plan_estrategico/plano_concluido/8/?next=/')).toBe(false);
    expect(isAllowedSuapProxyPath('https://malicioso.example/plan_estrategico/plano_concluido/8/')).toBe(false);
  });
});
