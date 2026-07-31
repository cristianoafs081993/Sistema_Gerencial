import { act, render, waitFor } from '@testing-library/react';

import {
  SUAP_EXTENSION_ORIGIN,
  SUAP_EXTENSION_PLAN_SUMMARY_ERROR_TYPE,
  SUAP_EXTENSION_PLAN_SUMMARY_READY_MESSAGE,
  SUAP_EXTENSION_PLAN_SUMMARY_TYPE,
} from '@/lib/suapExtensionDispatch';
import SuapExtensionPlanSummary from '@/pages/SuapExtensionPlanSummary';

const { getAtividadesMock, getDescentralizacoesMock, getEmpenhosMock } = vi.hoisted(() => ({
  getAtividadesMock: vi.fn(),
  getDescentralizacoesMock: vi.fn(),
  getEmpenhosMock: vi.fn(),
}));

vi.mock('@/services/atividades', () => ({ atividadesService: { getAll: getAtividadesMock } }));
vi.mock('@/services/descentralizacoes', () => ({ descentralizacoesService: { getAll: getDescentralizacoesMock } }));
vi.mock('@/services/empenhos', () => ({ empenhosService: { getAll: getEmpenhosMock } }));

const context = {
  source: 'siages-suap-extension',
  type: 'siages:suap-plan-context',
  version: 1,
  payload: { planId: 8, planUrl: 'https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/' },
};

async function sendContext(data = context, origin = SUAP_EXTENSION_ORIGIN) {
  await act(async () => {
    window.dispatchEvent(new MessageEvent('message', { origin, source: window.parent, data }));
  });
}

describe('SuapExtensionPlanSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAtividadesMock.mockResolvedValue([]);
    getDescentralizacoesMock.mockResolvedValue([]);
    getEmpenhosMock.mockResolvedValue([]);
  });

  it('faz o handshake e envia o resumo autenticado ao contexto válido do plano', async () => {
    const postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => undefined);
    render(<SuapExtensionPlanSummary />);

    expect(postMessage).toHaveBeenCalledWith(SUAP_EXTENSION_PLAN_SUMMARY_READY_MESSAGE, SUAP_EXTENSION_ORIGIN);
    await sendContext();

    await waitFor(() => expect(postMessage).toHaveBeenCalledWith({
      source: 'siages', type: SUAP_EXTENSION_PLAN_SUMMARY_TYPE, version: 1,
      payload: { planId: 8, dimensoes: [] },
    }, SUAP_EXTENSION_ORIGIN));
    postMessage.mockRestore();
  });

  it('ignora contexto com origem inválida', async () => {
    const postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => undefined);
    render(<SuapExtensionPlanSummary />);
    await sendContext(context, 'https://invalido.exemplo');

    await Promise.resolve();
    expect(postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: SUAP_EXTENSION_PLAN_SUMMARY_TYPE }), SUAP_EXTENSION_ORIGIN);
    postMessage.mockRestore();
  });

  it('informa falha de consulta ao content script autenticado', async () => {
    getAtividadesMock.mockRejectedValueOnce(new Error('sessao expirada'));
    const postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => undefined);
    render(<SuapExtensionPlanSummary />);
    await sendContext();

    await waitFor(() => expect(postMessage).toHaveBeenCalledWith({
      source: 'siages', type: SUAP_EXTENSION_PLAN_SUMMARY_ERROR_TYPE, version: 1,
      payload: { message: 'Não foi possível consultar o resumo no SIAGES. Tente novamente.' },
    }, SUAP_EXTENSION_ORIGIN));
    postMessage.mockRestore();
  });
});
