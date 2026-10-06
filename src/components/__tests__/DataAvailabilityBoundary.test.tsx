import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataAvailabilityBoundary } from '@/components/DataAvailabilityBoundary';
describe('DataAvailabilityBoundary', () => {
  it('hides budget figures on initial failure and exposes a manual retry', () => {
    const retry = vi.fn();
    render(<DataAvailabilityBoundary error="Não foi possível atualizar: atividades." hasInitialDataError blocksContent onRetry={retry}>
      <p>Planejado: R$ 0,00</p>
    </DataAvailabilityBoundary>);
    expect(screen.queryByText('Planejado: R$ 0,00')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Dados temporariamente indisponíveis');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it('retains successful values during refresh failure and disables overlapping retries', () => {
    render(<DataAvailabilityBoundary error="Falha na atualização." blocksContent isRefreshing onRetry={vi.fn()}>
      <p>Planejado: R$ 100,00</p>
    </DataAvailabilityBoundary>);
    expect(screen.getByText('Planejado: R$ 100,00')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('últimos dados carregados');
    expect(screen.getByRole('button')).toBeDisabled();
  });
  it('keeps recovery/import pages accessible when initial budget reads fail', () => {
    render(<DataAvailabilityBoundary error="Falha." hasInitialDataError blocksContent={false} onRetry={vi.fn()}>
      <p>Importação de Dados</p>
    </DataAvailabilityBoundary>);
    expect(screen.getByText('Importação de Dados')).toBeInTheDocument();
  });
});
