import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

type PredocApi = {
  PAYMENT_TABLE_ID: string;
  TABS_ID: string;
  PAYMENT_TAB_LABEL: string;
  REGISTER_ID: string;
  REGISTER_CURRENT_ID: string;
  SAVE_DRAFT_ID: string;
  getPendingPredocCount: () => number;
  isPaymentTabActive: () => boolean;
  hasPendingPredocs: () => boolean;
  refreshState: () => void;
  destroy: () => void;
};

const script = readFileSync(extensionFixturePath('siafi-predoc-alert.js'), 'utf8');

function rowHtml(index: number, filled = false) {
  return `<tr>
    <td>05340639000130</td>
    <td><input id="form_manterDocumentoHabil:lista_DPgtoOB:${index}:btnPredoc" class="botaoPredoc${filled ? ' checked' : ''}" type="button" value="Pré-Doc" /></td>
    ${filled ? '<td><input id="form_manterDocumentoHabil:lista_DPgtoOB:' + index + ':excluirPredoc_btn" type="button" title="Excluir Pré-doc" /></td>' : ''}
  </tr>`;
}

function renderPage(rows = rowHtml(0), activeTab = 'Dados de Pagamento') {
  const isActive = (label: string) => (activeTab === label ? 'class="ui-tabs-selected ui-state-active" aria-selected="true"' : '');
  document.body.innerHTML = `
    <form id="form_manterDocumentoHabil">
      <div id="form_manterDocumentoHabil:abasDocHabil">
        <input id="form_manterDocumentoHabil:abaDadosBasicosId" type="button" value="Dados Básicos" ${isActive('Dados Básicos')} />
        <input id="form_manterDocumentoHabil:abaDadosPagamentoId" type="button" value="Dados de Pagamento" ${isActive('Dados de Pagamento')} />
        <input id="form_manterDocumentoHabil:abaDetacustos" type="button" value="Detacustos" ${isActive('Detacustos')} />
      </div>
      <div id="form_manterDocumentoHabil:lista_DPgtoOB"><table><tbody>${rows}</tbody></table></div>
      <div id="form_manterDocumentoHabil:lista_DPgtoOB_painel">
        <input id="form_manterDocumentoHabil:lista_DPgtoOB_painel_confirmar" type="button" value="Confirmar" />
        <input id="form_manterDocumentoHabil:lista_DPgtoOB_painel_cancelar" type="button" value="Descartar" />
      </div>
      <input id="form_manterDocumentoHabil:btnRegistrarAlteracaoDocumentoHabil" type="button" value="Registrar Alterações" />
      <input id="form_manterDocumentoHabil:btnRegistrar" type="button" value="Registrar" />
      <input id="form_manterDocumentoHabil:salvarRascunho_botao" type="button" value="Salvar Rascunho" />
      <input id="form_manterDocumentoHabil:btnCancelarAlteracaoDocumentoHabil" type="button" value="Cancelar Alterações" />
      <input id="form_manterDocumentoHabil:btnVerificarConsistencia" type="button" value="Verificar Consistência" />
    </form>
  `;
}

function loadScript() {
  const testWindow = window as typeof window & {
    __SIAGES_SIAFI_PREDOC_ALERT_TEST__?: boolean;
    __siagesSiafiPredocAlert?: PredocApi;
    __siagesSiafiPredocAlertLoaded?: boolean;
  };
  testWindow.__SIAGES_SIAFI_PREDOC_ALERT_TEST__ = true;
  delete testWindow.__siagesSiafiPredocAlert;
  delete testWindow.__siagesSiafiPredocAlertLoaded;
  window.eval(script);
  return testWindow.__siagesSiafiPredocAlert as PredocApi;
}

function clickById(id: string) {
  (document.getElementById(id) as HTMLInputElement)?.click();
}

describe('guardião de pré-doc do SIAFI', () => {
  beforeEach(() => {
    const previous = (window as typeof window & { __siagesSiafiPredocAlert?: PredocApi }).__siagesSiafiPredocAlert;
    previous?.destroy();
    renderPage();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    const current = (window as typeof window & { __siagesSiafiPredocAlert?: PredocApi }).__siagesSiafiPredocAlert;
    current?.destroy();
  });

  it('identifica qualquer linha sem pré-doc', () => {
    const api = loadScript();
    expect(api.PAYMENT_TAB_LABEL).toBe('Dados de Pagamento');
    expect(api.isPaymentTabActive()).toBe(true);
    expect(api.getPendingPredocCount()).toBe(1);
    expect(api.hasPendingPredocs()).toBe(true);

    document.querySelector('tbody')?.insertAdjacentHTML('beforeend', rowHtml(1, true));
    api.refreshState();
    expect(api.getPendingPredocCount()).toBe(1);
  });

  it('não alerta quando todas as linhas estão preenchidas', () => {
    renderPage(rowHtml(0, true));
    const api = loadScript();
    expect(api.getPendingPredocCount()).toBe(0);
    expect(api.hasPendingPredocs()).toBe(false);
  });

  it('bloqueia a troca de aba até a decisão do usuário', async () => {
    const handler = vi.fn();
    document.querySelector('#form_manterDocumentoHabil\\:abaDetacustos')?.addEventListener('click', handler);
    loadScript();

    clickById('form_manterDocumentoHabil:abaDetacustos');
    expect(handler).not.toHaveBeenCalled();
    expect(document.getElementById('suape-siafi-predoc-overlay')).not.toHaveAttribute('hidden');

    (document.querySelector('[data-action="continue"]') as HTMLButtonElement)?.click();
    await Promise.resolve();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('não alerta nem bloqueia ações quando outra aba está ativa', () => {
    renderPage(rowHtml(0), 'Detacustos');
    const registerHandler = vi.fn();
    document.querySelector('#form_manterDocumentoHabil\\:btnRegistrarAlteracaoDocumentoHabil')?.addEventListener('click', registerHandler);
    const api = loadScript();

    expect(api.isPaymentTabActive()).toBe(false);
    expect(api.hasPendingPredocs()).toBe(false);

    clickById('form_manterDocumentoHabil:btnRegistrarAlteracaoDocumentoHabil');
    expect(registerHandler).toHaveBeenCalledTimes(1);
    expect(document.getElementById('suape-siafi-predoc-overlay')).toHaveAttribute('hidden');

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('bloqueia Registrar Alterações, mas permite a consistência', () => {
    const registerHandler = vi.fn();
    const consistencyHandler = vi.fn();
    document.querySelector('#form_manterDocumentoHabil\\:btnRegistrarAlteracaoDocumentoHabil')?.addEventListener('click', registerHandler);
    document.querySelector('#form_manterDocumentoHabil\\:btnVerificarConsistencia')?.addEventListener('click', consistencyHandler);
    loadScript();

    clickById('form_manterDocumentoHabil:btnRegistrarAlteracaoDocumentoHabil');
    clickById('form_manterDocumentoHabil:btnVerificarConsistencia');

    expect(registerHandler).not.toHaveBeenCalled();
    expect(consistencyHandler).toHaveBeenCalledTimes(1);
  });

  it('permite Confirmar e Descartar da edição da lista de favorecidos', () => {
    const confirmHandler = vi.fn();
    const discardHandler = vi.fn();
    document.getElementById('form_manterDocumentoHabil:lista_DPgtoOB_painel_confirmar')?.addEventListener('click', confirmHandler);
    document.getElementById('form_manterDocumentoHabil:lista_DPgtoOB_painel_cancelar')?.addEventListener('click', discardHandler);
    loadScript();

    clickById('form_manterDocumentoHabil:lista_DPgtoOB_painel_confirmar');
    clickById('form_manterDocumentoHabil:lista_DPgtoOB_painel_cancelar');

    expect(confirmHandler).toHaveBeenCalledTimes(1);
    expect(discardHandler).toHaveBeenCalledTimes(1);
    expect(document.getElementById('suape-siafi-predoc-overlay')).toHaveAttribute('hidden');
  });

  it('protege Registrar e Salvar Rascunho nos IDs atuais do SIAFI', () => {
    const registerHandler = vi.fn();
    const draftHandler = vi.fn();
    document.getElementById('form_manterDocumentoHabil:btnRegistrar')?.addEventListener('click', registerHandler);
    document.getElementById('form_manterDocumentoHabil:salvarRascunho_botao')?.addEventListener('click', draftHandler);
    loadScript();

    clickById('form_manterDocumentoHabil:btnRegistrar');
    expect(registerHandler).not.toHaveBeenCalled();
    (document.querySelector('[data-action="stay"]') as HTMLButtonElement)?.click();

    clickById('form_manterDocumentoHabil:salvarRascunho_botao');
    expect(draftHandler).not.toHaveBeenCalled();
  });

  it('protege a saída do navegador enquanto houver pendência', () => {
    loadScript();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
