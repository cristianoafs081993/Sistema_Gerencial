import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import GeradorDocumentos from '@/pages/GeradorDocumentos';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
  },
}));

describe('GeradorDocumentos', () => {
  it('oferece finalidade de bolsa sem projeto sem campos de projeto ou edital', () => {
    render(<GeradorDocumentos />);

    fireEvent.click(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('Bolsa sem projeto'));

    expect(screen.getByText('Favorecido (Bolsistas)')).toBeInTheDocument();
    expect(screen.queryByText('Nome do Projeto')).not.toBeInTheDocument();
    expect(screen.queryByText('Identificação do Edital')).not.toBeInTheDocument();
    expect(screen.queryByText('Tipo')).not.toBeInTheDocument();
  });
});
