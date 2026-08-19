import { readFileSync } from 'node:fs';

import {
  buildSuapCloneUrl,
  encodeSuapClonePayload,
  extractSuapSubjectFromHtml,
  parseSuapClonePayloadFromFragment,
} from '@/lib/suapCloneAutomation';
import { extensionFixturePath } from '@/test/extensionFixtures';

type TestTinyEditor = {
  initialized: boolean;
  isHidden: () => boolean;
  setContent: (content: string) => void;
  fire: (event: string) => void;
  save: () => void;
  getBody: () => { isContentEditable: boolean };
  getContent: () => string;
};

interface ExtensionTestWindow extends Window {
  tinymce?: { activeEditor: TestTinyEditor | null; editors: TestTinyEditor[] };
  __SIAGES_SUAP_CLONE_TEST__?: boolean;
  __siagesSuapCloneTestNavigate?: (url: string) => void;
  __siagesSuapCloneAutomation?: {
    parsePayloadFromHash: (hash: string) => unknown;
    runCloneAutomation: (payload: unknown) => boolean;
    openTextEditorFromView: () => Promise<boolean>;
    openTextEditorFromDocumentList: () => Promise<boolean>;
    findCreatedDraftEditorPath: (root: ParentNode, subject: string) => string | null;
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
    delete testWindow.__siagesSuapCloneTestNavigate;
    delete testWindow.tinymce;
    window.history.replaceState(null, document.title, '/');
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
    expect(document.getElementById('siages-suap-clone-notice')?.textContent).toContain('Revise os campos e clique em Salvar');
  });

  it('preenche input[name=assunto] quando nao ha id padrao', () => {
    const automation = loadContentScript();
    document.body.innerHTML = '<input name="assunto">';

    automation.runCloneAutomation({ ...automationPayload, subject: 'Assunto alternativo' });

    expect(document.querySelector<HTMLInputElement>('input[name="assunto"]')?.value).toBe('Assunto alternativo');
  });

  it('nao clica em Salvar automaticamente e deixa o usuario revisar os metadados', () => {
    vi.useFakeTimers();
    const automation = loadContentScript();
    document.body.innerHTML = '<input id="id_assunto"><button type="submit">Salvar</button>';
    const clickSpy = vi.fn();
    document.querySelector('button')?.addEventListener('click', clickSpy);

    automation.runCloneAutomation({ ...automationPayload, mode: 'review' });

    vi.advanceTimersByTime(2000);
    expect(clickSpy).not.toHaveBeenCalled();
    expect(document.getElementById('siages-suap-clone-notice')?.textContent).toContain('Revise os campos e clique em Salvar');
  });

  it('marca a automacao para localizar o rascunho apos o formulario de clone ser salvo', () => {
    const automation = loadContentScript();
    document.body.innerHTML = '<form><input id="id_assunto"><button type="submit">Salvar</button></form>';

    automation.runCloneAutomation(automationPayload);
    document.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(automation.loadPendingAutomation()).toMatchObject({ stage: 'awaiting-created-document' });
  });

  it('localiza o rascunho recem-criado na listagem e abre seu editor de texto', async () => {
    const automation = loadContentScript();
    const testWindow = window as ExtensionTestWindow;
    const navigate = vi.fn();
    testWindow.__siagesSuapCloneTestNavigate = navigate;
    automation.storePendingAutomation(automationPayload, 'awaiting-created-document');
    document.body.innerHTML = `
      <table><tbody>
        <tr><td>Autorizacao para Liquidacao da Despesa anterior</td><td>Rascunho</td><td><a href="/admin/documento_eletronico/documentotexto/1111111/change/">Editar</a></td></tr>
        <tr><td>Autorizacao para Liquidacao da Despesa</td><td>Rascunho</td><td><a href="/admin/documento_eletronico/documentotexto/2222222/change/">Editar</a></td></tr>
      </tbody></table>
    `;
    expect(automation.findCreatedDraftEditorPath(document, automationPayload.subject)).toBe('/documento_eletronico/editar_documento/2222222/');
    await expect(automation.openTextEditorFromDocumentList()).resolves.toBe(true);
    expect(navigate).toHaveBeenCalledWith('/documento_eletronico/editar_documento/2222222/');
    expect(automation.loadPendingAutomation()).toMatchObject({ stage: 'opening-text-editor' });
  });

  it('abre diretamente o editor pelo identificador da pagina de visualizacao', async () => {
    const automation = loadContentScript();
    const testWindow = window as ExtensionTestWindow;
    const navigate = vi.fn();
    testWindow.__siagesSuapCloneTestNavigate = navigate;
    automation.storePendingAutomation(automationPayload, 'awaiting-created-document');
    window.history.replaceState(null, document.title, '/documento_eletronico/visualizar_documento/1127834/');

    await expect(automation.openTextEditorFromView()).resolves.toBe(true);

    expect(navigate).toHaveBeenCalledWith('/documento_eletronico/editar_documento/1127834/');
    expect(automation.loadPendingAutomation()).toMatchObject({ stage: 'opening-text-editor' });
  });

  it('recupera pela listagem quando a navegacao da visualizacao ja iniciou o editor', async () => {
    const automation = loadContentScript();
    const testWindow = window as ExtensionTestWindow;
    const navigate = vi.fn();
    testWindow.__siagesSuapCloneTestNavigate = navigate;
    automation.storePendingAutomation(automationPayload, 'opening-text-editor');
    document.body.innerHTML = `
      <table><tbody>
        <tr><td>Autorizacao para Liquidacao da Despesa</td><td>Rascunho</td><td><a href="/admin/documento_eletronico/documentotexto/3333333/change/">Editar</a></td></tr>
      </tbody></table>
    `;

    await expect(automation.openTextEditorFromDocumentList()).resolves.toBe(true);

    expect(navigate).toHaveBeenCalledWith('/documento_eletronico/editar_documento/3333333/');
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

  it('espera o botao Editar quando a pagina de visualizacao ainda esta carregando', async () => {
    vi.useFakeTimers();
    const automation = loadContentScript();
    automation.storePendingAutomation(automationPayload, 'awaiting-document-view');
    const events: string[] = [];
    document.body.innerHTML = '<div id="menu"></div>';
    const openPromise = automation.openTextEditorFromView();

    window.setTimeout(() => {
      const editButton = document.createElement('button');
      editButton.textContent = 'Editar';
      editButton.addEventListener('click', () => {
        events.push('editar');
        document.querySelector('#menu')!.innerHTML = '<a href="/documento_eletronico/editar_texto/1113677/">Texto</a>';
        document.querySelector('a')?.addEventListener('click', (event) => {
          event.preventDefault();
          events.push('texto');
        });
      });
      document.body.appendChild(editButton);
    }, 400);

    await vi.advanceTimersByTimeAsync(1000);
    await expect(openPromise).resolves.toBe(true);
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

  it('espera o TinyMCE inicializar e nao confirma a colagem pelo textarea oculto', async () => {
    vi.useFakeTimers();
    const automation = loadContentScript();
    automation.storePendingAutomation(automationPayload, 'opening-text-editor');
    document.body.innerHTML = '<textarea id="id_corpo" style="display:none"></textarea>';
    let editorContent = '';
    const editor: TestTinyEditor = {
      initialized: true,
      isHidden: () => false,
      setContent: (content) => { editorContent = content; },
      fire: vi.fn(),
      save: vi.fn(),
      getBody: () => ({ isContentEditable: true }),
      getContent: () => editorContent,
    };
    const testWindow = window as ExtensionTestWindow;
    testWindow.tinymce = { activeEditor: null, editors: [] };
    const fillPromise = automation.fillTextEditorWhenReady();

    window.setTimeout(() => {
      testWindow.tinymce = { activeEditor: editor, editors: [editor] };
    }, 250);

    await vi.advanceTimersByTimeAsync(1000);
    await expect(fillPromise).resolves.toBe(true);
    expect(editorContent).toContain('Conteudo gerado');
    expect(document.querySelector<HTMLTextAreaElement>('#id_corpo')?.value).toBe('');
    expect(automation.loadPendingAutomation()).toBeNull();
  });

  it('navega diretamente por link com editar_texto_documento na visualizacao', async () => {
    const automation = loadContentScript();
    automation.storePendingAutomation(automationPayload, 'awaiting-document-view');
    const clickSpy = vi.fn((e: MouseEvent) => e.preventDefault());
    document.body.innerHTML = '<a id="direct-link" href="/documento_eletronico/editar_texto_documento/1113677/">Editar Texto</a>';
    document.querySelector('#direct-link')?.addEventListener('click', clickSpy as unknown as EventListener);

    await expect(automation.openTextEditorFromView()).resolves.toBe(true);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('protege o envio de formulario garantindo preenchimento do textarea no submit', async () => {
    const automation = loadContentScript();
    automation.storePendingAutomation(automationPayload, 'opening-text-editor');
    document.body.innerHTML = `
      <form id="doc-form">
        <textarea id="id_texto"></textarea>
        <button type="submit" id="save-btn">Salvar e Visualizar</button>
      </form>
    `;
    const form = document.querySelector<HTMLFormElement>('#doc-form')!;
    const textarea = document.querySelector<HTMLTextAreaElement>('#id_texto')!;

    await automation.fillTextEditorWhenReady();

    // Dispara submit do form
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(textarea.value).toContain('Conteudo gerado');
  });

  it('ignora payload invalido ou ausente', () => {
    const automation = loadContentScript();

    expect(automation.parsePayloadFromHash('')).toBeNull();
    expect(automation.parsePayloadFromHash('#siagesClone=%7B%22source%22%3A%22x%22%7D')).toBeNull();
  });
});
