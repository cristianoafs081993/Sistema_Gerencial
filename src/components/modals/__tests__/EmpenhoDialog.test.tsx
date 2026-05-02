import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { EmpenhoDialog } from '@/components/modals/EmpenhoDialog';
import { contratosApiService } from '@/services/contratosApi';
import type { Empenho } from '@/types';

vi.mock('@/services/contratosApi', () => ({
  contratosApiService: {
    getLiquidacoesPublicasPorEmpenho: vi.fn(),
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

const mockedContratosApiService = vi.mocked(contratosApiService);

const empenhoBase: Empenho = {
  id: 'emp-1',
  numero: '2026NE000002',
  descricao: 'Recurso para pagamento de diarias para convocacoes oficiais ou viagens a servico.',
  valor: 25000,
  valorLiquidado: 4713.17,
  valorPagoOficial: 4713.17,
  dimensao: 'AD - Administracao',
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

const renderDialog = (liquidacoesApi: unknown[] = []) => {
  mockedContratosApiService.getLiquidacoesPublicasPorEmpenho.mockResolvedValue(liquidacoesApi);
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
    mockedContratosApiService.getLiquidacoesPublicasPorEmpenho.mockReset();
  });

  it('renderiza historico de operacoes e liquidacoes da API de contratos', async () => {
    renderDialog([
      {
        contrato_api_id: 22024,
        contrato_numero: '00062/2018',
        contrato_objeto: 'Contrato teste',
        fatura_id: 188319,
        numero_instrumento_cobranca: '48161',
        situacao: 'Pago',
        valor_bruto: 12368.06,
        valor_liquido: 12000,
        data_emissao: '2023-05-08',
        data_vencimento: '2023-06-26',
        data_pagamento: '2023-06-20',
        data_liquidacao: '2023-05-10',
        processo: '23035.001299/2021-51',
        empenho_numero: '2026NE000002',
        valor_empenho: 12368.06,
        subelemento: '01',
      },
    ]);

    expect(screen.getByText((content) => content.includes('Inclus'))).toBeInTheDocument();
    expect(screen.getByText('+R$ 14.200,00')).toBeInTheDocument();
    expect(screen.queryByText((content) => content.includes('Documentos h'))).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockedContratosApiService.getLiquidacoesPublicasPorEmpenho).toHaveBeenCalledWith('2026NE000002');
    });

    expect(await screen.findByText('48161')).toBeInTheDocument();
    expect(screen.getByText('00062/2018')).toBeInTheDocument();
    expect(screen.getByText('Liquidações')).toBeInTheDocument();
    expect(screen.getAllByText('Valor').length).toBeGreaterThan(0);
    expect(screen.queryByText('Bruto')).not.toBeInTheDocument();
    expect(screen.queryByText('Liquido')).not.toBeInTheDocument();
    expect(screen.getByText('R$ 12.368,06')).toBeInTheDocument();
    expect(screen.queryByText('R$ 12.000,00')).not.toBeInTheDocument();
  });

  it('mantem o modal estavel e exibe o vazio da API publica sem a secao de documentos habeis', async () => {
    renderDialog();

    expect(await screen.findByText('O empenho nao foi localizado nos contratos publicos do Comprasnet para as UGs 158366 e 158155.')).toBeInTheDocument();
    expect(screen.queryByText((content) => content.includes('Nenhum documento'))).not.toBeInTheDocument();
    expect(screen.getByTestId('dialog-content')).toHaveClass('sm:max-w-4xl');
    expect(screen.getByTestId('dialog-content')).toHaveClass('lg:max-w-5xl');
  });
});
