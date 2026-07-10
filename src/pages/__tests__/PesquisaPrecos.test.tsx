import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PesquisaPrecos from '@/pages/PesquisaPrecos';
import { findCatalogSuggestions } from '@/lib/priceCatalogClient';
import { parsePriceResearchFile } from '@/lib/priceResearch';
import { priceResearchService } from '@/services/priceResearch';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
  },
}));

vi.mock('@/components/HeaderParts', () => ({
  HeaderActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HeaderSubtitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/priceResearch', async () => {
  const actual = await vi.importActual<typeof import('@/lib/priceResearch')>('@/lib/priceResearch');
  return {
    ...actual,
    parsePriceResearchFile: vi.fn(),
    createPriceResearchTemplate: vi.fn(),
    exportPriceResearchWorkbook: vi.fn(),
  };
});

vi.mock('@/services/priceResearch', () => ({
  priceResearchService: {
    search: vi.fn(),
    listRecent: vi.fn(),
    getById: vi.fn(),
    save: vi.fn(),
  },
}));

vi.mock('@/lib/priceCatalogClient', () => ({
  findCatalogSuggestions: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockedParser = vi.mocked(parsePriceResearchFile);
const mockedService = vi.mocked(priceResearchService);
const mockedCatalogMatcher = vi.mocked(findCatalogSuggestions);

const importedItem = {
  localId: 'item-1',
  itemNumber: '1',
  description: 'Café torrado e moído, pacote de 500 g',
  catalogType: 'material' as const,
  catalogCode: '606523',
  quantity: 100,
  unit: 'PCT',
  targetCapacity: 500,
  targetMeasureUnit: 'G',
  referenceUnitCost: null,
  candidates: [],
  searchStatus: 'idle' as const,
};

const candidate = {
  id: 'comprasgov:1',
  sourceType: 'compras_gov_precos' as const,
  sourceLabel: 'Compras.gov.br - Pesquisa de Preços',
  sourceUrl: 'https://dadosabertos.compras.gov.br/precos',
  pncpSearchUrl: 'https://pncp.gov.br/app/editais?q=1',
  purchaseId: '15836606000012026',
  purchaseItemId: '1',
  purchaseDate: '2026-05-01',
  resultDate: '2026-05-02',
  supplierDocument: '00000000000100',
  supplierName: 'Fornecedor',
  agencyCode: '158366',
  agencyName: 'IFRN',
  state: 'RN',
  municipality: 'Currais Novos',
  description: 'Café torrado e moído',
  detailedDescription: null,
  brand: 'Marca',
  quantity: 100,
  originalUnitPrice: 20,
  comparableUnitPrice: 20,
  originalUnitLabel: 'PCT 500 G',
  unitCompatible: true,
  aiScore: 92,
  aiReason: 'Descrição e unidade compatíveis.',
  selected: true,
  exclusionReason: '',
  rawData: {},
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <PesquisaPrecos />
    </QueryClientProvider>,
  );
  const startBtn = screen.queryByRole('button', { name: /Iniciar Nova Pesquisa/i });
  if (startBtn) {
    fireEvent.click(startBtn);
  }
  return renderResult;
}

describe('PesquisaPrecos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedService.listRecent.mockResolvedValue([]);
    mockedService.search.mockResolvedValue([
      { localId: 'item-1', candidates: [candidate] },
    ]);
    mockedService.save.mockResolvedValue('research-1');
    mockedParser.mockResolvedValue([importedItem]);
    mockedCatalogMatcher.mockResolvedValue([]);
  });

  it('importa a planilha e pesquisa até 15 referências oficiais', async () => {
    const { container } = renderPage();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, {
      target: { files: [new File(['xlsx'], 'custos.xlsx')] },
    });

    expect((await screen.findAllByText('Café torrado e moído, pacote de 500 g'))[0]).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Avançar/i }));

    await waitFor(() => {
      expect(mockedService.search).toHaveBeenCalledWith([
        expect.objectContaining({ catalogCode: '606523', catalogType: 'material' }),
      ]);
    });
    fireEvent.click(await screen.findByRole('button', { name: /Editar Cotações/i }));
    expect(await screen.findByText('Fornecedor')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 20,00').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Métodos de cálculo/i)).toBeInTheDocument();
    expect(screen.getByText(/Dispersão da amostra/i)).toBeInTheDocument();
    expect(screen.getByText(/Coeficiente de variação/i)).toBeInTheDocument();
    expect(screen.getByText(/Média ponderada/i)).toBeInTheDocument();
    expect(screen.getByText(/Média saneada/i)).toBeInTheDocument();
    expect(screen.getByText(/Excluídos/i)).toBeInTheDocument();
  });

  it('permite selecionar arquivo PDF pesquisável', () => {
    const { container } = renderPage();
    expect(container.querySelector('input[type="file"]')).toHaveAttribute('accept', expect.stringContaining('.pdf'));
  });

  it('sugere e permite confirmar CATMAT quando o arquivo não informa código', async () => {
    mockedParser.mockResolvedValue([{ ...importedItem, catalogCode: '' }]);
    mockedCatalogMatcher.mockResolvedValue([
      {
        code: '606523',
        catalogType: 'material',
        description: 'CAFÉ TORRADO E MOÍDO, PACOTE 500 G',
        context: 'ALIMENTOS > CAFÉ',
        score: 96,
        reason: '5 de 5 termos relevantes coincidem. Especificações numéricas coincidem.',
      },
    ]);

    const { container } = renderPage();
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['xlsx'], 'custos.xlsx')] },
    });

    fireEvent.click(await screen.findByText('Café torrado e moído, pacote de 500 g'));

    await waitFor(() => {
      expect(mockedCatalogMatcher).toHaveBeenCalledWith(
        'Café torrado e moído, pacote de 500 g',
        'material',
      );
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Usar este código' }));

    expect(screen.getByDisplayValue('606523')).toBeInTheDocument();
  });

  it('permite excluir um preço e exige justificativa visível', async () => {
    const { container } = renderPage();
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['xlsx'], 'custos.xlsx')] },
    });
    await screen.findAllByText('Café torrado e moído, pacote de 500 g');
    fireEvent.click(screen.getByRole('button', { name: /Avançar/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Editar Cotações/i }));
    await screen.findByText('Fornecedor');

    fireEvent.click(screen.getByRole('checkbox', { name: /Usar preço 1/i }));

    expect(screen.getByLabelText(/Justificativa para desconsiderar 1/i)).toBeInTheDocument();
  });

  it('monta o link correto do PNCP preferindo o ano da data real do candidato em vez de 2030 do purchaseId', async () => {
    const candidateWithMismatchedYear = {
      ...candidate,
      purchaseId: '93153605000522030', // Ano fatiado seria 2030
      purchaseDate: '2026-05-01', // Ano da data real é 2026
      agencyCode: '931536',
      pncpSearchUrl: 'https://pncp.gov.br/app/editais?q=931536%2052%2F2030', // Fallback inicial
    };

    mockedService.search.mockResolvedValue([
      { localId: 'item-1', candidates: [candidateWithMismatchedYear] },
    ]);

    const { supabase } = await import('@/lib/supabase');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({
          data: [
            {
              numero_controle_pncp: '51792919000104-1-000052/2026',
              uasg_codigo: '931536',
              numero_compra: '00052',
              ano_compra: 2026,
            },
          ],
          error: null,
        })),
      })),
    } as any);

    const { container } = renderPage();
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['xlsx'], 'custos.xlsx')] },
    });

    await screen.findAllByText('Café torrado e moído, pacote de 500 g');
    fireEvent.click(screen.getByRole('button', { name: /Avançar/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Editar Cotações/i }));
    await screen.findByText('Fornecedor');

    // Verifica que o link do PNCP montado no front-end aponta para o ano correto (2026) e tem o CNPJ resolvido
    const pncpLink = screen.getByRole('link', { name: /pncp/i });
    expect(pncpLink).toHaveAttribute(
      'href',
      'https://pncp.gov.br/app/editais/51792919000104/2026/52',
    );
  });
});
