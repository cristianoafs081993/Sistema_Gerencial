import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContratosSyncDialog } from '@/components/modals/ContratosSyncDialog';
import { contratosApiService } from '@/services/contratosApi';

vi.mock('@/services/contratosApi', () => ({
  contratosApiService: {
    runSync: vi.fn(),
  },
}));

const mockedContratosApiService = vi.mocked(contratosApiService);

describe('ContratosSyncDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedContratosApiService.runSync.mockResolvedValue({
      totals: {
        contracts_synced: 10,
        derived_active_contracts: 6,
        derived_inactive_contracts: 4,
      },
    });
  });

  it('nao exibe upload manual e dispara sincronizacao via API', async () => {
    const onSyncComplete = vi.fn();

    render(
      <ContratosSyncDialog
        open
        onOpenChange={vi.fn()}
        onSyncComplete={onSyncComplete}
      />,
    );

    expect(screen.queryByText(/Contratos Ativos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vinculos e Valores/i)).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Atualizar agora/i }));

    await waitFor(() => {
      expect(mockedContratosApiService.runSync).toHaveBeenCalledTimes(1);
      expect(onSyncComplete).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText(/Sincronização (?:solicitada|concluída) com sucesso/i)).toBeInTheDocument();
    expect(screen.getByText('Contratos: 10')).toBeInTheDocument();
    expect(screen.getByText('Ativos: 6')).toBeInTheDocument();
    expect(screen.getByText('Inativos: 4')).toBeInTheDocument();
  });
});
