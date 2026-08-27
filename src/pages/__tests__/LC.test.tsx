import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LCPage from '@/pages/LC';
import { loadLcSavedLists } from '@/lib/lcSavedLists';
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

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockedLoadLatestLCRowsFromDb = vi.mocked(loadLatestLCRowsFromDb);
const mockedExtractBolsistasFromPdfFiles = vi.mocked(extractBolsistasFromPdfFiles);
const mockedCompararBolsistasComLC = vi.mocked(compararBolsistasComLC);

describe('LCPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
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

    expect(loadLcSavedLists()).toEqual([
      expect.objectContaining({
        name: 'Pagamento de agosto',
        rows: [expect.objectContaining({ cpf: '12345678901', selectedConta: '020846728' })],
      }),
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
});
