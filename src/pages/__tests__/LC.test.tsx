import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

import LCPage from '@/pages/LC';
import { loadLcSavedLists } from '@/lib/lcSavedLists';
import { loadSharedLcSavedLists, saveSharedLcSavedList } from '@/services/lcSavedListsService';
import { extractBolsistasFromPdfFiles } from '@/services/bolsistasPdfService';
import { compararBolsistasComLC } from '@/services/lcComparisonService';
import { loadLatestLCRowsFromDb } from '@/services/lcImportService';

vi.mock('@/services/lcImportService', () => ({
  loadLatestLCRowsFromDb: vi.fn(),
  parseLCCsv: vi.fn(),
  saveLCRows: vi.fn(),
}));

vi.mock('@/services/bolsistasPdfService', () => ({
  extractBolsistasFromPdfFiles: vi.fn(),
}));

vi.mock('@/services/lcComparisonService', () => ({
  compararBolsistasComLC: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isLoading: false, isAuthenticated: true }),
}));

vi.mock('@/services/lcSavedListsService', () => ({
  loadSharedLcSavedLists: vi.fn(),
  saveSharedLcSavedList: vi.fn(),
  deleteSharedLcSavedList: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

const mockedLoadLatestLCRowsFromDb = vi.mocked(loadLatestLCRowsFromDb);
const mockedExtractBolsistasFromPdfFiles = vi.mocked(extractBolsistasFromPdfFiles);
const mockedCompararBolsistasComLC = vi.mocked(compararBolsistasComLC);
const mockedLoadSharedLcSavedLists = vi.mocked(loadSharedLcSavedLists);
const mockedSaveSharedLcSavedList = vi.mocked(saveSharedLcSavedList);

describe('LCPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockedLoadSharedLcSavedLists.mockResolvedValue([]);
    mockedSaveSharedLcSavedList.mockImplementation(async (input) => ({
      id: '00000000-0000-4000-8000-000000000001',
      name: input.name,
      createdAt: '2026-08-27T12:00:00.000Z',
      updatedAt: '2026-08-27T12:00:00.000Z',
      sourcePdfNames: input.sourcePdfNames,
      rows: input.rows,
    }));
    mockedLoadLatestLCRowsFromDb.mockResolvedValue({
      sourceFile: 'lista-credores.csv',
      rows: [
        {
          obListaCredores: 'OB-1',
          sequencial: 1,
          favorecidoDocumento: '12345678901',
          favorecidoNome: 'Bolsista sem divergência',
          bancoCodigo: '033',
          bancoNome: 'Santander',
          agenciaCodigo: '2979',
          agenciaNome: 'Agência',
          contaBancaria: '020846728',
        },
      ],
    });
    mockedExtractBolsistasFromPdfFiles.mockResolvedValue([
      {
        cpf: '12345678901',
        nome: 'Bolsista sem divergência',
        banco: '033',
        agencia: '2979',
        conta: '020846728',
        sourceFile: 'pagamento.pdf',
        valor: 250,
      },
    ]);
    mockedCompararBolsistasComLC.mockReturnValue([]);
  });

  it('exibe a cópia em conta sem divergência, mas só a habilita após selecionar a linha', async () => {
    const { container } = render(<LCPage />);

    await screen.findByText('Bolsista sem divergência');

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: {
        files: [new File(['pdf'], 'pagamento.pdf', { type: 'application/pdf' })],
      },
    });

    const dialog = await screen.findByRole('dialog');

    await waitFor(() => {
      expect(within(dialog).getAllByTitle('Selecione a linha para copiar')).toHaveLength(4);
    });
    for (const button of within(dialog).getAllByTitle('Selecione a linha para copiar')) {
      expect(button).toBeDisabled();
    }

    const row = within(dialog).getByText('12345678901').closest('tr');
    expect(row).not.toBeNull();
    fireEvent.click(row!);

    expect(within(dialog).getAllByTitle('Copiar')).toHaveLength(4);
    for (const button of within(dialog).getAllByTitle('Copiar')) {
      expect(button).toBeEnabled();
    }

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nome da lista de trabalho' }), {
      target: { value: 'Pagamento de agosto' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar lista' }));

    await waitFor(() => expect(mockedSaveSharedLcSavedList).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Pagamento de agosto',
      rows: [expect.objectContaining({ cpf: '12345678901', selectedConta: '020846728' })],
    })));
    expect(loadLcSavedLists()).toEqual([
      expect.objectContaining({ name: 'Pagamento de agosto' }),
    ]);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Preenchimento SIAFI & Lista de Credores' })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Listas salvas (1)' }));
    const savedListsDialog = await screen.findByRole('dialog', { name: 'Listas de trabalho salvas' });
    expect(within(savedListsDialog).getByText('Pagamento de agosto')).toBeInTheDocument();
    fireEvent.click(within(savedListsDialog).getByRole('button', { name: 'Abrir' }));

    const reopenedDialog = await screen.findByRole('dialog', { name: 'Preenchimento SIAFI & Lista de Credores' });
    expect(within(reopenedDialog).getByRole('textbox', { name: 'Nome da lista de trabalho' })).toHaveValue('Pagamento de agosto');
  });

  it('permite salvar a lista mesmo quando todos os credores têm pendência e a macro fica indisponível', async () => {
    mockedLoadLatestLCRowsFromDb.mockResolvedValue({ sourceFile: 'lista-credores.csv', rows: [] });
    mockedCompararBolsistasComLC.mockReturnValue([{} as never]);

    const { container } = render(<LCPage />);
    await waitFor(() => expect(mockedLoadLatestLCRowsFromDb).toHaveBeenCalled());

    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: {
        files: [new File(['pdf'], 'pagamento.pdf', { type: 'application/pdf' })],
      },
    });

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar lista' }));

    await waitFor(() => expect(mockedSaveSharedLcSavedList).toHaveBeenCalledWith(expect.objectContaining({
      rows: [expect.objectContaining({ cpf: '12345678901', status: 'aluno_nao_encontrado' })],
    })));
  });

  it('sinaliza os bolsistas lidos por OCR na grade e no aviso, destacando CPF com dígito verificador inválido', async () => {
    mockedExtractBolsistasFromPdfFiles.mockResolvedValue([
      {
        cpf: '123.456.789-01', // dígito verificador inválido: provável erro de leitura
        nome: 'Bolsista lida por OCR',
        banco: '033',
        agencia: '2979',
        conta: '020846728',
        sourceFile: 'pagamento.pdf',
        valor: 250,
        ocr: true,
      },
    ]);

    const { container } = render(<LCPage />);
    await waitFor(() => expect(mockedLoadLatestLCRowsFromDb).toHaveBeenCalled());

    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['pdf'], 'pagamento.pdf', { type: 'application/pdf' })] },
    });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('OCR · conferir')).toBeInTheDocument();

    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringMatching(/1 bolsista\(s\) foram lidos de página escaneada \(OCR\).*dígito verificador inválido.*Bolsista lida por OCR/),
      expect.anything(),
    );
    expect(toast.dismiss).toHaveBeenCalledWith('lc-pdf-ocr');
  });

  it('avisa quando o documento declara mais bolsas do que os bolsistas identificados', async () => {
    mockedExtractBolsistasFromPdfFiles.mockImplementation(async (_files, options) => {
      options?.onWarning?.({ sourceFile: 'pagamento.pdf', reason: 'count_mismatch', expected: 5, found: 1 });
      return [
        {
          cpf: '12345678901',
          nome: 'Bolsista sem divergência',
          banco: '033',
          agencia: '2979',
          conta: '020846728',
          sourceFile: 'pagamento.pdf',
          valor: 250,
        },
      ];
    });

    const { container } = render(<LCPage />);
    await waitFor(() => expect(mockedLoadLatestLCRowsFromDb).toHaveBeenCalled());

    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['pdf'], 'pagamento.pdf', { type: 'application/pdf' })] },
    });

    await screen.findByRole('dialog');
    expect(toast.warning).toHaveBeenCalledWith(
      'pagamento.pdf: o documento declara 5 bolsa(s), mas só 1 bolsista(s) foram identificados. Algum aluno ficou de fora — confira o PDF.',
      expect.anything(),
    );
  });

  it('não sinaliza OCR quando todos os dados vêm da camada de texto do PDF', async () => {
    const { container } = render(<LCPage />);
    await waitFor(() => expect(mockedLoadLatestLCRowsFromDb).toHaveBeenCalled());

    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['pdf'], 'pagamento.pdf', { type: 'application/pdf' })] },
    });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByText('OCR · conferir')).not.toBeInTheDocument();
    expect(toast.warning).not.toHaveBeenCalledWith(expect.stringContaining('OCR'), expect.anything());
  });

  it('exibe listas salvas por outro usuário do mesmo órgão', async () => {
    mockedLoadSharedLcSavedLists.mockResolvedValueOnce([
      {
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Lista compartilhada do campus',
        createdAt: '2026-08-27T11:00:00.000Z',
        updatedAt: '2026-08-27T11:00:00.000Z',
        sourcePdfNames: ['pagamento.pdf'],
        rows: [
          {
            id: 'row-1',
            cpf: '12345678901',
            nome: 'Bolsista sem divergência',
            bancoPdf: '033',
            agenciaPdf: '2979',
            contaPdf: '020846728',
            selectedBanco: '033',
            selectedAgencia: '2979',
            selectedConta: '020846728',
            contaPagadora: '00000000000000000000',
            status: 'ok',
            lcAccounts: [],
            originalLcAccounts: [],
          },
        ],
      },
    ]);

    render(<LCPage />);

    const savedListsButton = await screen.findByRole('button', { name: 'Listas salvas (1)' });
    fireEvent.click(savedListsButton);

    const savedListsDialog = await screen.findByRole('dialog', { name: 'Listas de trabalho salvas' });
    expect(within(savedListsDialog).getByText('Lista compartilhada do campus')).toBeInTheDocument();
  });

  describe('lista montada pela extensao (/lc?lista=<id>)', () => {
    const extensionList = {
      id: '00000000-0000-4000-8000-000000000003',
      name: 'Bolsa TAL 2026 - Outubro — 23035.003293.2026-22',
      createdAt: '2026-11-12T10:00:00.000Z',
      updatedAt: '2026-11-12T10:00:00.000Z',
      sourcePdfNames: ['Ofício Nº 156/2026'],
      suapId: '505643',
      processNumber: '23035.003293.2026-22',
      origin: 'extensao' as const,
      extraction: { method: 'ia' as const, documents: [], found: 1, pendencias: 0, warnings: [], builtAt: '2026-11-12T10:00:00.000Z' },
      rows: [{
        id: 'row-1', cpf: '52998224725', nome: 'ALUNA FICTICIA UM', bancoPdf: '001', agenciaPdf: '1234', contaPdf: '123456789',
        selectedBanco: '001', selectedAgencia: '1234', selectedConta: '123456789', contaPagadora: '00001',
        status: 'ok' as const, lcAccounts: [], originalLcAccounts: [], valor: 400, ia: true,
      }],
    };

    afterEach(() => {
      window.history.replaceState(null, '', '/');
    });

    it('abre direto a grade da lista indicada, com o selo de IA, e limpa o parametro da URL', async () => {
      window.history.replaceState(null, '', `/lc?lista=${extensionList.id}`);
      mockedLoadSharedLcSavedLists.mockResolvedValueOnce([extensionList]);

      render(<LCPage />);

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getAllByText(/52998224725/).length).toBeGreaterThan(0);
      expect(within(dialog).getByText('IA · conferir')).toBeInTheDocument();
      expect(window.location.search).toBe('');
    });

    it('avisa quando a lista indicada nao existe mais', async () => {
      window.history.replaceState(null, '', '/lc?lista=00000000-0000-4000-8000-00000000dead');
      mockedLoadSharedLcSavedLists.mockResolvedValueOnce([extensionList]);

      render(<LCPage />);

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('A lista de trabalho indicada não foi encontrada (pode ter sido excluída).'));
    });

    it('mostra a origem da lista no dialogo de listas salvas', async () => {
      mockedLoadSharedLcSavedLists.mockResolvedValueOnce([extensionList]);
      render(<LCPage />);

      fireEvent.click(await screen.findByRole('button', { name: 'Listas salvas (1)' }));
      const savedListsDialog = await screen.findByRole('dialog', { name: 'Listas de trabalho salvas' });
      expect(within(savedListsDialog).getByText(/Montada pela extensão · processo 23035.003293.2026-22 · via IA, conferir/)).toBeInTheDocument();
    });
  });
});
