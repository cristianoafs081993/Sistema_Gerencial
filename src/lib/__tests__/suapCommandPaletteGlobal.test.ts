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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  delete (window as typeof window & Record<string, unknown>).__suapeCommandPaletteLoaded;
  if (originalLocationDescriptor) Object.defineProperty(window, 'location', originalLocationDescriptor);
});

describe('paleta global da extensao Suape', () => {
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
});
