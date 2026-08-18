import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActiveFilterChips, type ActiveFilterItem } from '../ActiveFilterChips';

describe('ActiveFilterChips — Eixo 04', () => {
  it('não renderiza nada quando a lista de filtros está vazia', () => {
    const { container } = render(<ActiveFilterChips filters={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza filtros ativos com labels e valores destacados', () => {
    const onRemoveStatus = vi.fn();
    const onRemoveDim = vi.fn();

    const filters: ActiveFilterItem[] = [
      { id: 'status', label: 'Status', value: 'Pendente', onRemove: onRemoveStatus },
      { id: 'dimensao', label: 'Dimensão', value: 'Administração', onRemove: onRemoveDim },
    ];

    render(
      <ActiveFilterChips
        filters={filters}
        onClearAll={vi.fn()}
        filteredCount={15}
        totalCount={40}
      />,
    );

    expect(screen.getByText('Filtros ativos:')).toBeInTheDocument();
    expect(screen.getByText('Status:')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.getByText('Dimensão:')).toBeInTheDocument();
    expect(screen.getByText('Administração')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText(/de 40 registros/)).toBeInTheDocument();


    const removeButtons = screen.getAllByRole('button', { name: /Remover filtro/i });
    expect(removeButtons).toHaveLength(2);

    fireEvent.click(removeButtons[0]);
    expect(onRemoveStatus).toHaveBeenCalledTimes(1);
    expect(onRemoveDim).not.toHaveBeenCalled();
  });

  it('aciona onClearAll ao clicar no botão Limpar filtros', () => {
    const onClearAll = vi.fn();
    const filters: ActiveFilterItem[] = [
      { id: 'busca', label: 'Busca', value: 'papel a4', onRemove: vi.fn() },
    ];

    render(<ActiveFilterChips filters={filters} onClearAll={onClearAll} />);

    const clearButton = screen.getByRole('button', { name: /Limpar filtros/i });
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});
