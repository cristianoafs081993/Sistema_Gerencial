import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { isAllowedSuapProxyPath } from '../../../supabase/functions/_shared/suap_proxy_paths';

describe('proxy do Plano 8 do SUAP', () => {
  it('permite somente a pagina canonica sem query string', () => {
    expect(isAllowedSuapProxyPath('/plan_estrategico/plano_concluido/8/')).toBe(true);
    expect(isAllowedSuapProxyPath('/plan_estrategico/plano_concluido/8/?next=/')).toBe(false);
    expect(isAllowedSuapProxyPath('https://malicioso.example/plan_estrategico/plano_concluido/8/')).toBe(false);
  });

  it('aceita a captura direta da extensao somente no Plano 8 canonico', () => {
    const source = readFileSync('supabase/functions/sync-suap-plan/index.ts', 'utf8');
    expect(source).toContain("'sync-html'");
    expect(source).toContain('!url.search && !url.hash');
    expect(source).toContain('html.length > 15 * 1024 * 1024');
  });
});
