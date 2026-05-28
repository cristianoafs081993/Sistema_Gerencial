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
    ask: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedAsk = vi.mocked(assistenteGerencialService.ask);

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
    expect(screen.getByText('Resumo da execucao')).toBeInTheDocument();
    expect(screen.getByLabelText('Pergunta para o Assistente Gerencial')).toBeInTheDocument();
  });

  it('envia pergunta e persiste resposta no historico local', async () => {
    mockedAsk.mockResolvedValueOnce({
      response: 'O saldo disponivel esta concentrado em PTRES especificos.',
      suggestions: ['Detalhar por PTRES'],
      model: 'gemini-2.5-flash-lite',
      warnings: [],
      sources: [{ label: 'creditos_disponiveis', totalAmostra: 4, totalDisponivel: 4 }],
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

    expect(mockedAsk).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Qual o saldo?',
      }),
    );

    const stored = window.localStorage.getItem(window.localStorage.key(0) || '');
    expect(stored).toContain('Qual o saldo?');
  });
});
