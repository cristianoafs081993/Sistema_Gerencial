import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AutoPageHeader } from '../PageHeader';

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AutoPageHeader />
    </MemoryRouter>,
  );
}

describe('AutoPageHeader', () => {
  it.each([
    ['/manutencao', 'Limpeza e Manutenção', 'Administração'],
    ['/refeitorio/insumos', 'Dashboard', 'Refeitório'],
  ])('não exibe módulo nem título visíveis em %s', (pathname, titulo, modulo) => {
    renderAt(pathname);

    expect(screen.getByRole('heading', { level: 1, name: titulo })).toHaveClass('sr-only');
    expect(screen.queryByTestId('page-header')).not.toBeInTheDocument();
    expect(screen.queryByText(modulo)).not.toBeInTheDocument();
  });

  it('mantém o cabeçalho visível nas demais telas do Refeitório', () => {
    renderAt('/requisicao-compra');

    expect(screen.getByTestId('page-header')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Requisição de Compra' })).not.toHaveClass('sr-only');
  });
});
