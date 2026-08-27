import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GaugeChart } from '../GaugeChart';

describe('GaugeChart', () => {
  it('renderiza o percentual calculado corretamente com classes de contraste do tema', () => {
    const { container } = render(
      <GaugeChart
        value={99100}
        total={100000}
        label="Empenhado"
        sublabel="sobre Descentralizado"
      />
    );

    const percentText = screen.getByText('99.1%');
    expect(percentText).toBeInTheDocument();
    expect(percentText).toHaveAttribute('fill', 'currentColor');
    expect(percentText).toHaveClass('text-foreground');

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-label', 'Empenhado: 99.1%');
  });

  it('renderiza 0.0% quando o total for 0', () => {
    render(
      <GaugeChart
        value={500}
        total={0}
        label="Liquidado"
        sublabel="sobre Descentralizado"
      />
    );

    const percentText = screen.getByText('0.0%');
    expect(percentText).toBeInTheDocument();
    expect(percentText).toHaveAttribute('fill', 'currentColor');
    expect(percentText).toHaveClass('text-foreground');
  });

  it('renderiza estado de carregamento quando isLoading for true', () => {
    const { container } = render(
      <GaugeChart
        value={50000}
        total={100000}
        label="Empenhado"
        sublabel="sobre Descentralizado"
        isLoading={true}
      />
    );

    expect(screen.queryByText('50.0%')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});
