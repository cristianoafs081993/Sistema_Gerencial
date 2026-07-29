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

function financeSummary() {
  return {
    status: 'ready',
    beneficiario: { nome: 'Fornecedor Alfa' },
    contrato: { numero: '00040/2026' },
    escopoContrato: true,
    totais: { empenhado: 1000, liquidado: 300, saldo: 700 },
    empenhos: [{
      id: 'emp-1',
      numero: '2026NE000001',
      saldo: 700,
      liquidado: 300,
      liquidacoes: [
        { id: 'liq-1', numero: 'NF 123', data: '2026-02-20', situacao: 'Liquidada', valor: 280 },
        { id: 'liq-2', numero: 'NF 124', data: '2026-02-21', situacao: 'Pago', valor: 20 },
        { id: 'liq-3', numero: 'NF 125', data: '2026-02-22', situacao: 'Liquidada', valor: 10 },
        { id: 'liq-4', numero: 'NF 126', data: '2026-02-23', situacao: 'Liquidada', valor: 5 },
      ],
    }],
  };
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

  it('injeta card financeiro no fim da area de tramitacao e renderiza liquidacoes sem pagamento', async () => {
    document.body.innerHTML = '<main><section id="tramites"><h3>Tramitação do processo</h3><p>Processo 23035.000001.2026-11</p></section></main>';
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
        payload: financeSummary(),
      },
    }));

    await waitFor(() => expect(document.getElementById('siages-suap-finance-frame')).toBeNull());
    const panel = document.getElementById('siages-suap-finance-panel') as HTMLElement;
    expect(document.getElementById('tramites')?.lastElementChild).toBe(panel);
    expect(panel.dataset.siagesPlacement).toBe('flow');
    expect(panel.style.position).toBe('static');
    expect(panel.textContent).toContain('Fornecedor Alfa');
    expect(panel.textContent).toContain('00040/2026');
    expect(panel.textContent).toContain('Liquidado');
    expect(panel.textContent).toContain('NF 123');
    expect(panel.textContent).toContain('+1 liquidacoes');
    expect(panel.textContent).not.toMatch(/pago|pagamento/i);
    postMessage.mockRestore();
  });

  it('usa o conteudo principal como fallback quando nao encontra area de tramitacao', () => {
    const script = loadProcessScript();
    script.renderFinanceSummary(financeSummary());

    const panel = document.getElementById('siages-suap-finance-panel') as HTMLElement;
    expect(document.querySelector('main')?.contains(panel)).toBe(true);
    expect(panel.dataset.siagesPlacement).toBe('content');
    expect(panel.style.position).toBe('static');
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