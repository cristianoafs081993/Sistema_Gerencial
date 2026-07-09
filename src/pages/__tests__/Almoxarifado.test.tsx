import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '@/contexts/AuthContext';
import Almoxarifado from '@/pages/Almoxarifado';
import { inventoryService } from '@/services/inventory';

vi.mock('@/components/HeaderParts', () => ({
  HeaderActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HeaderSubtitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('@/services/inventory', () => ({
  inventoryService: {
    getContext: vi.fn(),
    getWorkspace: vi.fn(),
    createCatalogItem: vi.fn(),
    postMovement: vi.fn(),
  },
}));

const mockedAuth = vi.mocked(useAuth);
const mockedInventory = vi.mocked(inventoryService);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Almoxarifado /></QueryClientProvider>);
}

describe('Almoxarifado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockReturnValue({ isSuperAdmin: false } as never);
    mockedInventory.getContext.mockResolvedValue({ id: 'entity-1', code: 'DEFAULT', name: 'Entidade', role: 'admin' });
    mockedInventory.getWorkspace.mockResolvedValue({
      units: [{ id: 'unit-1', code: 'UN', name: 'Unidade', decimalPlaces: 0 }],
      warehouses: [{ id: 'warehouse-1', code: 'CENTRAL', name: 'Almoxarifado Central' }],
      items: [{ id: 'item-1', code: 'MAT-001', name: 'Papel A4', itemType: 'consumption', unitId: 'unit-1', unitCode: 'UN' }],
      balances: [{ warehouseId: 'warehouse-1', warehouseName: 'Almoxarifado Central', itemId: 'item-1', itemCode: 'MAT-001', itemName: 'Papel A4', unitCode: 'UN', quantity: 5, inventoryValue: 150, minimumStock: 10, isBlocked: false }],
      movements: [],
    });
  });

  it('exibe saldos, valor e situação crítica', async () => {
    renderPage();
    expect(await screen.findByText('Papel A4')).toBeInTheDocument();
    expect(screen.getByText('MAT-001')).toBeInTheDocument();
    expect(screen.getAllByText('Estoque baixo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 150,00').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Cadastrar item/i })).toBeInTheDocument();
  });

  it('filtra os itens pelo conteúdo pesquisado', async () => {
    renderPage();
    expect(await screen.findByText('Papel A4')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Buscar item ou código'), { target: { value: 'inexistente' } });
    expect(screen.queryByText('Papel A4')).not.toBeInTheDocument();
    expect(screen.getByText('Nenhuma posição de estoque encontrada.')).toBeInTheDocument();
  });

  it('mantém auditor em modo somente leitura', async () => {
    mockedInventory.getContext.mockResolvedValue({ id: 'entity-1', code: 'DEFAULT', name: 'Entidade', role: 'auditor' });
    renderPage();
    await screen.findByText('Papel A4');
    expect(screen.queryByRole('button', { name: /Cadastrar item/i })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /Registrar movimento/i })).toBeDisabled());
  });
});
