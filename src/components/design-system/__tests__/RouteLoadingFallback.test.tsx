import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RouteLoadingFallback } from '@/components/design-system/RouteLoadingFallback';

describe('RouteLoadingFallback', () => {
  it('renderiza o modo de tela cheia com semântica acessível', () => {
    render(<RouteLoadingFallback mode="screen" label="Preparando acesso..." />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveClass('min-h-dvh');
    expect(screen.getByText('Preparando acesso...')).toBeInTheDocument();
  });

  it('renderiza o modo de conteúdo com a mensagem padrão', () => {
    render(<RouteLoadingFallback mode="content" />);

    expect(screen.getByRole('status')).toHaveClass('min-h-[50vh]');
    expect(screen.getByText('Carregando página...')).toBeInTheDocument();
  });
});
