import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

type TextExpanderApi = {
  normalizeSnippetKey: (value: string) => string;
  expandTextValue: (value: string, cursor: number, snippets?: Record<string, string>) => { value: string; cursor: number } | null;
  expandFormControl: (element: HTMLInputElement | HTMLTextAreaElement) => boolean;
  expandContentEditable: (element: HTMLElement) => boolean;
  setSnippetsForTest: (snippets: Record<string, string>) => void;
};

function loadTextExpander() {
  const testWindow = window as typeof window & { __siagesTextExpander?: TextExpanderApi; chrome?: unknown };
  testWindow.chrome = {
    storage: {
      sync: { get: vi.fn((_key, callback) => callback({ 'siages-snippets': { '/cn': 'Currais Novos' } })), set: vi.fn() },
      onChanged: { addListener: vi.fn() },
    },
  };
  window.eval(readFileSync(extensionFixturePath('text-expander.js'), 'utf8'));
  return testWindow.__siagesTextExpander!;
}

describe('text-expander 1.9', () => {
  beforeEach(() => { document.body.innerHTML = ''; delete (window as typeof window & Record<string, unknown>).__siagesTextExpander; });

  it('normaliza comandos e expande de forma case-insensitive preservando o cursor', () => {
    const api = loadTextExpander();
    expect(api.normalizeSnippetKey(' CN ')).toBe('/cn');
    expect(api.expandTextValue('Destino /CN restante', 12, { '/cn': 'Currais Novos' })).toEqual({ value: 'Destino Currais Novos restante', cursor: 22, trigger: '/cn' });
  });

  it('expande input e textarea e dispara input/change', () => {
    const api = loadTextExpander(); api.setSnippetsForTest({ '/cn': 'Currais Novos' });
    for (const element of [document.createElement('input'), document.createElement('textarea')]) {
      document.body.appendChild(element); element.value = '/cn '; element.setSelectionRange(4, 4);
      const input = vi.fn(); const change = vi.fn(); element.addEventListener('input', input); element.addEventListener('change', change);
      expect(api.expandFormControl(element)).toBe(true);
      expect(element.value).toBe('Currais Novos '); expect(element.selectionStart).toBe(14); expect(input).toHaveBeenCalled(); expect(change).toHaveBeenCalled();
    }
  });

  it('ignora senhas, tipos nao textuais, comandos desconhecidos e texto sem espaco', () => {
    const api = loadTextExpander(); api.setSnippetsForTest({ '/cn': 'Currais Novos' });
    const password = document.createElement('input'); password.type = 'password'; password.value = '/cn ';
    const number = document.createElement('input'); number.type = 'number'; number.value = '123';
    expect(api.expandFormControl(password)).toBe(false); expect(api.expandFormControl(number)).toBe(false);
    expect(api.expandTextValue('/desconhecido ', 13)).toBeNull(); expect(api.expandTextValue('/cn', 3)).toBeNull();
  });

  it('expande contenteditable na posicao da selecao', () => {
    const api = loadTextExpander(); api.setSnippetsForTest({ '/cn': 'Currais Novos' });
    const editable = document.createElement('div'); editable.contentEditable = 'true'; editable.innerHTML = 'Local: /cn '; document.body.appendChild(editable);
    Object.defineProperty(editable, 'isContentEditable', { configurable: true, value: true });
    const node = editable.firstChild!; const range = document.createRange(); range.setStart(node, node.textContent!.length); range.collapse(true); getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    expect(api.expandContentEditable(editable)).toBe(true); expect(editable.textContent).toBe('Local: Currais Novos ');
  });
});
