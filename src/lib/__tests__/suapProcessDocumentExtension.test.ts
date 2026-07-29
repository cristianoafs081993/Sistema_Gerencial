import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { waitFor } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ExtensionWindow = Window & typeof globalThis & {
  __SIAGES_SUAP_PROCESS_TEST__?: boolean;
  __siagesSuapProcessDocument?: {
    getProcessId: () => string | null;
    getProcessNumber: () => string;
    buildContext: () => { payload: { suapId: string; processNumber: string; processUrl: string } } | null;
    installButton: () => void;
    installFinancePanel: () => void;
    openFinanceBridge: () => void;
    renderFinanceSummary: (summary: unknown) => void;
    openModal: () => void;
    closeModal: () => void;
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
  if (!testWindow.__siagesSuapProcessDocument) throw new Error('Content script nao foi carregado.');
  return testWindow.__siagesSuapProcessDocument;
}

describe('process-document extension script', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main>Processo 23035.000001.2026-11</main>';
    window.history.replaceState(null, '', '/processo_eletronico/processo/321/');
    document.getElementById('siages-suap-generate-document')?.remove();
    document.getElementById('siages-suap-finance-panel')?.remove();
    document.getElementById('siages-suap-finance-frame')?.remove();
  });

  afterEach(() => {
    const testWindow = window as ExtensionWindow;
    delete testWindow.__SIAGES_SUAP_PROCESS_TEST__;
    delete testWindow.__siagesSuapProcessDocument;
    delete testWindow.chrome;
    document.getElementById('siages-suap-dispatch-modal')?.remove();
    document.getElementById('siages-suap-finance-panel')?.remove();
    document.getElementById('siages-suap-finance-frame')?.remove();
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

  it('reenvia o contexto quando o iframe do SIAGES informa que esta pronto', async () => {
    const script = loadProcessScript();

    script.openModal();

    await waitFor(() => expect(document.getElementById('siages-suap-dispatch-frame')).toBeTruthy());
    const frame = document.getElementById('siages-suap-dispatch-frame') as HTMLIFrameElement;
    const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => undefined);

    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://sistema-gerencial-gamma.vercel.app',
      source: frame.contentWindow,
      data: { source: 'siages', type: 'siages:suap-dispatch-ready', version: 1 },
    }));

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      source: 'siages-suap-extension',
      type: 'siages:suap-process-context',
      payload: expect.objectContaining({ suapId: '321', processNumber: '23035.000001.2026-11' }),
    }), 'https://sistema-gerencial-gamma.vercel.app');
    postMessage.mockRestore();
  });

  it('injeta card financeiro e renderiza resumo recebido do SIAGES', async () => {
    const script = loadProcessScript();

    script.installFinancePanel();

    await waitFor(() => expect(document.getElementById('siages-suap-finance-frame')).toBeTruthy());
    const frame = document.getElementById('siages-suap-finance-frame') as HTMLIFrameElement;
    const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => undefined);

    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://sistema-gerencial-gamma.vercel.app',
      source: frame.contentWindow,
      data: { source: 'siages', type: 'siages:suap-process-info-ready', version: 1 },
    }));

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      source: 'siages-suap-extension',
      type: 'siages:suap-process-context',
      payload: expect.objectContaining({ suapId: '321' }),
    }), 'https://sistema-gerencial-gamma.vercel.app');

    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://sistema-gerencial-gamma.vercel.app',
      source: frame.contentWindow,
      data: {
        source: 'siages',
        type: 'siages:suap-process-finance-summary',
        version: 1,
        payload: {
          status: 'ready',
          beneficiario: { nome: 'Fornecedor Alfa' },
          contrato: { numero: '00040/2026' },
          escopoContrato: true,
          totais: { empenhado: 1000, liquidado: 300, pago: 100, saldo: 700 },
          empenhos: [{ id: 'emp-1', numero: '2026NE000001', saldo: 700, liquidado: 300, pago: 100, liquidacoes: [] }],
        },
      },
    }));

    await waitFor(() => expect(document.getElementById('siages-suap-finance-frame')).toBeNull());
    expect(document.getElementById('siages-suap-finance-panel')?.textContent).toContain('Fornecedor Alfa');
    expect(document.getElementById('siages-suap-finance-panel')?.textContent).toContain('00040/2026');
    expect(document.getElementById('siages-suap-finance-panel')?.textContent).toContain('R$');
    postMessage.mockRestore();
  });

  it('remove o card quando o processo nao tem beneficiario identificado', () => {
    const script = loadProcessScript();
    script.renderFinanceSummary({ status: 'ready', escopoContrato: false, totais: {}, empenhos: [] });
    expect(document.getElementById('siages-suap-finance-panel')).toBeTruthy();

    script.renderFinanceSummary({ status: 'missing-beneficiary', escopoContrato: false, totais: {}, empenhos: [] });
    expect(document.getElementById('siages-suap-finance-panel')).toBeNull();
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
    script.installFinancePanel();
    expect(document.querySelector('#siages-suap-generate-document')).toBeNull();
    expect(document.querySelector('#siages-suap-finance-panel')).toBeNull();
  });
});