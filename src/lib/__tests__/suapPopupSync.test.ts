import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

describe('popup da extensao: sincronizacao do Plano 8', () => {
  it('aciona o Campus do SIAGES em vez de extrair/inserir linhas no cliente', () => {
    const popup = readFileSync(extensionFixturePath('popup.js'), 'utf8');
    expect(popup).toContain('siages:suap-plan-sync-request');
    expect(popup).toContain('www.siages.com.br/planejamento/campus');
    expect(popup).not.toContain("files: ['content.js']");
    expect(popup).not.toContain("supabaseFetch('atividades'");
    expect(popup).not.toContain('insertActivities(newActivities)');
  });

  it('permite que o popup reenvie a solicitacao para uma pagina Campus ja aberta', () => {
    const bridge = readFileSync(extensionFixturePath('siages-plan-sync.js'), 'utf8');
    expect(bridge).toContain('chrome.runtime.onMessage');
    expect(bridge).toContain('siages:suap-plan-sync-request');
    expect(bridge).toContain("scope: 'campus'");
  });
});
