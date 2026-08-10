import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

describe('popup da extensao: sincronizacao do Plano 8', () => {
  it('captura o Plano 8 autenticado e envia ao sincronizador, sem inserir linhas no cliente', () => {
    const popup = readFileSync(extensionFixturePath('popup.js'), 'utf8');
    expect(popup).toContain("action: 'sync-html'");
    expect(popup).toContain("action: 'apply'");
    expect(popup).toContain('btn-apply-plan');
    expect(popup).toContain('chrome.scripting.executeScript');
    expect(popup).toContain('siages:suap-plan-sync-request');
    expect(popup).toContain('function isCampusUrl');
    expect(popup).not.toContain("files: ['content.js']");
    expect(popup).not.toContain("chrome.tabs.create({ url: 'https://www.siages.com.br/planejamento/campus' })");
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