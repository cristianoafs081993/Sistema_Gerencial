import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { EmpenhoDialog } from '@/components/modals/EmpenhoDialog';
import { transparenciaService } from '@/services/transparencia';
import type { DocumentoDespesa, Empenho } from '@/types';

vi.mock('@/services/transparencia', () => ({
  transparenciaService: {
    getDocumentosPorEmpenho: vi.fn(),
  },
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogTitle: ({ children, className }: { children: ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
  DialogFooter: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children, className }: { children: ReactNode; className?: string }) => (
    <button type="button" className={className}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

const mockedTransparenciaService = vi.mocked(transparenciaService);

const empenhoBase: Empenho = {
  id: 'emp-1',
  numero: '2026NE000002',
  descricao: 'Recurso para pagamento de diarias para convocacoes oficiais ou viagens a servico.',
  valor: 25000,
  valorLiquidado: 4713.17,
  valorPagoOficial: 4713.17,
  dimensao: 'AD - Administração',
  componenteFuncional: 'Contratos',
  origemRecurso: '158366',
  naturezaDespesa: '339014',
  favorecidoNome: 'INST.FED.DO RN/CAMPUS CURRAIS NOVOS',
  favorecidoDocumento: '158366',
  dataEmpenho: new Date('2026-02-03T12:00:00'),
  status: 'pendente',
  tipo: 'exercicio',
  processo: '23035.000147.2026-45',
  historicoOperacoes: [
    {
      data: '24/02/2026',
      operacao: 'INCLUSAO',
      quantidade: 1,
      valorUnitario: 14200,
      valorTotal: 14200,
    },
  ],
  createdAt: new Date('2026-02-03T12:00:00'),
  updatedAt: new Date('2026-02-03T12:00:00'),
};

const renderDialog = (documentos: DocumentoDespesa[]) => {
  mockedTransparenciaService.getDocumentosPorEmpenho.mockResolvedValue(documentos);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <EmpenhoDialog
        open
        onOpenChange={vi.fn()}
        empenho={empenhoBase}
        atividades={[]}
        onSave={vi.fn()}
      />
    </QueryClientProvider>,
  );
};

describe('EmpenhoDialog', () => {
  beforeEach(() => {
    mockedTransparenciaService.getDocumentosPorEmpenho.mockReset();
  });

  it('renderiza historico de operacoes e documentos habeis que diminuem o saldo', async () => {
    renderDialog([
      {
        id: '2026NP000001',
        valor_original: 4713.17,
        valor_pago: 1200,
        estado: 'REALIZADO',
        processo: '23035.000147.2026-45',
        favorecido_nome: 'Fornecedor',
        favorecido_documento: '12345678000199',
        data_emissao: '2026-03-05',
        empenho_numero: '2026NE000002',
      },
      {
        id: '2026NP000002',
        valor_original: 999,
        valor_pago: 0,
        estado: 'CANCELADO',
        processo: 'cancelado',
        favorecido_nome: 'Fornecedor',
        favorecido_documento: '12345678000199',
        data_emissao: '2026-03-06',
        empenho_numero: '2026NE000002',
      },
    ]);

    expect(screen.getByText('Inclusão')).toBeInTheDocument();
    expect(screen.getByText('+R$ 14.200,00')).toBeInTheDocument();

    expect(await screen.findByText('2026NP000001')).toBeInTheDocument();
    expect(screen.getByText('-R$ 4.713,17')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.200,00')).toBeInTheDocument();
    expect(screen.queryByText('2026NP000002')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockedTransparenciaService.getDocumentosPorEmpenho).toHaveBeenCalledWith('2026NE000002');
    });
  });

  it('mantem o modal estavel quando nao ha documentos habeis que reduzam saldo', async () => {
    renderDialog([]);

    expect(await screen.findByText('Nenhum documento hábil vinculado a este empenho reduziu o saldo.')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-content')).toHaveClass('sm:max-w-4xl');
    expect(screen.getByTestId('dialog-content')).toHaveClass('lg:max-w-5xl');
  });
});
