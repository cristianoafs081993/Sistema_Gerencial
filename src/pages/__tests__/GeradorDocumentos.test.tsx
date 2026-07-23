import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { buildSuapCloneUrl } from '@/lib/suapCloneAutomation';
import { copySuapDocumentToClipboard } from '@/lib/suapClipboard';
import GeradorDocumentos from '@/pages/GeradorDocumentos';

vi.mock('@/lib/suapCloneAutomation', async () => {
  const actual = await vi.importActual<typeof import('@/lib/suapCloneAutomation')>('@/lib/suapCloneAutomation');
  return {
    ...actual,
    buildSuapCloneUrl: vi.fn(() => 'https://suap.ifrn.edu.br/documento_eletronico/clonar_documento/1026154/#siagesClone=mock'),
  };
});

vi.mock('@/lib/suapClipboard', () => ({
  copySuapDocumentToClipboard: vi.fn().mockResolvedValue('html'),
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
  },
}));

describe('GeradorDocumentos', () => {
  beforeEach(() => {
    vi.mocked(buildSuapCloneUrl).mockClear();
    vi.mocked(copySuapDocumentToClipboard).mockClear();
  });

  it('oferece finalidade de bolsa sem projeto sem campos de projeto ou edital', () => {
    render(<GeradorDocumentos />);

    fireEvent.click(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('Bolsa sem projeto'));

    expect(screen.getByText('Favorecido (Bolsistas)')).toBeInTheDocument();
    expect(screen.queryByText('Nome do Projeto')).not.toBeInTheDocument();
    expect(screen.queryByText('Identificação do Edital')).not.toBeInTheDocument();
    expect(screen.queryByText('Tipo')).not.toBeInTheDocument();
  });

  it('oferece finalidade de auxilio-transporte sem Favorecido e com label de Empenho(s)', () => {
    render(<GeradorDocumentos />);

    fireEvent.click(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('Auxílio Transporte'));

    expect(screen.queryByText('Favorecido (Bolsistas)')).not.toBeInTheDocument();
    expect(screen.queryByText('Favorecido (Empresa)')).not.toBeInTheDocument();
    expect(screen.getByText('Empenho(s)')).toBeInTheDocument();
    expect(screen.queryByText('Número do Empenho')).not.toBeInTheDocument();
  });

  it('oferece finalidade de PAFE sem Favorecido e com label de Empenho(s)', () => {
    render(<GeradorDocumentos />);

    fireEvent.click(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('Programa de Apoio à Formação Estudantil - PAFE'));

    expect(screen.queryByText('Favorecido (Bolsistas)')).not.toBeInTheDocument();
    expect(screen.queryByText('Favorecido (Empresa)')).not.toBeInTheDocument();
    expect(screen.getByText('Empenho(s)')).toBeInTheDocument();
    expect(screen.queryByText('Número do Empenho')).not.toBeInTheDocument();
  });

  it('oferece finalidade de auxilio-moradia sem Favorecido e com label de Empenho(s)', () => {
    render(<GeradorDocumentos />);

    fireEvent.click(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('Auxílio Moradia'));

    expect(screen.queryByText('Favorecido (Bolsistas)')).not.toBeInTheDocument();
    expect(screen.queryByText('Favorecido (Empresa)')).not.toBeInTheDocument();
    expect(screen.getByText('Empenho(s)')).toBeInTheDocument();
    expect(screen.queryByText('Número do Empenho')).not.toBeInTheDocument();
  });

  it('copia despacho usando o helper de clipboard compativel com SUAP', async () => {
    render(<GeradorDocumentos />);

    fireEvent.click(screen.getByRole('button', { name: /GERAR DESPACHO/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /COPIAR DESPACHO/i })[0]);

    await waitFor(() => expect(copySuapDocumentToClipboard).toHaveBeenCalledTimes(1));
    expect(vi.mocked(copySuapDocumentToClipboard).mock.calls[0][0]).toContain('Assunto:');
  });

  it('clona despacho usando payload de assunto em modo revisao quando usuario nao confirma salvar', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<GeradorDocumentos />);

    fireEvent.click(screen.getByRole('button', { name: /GERAR DESPACHO/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /CLONAR NO SUAP/i })[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(buildSuapCloneUrl).toHaveBeenCalledWith(expect.objectContaining({
      documentType: 'despacho',
      mode: 'review',
      html: expect.stringContaining('Assunto:'),
    }));
    expect(openSpy).toHaveBeenCalledWith(
      'https://suap.ifrn.edu.br/documento_eletronico/clonar_documento/1026154/#siagesClone=mock',
      '_blank',
    );

    openSpy.mockRestore();
    confirmSpy.mockRestore();
  });

  it('clona despacho em modo salvar somente apos confirmacao explicita', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<GeradorDocumentos />);

    fireEvent.click(screen.getByRole('button', { name: /GERAR DESPACHO/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /CLONAR NO SUAP/i })[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(buildSuapCloneUrl).toHaveBeenCalledWith(expect.objectContaining({
      documentType: 'despacho',
      mode: 'save-after-confirmation',
    }));

    openSpy.mockRestore();
    confirmSpy.mockRestore();
  });
});
