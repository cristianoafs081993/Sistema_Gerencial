import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

describe('pacote da extensao Suape 1.9', () => {
  it('mantem versao, permissoes e scripts restritos as rotas corretas', () => {
    const manifest = JSON.parse(fs.readFileSync(extensionFixturePath('manifest.json'), 'utf8'));

    expect(manifest.version).toBe('1.9.26');
    expect(manifest.host_permissions).toContain('<all_urls>');
    expect(manifest.permissions).toEqual(expect.arrayContaining(['activeTab', 'scripting', 'storage', 'alarms']));
    expect(manifest.background).toEqual({ service_worker: 'background.js' });

    const expander = manifest.content_scripts.find((entry: { js: string[] }) => entry.js.includes('text-expander.js'));
    const process = manifest.content_scripts.find((entry: { js: string[] }) => entry.js.includes('process-document.js'));
    const plan = manifest.content_scripts.find((entry: { js: string[] }) => entry.js.includes('plan-summary.js'));
    const comprasnet = manifest.content_scripts.find((entry: { js: string[] }) => entry.js.includes('comprasnet-etp.js'));
    const siafi = manifest.content_scripts.find((entry: { js: string[] }) => entry.js.includes('siafi-favorecidos.js'));
    const commandPalettes = manifest.content_scripts.filter((entry: { js: string[] }) => entry.js.includes('command-palette.js'));
    const suapCommandPalette = commandPalettes.find((entry: { matches: string[] }) => entry.matches.includes('https://suap.ifrn.edu.br/*'));
    const globalCommandPalette = commandPalettes.find((entry: { matches: string[] }) => entry.matches.includes('<all_urls>'));

    expect(expander).toMatchObject({ matches: ['<all_urls>'], all_frames: true });
    expect(process.matches).toEqual([
      'https://suap.ifrn.edu.br/processo_eletronico/processo/*',
      'https://suap.ifrn.edu.br/processo_eletronico/visualizar_processo/*',
      'https://suap.ifrn.edu.br/documento_eletronico/visualizar_documento/*',
      'https://suap.ifrn.edu.br/documento_eletronico/*',
    ]);
    expect(plan.matches).toEqual(['https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/']);
    expect(plan.js).toEqual(['extension-auth-client.js', 'plan-summary.js']);
    expect(process.js).toEqual(['extension-auth-client.js', 'process-document.js']);
    expect(fs.readFileSync(extensionFixturePath('plan-summary.js'), 'utf8')).toContain('siages-plan-column-sort');
    expect(process.matches).not.toContain(plan.matches[0]);
    expect(comprasnet).toMatchObject({
      matches: ['https://cnetmobile.estaleiro.serpro.gov.br/*'],
      css: ['comprasnet-etp.css'],
      js: ['extension-auth-client.js', 'comprasnet-etp.js'],
      run_at: 'document_idle',
    });
    expect(suapCommandPalette).toMatchObject({
      matches: ['https://suap.ifrn.edu.br/*'],
      css: ['command-palette.css'],
      js: ['extension-auth-client.js', 'command-palette.js'],
      run_at: 'document_idle',
    });
    expect(siafi).toMatchObject({
      matches: ['https://siafi.tesouro.gov.br/*'],
      js: ['siafi-favorecidos.js'],
      run_at: 'document_idle',
      all_frames: true,
    });
    expect(globalCommandPalette).toMatchObject({
      matches: ['<all_urls>'],
      exclude_matches: [
        'https://www.siages.com.br/*',
        'https://suap.ifrn.edu.br/*',
        'https://cnetmobile.estaleiro.serpro.gov.br/*',
      ],
      css: ['command-palette.css'],
      js: ['extension-auth-client.js', 'command-palette.js'],
      run_at: 'document_idle',
    });
  });

  it('suporta atalhos rapidos de acoes em processos eletronicos no command-palette (Ctrl+K)', () => {
    const cpScript = fs.readFileSync(extensionFixturePath('command-palette.js'), 'utf8');
    const cpCss = fs.readFileSync(extensionFixturePath('command-palette.css'), 'utf8');

    expect(cpScript).toContain('getCurrentProcessId');
    expect(cpScript).toContain('getProcessActions');
    expect(cpScript).toContain('scoreProcessAction');
    expect(cpScript).toContain('/processo_eletronico/documento_upload/');
    expect(cpScript).toContain('/processo_eletronico/processo/encaminhar/');
    expect(cpScript).toContain('/processo_eletronico/processo/encaminhar_sem_despacho/');
    expect(cpScript).toContain("'up'");
    expect(cpScript).toContain("'enc'");
    expect(cpScript).toContain("'encs'");
    expect(cpScript).toContain('suape-cp-chip-processo');
    expect(cpScript).toContain('suape-cp-kbd-shortcut');

    expect(cpCss).toContain('.suape-cp-group-title.process-group');
    expect(cpCss).toContain('.suape-cp-chip-count.count-teal');
    expect(cpCss).toContain('.suape-cp-kbd-shortcut');
    expect(cpScript).toContain("const IS_SUAP_PAGE = window.location.hostname === 'suap.ifrn.edu.br';");
    expect(cpScript).toContain('if (!IS_SUAP_PAGE) return null;');
  });

  it('suporta pesquisa direta de contratos no SUAP via parâmetro q no command-palette (Ctrl+K)', () => {
    const cpScript = fs.readFileSync(extensionFixturePath('command-palette.js'), 'utf8');

    expect(cpScript).toContain('getSuapContractSearchUrl');
    expect(cpScript).toContain('/admin/contratos/contrato/?');
    expect(cpScript).toContain("baseParams.set('campi', campi)");
    expect(cpScript).toContain("baseParams.set('q', query.trim())");
    expect(cpScript).toContain("baseParams.set('tab', 'tab_ativos')");
    expect(cpScript).toContain('suap_contract_search');
    expect(cpScript).toContain('isExplicitContractSearch');
  });

  it('suporta pesquisa direta de processos eletrônicos no SUAP via parâmetro q no command-palette (Ctrl+K)', () => {
    const cpScript = fs.readFileSync(extensionFixturePath('command-palette.js'), 'utf8');

    expect(cpScript).toContain('getSuapProcessSearchUrl');
    expect(cpScript).toContain('/admin/processo_eletronico/processo/?');
    expect(cpScript).toContain("baseParams.set('q', query.trim())");
    expect(cpScript).toContain('suap_process_search');
    expect(cpScript).toContain('isExplicitProcessSearch');
  });

  it('suporta abertura de registro de aluno e busca de documentos no SUAP via command-palette (Ctrl+K)', () => {
    const cpScript = fs.readFileSync(extensionFixturePath('command-palette.js'), 'utf8');

    expect(cpScript).toContain('getSuapStudentUrl');
    expect(cpScript).toContain('/edu/aluno/');
    expect(cpScript).toContain('suap_student_search');
    expect(cpScript).toContain('isExplicitStudentSearch');

    expect(cpScript).toContain('getSuapDocumentSearchUrl');
    expect(cpScript).toContain('/admin/documento_eletronico/documentotexto/?');
    expect(cpScript).toContain("baseParams.set('opcao', '1')");
    expect(cpScript).toContain("baseParams.set('q', query.trim())");
    expect(cpScript).toContain('suap_document_search');
    expect(cpScript).toContain('isExplicitDocumentSearch');
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
    expect(popup).toContain('extension-auth-client.js');
    expect(popup).not.toContain('id="siages-app-origin"');
    expect(popup).not.toContain('id="btn-save-siages-app-origin"');
    expect(popupScript).not.toContain('siages-app-origin');
    expect(popupScript).not.toContain('sistema-gerencial-gamma.vercel.app');
    expect(processScript).toContain("form.querySelector('input[name=\"email\"]')");
    expect(processScript).toContain("form.querySelector('input[name=\"password\"]')");
    expect(processScript).not.toContain('form.elements.email.value');
    expect(processScript).not.toContain('form.elements.password.value');
    expect(backgroundScript).toContain("message.type === 'sign-out'");
    expect(backgroundScript).toContain('refreshInFlight');
    expect(backgroundScript).toContain('A sessão da extensão não pôde ser renovada agora');
    expect(processScript).toContain('SiagesExtensionAuth');
    expect(popupScript).toContain('SiagesExtensionAuth');
    expect(processScript).toContain('extension context invalidated');
    const processKey = processScript.match(/SUPABASE_ANON_KEY = '([^']+)'/)?.[1];
    const planKey = planScript.match(/SUPABASE_ANON_KEY = '([^']+)'/)?.[1];
    const popupKey = popupScript.match(/SUPABASE_KEY = '([^']+)'/)?.[1];
    const backgroundKey = backgroundScript.match(/SUPABASE_KEY = '([^']+)'/)?.[1];
    expect(processKey).toBe(planKey);
    expect(popupKey).toBe(planKey);
    expect(backgroundKey).toBe(planKey);
    expect(backgroundScript).toContain("const EXTENSION_SESSION_STORAGE_KEY = 'siages-extension-session'");
    expect(backgroundScript).toContain('refresh_token');
    expect(backgroundScript).toContain('chrome.alarms.create');
    expect(popup).toContain('id="siafi-list-select"');
    expect(popup).toContain('id="btn-siafi-fill"');
    expect(popupScript).toContain("siafi:fill-favorecidos");
    expect(fs.readFileSync(extensionFixturePath('siafi-favorecidos.js'), 'utf8')).toContain("Incluir Favorecido");
  });

  it('abre telas e acoes da paleta na origem publica do SIAGES', () => {
    const cpScript = fs.readFileSync(extensionFixturePath('command-palette.js'), 'utf8');

    expect(cpScript).toContain("const SIAGES_APP_URL = 'https://www.siages.com.br';");
    expect(cpScript).not.toContain("const SIAGES_APP_URL = 'http://localhost:5173';");
    expect(cpScript).toContain('if (IS_SUAP_PAGE)');
  });
});
