import { act, render, waitFor } from '@testing-library/react';

import {
  SUAP_EXTENSION_ORIGIN,
  SUAP_EXTENSION_PROCESS_FINANCE_SUMMARY_TYPE,
  SUAP_EXTENSION_PROCESS_INFO_READY_MESSAGE,
} from '@/lib/suapExtensionDispatch';
import SuapExtensionProcessInfo from '@/pages/SuapExtensionProcessInfo';
import { supabase } from '@/lib/supabase';
import { suapProcessFinanceService } from '@/services/suapProcessFinance';
import { suapProcessosService } from '@/services/suapProcessos';
import { suapScraperService } from '@/services/suapScraperService';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      setSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null }),
      stopAutoRefresh: vi.fn(),
    },
  },
}));

vi.mock('@/services/suapProcessFinance', async () => {
  const actual = await vi.importActual<typeof import('@/services/suapProcessFinance')>('@/services/suapProcessFinance');
  return {
    ...actual,
    suapProcessFinanceService: { getSummaryBySuapId: vi.fn() },
  };
});

vi.mock('@/services/suapProcessos', () => ({
  suapProcessosService: { getBySuapId: vi.fn() },
}));

vi.mock('@/services/suapScraperService', () => ({
  suapScraperService: {
    syncProcessListInSupabase: vi.fn(),
    storePdfBytesForProcess: vi.fn(),
    runAiExtractionForProcess: vi.fn(),
  },
}));

const processContext = {
  source: 'siages-suap-extension',
  type: 'siages:suap-process-context',
  version: 1,
  payload: {
    suapId: '987',
    processNumber: '23035.000987.2026-11',
    processUrl: 'https://suap.ifrn.edu.br/processo_eletronico/processo/987/',
    extensionSession: {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    },
  },
};

async function sendContext(data = processContext, origin = SUAP_EXTENSION_ORIGIN) {
  await act(async () => {
    window.dispatchEvent(new MessageEvent('message', { origin, source: window.parent, data }));
  });
}

describe('SuapExtensionProcessInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(suapProcessosService.getBySuapId).mockResolvedValue({
      id: 'process-1',
      suapId: '987',
      url: processContext.payload.processUrl,
      status: 'success',
      numProcesso: processContext.payload.processNumber,
    });
  });

  it('avisa a extensao quando esta pronto para receber o contexto', () => {
    const postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => undefined);

    render(<SuapExtensionProcessInfo />);

    expect(postMessage).toHaveBeenCalledWith(SUAP_EXTENSION_PROCESS_INFO_READY_MESSAGE, SUAP_EXTENSION_ORIGIN);
    postMessage.mockRestore();
  });

  it('usa a sessao privada da extensao para consultar e enviar o resumo financeiro', async () => {
    const summary = {
      status: 'ready' as const,
      escopoContrato: true,
      contrato: { numero: '00040/2026' },
      totais: { empenhado: 1000, saldo: 700 },
      empenhos: [],
    };
    vi.mocked(suapProcessFinanceService.getSummaryBySuapId).mockResolvedValue(summary);
    const postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => undefined);

    render(<SuapExtensionProcessInfo />);
    await sendContext();

    await waitFor(() => expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    }));
    expect(supabase.auth.stopAutoRefresh).toHaveBeenCalledOnce();
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

  it('cadastra um processo ausente antes de publicar os dados', async () => {
    vi.mocked(suapProcessosService.getBySuapId)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        id: 'process-1',
        suapId: '987',
        url: processContext.payload.processUrl,
        status: 'success',
        numProcesso: processContext.payload.processNumber,
      });
    vi.mocked(suapProcessFinanceService.getSummaryBySuapId).mockResolvedValue({
      status: 'not-found', escopoContrato: false, contrato: null, totais: null, empenhos: [],
    });

    render(<SuapExtensionProcessInfo />);
    await sendContext();

    await waitFor(() => expect(suapScraperService.syncProcessListInSupabase).toHaveBeenCalledWith([{
      suapId: '987',
      numProcesso: processContext.payload.processNumber,
      url: processContext.payload.processUrl,
    }], 'user-1'));
    expect(suapProcessosService.getBySuapId).toHaveBeenCalledTimes(2);
  });
});
