import { readFileSync } from 'node:fs';

import { fireEvent } from '@testing-library/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

const contentScript = readFileSync(extensionFixturePath('click-hints.js'), 'utf8');

function setRect(element: HTMLElement, left: number, top: number, width = 90, height = 28) {
  element.dataset.hintLeft = String(left);
  element.dataset.hintTop = String(top);
  element.dataset.hintWidth = String(width);
  element.dataset.hintHeight = String(height);
}

function installGeometry() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getBoundingClientRect() {
    const element = this as HTMLElement;
    const left = Number(element.dataset.hintLeft ?? 10);
    const top = Number(element.dataset.hintTop ?? 10);
    const width = Number(element.dataset.hintWidth ?? 90);
    const height = Number(element.dataset.hintHeight ?? 28);
    return {
      x: left, y: top, left, top, width, height,
      right: left + width, bottom: top + height,
      toJSON: () => ({}),
    } as DOMRect;
  });
}

afterEach(() => {
  document.body.innerHTML = '';
  document.getElementById('suape-click-hints-root')?.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('modo de atalhos mnemônicos da extensão Suape', () => {
  it('gera dicas estáveis, filtra, confirma ações, foca campos e respeita o teclado fora do modo', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    installGeometry();

    document.body.innerHTML = `
      <button id="edit-left">Editar</button>
      <button id="edit-right">Editar</button>
      <button id="save">Salvar</button>
      <label for="search">Buscar contrato</label><input id="search" />
      <input id="send" type="submit" value="Enviar" />
      <button id="close" aria-label="Fechar painel"></button>
      <button id="ignored" disabled>Ignorar</button>
    `;

    setRect(document.getElementById('edit-left')!, 20, 20);
    setRect(document.getElementById('edit-right')!, 180, 20);
    setRect(document.getElementById('save')!, 20, 80);
    setRect(document.getElementById('search')!, 20, 140);
    setRect(document.getElementById('send')!, 180, 140);
    setRect(document.getElementById('close')!, 20, 200);
    setRect(document.getElementById('ignored')!, 180, 200);

    const save = document.getElementById('save')!;
    const onSave = vi.fn();
    save.addEventListener('click', onSave);

    window.eval(contentScript);
    fireEvent.keyDown(document, { key: 'm', code: 'KeyM', ctrlKey: true, altKey: true });
    expect(document.getElementById('suape-click-hints-root')).toBeNull();
    fireEvent.keyDown(document, { key: ';', code: 'Semicolon', ctrlKey: true });

    const root = document.getElementById('suape-click-hints-root')!;
    expect(root.hidden).toBe(false);
    expect(Array.from(document.querySelectorAll('.suape-click-hint')).map((hint) => hint.textContent)).toEqual(
      expect.arrayContaining(['ED1', 'ED2', 'SA', 'BC', 'EN', 'FP']),
    );
    expect(document.querySelectorAll('.suape-click-hint[data-code="IG"]').length).toBe(0);

    const lateButton = document.createElement('button');
    lateButton.textContent = 'Novo item';
    setRect(lateButton, 180, 80);
    document.body.appendChild(lateButton);
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('.suape-click-hint[data-code="NI"]')).toBeTruthy();

    fireEvent.keyDown(document, { key: 's' });
    fireEvent.keyDown(document, { key: 'a' });
    expect(document.querySelector('.suape-click-hint[data-code="ED1"]')).toHaveClass('suape-click-hint-hidden');
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(root.hidden).toBe(true);

    fireEvent.keyDown(document, { key: ';', code: 'Semicolon', ctrlKey: true });
    fireEvent.keyDown(document, { key: 'b' });
    fireEvent.keyDown(document, { key: 'c' });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(document.activeElement).toBe(document.getElementById('search'));

    const regularKey = new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true });
    document.dispatchEvent(regularKey);
    expect(regularKey.defaultPrevented).toBe(false);

    fireEvent.keyDown(document, { key: ';', code: 'Semicolon', ctrlKey: true });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(root.hidden).toBe(true);
  });
});
