import { readFileSync } from 'node:fs';

import { fireEvent, waitFor } from '@testing-library/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

const contentScript = readFileSync(extensionFixturePath('command-palette.js'), 'utf8');
const originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
const testUserId = '11111111-1111-4111-8111-111111111111';
const testGroupId = '22222222-2222-4222-8222-222222222222';

async function flushMicrotasks() {
  for (let index = 0; index < 30; index += 1) await Promise.resolve();
}

function createAccessToken() {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: testUserId,
    email: 'servidor@example.org',
    app_metadata: {},
    user_metadata: {},
  })}.signature`;
}

function documentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '158366264352026NP000085',
    valor_original: 1250.75,
    valor_pago: 1250.75,
    estado: 'Paga',
    processo: '23000.000123/2026-01',
    favorecido_nome: 'Empresa Exemplo',
    favorecido_documento: '07.805.649/0001-29',
    data_emissao: '2026-03-01',
    fonte_sof: 'Tesouro Nacional',
    empenho_numero: '2026NE000123',
    ...overrides,
  };
}

function createFetchMock(options: {
  documents?: Record<string, unknown>[];
  screenPermission?: boolean;
} = {}) {
  const requests: Array<{ url: URL; init: RequestInit }> = [];
  const documents = options.documents || [documentRow()];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    requests.push({ url, init });
    const table = url.pathname.split('/').at(-1);
    let rows: Record<string, unknown>[] = [];
    let contentRange: string | null = null;

    if (table === 'user_group_memberships') {
      rows = [{ group_id: testGroupId, user_groups: { slug: 'servidores' } }];
    } else if (table === 'user_group_screen_permissions') {
      rows = options.screenPermission === false ? [] : [{ screen_id: 'liquidacoes-pagamentos' }];
    } else if (table === 'documentos_habeis') {
      const beneficiaryFilter = url.searchParams.get('favorecido_documento');
      const documentFilter = url.searchParams.get('id');
      rows = documents.filter((documento) => {
        const id = String(documento.id || '').toUpperCase();
        if (!/(NP|RP)/.test(id)) return false;
        if (beneficiaryFilter) {
          const wanted = beneficiaryFilter.match(/^in\.\((.*)\)$/)?.[1]?.split(',') || [];
          const normalized = String(documento.favorecido_documento || '').replace(/\D/g, '');
          return wanted.some((value) => value.replace(/\D/g, '') === normalized);
        }
        if (documentFilter?.startsWith('ilike.*')) return id.endsWith(documentFilter.slice('ilike.*'.length));
        return false;
      });

      rows.sort((left, right) => String(right.data_emissao || '').localeCompare(String(left.data_emissao || '')));
      const range = String((init.headers as Record<string, string> | undefined)?.Range || '0-19').split('-').map(Number);
      const start = range[0] || 0;
      const end = range[1] || start + 19;
      const allRows = rows;
      rows = allRows.slice(start, end + 1);
      contentRange = `${start}-${Math.max(start, start + rows.length - 1)}/${allRows.length}`;
    } else if (table === 'documentos_habeis_itens') {
      rows = [{ id: '158366264352026OB000176', doc_tipo: 'OB', data_emissao: '2026-03-02', valor: 1250.75, observacao: 'Pagamento efetuado' }];
    } else if (table === 'documentos_habeis_situacoes') {
      rows = [{ situacao_codigo: 'Paga', valor: 1250.75, is_retencao: false }];
    }

    return {
      ok: true,
      status: 200,
      json: async () => rows,
      headers: { get: (name: string) => name.toLowerCase() === 'content-range' ? contentRange : null },
    };
  });

  return { fetchMock, requests };
}

function installExtensionAuth() {
  vi.stubGlobal('SiagesExtensionAuth', {
    getSession: async () => ({ accessToken: createAccessToken() }),
  });
}

function openPalette() {
  fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true });
  return document.querySelector<HTMLInputElement>('.suape-cp-input')!;
}

afterEach(() => {
  (window as typeof window & {__suapeSolrecfin?:{destroy:()=>void}}).__suapeSolrecfin?.destroy();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.classList.remove('dark');
  document.body.innerHTML = '';
  try { localStorage.removeItem('siages-palette-theme'); } catch { /* noop */ }
  delete (window as typeof window & Record<string, unknown>).__suapeCommandPaletteLoaded;
  if (originalLocationDescriptor) Object.defineProperty(window, 'location', originalLocationDescriptor);
});

describe('paleta global da extensao Suape', () => {
  it.each(['https://siafi.tesouro.gov.br/siafiweb/menu','https://suap.ifrn.edu.br/processo_eletronico/processo/123/','https://mail.google.com/mail/','https://contratos.comprasnet.gov.br/'])('abre solrecfin fora de um DH e sem esperar o SIAGES em %s',async href=>{
    const url=new URL(href);
    Object.defineProperty(window,'location',{configurable:true,value:{protocol:url.protocol,hostname:url.hostname,pathname:url.pathname,href}});
    const entries=[{captureId:'global-1',capturedAt:new Date().toISOString(),code:'EXE001',source:'1000000000',valueCents:123456}];
    const stored={siages_solrecfin_entries:entries};
    vi.stubGlobal('chrome',{storage:{local:{get:(_keys:unknown,callback:(data:typeof stored)=>void)=>callback(stored),set:(_data:unknown,callback:()=>void)=>callback()}},runtime:{}});
    vi.stubGlobal('SiagesSiafiEvidence',{available:()=>false,isRunning:()=>false});
    installExtensionAuth();vi.stubGlobal('fetch',vi.fn(()=>new Promise(()=>{})));
    const open=vi.spyOn(window,'open').mockImplementation(()=>null);
    window.eval(contentScript);
    const input=openPalette();
    fireEvent.input(input,{target:{value:'solrecfin'}});
    expect(document.querySelector('.suape-cp-list')).toHaveTextContent('Solicitar financeiro (solrecfin)');
    fireEvent.keyDown(input,{key:'Enter'});
    await waitFor(()=>expect(document.querySelector('.suape-cp-detail-table')).toHaveTextContent('1.234,56'));
    expect(document.querySelector('.suape-cp-detail-table')).toHaveTextContent('EXE001');
    expect(document.querySelector('.suape-cp-detail-table')).toHaveTextContent('1000000000');
    expect(open).not.toHaveBeenCalled();
  });
  it('mantém print disponível no SIAFI mesmo enquanto outra busca espera os dados remotos', async () => {
    Object.defineProperty(window, 'location', { configurable: true, value: {
      protocol: 'https:', hostname: 'siafi.tesouro.gov.br', pathname: '/siafi/editarDH', href: 'https://siafi.tesouro.gov.br/siafi/editarDH',
    } });
    installExtensionAuth();
    const start = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('SiagesSiafiEvidence', { available: () => true, isRunning: () => false, start });
    const fetchMock = vi.fn(() => new Promise(() => {})); vi.stubGlobal('fetch', fetchMock);
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => null);
    window.eval(contentScript);
    const input = openPalette();
    await flushMicrotasks();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.input(input, { target: { value: 'empenho' } });
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(document.querySelector('.suape-cp-list')).toHaveTextContent('Carregando dados');
    fireEvent.input(input, { target: { value: 'print' } });
    expect(document.querySelector('.suape-cp-list')).toHaveTextContent('Capturar liquidação (PDF e JSON)');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(start).toHaveBeenCalledTimes(1);
    expect(document.getElementById('suape-cp-overlay')).not.toHaveClass('suape-cp-visible');
    expect(openMock).not.toHaveBeenCalled();
  });
  it('exibe consultas SUAP fora do SIAGES e resume RP/NP na própria paleta', async () => {
    vi.useFakeTimers();
    installExtensionAuth();
    const { fetchMock, requests } = createFetchMock();
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.stubGlobal('fetch', fetchMock);

    window.eval(contentScript);
    await vi.advanceTimersByTimeAsync(2500);
    expect(fetchMock).not.toHaveBeenCalled();

    const input = openPalette();
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const localContracts = requests.find(({ url }) => url.pathname.endsWith('/contratos'));
    expect(localContracts?.url.searchParams.get('select')).toBe('id,numero,contratada,valor,data_inicio,data_termino');

    fireEvent.input(input, { target: { value: 'processo 123' } });
    expect(document.body.textContent).toContain('no SUAP Processos');
    expect(document.body.textContent).toContain('SUAP Oficial');

    fireEvent.input(input, { target: { value: 'sincronizar processos agora' } });
    expect(document.body.textContent).not.toContain('Sincronizar processos agora');

    fireEvent.input(input, { target: { value: 'aluno 12345678901' } });
    expect(document.body.textContent).toContain('Abrir Aluno #12345678901');

    fireEvent.input(input, { target: { value: 'documento minuta' } });
    expect(document.body.textContent).toContain('no SUAP Documentos');

    fireEvent.input(input, { target: { value: 'contrato 12/2024' } });
    expect(document.body.textContent).toContain('no SUAP Contratos');

    fireEvent.input(input, { target: { value: 'condh 07.805.649/0001-29' } });
    await waitFor(() => expect(document.body.textContent).toContain('2026NP000085'));
    expect(document.body.textContent).toContain('2026NP000085');
    expect(document.body.textContent).toContain('Paga');
    expect(document.body.textContent).toContain('Empresa Exemplo');
    expect(document.body.textContent).toMatch(/R\$\s*1\.250,75/);
    expect(requests.some(({ url }) => url.pathname.endsWith('/documentos_habeis') && url.searchParams.get('or') === '(id.ilike.*NP*,id.ilike.*RP*)')).toBe(true);

    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(document.querySelector('.suape-cp-detail-body')?.textContent).toContain('Pagamento efetuado'));
    expect(document.querySelector('.suape-cp-detail-title')?.textContent).toContain('2026NP000085');
    expect(document.querySelector('.suape-cp-detail-body')?.textContent).toContain('Pagamento efetuado');
    expect(document.querySelector('.suape-cp-detail-body')?.textContent).toContain('Situações (1)');
    expect(openMock).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true });
    const reopenedInput = document.querySelector<HTMLInputElement>('.suape-cp-input')!;
    fireEvent.input(reopenedInput, { target: { value: 'dashboard' } });
    const dashboard = Array.from(document.querySelectorAll<HTMLElement>('.suape-cp-screen-item'))
      .find((element) => element.textContent?.includes('Dashboard'));
    expect(dashboard).toBeTruthy();
    fireEvent.click(dashboard!);
    expect(openMock).toHaveBeenCalledWith('https://www.siages.com.br/', '_blank');
  });

  it('busca por CPF sem pontuação e pelo número exato da RP/NP', async () => {
    installExtensionAuth();
    const { fetchMock, requests } = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    window.eval(contentScript);
    const input = openPalette();
    await flushMicrotasks();

    fireEvent.input(input, { target: { value: 'condh 07805649000129' } });
    await waitFor(() => expect(document.body.textContent).toContain('2026NP000085'));
    expect(document.body.textContent).toContain('2026NP000085');
    const cnpjRequest = requests.find(({ url }) => url.pathname.endsWith('/documentos_habeis'))!;
    expect(cnpjRequest.url.searchParams.get('favorecido_documento')).toBe('in.(07805649000129,07.805.649/0001-29)');

    fireEvent.input(input, { target: { value: 'condh 2026NP000085' } });
    await waitFor(() => expect(requests.filter(({ url }) => url.pathname.endsWith('/documentos_habeis'))).toHaveLength(2));
    await waitFor(() => expect(document.body.textContent).toContain('Página 1 de 1'));
    expect(document.body.textContent).toContain('2026NP000085');
    const numberRequest = requests.filter(({ url }) => url.pathname.endsWith('/documentos_habeis')).at(-1)!;
    expect(numberRequest.url.searchParams.get('id')).toBe('ilike.*2026NP000085');
    expect(numberRequest.url.searchParams.has('favorecido_documento')).toBe(false);
  });

  it('busca RP e NP pelo sufixo numérico no comando condh', async () => {
    installExtensionAuth();
    const documents = [
      documentRow({ id: '158366264352026NP000082' }),
      documentRow({ id: '158366264352026RP000082' }),
    ];
    const { fetchMock, requests } = createFetchMock({ documents });
    vi.stubGlobal('fetch', fetchMock);
    window.eval(contentScript);
    const input = openPalette();
    await flushMicrotasks();

    fireEvent.input(input, { target: { value: 'condh 82' } });
    await waitFor(() => expect(document.body.textContent).toContain('2026NP000082'));
    expect(document.body.textContent).toContain('2026RP000082');
    const request = requests.find(({ url }) => url.pathname.endsWith('/documentos_habeis'))!;
    expect(request.url.searchParams.get('id')).toBe('ilike.*82');
    expect(request.url.searchParams.get('or')).toBe('(id.ilike.*NP*,id.ilike.*RP*)');
  });

  it('percorre resultados em páginas de 20 documentos', async () => {
    installExtensionAuth();
    const documents = Array.from({ length: 21 }, (_, index) => documentRow({
      id: `158366264352026NP${String(85 - index).padStart(6, '0')}`,
      data_emissao: `2026-03-${String(21 - index).padStart(2, '0')}`,
      favorecido_nome: `Favorecido ${index + 1}`,
    }));
    const { fetchMock, requests } = createFetchMock({ documents });
    vi.stubGlobal('fetch', fetchMock);
    window.eval(contentScript);
    const input = openPalette();
    await flushMicrotasks();

    fireEvent.input(input, { target: { value: 'condh 07.805.649/0001-29' } });
    await waitFor(() => expect(document.body.textContent).toContain('Página 1 de 2'));
    expect(document.body.textContent).toContain('Página 1 de 2');
    expect(document.querySelectorAll('.suape-cp-item')).toHaveLength(20);

    fireEvent.click(document.querySelector<HTMLButtonElement>('.suape-cp-condh-page-btn:not(:disabled)[data-page="2"]')!);
    await waitFor(() => expect(document.body.textContent).toContain('Página 2 de 2'));
    expect(document.body.textContent).toContain('Página 2 de 2');
    expect(document.body.textContent).toContain('Favorecido 21');
    expect(document.querySelectorAll('.suape-cp-item')).toHaveLength(1);
    expect(requests.filter(({ url }) => url.pathname.endsWith('/documentos_habeis'))).toHaveLength(2);
  });

  it('informa quando não encontra uma RP/NP correspondente', async () => {
    installExtensionAuth();
    const { fetchMock } = createFetchMock({
      documents: [
        documentRow({ id: '158366264352026NS000085' }),
        documentRow({ id: '158366264352026OB000085' }),
      ],
    });
    vi.stubGlobal('fetch', fetchMock);
    window.eval(contentScript);
    const input = openPalette();
    await flushMicrotasks();

    fireEvent.input(input, { target: { value: 'condh 2026NP000085' } });
    await waitFor(() => expect(document.body.textContent).toContain('Nenhuma RP ou NP encontrada'));
    expect(document.body.textContent).not.toContain('2026NS000085');
    expect(document.body.textContent).not.toContain('2026OB000085');
  });

  it('respeita a permissão de Liquidações e não consulta documentos quando ela falta', async () => {
    installExtensionAuth();
    const { fetchMock, requests } = createFetchMock({ screenPermission: false });
    vi.stubGlobal('fetch', fetchMock);
    window.eval(contentScript);
    const input = openPalette();
    await flushMicrotasks();

    fireEvent.input(input, { target: { value: 'condh 2026NP000085' } });
    await waitFor(() => expect(document.body.textContent).toContain('não tem acesso à tela Liquidações e Pagamentos'));
    expect(document.body.textContent).toContain('não tem acesso à tela Liquidações e Pagamentos');
    expect(requests.some(({ url }) => url.pathname.endsWith('/documentos_habeis'))).toBe(false);
  });

  it('abre consultas SUAP na aba atual com Enter e em nova aba com Ctrl+Enter', async () => {
    vi.useFakeTimers();
    const { fetchMock } = createFetchMock();
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => null);
    let assignedUrl = '';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        hostname: 'example.com',
        pathname: '/',
        search: '',
        set href(url: string) { assignedUrl = url; },
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    window.eval(contentScript);
    const input = openPalette();
    await flushMicrotasks();
    fireEvent.input(input, { target: { value: 'processo 23000.000123/2026-01' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(assignedUrl).toBe('https://suap.ifrn.edu.br/admin/processo_eletronico/processo/?q=23000.000123%2F2026-01');

    fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true });
    const reopenedInput = document.querySelector<HTMLInputElement>('.suape-cp-input')!;
    fireEvent.input(reopenedInput, { target: { value: 'aluno 12345678901' } });
    fireEvent.keyDown(reopenedInput, { key: 'Enter', ctrlKey: true });
    expect(openMock).toHaveBeenCalledWith('https://suap.ifrn.edu.br/edu/aluno/12345678901/', '_blank');

    fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true });
    const documentInput = document.querySelector<HTMLInputElement>('.suape-cp-input')!;
    fireEvent.input(documentInput, { target: { value: 'documento termo de busca' } });
    fireEvent.keyDown(documentInput, { key: 'Enter' });
    expect(assignedUrl).toBe('https://suap.ifrn.edu.br/admin/documento_eletronico/documentotexto/?opcao=1&q=termo+de+busca');

    fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true });
    const contractInput = document.querySelector<HTMLInputElement>('.suape-cp-input')!;
    fireEvent.input(contractInput, { target: { value: 'contrato 12/2024' } });
    fireEvent.keyDown(contractInput, { key: 'Enter' });
    expect(assignedUrl).toBe('https://suap.ifrn.edu.br/admin/contratos/contrato/?campi=3&q=12%2F2024&tab=tab_ativos');
  });

  it('permite usar atalhos de processo com ID explícito (up, enc, etc.) mesmo fora da página do processo', async () => {
    vi.useFakeTimers();
    const { fetchMock } = createFetchMock();
    let assignedUrl = '';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        hostname: 'example.com',
        pathname: '/',
        search: '',
        set href(url: string) { assignedUrl = url; },
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    window.eval(contentScript);
    const input = openPalette();
    await flushMicrotasks();

    // 1. Atalho 'up 498930' (aciona automação com payload no hash e no storage)
    fireEvent.input(input, { target: { value: 'up 498930' } });
    expect(document.body.textContent).toContain('Fazer Upload de Documento');
    expect(document.body.textContent).toContain('#498930');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(assignedUrl).toContain('https://suap.ifrn.edu.br/processo_eletronico/documento_upload/498930/#siagesUpload=');
    const hashPart = assignedUrl.split('#siagesUpload=')[1];
    expect(hashPart).toBeDefined();
    const parsedPayload = JSON.parse(decodeURIComponent(hashPart));
    expect(parsedPayload).toEqual({
      source: 'siages',
      version: 1,
      action: 'suap_upload_document',
      suapId: '498930',
      tipoConferencia: 'Cópia Simples',
      tipoDocumento: 'Liquidação',
      assunto: 'Liquidação',
    });
    const stored = JSON.parse(sessionStorage.getItem('siagesUploadPendingV1') || '{}');
    expect(stored.payload).toEqual(parsedPayload);

    // 2. Atalho 'enc 498930'
    fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true });
    const encInput = document.querySelector<HTMLInputElement>('.suape-cp-input')!;
    fireEvent.input(encInput, { target: { value: 'enc 498930' } });
    expect(document.body.textContent).toContain('Encaminhar Processo');
    fireEvent.keyDown(encInput, { key: 'Enter' });
    expect(assignedUrl).toBe('https://suap.ifrn.edu.br/processo_eletronico/processo/encaminhar/498930/');

    // 3. Ordem invertida '498930 encs'
    fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true });
    const encsInput = document.querySelector<HTMLInputElement>('.suape-cp-input')!;
    fireEvent.input(encsInput, { target: { value: '498930 encs' } });
    expect(document.body.textContent).toContain('Encaminhar Sem Despacho');
    fireEvent.keyDown(encsInput, { key: 'Enter' });
    expect(assignedUrl).toBe('https://suap.ifrn.edu.br/processo_eletronico/processo/encaminhar_sem_despacho/498930/');

    // 3b. Atalho 'encdg 498930' leva o preenchimento da DG/CN no hash
    fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true });
    const encdgInput = document.querySelector<HTMLInputElement>('.suape-cp-input')!;
    fireEvent.input(encdgInput, { target: { value: 'encdg 498930' } });
    expect(document.body.textContent).toContain('Encaminhar à DG para Autorização de Pagamento');
    fireEvent.keyDown(encdgInput, { key: 'Enter' });
    expect(assignedUrl).toContain('https://suap.ifrn.edu.br/processo_eletronico/processo/encaminhar/498930/#siagesEncaminhar=');
    expect(JSON.parse(decodeURIComponent(assignedUrl.split('#siagesEncaminhar=')[1]))).toEqual({
      source: 'siages',
      version: 1,
      action: 'suap_forward_process',
      suapId: '498930',
      despacho: 'Ao Diretor geral para autorização de pagamento',
      campus: { id: '3', text: 'CN' },
      setor: { id: '841', text: 'DG/CN' },
      papel: 'ASSISTENTE EM ADMINISTRACAO',
    });

    // 4. Apenas o ID '498930' lista todas as ações do processo
    fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true });
    const idInput = document.querySelector<HTMLInputElement>('.suape-cp-input')!;
    fireEvent.input(idInput, { target: { value: '498930' } });
    expect(document.body.textContent).toContain('Ações do Processo #498930');
    expect(document.body.textContent).toContain('Fazer Upload de Documento');
    expect(document.body.textContent).toContain('Encaminhar Processo');
    expect(document.body.textContent).toContain('Ver Capa do Processo');
  });

  it('injeta badges com ID do processo na tela de caixas de processos com clique para copiar', async () => {
    vi.useFakeTimers();
    let assignedUrl = '';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        hostname: 'suap.ifrn.edu.br',
        pathname: '/processo_eletronico/caixa_processos/',
        search: '',
        set href(url: string) { assignedUrl = url; },
      },
    });

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>2</td>
      <td>
        <a href="/processo_eletronico/processo/498930/">23035.002761.2026-41 - Auxílio Financeiro</a>
      </td>
    `;
    document.body.appendChild(row);

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    window.eval(contentScript);

    const initBadges = (window as unknown as { __suapeInitProcessBoxIdBadges?: () => void }).__suapeInitProcessBoxIdBadges;
    expect(typeof initBadges).toBe('function');
    initBadges?.();

    const badge = row.querySelector<HTMLElement>('.suape-process-id-badge');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('#498930');
    expect(badge?.dataset.processId).toBe('498930');

    // Clique simples deve copiar o ID
    fireEvent.click(badge!);
    await flushMicrotasks();
    expect(writeTextMock).toHaveBeenCalledWith('498930');
    expect(badge?.textContent).toContain('Copiado!');

    // Alt+Clique deve navegar direto para upload com automação
    fireEvent.click(badge!, { altKey: true });
    expect(assignedUrl).toContain('/processo_eletronico/documento_upload/498930/#siagesUpload=');
    const badgeHashPart = assignedUrl.split('#siagesUpload=')[1];
    const badgePayload = JSON.parse(decodeURIComponent(badgeHashPart));
    expect(badgePayload).toEqual({
      source: 'siages',
      version: 1,
      action: 'suap_forward_process',
    }.action === 'suap_upload_document' ? badgePayload : {
      source: 'siages',
      version: 1,
      action: 'suap_upload_document',
      suapId: '498930',
      tipoConferencia: 'Cópia Simples',
      tipoDocumento: 'Liquidação',
      assunto: 'Liquidação',
    });
    const storedFromBadge = JSON.parse(sessionStorage.getItem('siagesUploadPendingV1') || '{}');
    expect(storedFromBadge.payload).toEqual(badgePayload);
  });

  it('filtra empenhos pela UASG vinculada (158366 — Currais Novos) e exibe o saldo ao digitar o número da NE, sequencial com zero ou código completo SIAFI', async () => {
    installExtensionAuth();
    const requests: URL[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requests.push(url);
      const table = url.pathname.split('/').at(-1);
      if (table === 'empenhos') {
        const campusFilter = url.searchParams.get('campus_uasg');
        const allEmpenhos = [
          {
            id: 'emp-reitoria-150',
            campus_uasg: '158155',
            numero: '2026NE000150',
            descricao: 'Empenho da Reitoria',
            valor: 90000,
            valor_liquidado: 0,
            status: 'pendente',
            tipo: 'exercicio',
            favorecido_nome: 'FORNECEDOR REITORIA LTDA',
          },
          {
            id: 'emp-cn-110',
            campus_uasg: '158366',
            numero: '2026NE000110',
            descricao: 'Combustível Campus Currais Novos',
            valor: 10000,
            valor_liquidado_a_pagar: 1000,
            valor_pago_oficial: 2590.67,
            status: 'liquidado',
            tipo: 'exercicio',
            plano_interno: 'L20RLP0100N',
            favorecido_nome: 'PRIME CONSULTORIA E ASSESSORIA EMPRESARIAL LTDA',
          },
        ];
        const filtered = campusFilter?.startsWith('eq.')
          ? allEmpenhos.filter((e) => e.campus_uasg === campusFilter.slice(3))
          : allEmpenhos;
        return { ok: true, status: 200, json: async () => filtered, headers: { get: () => null } };
      }
      return { ok: true, status: 200, json: async () => [], headers: { get: () => null } };
    });
    vi.stubGlobal('fetch', fetchMock);

    window.eval(contentScript);
    const input = openPalette();
    await flushMicrotasks();

    const empenhosReq = requests.find((u) => u.pathname.endsWith('/empenhos'));
    expect(empenhosReq?.searchParams.get('campus_uasg')).toBe('eq.158366');

    // Digitar sequencial com zeros à esquerda ('000110') não pode ser engolido pelo filtro de processos
    fireEvent.input(input, { target: { value: '000110' } });
    await waitFor(() => expect(document.body.textContent).toContain('2026NE000110'));
    expect(document.body.textContent).toContain('PRIME CONSULTORIA E ASSESSORIA EMPRESARIAL LTDA');
    expect(document.body.textContent).toMatch(/R\$\s*6\.409,33/);
    expect(document.body.textContent).not.toContain('FORNECEDOR REITORIA LTDA');

    // Digitar número completo do SIAFI com prefixo de UG e Gestão ('158366264352026NE000110')
    fireEvent.input(input, { target: { value: '158366264352026NE000110' } });
    expect(document.body.textContent).toContain('2026NE000110');
    expect(document.body.textContent).toMatch(/R\$\s*6\.409,33/);

    // Abrir detalhes do empenho e verificar exibição da UASG / Campus
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(document.querySelector('.suape-cp-detail-body')?.textContent).toContain('158366 — Currais Novos'));
  });

  it('exibe contratos com busca por CNPJ, badge de vigência e dossiê com 4 abas (Empenhos, Faturas, Itens, Termos) usando as colunas reais do PostgREST', async () => {
    installExtensionAuth();
    const requests: URL[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requests.push(url);
      const table = url.pathname.split('/').at(-1);
      if (table === 'contratos_api') {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 'api-777',
              api_contrato_id: 777,
              numero: '00045/2025',
              unidade_codigo: '158155',
              unidade_nome: 'REITORIA IFRN',
              fornecedor_nome: 'SOLUCOES DIGITAIS LTDA',
              fornecedor_documento: '11.222.333/0001-44',
              objeto: 'Licenciamento corporativo de software',
              processo: '23000.000777/2025-99',
              situacao: 'Ativo',
              situacao_derivada: true,
              campus_scope_reason: 'reitoria_com_empenho_campus',
              vigencia_inicio: '2025-01-01',
              vigencia_fim: '2026-12-31',
              vigencia_inicio_derivada: '2025-01-01',
              vigencia_fim_derivada: '2026-12-31',
              valor_global: 120000,
              valor_acumulado: 180000,
            },
          ],
          headers: { get: () => null },
        };
      }
      if (table === 'contratos_api_empenhos') {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 'emp-api-901',
              contrato_api_id: 'api-777',
              numero: '2026NE000555',
              unidade_gestora: '158366',
              valor_empenhado: 90000,
              valor_a_liquidar: 40000,
              valor_liquidado: 20000,
              valor_pago: 30000,
            },
          ],
          headers: { get: () => null },
        };
      }
      if (table === 'contratos_api_faturas') {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 'fat-501',
              contrato_api_id: 'api-777',
              numero_instrumento_cobranca: 'FAT-10',
              data_emissao: '2026-03-10',
              processo: '23000.000777/2025-99',
              valor_liquido: 8500,
              situacao: 'Ateste Pendente',
            },
          ],
          headers: { get: () => null },
        };
      }
      if (table === 'contratos_api_itens') {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 'item-301',
              contrato_api_id: 'api-777',
              numero_item_compra: '1',
              tipo_material: 'Serviço',
              descricao_complementar: 'Subscrição anual de licenças',
              quantidade: 12,
              valor_unitario: 10000,
              valor_total: 120000,
            },
          ],
          headers: { get: () => null },
        };
      }
      if (table === 'contratos_api_historico') {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 'hist-201',
              contrato_api_id: 'api-777',
              receita_despesa: 'Despesa',
              tipo: 'Termo Aditivo',
              numero: '01/2026',
              data_assinatura: '2026-01-10',
              vigencia_inicio: '2026-01-10',
              vigencia_fim: '2027-01-10',
              valor_inicial: 200000,
              novo_valor_global: 200000,
              observacao: 'Prorrogação contratual de 12 meses',
            },
          ],
          headers: { get: () => null },
        };
      }
      return { ok: true, status: 200, json: async () => [], headers: { get: () => null } };
    });
    vi.stubGlobal('fetch', fetchMock);

    window.eval(contentScript);
    const input = openPalette();
    await flushMicrotasks();

    // Busca pelo CNPJ do fornecedor
    fireEvent.input(input, { target: { value: '11.222.333/0001-44' } });
    await waitFor(() => expect(document.body.textContent).toContain('Contrato 00045/2025'));
    expect(document.body.textContent).toContain('SOLUCOES DIGITAIS LTDA');
    expect(document.body.textContent).toContain('Origem Reitoria');

    // Seleciona o item do contrato (não a linha de consulta SUAP)
    const contractItem = Array.from(document.querySelectorAll<HTMLElement>('.suape-cp-item'))
      .find((el) => el.textContent?.includes('Contrato 00045/2025'));
    expect(contractItem).toBeTruthy();
    fireEvent.click(contractItem!);

    await waitFor(() => expect(document.querySelector('.suape-cp-detail-body')?.textContent).toContain('2026NE000555'));

    // Verifica que a query de itens usou numero_item_compra.asc
    const itensReq = requests.find((u) => u.pathname.endsWith('/contratos_api_itens'));
    expect(itensReq?.searchParams.get('order')).toBe('numero_item_compra.asc');

    // Verifica as 4 abas e alternância para Faturas, Itens e Termos
    const detailBody = document.querySelector('.suape-cp-detail-body')!;
    expect(detailBody.textContent).toContain('Empenhos (1)');
    expect(detailBody.textContent).toContain('Faturas (1)');
    expect(detailBody.textContent).toContain('Itens (1)');
    expect(detailBody.textContent).toContain('Termos (1)');

    fireEvent.click(detailBody.querySelector<HTMLElement>('[data-tab="faturas"]')!);
    expect(detailBody.textContent).toContain('FAT-10');
    expect(detailBody.textContent).toContain('Ateste Pendente');

    fireEvent.click(detailBody.querySelector<HTMLElement>('[data-tab="itens"]')!);
    expect(detailBody.textContent).toContain('Subscrição anual de licenças');

    fireEvent.click(detailBody.querySelector<HTMLElement>('[data-tab="termos"]')!);
    expect(detailBody.textContent).toContain('Termo Aditivo');
    expect(detailBody.textContent).toContain('Prorrogação contratual de 12 meses');
  });

  it('abre a paleta com Ctrl+K no Google mesmo quando TrustedHTML bloqueia innerHTML e createPolicy é restrito', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        protocol: 'https:',
        hostname: 'www.google.com',
        pathname: '/search',
        search: '?q=ifrn',
        hash: '',
        href: 'https://www.google.com/search?q=ifrn',
      },
    });
    installExtensionAuth();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => [], headers: { get: () => null } })));

    const originalInnerHtmlDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    const googleDocKeydownStopper = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', googleDocKeydownStopper, false);

    const childIframe = document.createElement('iframe');
    childIframe.src = 'https://ogs.google.com/widget/app';
    document.body.appendChild(childIframe);
    document.documentElement.classList.add('dark');
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, media: '(prefers-color-scheme: dark)', addEventListener: vi.fn(), removeEventListener: vi.fn() })));

    vi.stubGlobal('trustedTypes', {
      createPolicy: vi.fn(() => {
        throw new TypeError("Failed to execute 'createPolicy' on 'TrustedTypePolicyFactory': Policy disallowed.");
      }),
    });

    Object.defineProperty(Element.prototype, 'innerHTML', {
      configurable: true,
      get() {
        return originalInnerHtmlDesc?.get?.call(this) ?? '';
      },
      set(value: unknown) {
        if (typeof value === 'string') {
          throw new TypeError("Failed to set the 'innerHTML' property on 'Element': This document requires 'TrustedHTML' assignment.");
        }
        originalInnerHtmlDesc?.set?.call(this, value);
      },
    });

    try {
      window.eval(contentScript);
      fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK', ctrlKey: true });

      const overlay = document.getElementById('suape-cp-overlay');
      const detailOverlay = document.getElementById('suape-cp-detail-overlay');
      expect(overlay).toHaveClass('suape-cp-visible');
      expect(overlay?.dataset.theme).toBe('light');
      expect(detailOverlay?.dataset.theme).toBe('light');

      const themeToggle = overlay?.querySelector<HTMLButtonElement>('#suape-cp-theme-toggle');
      expect(themeToggle).toBeTruthy();
      fireEvent.click(themeToggle!);
      expect(overlay?.dataset.theme).toBe('dark');
      expect(detailOverlay?.dataset.theme).toBe('dark');
      fireEvent.click(themeToggle!);
      expect(overlay?.dataset.theme).toBe('light');
      expect(detailOverlay?.dataset.theme).toBe('light');

      const input = document.querySelector<HTMLInputElement>('.suape-cp-input');
      expect(input).toBeTruthy();
      expect(document.activeElement).toBe(input);
      expect(overlay?.querySelectorAll('svg').length).toBeGreaterThan(0);

      await flushMicrotasks();
      fireEvent.input(input!, { target: { value: 'dashboard' } });
      await waitFor(() => expect(document.querySelector('.suape-cp-list')).toHaveTextContent('Dashboard'));
    } finally {
      document.removeEventListener('keydown', googleDocKeydownStopper, false);
      if (originalInnerHtmlDesc) {
        Object.defineProperty(Element.prototype, 'innerHTML', originalInnerHtmlDesc);
      }
    }
  });

  it('recupera o foco preso em PDF embutido no SUAP e abre Ctrl+K sem precisar clicar fora do PDF', async () => {
    vi.useFakeTimers();
    const windowFocusSpy = vi.spyOn(window, 'focus').mockImplementation(() => undefined);
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        protocol: 'https:',
        hostname: 'suap.ifrn.edu.br',
        pathname: '/documento_eletronico/visualizar_documento_digitalizado/2693291/',
        search: '',
        hash: '',
        href: 'https://suap.ifrn.edu.br/documento_eletronico/visualizar_documento_digitalizado/2693291/',
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => [], headers: { get: () => null } })));

    const embed = document.createElement('embed');
    embed.setAttribute('type', 'application/pdf');
    embed.setAttribute('src', '/documento_eletronico/visualizar_documento_digitalizado/2693291/?original=sim');
    embed.tabIndex = 0;
    document.body.appendChild(embed);
    embed.focus();
    expect(document.activeElement).toBe(embed);

    window.eval(contentScript);
    // Na carga inicial já retira o foco do <embed> sem precisar clicar fora
    expect(document.activeElement).not.toBe(embed);
    expect(document.activeElement).toBe(document.body);

    // Simula clique posterior no PDF (<embed> captura o foco e dispara blur na window)
    embed.focus();
    expect(document.activeElement).toBe(embed);
    window.dispatchEvent(new Event('blur'));
    await vi.advanceTimersByTimeAsync(250);
    expect(document.activeElement).toBe(document.body);

    // Simula Ctrl+K enquanto um <object> ou <iframe> de PDF ainda detém document.activeElement
    const pdfObject = document.createElement('object');
    pdfObject.setAttribute('type', 'application/pdf');
    pdfObject.setAttribute('data', '/documento_eletronico/visualizar_documento_digitalizado/2693291/?original=sim');
    pdfObject.tabIndex = 0;
    document.body.appendChild(pdfObject);

    const pdfIframe = document.createElement('iframe');
    pdfIframe.setAttribute('src', '/documento_eletronico/visualizar_documento_digitalizado/2693291/?original=sim');
    document.body.appendChild(pdfIframe);

    const activeElementSpy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(pdfIframe);
    const iframeBlurSpy = vi.spyOn(pdfIframe, 'blur');
    fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true });
    activeElementSpy.mockRestore();

    expect(iframeBlurSpy).toHaveBeenCalled();
    expect(windowFocusSpy).toHaveBeenCalled();
    expect(document.getElementById('suape-cp-overlay')).toHaveClass('suape-cp-visible');

    // Fechar com Escape não devolve o foco ao plugin de PDF
    const input = document.querySelector<HTMLInputElement>('.suape-cp-input')!;
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
    expect(document.getElementById('suape-cp-overlay')).not.toHaveClass('suape-cp-visible');
    expect(document.activeElement).toBe(document.body);
  });

  it('encaminha Ctrl+K de iframes filhos para o topo e evita alternância duplicada entre evento e mensagem', async () => {
    vi.useFakeTimers();

    // 1. Comportamento no frame filho (window !== window.top)
    const originalTopDescriptor = Object.getOwnPropertyDescriptor(window, 'top');
    const topPostMessage = vi.fn();
    const childSendMessage = vi.fn((_msg: unknown, cb?: () => void) => cb?.());
    Object.defineProperty(window, 'top', {
      configurable: true,
      value: { postMessage: topPostMessage },
    });
    vi.stubGlobal('chrome', {
      runtime: { sendMessage: childSendMessage, lastError: undefined },
    });

    try {
      window.eval(contentScript);
      expect((window as unknown as { __suapeCommandPaletteFrameForwarderLoaded?: boolean }).__suapeCommandPaletteFrameForwarderLoaded).toBe(true);
      expect(document.getElementById('suape-cp-overlay')).toBeNull();

      fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true });
      expect(topPostMessage).toHaveBeenCalledTimes(1);
      expect(topPostMessage).toHaveBeenCalledWith(
        { source: 'siages-command-palette', action: 'toggle-command-palette' },
        '*',
      );
      expect(childSendMessage).toHaveBeenCalledTimes(1);
      expect(childSendMessage.mock.calls[0][0]).toEqual({
        source: 'siages-command-palette',
        type: 'toggle-in-top-frame',
      });

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      expect(topPostMessage).toHaveBeenLastCalledWith(
        { source: 'siages-command-palette', action: 'close-command-palette' },
        '*',
      );
    } finally {
      (window as typeof window & { __suapeSolrecfin?: { destroy: () => void } }).__suapeSolrecfin?.destroy();
      delete (window as typeof window & Record<string, unknown>).__suapeCommandPaletteLoaded;
      if (originalTopDescriptor) {
        Object.defineProperty(window, 'top', originalTopDescriptor);
      }
    }

    // 2. Comportamento no frame principal recebendo evento + postMessage + runtime.onMessage
    let onMessageListener: ((message: unknown, sender: unknown, sendResponse: (res: unknown) => void) => void) | undefined;
    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: {
          addListener: (cb: typeof onMessageListener) => { onMessageListener = cb; },
          removeListener: vi.fn(),
        },
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => [], headers: { get: () => null } })));

    window.eval(contentScript);

    const sendResponse = vi.fn();
    onMessageListener?.({ source: 'siages-command-palette', action: 'toggle-command-palette' }, {}, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
    expect(document.getElementById('suape-cp-overlay')).toHaveClass('suape-cp-visible');

    // Deduplicação imediata impede que postMessage/onMessage simultâneos fechem a paleta recém-aberta
    window.dispatchEvent(new MessageEvent('message', {
      data: { source: 'siages-command-palette', action: 'toggle-command-palette' },
    }));
    expect(document.getElementById('suape-cp-overlay')).toHaveClass('suape-cp-visible');

    // Após fechar, keydown + mensagem simultânea mantém aberta
    onMessageListener?.({ source: 'siages-command-palette', action: 'close-command-palette' }, {}, sendResponse);
    expect(document.getElementById('suape-cp-overlay')).not.toHaveClass('suape-cp-visible');

    await vi.advanceTimersByTimeAsync(250);
    fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true });
    window.dispatchEvent(new MessageEvent('message', {
      data: { source: 'siages-command-palette', action: 'toggle-command-palette' },
    }));
    onMessageListener?.({ source: 'siages-command-palette', action: 'toggle-command-palette' }, {}, sendResponse);
    expect(document.getElementById('suape-cp-overlay')).toHaveClass('suape-cp-visible');
  });

  it('abre a paleta automaticamente via #siagesOpenPalette=1 e roteia open-command-palette no background.js', async () => {
    const replaceState = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        protocol: 'https:',
        hostname: 'www.google.com',
        pathname: '/',
        search: '',
        hash: '#siagesOpenPalette=1',
        href: 'https://www.google.com/#siagesOpenPalette=1',
      },
    });
    vi.spyOn(window.history, 'replaceState').mockImplementation(replaceState);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => [], headers: { get: () => null } })));

    window.eval(contentScript);
    expect(replaceState).toHaveBeenCalledWith(null, expect.any(String), '/');
    expect(document.getElementById('suape-cp-overlay')).toHaveClass('suape-cp-visible');

    // Testa o background.js para comando open-command-palette e nova guia
    const commandListeners: Array<(command: string, tab?: { id: number; url?: string }) => Promise<void> | void> = [];
    const messageListeners: Array<(message: unknown, sender: unknown, sendResponse: (res: unknown) => void) => unknown> = [];
    const tabsSendMessage = vi.fn((_tabId: number, _msg: unknown, cb?: (res: unknown) => void) => cb?.(undefined));
    const tabsUpdate = vi.fn(async () => ({}));
    const scriptingInsertCss = vi.fn(async () => undefined);
    const scriptingExecuteScript = vi.fn(async () => []);

    const chromeBg = {
      storage: { local: { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) } },
      runtime: {
        onMessage: { addListener: (cb: typeof messageListeners[number]) => messageListeners.push(cb) },
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
      },
      alarms: { create: vi.fn(), get: vi.fn().mockResolvedValue(undefined), onAlarm: { addListener: vi.fn() } },
      tabs: {
        query: vi.fn(async () => [{ id: 10, url: 'chrome://newtab/' }]),
        sendMessage: tabsSendMessage,
        update: tabsUpdate,
      },
      scripting: {
        insertCSS: scriptingInsertCss,
        executeScript: scriptingExecuteScript,
      },
      commands: {
        onCommand: { addListener: (cb: typeof commandListeners[number]) => commandListeners.push(cb) },
      },
    };

    const bgScope: Record<string, unknown> = {};
    new Function('chrome', 'fetch', 'globalThis', readFileSync(extensionFixturePath('background.js'), 'utf8'))(chromeBg, globalThis.fetch, bgScope);

    // Nova guia redireciona para Google com hash de abertura automática
    await commandListeners[0]('open-command-palette', { id: 10, url: 'chrome://newtab/' });
    expect(tabsUpdate).toHaveBeenCalledWith(10, { url: 'https://www.google.com/#siagesOpenPalette=1' });

    // Aba HTTP sem content script recebe injeção sob demanda e reenvio da mensagem
    let injected = false;
    scriptingExecuteScript.mockImplementation(async () => {
      injected = true;
      return [];
    });
    tabsSendMessage.mockImplementation((_tabId: number, _msg: unknown, cb?: (res: unknown) => void) => {
      cb?.(injected ? { ok: true } : undefined);
    });
    await commandListeners[0]('open-command-palette', { id: 20, url: 'https://www.google.com/' });
    expect(scriptingInsertCss).toHaveBeenCalledWith({
      target: { tabId: 20, allFrames: true },
      files: ['command-palette.css'],
    });
    expect(scriptingExecuteScript).toHaveBeenCalledWith({
      target: { tabId: 20, allFrames: true },
      files: ['extension-auth-client.js', 'command-palette.js'],
    });
    expect(tabsSendMessage).toHaveBeenCalledWith(
      20,
      { source: 'siages-command-palette', action: 'toggle-command-palette' },
      expect.any(Function),
    );
  });
});
