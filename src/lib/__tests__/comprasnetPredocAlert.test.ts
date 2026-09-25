import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

type PredocApi = {
  getPredocRows: () => Array<{ row: Element; predocCell: Element }>;
  isPredocFilled: (row: { predocCell: Element }) => boolean;
  getPendingPredocCount: () => number;
  isPaymentTabActive: () => boolean;
  hasPendingPredocs: () => boolean;
  refreshState: () => void;
  destroy: () => void;
};

const script = readFileSync(extensionFixturePath('comprasnet-predoc-alert.js'), 'utf8');
const originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');

function rowHtml(index: number, filled = false) {
  return `<tr>
    <td><input id="codcredordevedor${index}" value="18.891.594/0001-33" /></td>
    <td><input id="vlrFavorecido${index}" value="2.314,09" /></td>
    <td><button type="button"><i class="fa fa-check"></i> Pré-Doc</button>${filled ? '<button type="button" title="Excluir Pré-doc"><i class="fa fa-trash"></i></button>' : ''}</td>
    <td><button type="button">Ações</button></td>
  </tr>`;
}

function renderPage(rows = rowHtml(0), deductionRows = '', activeTab = 'Dados de pagamento') {
  const isActive = (label: string) => activeTab === label ? 'aria-expanded="true" class="active"' : 'aria-expanded="false"';
  document.body.innerHTML = `
    <div class="abas-alteracao-apropriacao">
      <button id="dados-basicos-tab" role="tab" ${isActive('Dados Básicos')}>Dados Básicos</button>
      <button id="dados-pagamento-tab" role="tab" ${isActive('Dados de pagamento')}>Dados de pagamento</button>
      <button id="deducao-tab" role="tab" ${isActive('Dedução')}>Dedução</button>
    </div>
    <button id="btnEnviarApropriacaoSiafiDiretamente">Apropriar SIAFI</button>
    <div id="dados-pagamento">
      <table><thead><tr><th>Favorecido</th><th>Valor</th><th>Pré-Doc</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table>
      <button id="btnSubmitFormSfDadosPagamento">Confirmar Dados de Pagamento</button>
    </div>
    <div id="deducao"><table><thead><tr><th>Descrição</th><th>Valor</th><th>Pré-Doc</th><th>Ações</th></tr></thead><tbody>${deductionRows}</tbody></table></div>
    <a id="back-link" href="/apropriacao">Voltar</a>
  `;
}

function loadScript() {
  const testWindow = window as typeof window & {
    __SIAGES_COMPRASNET_PREDOC_ALERT_TEST__?: boolean;
    __siagesComprasnetPredocAlert?: PredocApi;
    __siagesComprasnetPredocAlertLoaded?: boolean;
  };
  testWindow.__SIAGES_COMPRASNET_PREDOC_ALERT_TEST__ = true;
  delete testWindow.__siagesComprasnetPredocAlert;
  delete testWindow.__siagesComprasnetPredocAlertLoaded;
  window.eval(script);
  return testWindow.__siagesComprasnetPredocAlert as PredocApi;
}

function clickById(id: string) {
  document.getElementById(id)?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('guardião de pré-doc do Comprasnet', () => {
  beforeEach(() => {
    const previous = (window as typeof window & { __siagesComprasnetPredocAlert?: PredocApi }).__siagesComprasnetPredocAlert;
    previous?.destroy();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'contratos.comprasnet.gov.br', pathname: '/apropriacao/fatura-form/alterar-antes-apropriar/1766989/1753187' },
    });
    renderPage();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    const current = (window as typeof window & { __siagesComprasnetPredocAlert?: PredocApi }).__siagesComprasnetPredocAlert;
    current?.destroy();
    document.body.innerHTML = '';
    if (originalLocationDescriptor) Object.defineProperty(window, 'location', originalLocationDescriptor);
  });

  it('distingue a linha vazia da linha preenchida pelo controle de remoção', () => {
    const api = loadScript();
    expect(api.isPaymentTabActive()).toBe(true);
    expect(api.getPendingPredocCount()).toBe(1);
    expect(api.hasPendingPredocs()).toBe(true);

    renderPage(rowHtml(0, true));
    api.refreshState();
    expect(api.getPendingPredocCount()).toBe(0);
    expect(api.isPredocFilled(api.getPredocRows()[0])).toBe(true);
  });

  it('inclui linhas de dedução sem pré-doc na pendência', () => {
    renderPage(rowHtml(0, true), rowHtml(1));
    const api = loadScript();
    expect(api.getPendingPredocCount()).toBe(1);
  });

  it('bloqueia troca de aba, confirmação e apropriação enquanto houver pendência', () => {
    const handlers = ['dados-basicos-tab', 'btnSubmitFormSfDadosPagamento', 'btnEnviarApropriacaoSiafiDiretamente']
      .map((id) => {
        const handler = vi.fn();
        document.getElementById(id)?.addEventListener('click', handler);
        return handler;
      });
    loadScript();

    clickById('dados-basicos-tab');
    clickById('btnSubmitFormSfDadosPagamento');
    clickById('btnEnviarApropriacaoSiafiDiretamente');

    handlers.forEach((handler) => expect(handler).not.toHaveBeenCalled());
    expect(document.getElementById('suape-comprasnet-predoc-overlay')).not.toHaveAttribute('hidden');

    (document.querySelector('[data-action="continue"]') as HTMLButtonElement)?.click();
    expect(handlers[2]).toHaveBeenCalledTimes(1);
  });

  it('não bloqueia navegação quando todas as linhas estão preenchidas', () => {
    renderPage(rowHtml(0, true));
    const handler = vi.fn();
    document.getElementById('btnEnviarApropriacaoSiafiDiretamente')?.addEventListener('click', handler);
    const api = loadScript();

    expect(api.hasPendingPredocs()).toBe(false);
    clickById('btnEnviarApropriacaoSiafiDiretamente');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('não protege as ações enquanto outra aba estiver ativa', () => {
    renderPage(rowHtml(0), '', 'Dados Básicos');
    const handler = vi.fn();
    document.getElementById('btnEnviarApropriacaoSiafiDiretamente')?.addEventListener('click', handler);
    const api = loadScript();

    expect(api.isPaymentTabActive()).toBe(false);
    clickById('btnEnviarApropriacaoSiafiDiretamente');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('protege a saída do navegador enquanto houver pendência', () => {
    loadScript();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
