import { act, render, screen, waitFor } from '@testing-library/react';

import { SUAP_EXTENSION_DISPATCH_READY_MESSAGE, SUAP_EXTENSION_ORIGIN } from '@/lib/suapExtensionDispatch';
import SuapExtensionDispatch from '@/pages/SuapExtensionDispatch';
import { suapProcessosService } from '@/services/suapProcessos';
import type { SuapProcesso } from '@/types';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/services/suapProcessos', () => ({ suapProcessosService: { getBySuapId: vi.fn() } }));
vi.mock('@/components/suap/SuapDocumentGeneratorDialog', () => ({
  SuapDocumentGeneratorDialog: ({ processos, queue }: { processos: SuapProcesso[]; queue: { items: Array<{ standalone?: boolean; manualFields?: { processo: string } }> } }) => (
    <div data-testid="dispatch-dialog" data-process-id={processos[0]?.id || ''} data-standalone={String(Boolean(queue.items[0]?.standalone))} data-process-number={queue.items[0]?.manualFields?.processo || ''} />
  ),
}));

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

async function sendContext(data = processContext, origin = 'https://suap.ifrn.edu.br') {
  await act(async () => {
    window.dispatchEvent(new MessageEvent('message', { origin, source: window.parent, data }));
  });
}

describe('SuapExtensionDispatch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('avisa a extensao quando esta pronto para receber o contexto', () => {
    const postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => undefined);

    render(<SuapExtensionDispatch />);

    expect(postMessage).toHaveBeenCalledWith(SUAP_EXTENSION_DISPATCH_READY_MESSAGE, SUAP_EXTENSION_ORIGIN);
    postMessage.mockRestore();
  });

  it('abre a fila do processo sincronizado a partir do contexto validado', async () => {
    vi.mocked(suapProcessosService.getBySuapId).mockResolvedValue({
      id: 'processo-1', suapId: '987', url: processContext.payload.processUrl, status: 'success',
    });
    render(<SuapExtensionDispatch />);
    await sendContext();

    await waitFor(() => expect(suapProcessosService.getBySuapId).toHaveBeenCalledWith('987'));
    expect(screen.getByTestId('dispatch-dialog')).toHaveAttribute('data-process-id', 'processo-1');
    expect(screen.getByTestId('dispatch-dialog')).toHaveAttribute('data-standalone', 'false');
  });

  it('abre despacho avulso com processo preenchido quando nao houver espelho', async () => {
    vi.mocked(suapProcessosService.getBySuapId).mockResolvedValue(null);
    render(<SuapExtensionDispatch />);
    await sendContext();

    const dialog = await screen.findByTestId('dispatch-dialog');
    expect(dialog).toHaveAttribute('data-standalone', 'true');
    expect(dialog).toHaveAttribute('data-process-number', '23035.000987.2026-11');
  });

  it('ignora mensagem com origem invalida', async () => {
    render(<SuapExtensionDispatch />);
    await sendContext(processContext, 'https://origem-invalida.exemplo');

    await Promise.resolve();
    expect(suapProcessosService.getBySuapId).not.toHaveBeenCalled();
    expect(screen.queryByTestId('dispatch-dialog')).not.toBeInTheDocument();
  });
});