import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

describe('pacote da extensao Suape 1.9', () => {
  it('mantem versao, permissoes e scripts restritos as rotas corretas', () => {
    const manifest = JSON.parse(fs.readFileSync(extensionFixturePath('manifest.json'), 'utf8'));

    expect(manifest.version).toBe('1.9.15');
    expect(manifest.host_permissions).toContain('<all_urls>');
    expect(manifest.permissions).toEqual(expect.arrayContaining(['activeTab', 'scripting', 'storage', 'alarms']));
    expect(manifest.background).toEqual({ service_worker: 'background.js' });

    const expander = manifest.content_scripts.find((entry: { js: string[] }) => entry.js.includes('text-expander.js'));
    const process = manifest.content_scripts.find((entry: { js: string[] }) => entry.js.includes('process-document.js'));
    const plan = manifest.content_scripts.find((entry: { js: string[] }) => entry.js.includes('plan-summary.js'));

    expect(expander).toMatchObject({ matches: ['<all_urls>'], all_frames: true });
    expect(process.matches).toEqual([
      'https://suap.ifrn.edu.br/processo_eletronico/processo/*',
      'https://suap.ifrn.edu.br/processo_eletronico/visualizar_processo/*',
    ]);
    expect(plan.matches).toEqual(['https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/']);
    expect(plan.js).toEqual(['plan-summary.js']);
    expect(fs.readFileSync(extensionFixturePath('plan-summary.js'), 'utf8')).toContain('siages-plan-column-sort');
    expect(process.matches).not.toContain(plan.matches[0]);
  });

  it('preserva autenticacao e extracao no popup sem expor a origem configuravel', () => {
    const popup = fs.readFileSync(extensionFixturePath('popup.html'), 'utf8');
    const popupScript = fs.readFileSync(extensionFixturePath('popup.js'), 'utf8');
    const processScript = fs.readFileSync(extensionFixturePath('process-document.js'), 'utf8');
    const planScript = fs.readFileSync(extensionFixturePath('plan-summary.js'), 'utf8');
    const backgroundScript = fs.readFileSync(extensionFixturePath('background.js'), 'utf8');

    expect(popup).toContain('id="extension-auth-email"');
    expect(popup).toContain('id="btn-extension-sign-in"');
    expect(popup).toContain('id="btn-extension-sign-out"');
    expect(popup).toContain('id="btn-extract-en"');
    expect(popup).toContain('id="btn-extract-all"');
    expect(popup).not.toContain('id="siages-app-origin"');
    expect(popup).not.toContain('id="btn-save-siages-app-origin"');
    expect(popupScript).not.toContain('siages-app-origin');
    expect(popupScript).not.toContain('sistema-gerencial-gamma.vercel.app');
    expect(processScript).toContain("form.querySelector('input[name=\"email\"]')");
    expect(processScript).toContain("form.querySelector('input[name=\"password\"]')");
    expect(processScript).not.toContain('form.elements.email.value');
    expect(processScript).not.toContain('form.elements.password.value');
    expect(processScript).toContain('response.status === 400');
    expect(popupScript).toContain('response.status === 400');
    expect(processScript).toContain('extension context invalidated');
    const processKey = processScript.match(/SUPABASE_ANON_KEY = '([^']+)'/)?.[1];
    const planKey = planScript.match(/SUPABASE_ANON_KEY = '([^']+)'/)?.[1];
    const popupKey = popupScript.match(/SUPABASE_KEY = '([^']+)'/)?.[1];
    expect(processKey).toBe(planKey);
    expect(popupKey).toBe(planKey);
    expect(backgroundScript).toContain("const EXTENSION_SESSION_STORAGE_KEY = 'siages-extension-session'");
    expect(backgroundScript).toContain('refresh_token');
    expect(backgroundScript).toContain('chrome.alarms.create');
  });
});


