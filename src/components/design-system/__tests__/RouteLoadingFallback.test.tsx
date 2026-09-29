import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppSplash } from '@/components/design-system/AppSplash';
import { LoadingState } from '@/components/design-system/LoadingState';
import { PageLoadingSkeleton } from '@/components/design-system/PageLoadingSkeleton';
import { RouteLoadingFallback } from '@/components/design-system/RouteLoadingFallback';

describe('RouteLoadingFallback', () => {
  it('renderiza o modo de tela cheia como tela de abertura acessível', () => {
    render(<RouteLoadingFallback mode="screen" label="Preparando acesso..." />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveClass('min-h-dvh');
    expect(screen.getByText('Preparando acesso...')).toBeInTheDocument();
    expect(screen.getByText('SIAGES')).toBeInTheDocument();
  });

  it('renderiza o modo de conteúdo como esqueleto de página com rótulo acessível', () => {
    render(<RouteLoadingFallback mode="content" />);

    const status = screen.getByRole('status');
    expect(status).toHaveClass('min-h-[50vh]');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Carregando página...')).toHaveClass('sr-only');
    expect(status.querySelectorAll('.skeleton').length).toBeGreaterThan(10);
  });
});

describe('estados de carregamento compartilhados', () => {
  it('AppSplash exibe descrição opcional', () => {
    render(<AppSplash label="Validando sessão" description="Confirmando permissões." />);

    expect(screen.getByText('Validando sessão')).toBeInTheDocument();
    expect(screen.getByText('Confirmando permissões.')).toBeInTheDocument();
  });

  it('PageLoadingSkeleton esconde os blocos decorativos dos leitores de tela', () => {
    const { container } = render(<PageLoadingSkeleton label="Carregando empenhos..." />);

    expect(screen.getByText('Carregando empenhos...')).toBeInTheDocument();
    container.querySelectorAll('[aria-hidden="true"]').forEach((node) => {
      expect(node.querySelector('.skeleton')).not.toBeNull();
    });
  });

  it('LoadingState usa status polido com mensagem padrão', () => {
    render(<LoadingState />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Carregando...');
    expect(status).toHaveAttribute('aria-busy', 'true');
  });
});
