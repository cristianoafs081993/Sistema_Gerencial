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
    totais: { empenhado: 1000, saldo: 700 },
    empenhos: [{
      id: 'emp-1',
      numero: '2026NE000001',
      empenhado: 1000,
      saldo: 700,
      liquidacoes: [
        { id: 'liq-1', numero: 'NF 123', data: '2026-02-20', situacao: 'Liquidada', valor: 280 },
        { id: 'liq-2', numero: 'NF 124', data: '2026-02-21', situacao: 'Siafi Apropriado', valor: 20 },
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
    document.getElementById('siages-suap-finance-widget')?.remove();
    document.getElementById('siages-suap-finance-frame')?.remove();
  });

  afterEach(() => {
    const testWindow = window as ExtensionWindow;
    delete testWindow.__SIAGES_SUAP_PROCESS_TEST__;
    delete testWindow.__siagesSuapProcessDocument;
    delete testWindow.chrome;
    document.getElementById('siages-suap-dispatch-modal')?.remove();
    document.getElementById('siages-suap-finance-panel')?.remove();
    document.getElementById('siages-suap-finance-widget')?.remove();
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

    script.installButton();
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
    const widget = document.getElementById('siages-suap-finance-widget') as HTMLElement;
    expect(widget).toContainElement(panel);
    expect(widget).toContainElement(document.getElementById('siages-suap-generate-document'));
    expect(widget.style.position).toBe('fixed');
    expect(widget.style.right).toBe('20px');
    expect(widget.lastElementChild?.id).toBe('siages-suap-generate-document');
    expect(panel.dataset.siagesPlacement).toBe('widget');
    expect(panel.style.position).toBe('static');
    expect(panel.textContent).toContain('Fornecedor Alfa');
    expect(panel.textContent).toContain('00040/2026');
    expect(panel.textContent).toContain('Empenhado');
    expect(panel.textContent).toContain('NF 123');
    expect(panel.textContent).toContain('NF 126');
    expect(panel.textContent).not.toContain('Liquidado');
    expect(panel.textContent).not.toContain('+1 liquidacoes');
    expect(panel.textContent).not.toMatch(/pago|pagamento/i);
    postMessage.mockRestore();
  });

  it('mantem o painel a direita mesmo quando a timeline do SUAP estiver em outra coluna', () => {
    document.body.innerHTML = `
      <main>
        <section id="processo-principal"><h3>Tramitação</h3><p>Documentos e detalhes do processo</p></section>
      </main>
      <aside id="timeline-direita">
        <div>24/07/2026 10:01:59 Recebido por COFINC/CN: Fransuelia Araujo</div>
        <div>23/07/2026 09:55:21 Encaminhado por COINFRA/CN: Sheila Pessoa</div>
        <h3>Registro de ações</h3>
      </aside>
    `;
    const script = loadProcessScript();

    script.renderFinanceSummary(financeSummary());

    const panel = document.getElementById('siages-suap-finance-panel') as HTMLElement;
    const widget = document.getElementById('siages-suap-finance-widget') as HTMLElement;
    expect(widget).toContainElement(panel);
    expect(document.getElementById('timeline-direita')?.contains(panel)).toBe(false);
    expect(document.getElementById('processo-principal')?.contains(panel)).toBe(false);
    expect(panel.dataset.siagesPlacement).toBe('widget');
    expect(panel.style.position).toBe('static');
    expect(panel.style.overflow).toBe('hidden');
    expect(panel.style.maxWidth).toBe('100%');
  });
  it('usa o painel a direita sem depender de uma area de tramitacao', () => {
    const script = loadProcessScript();
    script.renderFinanceSummary(financeSummary());

    const panel = document.getElementById('siages-suap-finance-panel') as HTMLElement;
    expect(document.getElementById('siages-suap-finance-widget')).toContainElement(panel);
    expect(panel.dataset.siagesPlacement).toBe('widget');
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