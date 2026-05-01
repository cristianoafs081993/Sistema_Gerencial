import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Empenhos from '@/pages/Empenhos';
import { useData } from '@/contexts/DataContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useUserFavorites } from '@/services/userFavorites';
import type { Empenho } from '@/types';

vi.mock('@/contexts/DataContext', () => ({
  useData: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isSuperAdmin: false }),
}));

vi.mock('@/services/userFavorites', () => ({
  useUserFavorites: vi.fn(),
}));

vi.mock('@/components/HeaderParts', () => ({
  HeaderActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/JsonImportDialog', () => ({
  JsonImportDialog: () => null,
}));

vi.mock('@/components/modals/EmpenhoDialog', () => ({
  EmpenhoDialog: () => null,
}));

const mockedUseData = vi.mocked(useData);
const mockedUseUserFavorites = vi.mocked(useUserFavorites);

const renderEmpenhos = () =>
  render(
    <TooltipProvider>
      <Empenhos />
    </TooltipProvider>,
  );

const createEmpenho = (overrides: Partial<Empenho>): Empenho => ({
  id: 'empenho-1',
  numero: '2026NE000001',
  descricao: 'Empenho teste',
  valor: 100,
  dimensao: 'AD - Administração',
  componenteFuncional: 'Contratos',
  origemRecurso: 'Tesouro',
  naturezaDespesa: '339039',
  planoInterno: 'PI-AD',
  favorecidoNome: 'Fornecedor Teste',
  favorecidoDocumento: '11222333000144',
  tipo: 'exercicio',
  dataEmpenho: new Date('2026-02-10'),
  status: 'pendente',
  createdAt: new Date('2026-02-10'),
  updatedAt: new Date('2026-02-10'),
  ...overrides,
});

describe('Empenhos', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseData.mockReturnValue({
      atividades: [],
      empenhos: [
        createEmpenho({ id: 'empenho-favorito', numero: '2026NE000001', favorecidoNome: 'Fornecedor Favorito' }),
        createEmpenho({ id: 'empenho-comum', numero: '2026NE000002', favorecidoNome: 'Fornecedor Comum' }),
      ],
      descentralizacoes: [],
      contaDescentralizacoes: [],
      contratos: [],
      contratosEmpenhos: [],
      creditosDisponiveis: [],
      isLoading: false,
      addAtividade: vi.fn(),
      updateAtividade: vi.fn(),
      deleteAtividade: vi.fn(),
      addEmpenho: vi.fn(),
      updateEmpenho: vi.fn(),
      deleteEmpenho: vi.fn(),
      addDescentralizacao: vi.fn(),
      updateDescentralizacao: vi.fn(),
      deleteDescentralizacao: vi.fn(),
      getResumoOrcamentario: vi.fn(),
      getTotalPlanejado: vi.fn(),
      getTotalEmpenhado: vi.fn(),
      getTotalDescentralizado: vi.fn(),
      getADescentralizar: vi.fn(),
      getSaldoTotal: vi.fn(),
      refreshData: vi.fn(),
    });

    mockedUseUserFavorites.mockReturnValue({
      favorites: [],
      favoriteIdsByType: {
        empenho: new Set(['empenho-favorito']),
        contrato: new Set(),
      },
      isLoading: false,
      isPending: false,
      isFavorite: (entityType, entityId) => entityType === 'empenho' && entityId === 'empenho-favorito',
      toggleFavorite: vi.fn(),
    });
  });

  it('filtra empenhos favoritos sem quebrar a tabela de execucao', () => {
    renderEmpenhos();

    expect(screen.getByText('2026NE000001')).toBeInTheDocument();
    expect(screen.getByText('2026NE000002')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Favoritos$/i }));

    expect(screen.getByText('2026NE000001')).toBeInTheDocument();
    expect(screen.queryByText('2026NE000002')).not.toBeInTheDocument();
  });
});
