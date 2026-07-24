import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState, type ReactNode } from 'react';

import { SuapDocumentGeneratorDialog } from '@/components/suap/SuapDocumentGeneratorDialog';
import { buildResolvedContextFromSuapProcess } from '@/lib/documentGeneration';
import { createDispatchQueue, type DispatchQueueState } from '@/lib/suapDispatchGeneration';
import { buildSuapCloneUrl } from '@/lib/suapCloneAutomation';
import { copySuapDocumentToClipboard } from '@/lib/suapClipboard';
import type { SuapProcesso } from '@/types';

const dataContextValue = { empenhos: [], contratos: [], contratosEmpenhos: [] };

vi.mock('@/contexts/DataContext', () => ({
  useData: () => dataContextValue,
}));vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/lib/documentGeneration', () => ({
  buildResolvedContextFromSuapProcess: vi.fn(async (processo: SuapProcesso) => ({
    processo: processo.numProcesso,
    favorecido: processo.beneficiario,
    documentoFavorecido: processo.cpfCnpj,
    tipoPessoa: 'PJ',
    valor: 1250,
    objeto: processo.assunto,
    fields: [],
    missingRequiredFields: [],
    warnings: [],
    matchedFrom: ['Espelho SUAP'],
  })),
  buildDespachoLiquidacaoHtml: vi.fn((context: { favorecido?: string }) => `<p>Despacho para ${context.favorecido || '[favorecido]'}</p>`),
}));

vi.mock('@/components/Editor/RichTextEditor', () => ({
  default: ({ content, onChange }: { content: string; onChange: (html: string) => void }) => (
    <div>
      <div
        aria-label="Conteudo editavel do despacho"
        contentEditable
        suppressContentEditableWarning
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  ),
}));

vi.mock('@/lib/suapClipboard', () => ({
  copySuapDocumentToClipboard: vi.fn().mockResolvedValue('html'),
}));

vi.mock('@/lib/suapCloneAutomation', () => ({
  buildSuapCloneUrl: vi.fn(() => 'https://suap.local/clone'),
}));

const processoCompleto: SuapProcesso = {
  id: 'proc-1', suapId: '1', url: 'https://suap.local/1', status: 'success',
  numProcesso: '23035.000001.2026-11', beneficiario: 'Fornecedor Teste', assunto: 'Servico de apoio',
  dadosCompletos: { val_nf: '1250,00', empenhos: ['2026NE000001'] },
};

function renderDialog(processos: SuapProcesso[], initialQueue = createDispatchQueue(processos)) {
  function Harness() {
    const [queue, setQueue] = useState<DispatchQueueState | null>(initialQueue);
    const [open, setOpen] = useState(true);
    return <SuapDocumentGeneratorDialog open={open} onOpenChange={setOpen} processos={processos} queue={queue} onQueueChange={setQueue} />;
  }
  return render(<Harness />);
}

describe('SuapDocumentGeneratorDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gera despacho assistido sem mostrar o formulario manual', async () => {
    renderDialog([processoCompleto]);

    await waitFor(() => expect(screen.getByLabelText('Previa editavel do despacho')).toHaveTextContent('Fornecedor Teste'));
    expect(screen.queryByText('Preenchimento manual')).not.toBeInTheDocument();
  });

  it('mantem o marcador quando a extracao parcial nao trouxe o campo', async () => {
    renderDialog([{ ...processoCompleto, status: 'incomplete_extraction', beneficiario: undefined }]);

    await waitFor(() => expect(screen.getByLabelText('Previa editavel do despacho')).toHaveTextContent('[favorecido]'));
  });

  it('abre formulario manual para processo ainda sem extracao por IA', () => {
    renderDialog([{ ...processoCompleto, status: 'queued_extraction' }]);

    expect(screen.getAllByText('Preenchimento manual')).toHaveLength(2);
    expect(screen.getByDisplayValue('23035.000001.2026-11')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gerar despacho' }));
    expect(screen.getByLabelText('Previa editavel do despacho')).toBeInTheDocument();
  });

  it('navega e preserva a fila por processo', async () => {
    renderDialog([processoCompleto, { ...processoCompleto, id: 'proc-2', suapId: '2', numProcesso: '23035.000002.2026-12' }]);

    await screen.findByLabelText('Previa editavel do despacho');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Proximo/i })); });
    await screen.findByText('2 de 2 processo(s)');
    await screen.findByLabelText('Previa editavel do despacho');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Anterior/i })); });
    await screen.findByText('1 de 2 processo(s)');
  });

  it('copia e clona o HTML efetivamente editado em modo de revisao', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderDialog([processoCompleto]);

    await screen.findByLabelText('Previa editavel do despacho');
    const editor = screen.getByLabelText('Conteudo editavel do despacho');
    editor.innerHTML = '<p>Despacho revisado</p>';
    fireEvent.input(editor);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    await waitFor(() => expect(copySuapDocumentToClipboard).toHaveBeenCalledWith('<p>Despacho revisado</p>'));

    fireEvent.click(screen.getByRole('button', { name: /Clonar no SUAP/i }));
    expect(buildSuapCloneUrl).toHaveBeenCalledWith({ documentType: 'despacho', html: '<p>Despacho revisado</p>', mode: 'review' });
    expect(openSpy).toHaveBeenCalledWith('https://suap.local/clone', '_blank', 'noopener,noreferrer');

    openSpy.mockRestore();
    confirmSpy.mockRestore();
  });
  it('executes the mixed queue for complete AI, partial AI, and manual entry', async () => {
    const partial = { ...processoCompleto, id: 'proc-2', suapId: '2', status: 'incomplete_extraction', beneficiario: undefined };
    const manual = { ...processoCompleto, id: 'proc-3', suapId: '3', status: 'extraction_failed' };
    renderDialog([processoCompleto, partial, manual]);

    await screen.findByLabelText('Previa editavel do despacho');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Proximo/i })); });
    await waitFor(() => expect(screen.getByLabelText('Previa editavel do despacho')).toHaveTextContent('[favorecido]'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Proximo/i })); });
    await waitFor(() => expect(screen.getAllByText('Preenchimento manual')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Gerar despacho' }));
    expect(screen.getByLabelText('Previa editavel do despacho')).toBeInTheDocument();
  });

  it('allows skipping a process no longer available without interrupting the batch', async () => {
    const queue = createDispatchQueue([{ ...processoCompleto, id: 'ausente' }, processoCompleto]);
    renderDialog([processoCompleto], queue);

    expect(screen.getByText('Este processo nao esta mais disponivel no espelho SUAP.')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Pular/i })); });
    await screen.findByText('2 de 2 processo(s)');
  });

  it('stops an assisted-context error and retries only when requested', async () => {
    vi.mocked(buildResolvedContextFromSuapProcess).mockRejectedValueOnce(new Error('Contexto indisponivel'));
    renderDialog([processoCompleto]);

    await screen.findByText('Contexto indisponivel');
    expect(screen.queryByLabelText('Conteudo editavel do despacho')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/i }));
    await screen.findByLabelText('Previa editavel do despacho');
  });
});
