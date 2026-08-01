import { readFileSync } from 'node:fs';

import {
  buildSuapCloneUrl,
  encodeSuapClonePayload,
  extractSuapSubjectFromHtml,
  parseSuapClonePayloadFromFragment,
} from '@/lib/suapCloneAutomation';
import { extensionFixturePath } from '@/test/extensionFixtures';

interface ExtensionTestWindow extends Window {
  __SIAGES_SUAP_CLONE_TEST__?: boolean;
  __siagesSuapCloneAutomation?: {
    parsePayloadFromHash: (hash: string) => unknown;
    runCloneAutomation: (payload: unknown) => boolean;
    openTextEditorFromView: () => Promise<boolean>;
    fillTextEditorWhenReady: () => Promise<boolean>;
    loadPendingAutomation: () => { payload: { contentHtml?: string } } | null;
    storePendingAutomation: (payload: unknown, stage: string) => void;
    clearPendingAutomation: () => void;
  };
}

const generatedDespachoHtml = `
  <div>
    <div>A Coordenacao</div>
    <div><b>Assunto:</b> Autorizacao para Liquidacao da Despesa</div>
    <div style="text-indent: 2.5cm; margin-top: 30px;">Considerando a regularidade, <b>AUTORIZO</b>.</div>
  </div>
`;

const automationPayload = {
  source: 'siages',
  version: 1,
  documentType: 'despacho',
  subject: 'Autorizacao para Liquidacao da Despesa',
  mode: 'review',
  contentHtml: '<div><p><b>Assunto:</b> Autorizacao para Liquidacao da Despesa</p><p>Conteudo gerado</p></div>',
};

describe('suapCloneAutomation', () => {
  it('monta URL de clone com payload no fragmento sem expor cookie', () => {
    const url = buildSuapCloneUrl({
      documentType: 'despacho',
      html: generatedDespachoHtml,
      mode: 'review',
    });

    expect(url).toMatch(/^https:\/\/suap\.ifrn\.edu\.br\/documento_eletronico\/clonar_documento\/1026154\/#/);
    expect(url).not.toContain('sessionid');

    const payload = parseSuapClonePayloadFromFragment(new URL(url).hash);
    expect(payload).toMatchObject({
      source: 'siages',
      version: 1,
      documentType: 'despacho',
      subject: 'Autorizacao para Liquidacao da Despesa',
      mode: 'review',
    });
    expect(payload?.contentHtml).toContain('<p');
    expect(payload?.contentHtml).toContain('AUTORIZO');
    expect(payload?.plainText).toContain('Autorizacao para Liquidacao da Despesa');
  });

  it('extrai o assunto de um bloco do documento gerado', () => {
    expect(extractSuapSubjectFromHtml(generatedDespachoHtml)).toBe('Autorizacao para Liquidacao da Despesa');
  });

  it('preserva o modo de salvar apos confirmacao', () => {
    const fragment = encodeSuapClonePayload({
      source: 'siages',
      version: 1,
      documentType: 'despacho',
      subject: 'Autorizacao para Liquidacao da Despesa',
      mode: 'save-after-confirmation',
      contentHtml: '<p>Texto</p>',
    });

    expect(parseSuapClonePayloadFromFragment(`#${fragment}`)).toMatchObject({
      mode: 'save-after-confirmation',
      contentHtml: '<p>Texto</p>',
    });
  });

  it('mantem CDO sem payload ate existir assunto explicito no modelo', () => {
    expect(buildSuapCloneUrl({ documentType: 'cdo', html: '<p>CDO</p>' })).toBe(
      'https://suap.ifrn.edu.br/documento_eletronico/clonar_documento/1016427/',
    );
  });
});

describe('suap-atividades-extension clone-document.js', () => {
  function loadContentScript() {
    const testWindow = window as ExtensionTestWindow;
    testWindow.__SIAGES_SUAP_CLONE_TEST__ = true;
    const script = readFileSync(extensionFixturePath('clone-document.js'), 'utf8');
    window.eval(script);
    if (!testWindow.__siagesSuapCloneAutomation) {
      throw new Error('Extension test hook was not registered');
    }
    return testWindow.__siagesSuapCloneAutomation;
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
    vi.useRealTimers();
    const testWindow = window as ExtensionTestWindow;
    delete testWindow.__siagesSuapCloneAutomation;
    delete testWindow.__SIAGES_SUAP_CLONE_TEST__;
  });

  it('preenche #id_assunto, dispara input/change e guarda texto para a proxima tela', () => {
    const automation = loadContentScript();
    document.body.innerHTML = '<input id="id_assunto"><button type="submit">Salvar</button>';
    const events: string[] = [];
    const input = document.querySelector<HTMLInputElement>('#id_assunto');
    const saveButton = document.querySelector<HTMLButtonElement>('button');
    if (!input || !saveButton) throw new Error('Fixture not rendered');

    input.addEventListener('input', () => events.push('input'));
    input.addEventListener('change', () => events.push('change'));
    saveButton.addEventListener('click', () => events.push('click'));

    automation.runCloneAutomation(automationPayload);

    expect(input.value).toBe('Autorizacao para Liquidacao da Despesa');
    expect(events).toEqual(['input', 'change']);
    expect(automation.loadPendingAutomation()?.payload.contentHtml).toContain('Conteudo gerado');
    expect(document.getElementById('siages-suap-clone-notice')?.textContent).toContain('Ao salvar');
  });

  it('preenche input[name=assunto] quando nao ha id padrao', () => {
    const automation = loadContentScript();
    document.body.innerHTML = '<input name="assunto">';

    automation.runCloneAutomation({ ...automationPayload, subject: 'Assunto alternativo' });

    expect(document.querySelector<HTMLInputElement>('input[name="assunto"]')?.value).toBe('Assunto alternativo');
  });

  it('clica Salvar somente no modo confirmado', () => {
    vi.useFakeTimers();
    const automation = loadContentScript();
    document.body.innerHTML = '<input id="id_assunto"><button type="submit">Salvar</button>';
    const clickSpy = vi.fn();
    document.querySelector('button')?.addEventListener('click', clickSpy);

    automation.runCloneAutomation({ ...automationPayload, mode: 'save-after-confirmation' });

    expect(clickSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('apos visualizar documento, abre o menu Editar e clica em Texto', async () => {
    const automation = loadContentScript();
    automation.storePendingAutomation(automationPayload, 'awaiting-document-view');
    const events: string[] = [];
    document.body.innerHTML = '<button id="edit-button">Editar</button><div id="menu"></div>';
    document.querySelector('#edit-button')?.addEventListener('click', () => {
      events.push('editar');
      document.querySelector('#menu')!.innerHTML = '<a href="/documento_eletronico/editar_texto/1113677/">Texto</a>';
      document.querySelector('a')?.addEventListener('click', (event) => {
        event.preventDefault();
        events.push('texto');
      });
    });

    await expect(automation.openTextEditorFromView()).resolves.toBe(true);
    expect(events).toEqual(['editar', 'texto']);
  });

  it('preenche o textarea do editor de texto e limpa a automacao pendente', async () => {
    const automation = loadContentScript();
    automation.storePendingAutomation(automationPayload, 'opening-text-editor');
    document.body.innerHTML = '<textarea id="id_corpo"></textarea>';

    await expect(automation.fillTextEditorWhenReady()).resolves.toBe(true);

    expect(document.querySelector<HTMLTextAreaElement>('#id_corpo')?.value).toContain('Conteudo gerado');
    expect(automation.loadPendingAutomation()).toBeNull();
    expect(document.getElementById('siages-suap-clone-notice')?.textContent).toContain('texto preenchido');
  });

  it('ignora payload invalido ou ausente', () => {
    const automation = loadContentScript();

    expect(automation.parsePayloadFromHash('')).toBeNull();
    expect(automation.parsePayloadFromHash('#siagesClone=%7B%22source%22%3A%22x%22%7D')).toBeNull();
  });
});
