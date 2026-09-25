import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extensionFixturePath } from '@/test/extensionFixtures';

interface UploadAutomationTestWindow extends Window {
  __SIAGES_SUAP_UPLOAD_TEST__?: boolean;
  __siagesSuapUploadAutomation?: {
    cleanText: (text: string) => string;
    normalizeText: (text: string) => string;
    parseUploadPayloadFromHash: (hash: string) => any;
    loadPendingUploadAutomation: () => any;
    clearPendingUploadAutomation: () => void;
    stripUploadAutomationHash: () => void;
    findTipoConferenciaField: (root?: ParentNode) => HTMLSelectElement | null;
    findTipoDocumentoField: (root?: ParentNode) => HTMLSelectElement | null;
    findAssuntoField: (root?: ParentNode) => HTMLInputElement | null;
    selectOptionByText: (selectEl: HTMLSelectElement, targetText: string) => HTMLOptionElement | null;
    updateSelect2Display: (selectEl: HTMLSelectElement, option: HTMLOptionElement) => void;
    fillTextInput: (inputEl: HTMLInputElement, value: string) => boolean;
    runUploadAutomation: (payload: any) => Promise<boolean>;
    initUploadAutomation: () => Promise<void>;
  };
}

const mockUploadHtml = `
  <form id="documento-externo-form" method="post" action="/processo_eletronico/documento_upload/498930/">
    <div class="form-row">
      <label for="id_tipo_conferencia">Tipo de Conferência:</label>
      <select id="id_tipo_conferencia" name="tipo_conferencia">
        <option value="">---------</option>
        <option value="1">Cópia Autenticada Administrativamente</option>
        <option value="2">Cópia Autenticada por Cartório</option>
        <option value="3">Cópia Simples</option>
        <option value="4">Documento Original</option>
      </select>
    </div>

    <div class="form-row">
      <label for="id_tipo">Tipo:</label>
      <select id="id_tipo" name="tipo" data-select2-id="id_tipo">
        <option value="">---------</option>
        <option value="10">Acordo</option>
        <option value="20">Liquidação</option>
        <option value="30">Nota Fiscal</option>
      </select>
      <span class="select2-container select2-container--default">
        <span class="select2-selection">
          <span class="select2-selection__rendered" id="select2-id_tipo-container">---------</span>
        </span>
      </span>
    </div>

    <div class="form-row">
      <label for="id_assunto">Assunto:</label>
      <input type="text" id="id_assunto" name="assunto" value="" />
    </div>

    <div class="form-row">
      <input type="submit" value="Salvar" />
    </div>
  </form>
`;

function loadScript(): NonNullable<UploadAutomationTestWindow['__siagesSuapUploadAutomation']> {
  const testWindow = window as unknown as UploadAutomationTestWindow;
  testWindow.__SIAGES_SUAP_UPLOAD_TEST__ = true;
  const scriptContent = readFileSync(extensionFixturePath('upload-document.js'), 'utf8');
  new Function(scriptContent)();
  if (!testWindow.__siagesSuapUploadAutomation) {
    throw new Error('Falha ao expor __siagesSuapUploadAutomation no ambiente de teste.');
  }
  return testWindow.__siagesSuapUploadAutomation;
}

describe('upload-document.js (Automação de Upload de Documentos no SUAP)', () => {
  beforeEach(() => {
    document.body.innerHTML = mockUploadHtml;
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '';
  });

  it('faz o parse correto do payload via fragmento de URL (#siagesUpload=)', () => {
    const automation = loadScript();
    const payload = {
      source: 'siages',
      version: 1,
      action: 'suap_upload_document',
      suapId: '498930',
      processNumber: '23000.000123/2026-00',
      tipoConferencia: 'Cópia Simples',
      tipoDocumento: 'Liquidação',
      assunto: 'Liquidação de Bolsas',
    };
    const hash = '#siagesUpload=' + encodeURIComponent(JSON.stringify(payload));
    const parsed = automation.parseUploadPayloadFromHash(hash);

    expect(parsed).toEqual({
      source: 'siages',
      version: 1,
      action: 'suap_upload_document',
      suapId: '498930',
      processNumber: '23000.000123/2026-00',
      tipoConferencia: 'Cópia Simples',
      tipoDocumento: 'Liquidação',
      assunto: 'Liquidação de Bolsas',
    });
  });

  it('ignora payloads inválidos ou com action diferente', () => {
    const automation = loadScript();
    expect(automation.parseUploadPayloadFromHash('#siagesUpload=invalido')).toBeNull();
    expect(automation.parseUploadPayloadFromHash('#siagesUpload=' + encodeURIComponent(JSON.stringify({ source: 'other' })))).toBeNull();
    expect(automation.parseUploadPayloadFromHash('#siagesUpload=' + encodeURIComponent(JSON.stringify({ source: 'siages', version: 1, action: 'other' })))).toBeNull();
  });

  it('localiza corretamente os 3 campos no formulário do SUAP', () => {
    const automation = loadScript();
    const conf = automation.findTipoConferenciaField(document);
    const tipo = automation.findTipoDocumentoField(document);
    const ass = automation.findAssuntoField(document);

    expect(conf).not.toBeNull();
    expect(conf?.id).toBe('id_tipo_conferencia');

    expect(tipo).not.toBeNull();
    expect(tipo?.id).toBe('id_tipo');

    expect(ass).not.toBeNull();
    expect(ass?.id).toBe('id_assunto');
  });

  it('seleciona opção de select por texto com tolerância a maiúsculas e acentuação', () => {
    const automation = loadScript();
    const conf = document.getElementById('id_tipo_conferencia') as HTMLSelectElement;

    // "Cópia Simples" normalizado com "copia simples"
    const selected = automation.selectOptionByText(conf, 'copia simples');
    expect(selected).not.toBeNull();
    expect(selected?.value).toBe('3');
    expect(conf.value).toBe('3');

    // "Liquidação" em #id_tipo
    const tipo = document.getElementById('id_tipo') as HTMLSelectElement;
    const selectedTipo = automation.selectOptionByText(tipo, 'LIQUIDAÇÃO');
    expect(selectedTipo).not.toBeNull();
    expect(selectedTipo?.value).toBe('20');
    expect(tipo.value).toBe('20');
  });

  it('atualiza o rótulo do Select2 visual e dispara eventos', () => {
    const automation = loadScript();
    const tipo = document.getElementById('id_tipo') as HTMLSelectElement;
    const option = tipo.querySelector('option[value="20"]') as HTMLOptionElement;

    automation.updateSelect2Display(tipo, option);

    const select2Container = document.getElementById('select2-id_tipo-container');
    expect(select2Container?.textContent).toBe('Liquidação');
    expect(select2Container?.getAttribute('title')).toBe('Liquidação');
  });

  it('preenche o campo de assunto e dispara eventos input/change', () => {
    const automation = loadScript();
    const ass = document.getElementById('id_assunto') as HTMLInputElement;

    let inputFired = false;
    let changeFired = false;
    ass.addEventListener('input', () => { inputFired = true; });
    ass.addEventListener('change', () => { changeFired = true; });

    automation.fillTextInput(ass, 'Liquidação de Despesa 2026');

    expect(ass.value).toBe('Liquidação de Despesa 2026');
    expect(inputFired).toBe(true);
    expect(changeFired).toBe(true);
  });

  it('executa a automação completa runUploadAutomation preenchendo os 3 campos e exibindo toast', async () => {
    const automation = loadScript();
    const payload = {
      source: 'siages',
      version: 1,
      action: 'suap_upload_document',
      suapId: '498930',
      processNumber: '23000.000123/2026-00',
      tipoConferencia: 'Cópia Simples',
      tipoDocumento: 'Liquidação',
      assunto: 'Liquidação de Pagamento',
    };

    const result = await automation.runUploadAutomation(payload);
    expect(result).toBe(true);

    const conf = document.getElementById('id_tipo_conferencia') as HTMLSelectElement;
    const tipo = document.getElementById('id_tipo') as HTMLSelectElement;
    const ass = document.getElementById('id_assunto') as HTMLInputElement;
    const select2Container = document.getElementById('select2-id_tipo-container');

    expect(conf.value).toBe('3'); // Cópia Simples
    expect(tipo.value).toBe('20'); // Liquidação
    expect(select2Container?.textContent).toBe('Liquidação');
    expect(ass.value).toBe('Liquidação de Pagamento');

    const notice = document.getElementById('siages-suap-upload-notice');
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toContain('Liquidação');
    expect(notice?.textContent).toContain('Cópia Simples');
  });

  it('recupera e limpa payload do storage quando não vem pelo hash', () => {
    const automation = loadScript();
    const payload = {
      source: 'siages',
      version: 1,
      action: 'suap_upload_document',
      suapId: '498930',
      tipoConferencia: 'Cópia Simples',
      tipoDocumento: 'Liquidação',
      assunto: 'Liquidação',
    };

    sessionStorage.setItem('siagesUploadPendingV1', JSON.stringify({
      payload,
      createdAt: Date.now(),
    }));

    const loaded = automation.loadPendingUploadAutomation();
    expect(loaded).toEqual(payload);

    automation.clearPendingUploadAutomation();
    expect(automation.loadPendingUploadAutomation()).toBeNull();
  });
});
