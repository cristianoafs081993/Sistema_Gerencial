import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
      <label for="id_arquivo">Arquivo:</label>
      <input type="file" id="id_arquivo" name="arquivo" />
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

  it('nunca cria opção com o texto como valor quando o tipo não existe no select', () => {
    const automation = loadScript();
    const tipo = document.getElementById('id_tipo') as HTMLSelectElement;
    const optionCount = tipo.options.length;

    expect(automation.selectOptionByText(tipo, 'Tipo Inexistente')).toBeNull();
    expect(tipo.options).toHaveLength(optionCount);
    expect(tipo.value).toBe('');
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

// SUAP renders "Tipo" as an AJAX Select2: the <select> only holds the chosen option.
const mockAjaxUploadHtml = `
  <form id="documento-externo-form" method="post">
    <div class="form-row">
      <label for="id_tipo_conferencia">Tipo de Conferência:</label>
      <select id="id_tipo_conferencia" name="tipo_conferencia">
        <option value="">---------</option>
        <option value="3">Cópia Simples</option>
      </select>
    </div>
    <div class="form-row">
      <label for="id_tipo">Tipo:</label>
      <select class="js-example-data-ajax form-control select2-hidden-accessible" id="tipo_Xk29aQ" name="tipo"></select>
      <span class="select2 select2-container"><span class="select2-selection__rendered" id="select2-tipo_Xk29aQ-container"></span></span>
    </div>
    <div class="form-row">
      <label for="id_assunto">Assunto:</label>
      <input type="text" id="id_assunto" name="assunto" value="" />
    </div>
  </form>
`;

describe('select2-bridge-main.js (Tipo com Select2 AJAX no upload)', () => {
  let queries: string[];
  let select2Events: unknown[];
  let results: Array<{ id: string; text?: string; html?: string }>;

  beforeEach(() => {
    document.body.innerHTML = mockAjaxUploadHtml;
    queries = [];
    select2Events = [];
    results = [
      { id: '46', text: 'Liquidação de Despesa' },
      { id: '45', html: '<span class="text">Liquidação</span>' },
    ];
    const fakeJquery = Object.assign(
      () => ({
        data: (key: string) => (key === 'select2'
          ? { dataAdapter: { query: (params: { term: string }, callback: (data: unknown) => void) => { queries.push(params.term); callback({ results }); } } }
          : undefined),
        trigger: (event: unknown) => { select2Events.push(event); },
      }),
      { fn: { select2: () => undefined } },
    );
    vi.stubGlobal('jQuery', fakeJquery);
    const bridgeWindow = window as unknown as { __siagesSelect2BridgeLoaded?: boolean };
    if (!bridgeWindow.__siagesSelect2BridgeLoaded) {
      window.eval(readFileSync(extensionFixturePath('select2-bridge-main.js'), 'utf8'));
    }
    document.documentElement.dataset.siagesSelect2Bridge = 'ready';
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-siages-select2-bridge');
    vi.unstubAllGlobals();
  });

  it('busca o tipo na fonte AJAX do Select2 e seleciona o ID real', async () => {
    const automation = loadScript();
    const changes = vi.fn();
    const tipo = document.querySelector<HTMLSelectElement>('select[name="tipo"]')!;
    tipo.addEventListener('change', changes);

    const result = await automation.runUploadAutomation({
      source: 'siages', version: 1, action: 'suap_upload_document', suapId: '498930',
      tipoConferencia: 'Cópia Simples', tipoDocumento: 'Liquidação', assunto: 'Liquidação',
    });

    expect(result).toBe(true);
    expect(queries).toEqual(['Liquidação']);
    expect(tipo.value).toBe('45');
    expect(tipo.selectedOptions[0].textContent).toBe('Liquidação');
    expect(changes).toHaveBeenCalled();
    expect(select2Events).toEqual([expect.objectContaining({ type: 'select2:select' })]);
    expect(document.getElementById('siages-suap-upload-notice')?.textContent).toContain('Campos preenchidos');
  });

  it('avisa e não inventa opção quando o tipo não é encontrado', async () => {
    results = [{ id: '10', text: 'Acordo' }];
    const automation = loadScript();
    const tipo = document.querySelector<HTMLSelectElement>('select[name="tipo"]')!;

    await automation.runUploadAutomation({
      source: 'siages', version: 1, action: 'suap_upload_document', suapId: '498930',
      tipoConferencia: 'Cópia Simples', tipoDocumento: 'Liquidação', assunto: 'Liquidação',
    });

    expect(tipo.options).toHaveLength(0);
    expect(tipo.value).toBe('');
    expect(document.getElementById('siages-suap-upload-notice')?.textContent).toContain('não foi possível selecionar Tipo "Liquidação"');
  });
});

describe('upload-document.js (seletor de arquivo após o preenchimento)', () => {
  const payload = {
    source: 'siages', version: 1, action: 'suap_upload_document', suapId: '498930',
    tipoConferencia: 'Cópia Simples', tipoDocumento: 'Liquidação', assunto: 'Liquidação',
  };

  beforeEach(() => {
    document.body.innerHTML = mockUploadHtml;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'userActivation');
  });

  it('sem gesto do usuário na página, foca o arquivo e abre o seletor com Enter ou com o botão', async () => {
    const automation = loadScript();
    const fileInput = document.getElementById('id_arquivo') as HTMLInputElement;
    const click = vi.spyOn(fileInput, 'click').mockImplementation(() => undefined);

    await automation.runUploadAutomation(payload);

    expect(click).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(fileInput);
    const button = document.getElementById('siages-suap-upload-file-prompt') as HTMLButtonElement;
    expect(button).toHaveTextContent('Escolher documento (Enter)');

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    fileInput.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(click).toHaveBeenCalledTimes(1);

    button.click();
    expect(click).toHaveBeenCalledTimes(2);

    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.getElementById('siages-suap-upload-file-prompt')).toBeNull();
    fileInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(click).toHaveBeenCalledTimes(2);
  });

  it('abre o seletor direto quando o navegador permite', async () => {
    Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { isActive: true } });
    const automation = loadScript();
    const fileInput = document.getElementById('id_arquivo') as HTMLInputElement;
    const click = vi.spyOn(fileInput, 'click').mockImplementation(() => undefined);

    await automation.runUploadAutomation(payload);

    expect(click).toHaveBeenCalledTimes(1);
    expect(document.getElementById('siages-suap-upload-file-prompt')).toBeNull();
  });
});

describe('upload-document.js (captura SIAFI do printup)', () => {
  const uploadId = '11111111-1111-4111-8111-111111111111';
  const pdf = '%PDF-1.4\n%SIAGES\n';
  const capture = { id: uploadId, processKey: '23035002988202697', processNumber: '23035.002988.2026-97', documentLabel: '2026NP000123', fileName: '23035.002988.2026-97 - 2026NP000123.pdf' };
  const payload = {
    source: 'siages', version: 1, action: 'suap_upload_document', suapId: '498930', processNumber: '23035.002988.2026-97', siafiUploadId: uploadId,
    tipoConferencia: 'Cópia Simples', tipoDocumento: 'Liquidação', assunto: 'Liquidação',
  };
  let messages: Array<Record<string, unknown>>;
  let responses: Record<string, unknown>;
  let selected: File[];

  beforeEach(() => {
    document.body.innerHTML = mockUploadHtml;
    messages = [];
    selected = [];
    responses = {
      'find-siafi-capture': { ok: true, capture, others: 0 },
      'download-siafi-capture': { ok: true, file: { ...capture, pdfBase64: btoa(pdf) } },
      'consume-siafi-capture': { ok: true, consumed: true },
    };
    vi.stubGlobal('chrome', { runtime: { lastError: undefined, sendMessage: (message: Record<string, unknown>, reply: (value: unknown) => void) => {
      messages.push(message);
      queueMicrotask(() => reply(responses[String(message.type)]));
    } } });
    vi.stubGlobal('DataTransfer', class { files: File[] = []; items = { add: (file: File) => { this.files.push(file); } }; });
    // jsdom só aceita FileList real em input.files; o teste guarda o que a extensão atribui.
    Object.defineProperty(document.getElementById('id_arquivo')!, 'files', { configurable: true, get: () => selected, set: (value: File[]) => { selected = [...value]; } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('anexa o PDF do printup, dispensa o seletor e apaga a captura ao salvar', async () => {
    const automation = loadScript();
    const fileInput = document.getElementById('id_arquivo') as HTMLInputElement;
    const change = vi.fn();
    fileInput.addEventListener('change', change);

    await expect(automation.runUploadAutomation(automation.parseUploadPayloadFromHash(`#siagesUpload=${encodeURIComponent(JSON.stringify(payload))}`))).resolves.toBe(true);

    expect(messages[0]).toMatchObject({ source: 'siages-upload', type: 'find-siafi-capture', uploadId, processNumber: '23035.002988.2026-97' });
    expect(messages[1]).toMatchObject({ type: 'download-siafi-capture', id: uploadId });
    expect(selected).toHaveLength(1);
    expect(selected[0].name).toBe('23035.002988.2026-97 - 2026NP000123.pdf');
    expect(selected[0].type).toBe('application/pdf');
    expect(selected[0].size).toBe(pdf.length);
    expect(change).toHaveBeenCalled();
    expect(document.getElementById('siages-suap-upload-file-prompt')).toBeNull();
    expect(document.getElementById('siages-suap-upload-notice')?.textContent).toContain('captura SIAFI 2026NP000123 anexada (processo 23035.002988.2026-97). Confira e clique em Salvar.');

    document.getElementById('documento-externo-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await Promise.resolve();
    expect(messages.at(-1)).toMatchObject({ type: 'consume-siafi-capture', id: uploadId });
  });

  it('recusa a captura de outro processo exibido no cabeçalho e volta ao seletor', async () => {
    document.body.insertAdjacentHTML('afterbegin', '<h2>Processo 23035.000001.2026-01</h2>');
    const automation = loadScript();

    await automation.runUploadAutomation(payload);

    expect(messages.map((message) => message.type)).toEqual(['find-siafi-capture']);
    expect(messages[0].pageNumbers).toEqual(['23035.000001.2026-01']);
    expect(selected).toHaveLength(0);
    expect(document.getElementById('siages-suap-upload-notice')?.textContent).toContain('a captura SIAFI é do processo 23035.002988.2026-97, diferente do processo desta página');
    expect(document.getElementById('siages-suap-upload-file-prompt')).not.toBeNull();
  });

  it('up comum sem captura mantém o aviso dos campos e abre o seletor', async () => {
    responses['find-siafi-capture'] = { ok: true, capture: null, reason: 'sem-captura' };
    const automation = loadScript();

    await automation.runUploadAutomation({ ...payload, processNumber: undefined, siafiUploadId: undefined });

    expect(messages).toHaveLength(1);
    expect(document.getElementById('siages-suap-upload-notice')?.textContent).toContain('Campos preenchidos automaticamente');
    expect(document.getElementById('siages-suap-upload-file-prompt')).not.toBeNull();
  });

  it('não substitui um arquivo escolhido pelo usuário durante o download', async () => {
    const automation = loadScript();
    const own = new File(['meu'], 'meu.pdf', { type: 'application/pdf' });
    responses['download-siafi-capture'] = { ok: true, file: { ...capture, pdfBase64: btoa(pdf) } };
    const original = (globalThis as unknown as { chrome: { runtime: { sendMessage: (m: Record<string, unknown>, r: (v: unknown) => void) => void } } }).chrome.runtime.sendMessage;
    (globalThis as unknown as { chrome: { runtime: { sendMessage: unknown } } }).chrome.runtime.sendMessage = (message: Record<string, unknown>, reply: (value: unknown) => void) => {
      if (message.type === 'download-siafi-capture') selected = [own];
      original(message, reply);
    };

    await automation.runUploadAutomation(payload);

    expect(selected).toEqual([own]);
    expect(messages.map((message) => message.type)).toEqual(['find-siafi-capture', 'download-siafi-capture']);
  });
});
