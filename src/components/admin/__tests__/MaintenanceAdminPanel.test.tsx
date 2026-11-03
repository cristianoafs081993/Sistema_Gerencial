import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MaintenanceAdminPanel } from '../MaintenanceAdminPanel';
import * as MaintenanceContextModule from '@/contexts/MaintenanceContext';

describe('MaintenanceAdminPanel', () => {
  const mockToggleMaintenance = vi.fn();
  const mockUpdateSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza o painel com o status de manutencao ativado', () => {
    vi.spyOn(MaintenanceContextModule, 'useMaintenance').mockReturnValue({
      settings: {
        enabled: true,
        title: 'Sistema em Manutenção',
        subtitle: 'Subtítulo',
        description: 'Descrição de teste',
        estimatedReturn: 'Previsão às 16h',
        bypassSecret: 'siages',
      },
      isLoading: false,
      isMaintenanceBlocking: false,
      toggleMaintenance: mockToggleMaintenance,
      updateSettings: mockUpdateSettings,
      hasBypass: false,
    });

    render(<MaintenanceAdminPanel />);

    expect(screen.getByText(/Modo de Manutenção do Sistema/i)).toBeInTheDocument();
    expect(screen.getByText(/Status: Em Manutenção/i)).toBeInTheDocument();
    expect(screen.getByText(/Bloqueio ativo para usuários/i)).toBeInTheDocument();
    expect(screen.getByText(/Chave de bypass técnico:/i)).toBeInTheDocument();
  });

  it('permite alternar o status de manutencao via switch', async () => {
    vi.spyOn(MaintenanceContextModule, 'useMaintenance').mockReturnValue({
      settings: {
        enabled: false,
        title: 'Sistema em Manutenção',
        subtitle: 'Subtítulo',
        description: 'Descrição',
        estimatedReturn: 'Previsão',
        bypassSecret: 'siages',
      },
      isLoading: false,
      isMaintenanceBlocking: false,
      toggleMaintenance: mockToggleMaintenance,
      updateSettings: mockUpdateSettings,
      hasBypass: false,
    });

    render(<MaintenanceAdminPanel />);

    expect(screen.getByText(/Status: Sistema Online/i)).toBeInTheDocument();
    expect(screen.getByText(/Acesso liberado/i)).toBeInTheDocument();

    const toggleSwitch = screen.getByRole('switch');
    fireEvent.click(toggleSwitch);

    expect(mockToggleMaintenance).toHaveBeenCalledWith(true);
  });

  it('permite abrir personalizacao de mensagens e salvar', async () => {
    vi.spyOn(MaintenanceContextModule, 'useMaintenance').mockReturnValue({
      settings: {
        enabled: true,
        title: 'Sistema em Manutenção',
        subtitle: 'Subtítulo',
        description: 'Descrição de teste',
        estimatedReturn: 'Previsão às 16h',
        bypassSecret: 'siages',
      },
      isLoading: false,
      isMaintenanceBlocking: false,
      toggleMaintenance: mockToggleMaintenance,
      updateSettings: mockUpdateSettings,
      hasBypass: false,
    });

    render(<MaintenanceAdminPanel />);

    const customizeButton = screen.getByRole('button', {
      name: /Personalizar mensagens da página/i,
    });
    fireEvent.click(customizeButton);

    expect(screen.getByLabelText(/Título Principal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Previsão de Retorno/i)).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: /Salvar Mensagens/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalled();
    });
  });
});
