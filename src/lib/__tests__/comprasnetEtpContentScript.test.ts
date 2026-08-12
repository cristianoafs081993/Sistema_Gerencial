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
  });

  it('injeta um único botão/modal sem alterar o body nem clicar em Concluir ETP', () => {
    const originalClass = document.body.className;
    window.eval(readFileSync(extensionFixturePath('comprasnet-etp.js'), 'utf8'));
    const testWindow = window as typeof window & { __siagesComprasnetEtp?: { install: () => void } };
    testWindow.__siagesComprasnetEtp?.install();
    testWindow.__siagesComprasnetEtp?.install();

    expect(document.querySelectorAll('#siages-comprasnet-etp-open')).toHaveLength(1);
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
});
