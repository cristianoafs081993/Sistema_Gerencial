import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AIAssistantWidget } from '@/components/ai/AIAssistantWidget';
import { useAuth } from '@/contexts/AuthContext';
import { assistenteGerencialService } from '@/services/assistenteGerencial';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/assistenteGerencial', () => ({
  assistenteGerencialService: {
    perguntar: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedPerguntar = vi.mocked(assistenteGerencialService.perguntar);


describe('AIAssistantWidget', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'user@ifrn.edu.br' } as never,
    } as never);
  });

  it('abre o painel global e exibe sugestoes iniciais', () => {
    render(<AIAssistantWidget />);

    fireEvent.click(screen.getByLabelText('Abrir Assistente Gerencial'));

    expect(screen.getByText('Assistente Gerencial IA')).toBeInTheDocument();
    expect(screen.getByText(/Sou o Assistente Gerencial/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Pergunta para o Assistente Gerencial')).toBeInTheDocument();
  });




  it('envia pergunta e persiste resposta no historico local', async () => {
    mockedPerguntar.mockResolvedValueOnce({
      resposta: 'O saldo disponivel esta concentrado em PTRES especificos.',
      sugestoes: ['Detalhar por PTRES'],
      modelo: 'gemini-2.5-flash-lite',
      avisos: [],
      fontes: [{ label: 'creditos_disponiveis', totalAmostra: 4, totalDisponivel: 4 }],
    });

    render(<AIAssistantWidget />);

    fireEvent.click(screen.getByLabelText('Abrir Assistente Gerencial'));
    fireEvent.change(screen.getByLabelText('Pergunta para o Assistente Gerencial'), {
      target: { value: 'Qual o saldo?' },
    });
    fireEvent.click(screen.getByLabelText('Enviar pergunta'));

    await waitFor(() => {
      expect(screen.getByText('O saldo disponivel esta concentrado em PTRES especificos.')).toBeInTheDocument();
    });
    expect(screen.getByText(/Fontes: creditos_disponiveis \(4\)/)).toBeInTheDocument();

    expect(mockedPerguntar).toHaveBeenCalledWith(
      expect.objectContaining({
        pergunta: 'Qual o saldo?',
      }),
    );

    const stored = window.localStorage.getItem(window.localStorage.key(0) || '');
    expect(stored).toContain('Qual o saldo?');
  });

  it('renderiza o card de pesquisa de precos e acoes normativas quando retornado pelo assistente', async () => {
    mockedPerguntar.mockResolvedValueOnce({
      resposta: 'Pesquisa de precos realizada com sucesso.',
      sugestoes: ['Baixar o Mapa Comparativo em PDF'],
      modelo: 'gemini-2.5-flash',
      avisos: [],
      fontes: [{ label: 'Compras.gov.br', totalAmostra: 3 }],
      priceResearchResult: {
        title: 'Pesquisa de Preços - Monitores',
        demandSummary: '50 UN de Monitores 27 pol 4K',
        researchDate: '2026-09-02',
        calculationMethod: 'median',
        overallEstimatedTotal: 55000,
        complianceValid: true,
        complianceNotes: ['Cesta homogênea de preços (CV ≤ 25%).'],
        items: [
          {
            itemNumber: '1',
            description: 'Monitor 27 polegadas 4K',
            catalogType: 'material',
            catalogCode: '12345',
            quantity: 50,
            unit: 'UN',
            estimatedUnitPrice: 1100,
            estimatedTotal: 55000,
            method: 'median',
            coefficientOfVariation: 8.5,
            standardDeviation: 93.5,
            minimumPrice: 1000,
            maximumPrice: 1200,
            meanPrice: 1100,
            medianPrice: 1100,
            candidatesCount: 3,
            selectedCount: 3,
            candidates: [
              {
                id: 'cand-1',
                supplierName: 'Tech Info LTDA',
                supplierDocument: '12.345.678/0001-90',
                agencyName: 'IFRN Campus Natal',
                purchaseId: '10877412000168-1-000001/2026',
                purchaseDate: '2026-02-15',
                unitPrice: 1100,
                comparableUnitPrice: 1100,
                originalUnitLabel: 'UN',
                unitCompatible: true,
                selected: true,
                exclusionReason: '',
                pncpUrl: 'https://pncp.gov.br/app/editais/10877412000168/2026/1',
                editalAudited: true,
                editalPage: 'Pág. 14, Item 3',
                editalScore: 95,
                compatibility: 'COMPATIVEL',
                technicalJustification: 'Especificações técnicas aderentes.',
              },
            ],
          },
        ],
      },
    });

    render(<AIAssistantWidget />);

    fireEvent.click(screen.getByLabelText('Abrir Assistente Gerencial'));
    fireEvent.change(screen.getByLabelText('Pergunta para o Assistente Gerencial'), {
      target: { value: 'Pesquisar precos para 50 monitores' },
    });
    fireEvent.click(screen.getByLabelText('Enviar pergunta'));

    await waitFor(() => {
      expect(screen.getByText('Pesquisa de Preços Normativa (IN 65/2021)')).toBeInTheDocument();
    });

    expect(screen.getByText('Monitor 27 polegadas 4K')).toBeInTheDocument();
    expect(screen.getByText('Mapa Comparativo (PDF)')).toBeInTheDocument();
    expect(screen.getByText('Despacho SUAP')).toBeInTheDocument();
    expect(screen.getByText('Excel (.xlsx)')).toBeInTheDocument();
  });
});
