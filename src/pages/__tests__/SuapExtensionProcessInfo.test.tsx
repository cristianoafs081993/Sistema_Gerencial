import { act, render, waitFor } from '@testing-library/react';

import {
  SUAP_EXTENSION_ORIGIN,
  SUAP_EXTENSION_PROCESS_FINANCE_SUMMARY_TYPE,
  SUAP_EXTENSION_PROCESS_INFO_READY_MESSAGE,
} from '@/lib/suapExtensionDispatch';
import SuapExtensionProcessInfo from '@/pages/SuapExtensionProcessInfo';
import { suapProcessFinanceService } from '@/services/suapProcessFinance';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/services/suapProcessFinance', async () => {
  const actual = await vi.importActual<typeof import('@/services/suapProcessFinance')>('@/services/suapProcessFinance');
  return {
    ...actual,
    suapProcessFinanceService: { getSummaryBySuapId: vi.fn() },
  };
});

const processContext = {
  source: 'siages-suap-extension',
  type: 'siages:suap-process-context',
  version: 1,
  payload: {
    suapId: '987',
    processNumber: '23035.000987.2026-11',
    processUrl: 'https://suap.ifrn.edu.br/processo_eletronico/processo/987/',
  },
};

async function sendContext(data = processContext, origin = SUAP_EXTENSION_ORIGIN) {
  await act(async () => {
    window.dispatchEvent(new MessageEvent('message', { origin, source: window.parent, data }));
  });
}

describe('SuapExtensionProcessInfo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('avisa a extensao quando esta pronto para receber o contexto', () => {
    const postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => undefined);

    render(<SuapExtensionProcessInfo />);

    expect(postMessage).toHaveBeenCalledWith(SUAP_EXTENSION_PROCESS_INFO_READY_MESSAGE, SUAP_EXTENSION_ORIGIN);
    postMessage.mockRestore();
  });

  it('consulta o resumo financeiro e envia o payload para a pagina do SUAP', async () => {
    const summary = {
      status: 'ready' as const,
      escopoContrato: true,
      contrato: { numero: '00040/2026' },
      totais: { empenhado: 1000, liquidado: 300, saldo: 700 },
      empenhos: [],
    };
    vi.mocked(suapProcessFinanceService.getSummaryBySuapId).mockResolvedValue(summary);
    const postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => undefined);

    render(<SuapExtensionProcessInfo />);
    await sendContext();

    await waitFor(() => expect(suapProcessFinanceService.getSummaryBySuapId).toHaveBeenCalledWith('987'));
    expect(postMessage).toHaveBeenCalledWith({
      source: 'siages',
      type: SUAP_EXTENSION_PROCESS_FINANCE_SUMMARY_TYPE,
      version: 1,
      payload: summary,
    }, SUAP_EXTENSION_ORIGIN);
    postMessage.mockRestore();
  });

  it('ignora contexto enviado por outra origem', async () => {
    render(<SuapExtensionProcessInfo />);
    await sendContext(processContext, 'https://origem-invalida.exemplo');

    await Promise.resolve();
    expect(suapProcessFinanceService.getSummaryBySuapId).not.toHaveBeenCalled();
  });
});