import { readFileSync } from 'node:fs';

import { fireEvent } from '@testing-library/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

const contentScript = readFileSync(extensionFixturePath('command-palette.js'), 'utf8');
const originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');

async function flushMicrotasks() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
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
  it('exibe consultas oficiais SUAP em paginas externas e mantém a sincronização restrita ao SUAP', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [] }));
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.stubGlobal('fetch', fetchMock);

    window.eval(contentScript);

    await vi.advanceTimersByTimeAsync(2500);
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true });

    expect(document.getElementById('suape-cp-overlay')).toHaveClass('suape-cp-visible');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await flushMicrotasks();

    const input = document.querySelector<HTMLInputElement>('.suape-cp-input')!;
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
    expect(document.body.textContent).toContain('Buscar RP/NP para 07.805.649/0001-29');
    expect(document.body.textContent).toContain('consulta de Liquidações e Pagamentos no SIAGES');
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    expect(openMock).toHaveBeenCalledWith(
      'https://www.siages.com.br/liquidacoes-pagamentos#condh=07805649000129',
      '_blank',
    );

    fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true });
    const reopenedInput = document.querySelector<HTMLInputElement>('.suape-cp-input')!;
    fireEvent.input(reopenedInput, { target: { value: 'dashboard' } });
    const dashboard = Array.from(document.querySelectorAll<HTMLElement>('.suape-cp-screen-item'))
      .find((element) => element.textContent?.includes('Dashboard'));
    expect(dashboard).toBeTruthy();

    fireEvent.click(dashboard!);
    expect(openMock).toHaveBeenCalledWith('https://www.siages.com.br/', '_blank');
  });

  it('abre as consultas na aba atual com Enter e em nova aba com Ctrl+Enter', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [] }));
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
    fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true });
    await flushMicrotasks();

    const input = document.querySelector<HTMLInputElement>('.suape-cp-input')!;
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

    fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true });
    const condhInput = document.querySelector<HTMLInputElement>('.suape-cp-input')!;
    fireEvent.input(condhInput, { target: { value: 'CONDH 07.805.649/0001-29' } });
    fireEvent.keyDown(condhInput, { key: 'Enter' });
    expect(assignedUrl).toBe('https://www.siages.com.br/liquidacoes-pagamentos#condh=07805649000129');

    fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true });
    const condhNewTabInput = document.querySelector<HTMLInputElement>('.suape-cp-input')!;
    fireEvent.input(condhNewTabInput, { target: { value: 'condh 07805649000129' } });
    fireEvent.keyDown(condhNewTabInput, { key: 'Enter', ctrlKey: true });
    expect(openMock).toHaveBeenCalledWith(
      'https://www.siages.com.br/liquidacoes-pagamentos#condh=07805649000129',
      '_blank',
    );
  });
});
