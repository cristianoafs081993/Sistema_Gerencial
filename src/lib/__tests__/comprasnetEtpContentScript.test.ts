import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

describe('content script do ETP Comprasnet', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main><h1>Estudo Técnico Preliminar</h1><button class="btn-section">Descrição da necessidade</button><button class="br-button primary">Concluir ETP</button><iframe class="cke_wysiwyg_frame"></iframe></main>';
    const frame = document.querySelector('iframe') as HTMLIFrameElement;
    frame.contentDocument!.body.innerHTML = '<p>Conteúdo atual</p>';
    const testWindow = window as typeof window & Record<string, unknown>;
    testWindow.__SIAGES_COMPRASNET_ETP_TEST__ = true;
    delete testWindow.__siagesComprasnetEtp;
    delete (globalThis as typeof globalThis & { chrome?: unknown }).chrome;
  });

  it('injeta um único botão/modal sem alterar o body nem clicar em Concluir ETP', () => {
    const originalClass = document.body.className;
    window.eval(readFileSync(extensionFixturePath('comprasnet-etp.js'), 'utf8'));
    const testWindow = window as typeof window & { __siagesComprasnetEtp?: { install: () => void } };
    testWindow.__siagesComprasnetEtp?.install();
    testWindow.__siagesComprasnetEtp?.install();

    const openButtons = document.querySelectorAll('#siages-comprasnet-etp-open');
    expect(openButtons).toHaveLength(1);
    expect(openButtons[0].classList.contains('br-button')).toBe(true);
    expect(openButtons[0].classList.contains('secondary')).toBe(true);
    expect(openButtons[0].classList.contains('small')).toBe(true);
    expect(document.querySelectorAll('#siages-comprasnet-etp-overlay')).toHaveLength(1);
    expect(document.body.className).toBe(originalClass);
    expect(document.querySelector('button.br-button.primary')).toHaveTextContent('Concluir ETP');
  });

  it('lê a seção atual e o conteúdo do CKEditor', async () => {
    window.eval(readFileSync(extensionFixturePath('comprasnet-etp.js'), 'utf8'));
    const testWindow = window as typeof window & { __siagesComprasnetEtp?: { collectFields: (mode: string) => Promise<Array<{ id: string; existingText: string }>> } };
    const fields = await testWindow.__siagesComprasnetEtp?.collectFields('current');
    expect(fields).toEqual([{ id: 'necessidade', title: 'Descrição da necessidade', existingHtml: '<p>Conteúdo atual</p>', existingText: 'Conteúdo atual' }]);
  });

  it('reconhece a seção ativa no menu Angular do Comprasnet', async () => {
    document.body.innerHTML = '<main><div class="dropdown-item active"><a>4. Descrição dos Requisitos da Contratação</a></div><iframe class="cke_wysiwyg_frame"></iframe><button class="br-button primary">Concluir ETP</button></main>';
    const frame = document.querySelector('iframe') as HTMLIFrameElement;
    frame.contentDocument!.body.innerHTML = '<p>Requisitos atuais</p>';
    window.eval(readFileSync(extensionFixturePath('comprasnet-etp.js'), 'utf8'));
    const testWindow = window as typeof window & { __siagesComprasnetEtp?: { collectFields: (mode: string) => Promise<Array<{ id: string }>> } };

    await expect(testWindow.__siagesComprasnetEtp?.collectFields('current')).resolves.toEqual([
      { id: 'requisitos', title: 'Descrição dos Requisitos da Contratação', existingHtml: '<p>Requisitos atuais</p>', existingText: 'Requisitos atuais' },
    ]);
  });

  it('não insere o botão em uma cópia oculta das ações', () => {
    document.body.innerHTML = '<main><h1>Estudo Técnico Preliminar</h1><div style="display:none"><button class="br-button">Concluir ETP</button></div><div id="visible-actions"><button class="br-button primary">Concluir ETP</button></div></main>';
    window.eval(readFileSync(extensionFixturePath('comprasnet-etp.js'), 'utf8'));
    const testWindow = window as typeof window & { __siagesComprasnetEtp?: { install: () => void } };
    testWindow.__siagesComprasnetEtp?.install();

    expect(document.querySelector('#visible-actions #siages-comprasnet-etp-open')).toBeTruthy();
    expect(document.querySelector('div[style="display:none"] #siages-comprasnet-etp-open')).toBeNull();
  });

  it('devolve o foco para a página ao fechar o modal', () => {
    window.eval(readFileSync(extensionFixturePath('comprasnet-etp.js'), 'utf8'));
    const testWindow = window as typeof window & { __siagesComprasnetEtp?: { install: () => void; closeModal: () => void } };
    testWindow.__siagesComprasnetEtp?.install();
    const openButton = document.querySelector('#siages-comprasnet-etp-open') as HTMLButtonElement;
    openButton.focus();
    openButton.click();
    testWindow.__siagesComprasnetEtp?.closeModal();

    expect(document.activeElement).toBe(openButton);
  });

  it('recusa escrita em outra seção sem navegar automaticamente', async () => {
    window.eval(readFileSync(extensionFixturePath('comprasnet-etp.js'), 'utf8'));
    const testWindow = window as typeof window & { __siagesComprasnetEtp?: { applyFields: (fields: Array<{ id: string; html: string; replaceExisting: boolean }>) => Promise<string[]> } };

    await expect(testWindow.__siagesComprasnetEtp?.applyFields([
      { id: 'requisitos', html: '<p>Novo texto</p>', replaceExisting: true },
    ])).rejects.toThrow('Avance manualmente no Comprasnet');
    expect((document.querySelector('iframe') as HTMLIFrameElement).contentDocument!.body.innerHTML).toBe('<p>Conteúdo atual</p>');
  });

  it('sincroniza somente preferências normalizadas no armazenamento da extensão', async () => {
    let stored: Record<string, unknown> = {};
    (globalThis as typeof globalThis & { chrome?: unknown }).chrome = {
      storage: {
        sync: {
          get: (_key: string, callback: (value: Record<string, unknown>) => void) => callback(stored),
          set: (value: Record<string, unknown>, callback: () => void) => { stored = { ...stored, ...value }; callback(); },
        },
      },
      runtime: {},
    };
    window.eval(readFileSync(extensionFixturePath('comprasnet-etp.js'), 'utf8'));
    const testWindow = window as typeof window & { __siagesComprasnetEtp?: { savePreferences: (value: unknown) => Promise<{ paragraphCount: number; sectionOverrides: Record<string, unknown> }>; readPreferences: () => Promise<{ paragraphCount: number }> } };

    const saved = await testWindow.__siagesComprasnetEtp?.savePreferences({ paragraphCount: 99, processo: 'sigiloso', sectionOverrides: { necessidade: { checklist: ['publico_afetado', 'invalido'] } } });

    expect(saved).toMatchObject({ paragraphCount: 8, sectionOverrides: { necessidade: { checklist: ['publico_afetado'] } } });
    expect(JSON.stringify(stored)).not.toContain('sigiloso');
    await expect(testWindow.__siagesComprasnetEtp?.readPreferences()).resolves.toMatchObject({ paragraphCount: 8 });
  });
});
