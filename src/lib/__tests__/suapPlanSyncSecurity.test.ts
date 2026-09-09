import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { isAllowedSuapProxyPath } from '../../../supabase/functions/_shared/suap_proxy_paths';

describe('proxy do Plano 8 do SUAP', () => {
  it('permite a pagina canonica e apenas o filtro de unidade SUAP controlado', () => {
    expect(isAllowedSuapProxyPath('/plan_estrategico/plano_concluido/8/')).toBe(true);
    expect(isAllowedSuapProxyPath('/plan_estrategico/plano_concluido/8/?unidade_gestora=15')).toBe(true);
    expect(isAllowedSuapProxyPath('/plan_estrategico/plano_concluido/8/?unidade_gestora=999')).toBe(false);
    expect(isAllowedSuapProxyPath('/plan_estrategico/plano_concluido/8/?unidade_gestora=15&next=/')).toBe(false);
    expect(isAllowedSuapProxyPath('https://malicioso.example/plan_estrategico/plano_concluido/8/')).toBe(false);
  });

  it('aceita a captura direta da extensao somente no Plano 8 canonico', () => {
    const source = readFileSync('supabase/functions/sync-suap-plan/index.ts', 'utf8');
    expect(source).toContain("'sync-html'");
    expect(source).toContain('unidade_gestora');
    expect(source).toMatch(/html\.length > (?:HTML_LIMIT|15 \* 1024 \* 1024)/);
  });
});
