import { readFileSync } from 'node:fs';

import { fireEvent } from '@testing-library/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

const contentScript = readFileSync(extensionFixturePath('command-palette.js'), 'utf8');

async function flushMicrotasks() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  delete (window as typeof window & Record<string, unknown>).__suapeCommandPaletteLoaded;
});

describe('paleta global da extensao Suape', () => {
  it('abre sob demanda em pagina externa, oculta comandos SUAP e navega para a origem publica', async () => {
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
    expect(document.body.textContent).not.toContain('no SUAP Processos');
    expect(document.body.textContent).not.toContain('SUAP Oficial');

    fireEvent.input(input, { target: { value: 'dashboard' } });
    const dashboard = Array.from(document.querySelectorAll<HTMLElement>('.suape-cp-screen-item'))
      .find((element) => element.textContent?.includes('Dashboard'));
    expect(dashboard).toBeTruthy();

    fireEvent.click(dashboard!);
    expect(openMock).toHaveBeenCalledWith('https://www.siages.com.br/', '_blank');
  });
});
