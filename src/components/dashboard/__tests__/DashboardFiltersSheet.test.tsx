import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardFiltersSheet } from '@/components/dashboard/DashboardFiltersSheet';

describe('DashboardFiltersSheet', () => {
  const defaultProps = {
    buttonClassName: 'test-button',
    filterOrigem: 'all',
    filterPlanoInterno: 'all',
    dateStart: '',
    dateEnd: '',
    origensDisponiveis: ['Tesouro', 'Proprio'],
    planosInternosDisponiveis: ['L20RLP0100N', 'L20RLP0200N'],
    hasActiveFilters: false,
    activeFiltersCount: 0,
    onFilterOrigemChange: vi.fn(),
    onFilterPlanoInternoChange: vi.fn(),
    onDateStartChange: vi.fn(),
    onDateEndChange: vi.fn(),
    onClearFilters: vi.fn(),
  };

  it('renderiza o botão de filtros sem badge quando não há filtros ativos', () => {
    render(<DashboardFiltersSheet {...defaultProps} />);

    expect(screen.getByRole('button', { name: /filtros/i })).toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('exibe o badge com a quantidade de filtros ativos', () => {
    render(<DashboardFiltersSheet {...defaultProps} hasActiveFilters activeFiltersCount={2} />);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('abre o sheet e renderiza Origem de Recurso como primeiro filtro e Plano Interno (PI) como segundo', () => {
    render(<DashboardFiltersSheet {...defaultProps} />);

    // Clicar para abrir o Sheet
    fireEvent.click(screen.getByRole('button', { name: /filtros/i }));

    expect(screen.getByText('Filtrar Dashboard')).toBeInTheDocument();

    // Validar labels presentes
    const labelOrigem = screen.getByText('Origem de Recurso');
    const labelPlanoInterno = screen.getByText('Plano Interno (PI)');
    const labelDataInicio = screen.getByText('Periodo de Inicio');
    const labelDataFim = screen.getByText('Periodo Final');

    expect(labelOrigem).toBeInTheDocument();
    expect(labelPlanoInterno).toBeInTheDocument();
    expect(labelDataInicio).toBeInTheDocument();
    expect(labelDataFim).toBeInTheDocument();

    // Validar que o filtro Dimensao foi removido
    expect(screen.queryByText('Dimensao')).not.toBeInTheDocument();
    expect(screen.queryByText('Dimensão')).not.toBeInTheDocument();

    // Validar ordem no DOM: Origem de Recurso vem antes de Plano Interno (PI)
    expect(labelOrigem.compareDocumentPosition(labelPlanoInterno)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(labelPlanoInterno.compareDocumentPosition(labelDataInicio)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('chama onDateStartChange e onDateEndChange ao alterar datas', () => {
    const onDateStartChange = vi.fn();
    const onDateEndChange = vi.fn();

    render(
      <DashboardFiltersSheet
        {...defaultProps}
        onDateStartChange={onDateStartChange}
        onDateEndChange={onDateEndChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /filtros/i }));

    const inputs = screen.getAllByDisplayValue('');
    const dateInputs = inputs.filter((input) => input.getAttribute('type') === 'date');

    fireEvent.change(dateInputs[0], { target: { value: '2026-01-01' } });
    expect(onDateStartChange).toHaveBeenCalledWith('2026-01-01');

    fireEvent.change(dateInputs[1], { target: { value: '2026-12-31' } });
    expect(onDateEndChange).toHaveBeenCalledWith('2026-12-31');
  });

  it('exibe botão Limpar Filtros quando hasActiveFilters é true e dispara onClearFilters', () => {
    const onClearFilters = vi.fn();

    render(
      <DashboardFiltersSheet
        {...defaultProps}
        hasActiveFilters
        activeFiltersCount={1}
        onClearFilters={onClearFilters}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /filtros/i }));

    const clearButton = screen.getByRole('button', { name: /limpar filtros/i });
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});
