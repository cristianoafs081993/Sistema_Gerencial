import type { InputHTMLAttributes, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { EmpenhoDialog } from '@/components/modals/EmpenhoDialog';
import { formatCurrency } from '@/lib/utils';
import type { Empenho } from '@/types';

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
  DialogHeader: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
  DialogTitle: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
  DialogFooter: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: { children: ReactNode }) => <button type="button" {...props}>{children}</button>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, ...props }: InputHTMLAttributes<HTMLInputElement>) => <input {...props} value={value ?? ''} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: { children: ReactNode }) => <label {...props}>{children}</label>,
}));

const baseEmpenho = (): Empenho => ({
  id: 'emp-1',
  numero: '2026NE000001',
  descricao: 'Empenho de teste',
  valor: 1000,
  dimensao: 'EN - Ensino',
  componenteFuncional: 'Ensino',
  origemRecurso: 'Tesouro',
  naturezaDespesa: '339039',
  tipo: 'exercicio',
  dataEmpenho: new Date('2026-02-10T00:00:00.000Z'),
  status: 'pendente',
  createdAt: new Date('2026-02-10T00:00:00.000Z'),
  updatedAt: new Date('2026-02-10T00:00:00.000Z'),
});

const expectCurrencyValue = (value: number) => {
  const expected = formatCurrency(value).replace(/\s+/g, ' ').trim();
  expect(
    screen.getByText((_, node) => (node?.textContent || '').replace(/\s+/g, ' ').trim() === expected),
  ).toBeInTheDocument();
};

describe('EmpenhoDialog', () => {
  it('mostra metricas de RAP usando base vigente, liquidado no ano e saldo atual', () => {
    render(
      <EmpenhoDialog
        open
        onOpenChange={vi.fn()}
        atividades={[]}
        onSave={vi.fn()}
        empenho={{
          ...baseEmpenho(),
          numero: '2025NE000085',
          tipo: 'rap',
          valor: 0,
          rapInscrito: 33434.84,
          rapPago: 24489.1,
          valorLiquidadoAPagar: 1562.42,
          saldoRapOficial: 7383.32,
          status: 'liquidado',
        }}
      />,
    );

    expect(screen.getByText('Valor Inscrito')).toBeInTheDocument();
    expect(screen.getByText('Liquidado no Ano')).toBeInTheDocument();
    expect(screen.getByText('Saldo Atual')).toBeInTheDocument();
    expectCurrencyValue(33434.84);
    expectCurrencyValue(26051.52);
    expectCurrencyValue(7383.32);
  });

  it('prioriza os valores oficiais em empenhos do exercicio', () => {
    render(
      <EmpenhoDialog
        open
        onOpenChange={vi.fn()}
        atividades={[]}
        onSave={vi.fn()}
        empenho={{
          ...baseEmpenho(),
          valorLiquidado: 100,
          valorLiquidadoOficial: 140,
          valorPago: 80,
          valorPagoOficial: 120,
        }}
      />,
    );

    expect(screen.getByText('Valor Empenhado')).toBeInTheDocument();
    expect(screen.getByText('Valor Liquidado')).toBeInTheDocument();
    expect(screen.getByText('Valor Pago')).toBeInTheDocument();
    expectCurrencyValue(1000);
    expectCurrencyValue(140);
    expectCurrencyValue(120);
  });
});
