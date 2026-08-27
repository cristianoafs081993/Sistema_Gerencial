import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LCPage from '@/pages/LC';
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
  });
});
