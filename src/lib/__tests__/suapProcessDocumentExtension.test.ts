import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type ExtensionWindow = Window & typeof globalThis & {
  __SIAGES_SUAP_PROCESS_TEST__?: boolean;
  __siagesSuapProcessDocument?: {
    getProcessId: () => string | null;
    getProcessNumber: () => string;
    buildContext: () => { payload: { suapId: string; processNumber: string; processUrl: string } } | null;
    installButton: () => void;
  };
  chrome?: unknown;
};

function loadProcessScript() {
  const testWindow = window as ExtensionWindow;
  testWindow.__SIAGES_SUAP_PROCESS_TEST__ = true;
  testWindow.chrome = {
    storage: { local: { get: (_key: string, callback: (value: Record<string, string>) => void) => callback({}) } },
  };
  const script = readFileSync(resolve(process.cwd(), 'suap-atividades-extension/process-document.js'), 'utf8');
  window.eval(script);
  if (!testWindow.__siagesSuapProcessDocument) throw new Error('Content script não foi carregado.');
  return testWindow.__siagesSuapProcessDocument;
}

describe('process-document extension script', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main>Processo 23035.000001.2026-11</main>';
    window.history.replaceState(null, '', '/processo_eletronico/processo/321/');
    document.getElementById('siages-suap-generate-document')?.remove();
  });

  afterEach(() => {
    const testWindow = window as ExtensionWindow;
    delete testWindow.__SIAGES_SUAP_PROCESS_TEST__;
    delete testWindow.__siagesSuapProcessDocument;
    delete testWindow.chrome;
  });

  it('gera o contexto da pagina de processo e instala apenas um botao', () => {
    const script = loadProcessScript();
    expect(script.getProcessId()).toBe('321');
    expect(script.getProcessNumber()).toBe('23035.000001.2026-11');
    expect(script.buildContext()).toMatchObject({
      source: 'siages-suap-extension',
      type: 'siages:suap-process-context',
      payload: { suapId: '321', processNumber: '23035.000001.2026-11' },
    });

    script.installButton();
    script.installButton();
    expect(document.querySelectorAll('#siages-suap-generate-document')).toHaveLength(1);
  });

  it('reconhece a tela de visualizacao e ignora paginas sem processo', () => {
    window.history.replaceState(null, '', '/processo_eletronico/visualizar_processo/654/');
    let script = loadProcessScript();
    expect(script.getProcessId()).toBe('654');

    delete (window as ExtensionWindow).__siagesSuapProcessDocument;
    window.history.replaceState(null, '', '/processo_eletronico/caixa/');
    script = loadProcessScript();
    expect(script.getProcessId()).toBeNull();
    script.installButton();
    expect(document.querySelector('#siages-suap-generate-document')).toBeNull();
  });
});