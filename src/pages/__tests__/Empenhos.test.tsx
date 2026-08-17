import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Empenhos from '@/pages/Empenhos';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useUserFavorites } from '@/services/userFavorites';
import type { Empenho } from '@/types';

vi.mock('@/contexts/DataContext', () => ({
  useData: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
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
const mockedUseAuth = vi.mocked(useAuth);
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
    mockedUseAuth.mockReturnValue({ isSuperAdmin: false } as never);

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
      creditosDisponiveis: [
        {
          id: 'credito-legado',
          ptres: '230446',
          metrica: 'Saldo',
          valor: 75867,
          updated_at: '2026-05-27T10:00:00.000Z',
        },
      ],
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

  it('nao exibe credito disponivel nem importacao legada na tela de empenhos', () => {
    mockedUseAuth.mockReturnValue({ isSuperAdmin: true } as never);
    renderEmpenhos();

    expect(screen.queryByText('Crédito Disponível')).not.toBeInTheDocument();
    expect(screen.queryByText('R$ 75.867,00')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Importar Crédito/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Importar Empenhos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Importar Saldo RAP/i })).toBeInTheDocument();
  });

  it('exibe a previa da descricao e metadados na tabela de execucao do ano atual', () => {
    renderEmpenhos();

    expect(screen.getAllByText('Descrição')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Empenho teste')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Tesouro • PI: PI-AD')[0]).toBeInTheDocument();
  });

  it('alterna entre as abas de execucao e restos a pagar usando o layout folder tab', () => {
    renderEmpenhos();

    const restosTab = screen.getByRole('button', { name: /^Restos a Pagar/i });
    expect(restosTab).toBeInTheDocument();

    fireEvent.click(restosTab);
    expect(screen.getByText('Nenhum empenho encontrado.')).toBeInTheDocument();
  });
});
