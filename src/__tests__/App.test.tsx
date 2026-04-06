import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import App from '@/App';

vi.mock('@/components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null,
}));

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => null,
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/contexts/DataContext', () => ({
  DataProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/pages/Dashboard', () => ({
  default: () => <div>dashboard-page</div>,
}));

vi.mock('@/pages/Atividades', () => ({
  default: () => <div>atividades-page</div>,
}));

vi.mock('@/pages/Descentralizacoes', () => ({
  default: () => <div>descentralizacoes-page</div>,
}));

vi.mock('@/pages/Empenhos', () => ({
  default: () => <div>empenhos-page</div>,
}));

vi.mock('@/pages/Contratos', () => ({
  default: () => <div>contratos-page</div>,
}));

vi.mock('@/pages/LiquidacoesPagamentos', () => ({
  default: () => <div>liquidacoes-page</div>,
}));

vi.mock('@/pages/Financeiro', () => ({
  default: () => <div>financeiro-page</div>,
}));

vi.mock('@/pages/LC', () => ({
  default: () => <div>lc-page</div>,
}));

vi.mock('@/pages/RetencoesFdReinfDesign', () => ({
  default: () => <div>retencoes-page</div>,
}));

vi.mock('@/pages/RastreabilidadePFs', () => ({
  default: () => <div>rastreabilidade-page</div>,
}));

vi.mock('@/pages/ConciliacaoPfs', () => ({
  default: () => <div>conciliacao-page</div>,
}));

vi.mock('@/pages/GeradorDocumentos', () => ({
  default: () => <div>gerador-page</div>,
}));

vi.mock('@/pages/EditorDocumentos', () => ({
  default: () => <div>editor-page</div>,
}));

vi.mock('@/pages/Consultor', () => ({
  default: () => <div>consultor-page</div>,
}));

vi.mock('@/pages/Suap', () => ({
  default: () => <div>suap-page</div>,
}));

vi.mock('@/pages/DesignSystemPreview', () => ({
  default: () => <div>design-system-page</div>,
}));

vi.mock('@/pages/NotFound', () => ({
  default: () => <div>not-found-page</div>,
}));

describe('App routes', () => {
  it('renderiza a rota inicial do dashboard', async () => {
    window.history.pushState({}, '', '/');

    render(<App />);

    expect(await screen.findByText('dashboard-page')).toBeInTheDocument();
  });

  it('renderiza a rota de empenhos', async () => {
    window.history.pushState({}, '', '/empenhos');

    render(<App />);

    expect(await screen.findByText('empenhos-page')).toBeInTheDocument();
  });

  it('renderiza a pagina not found para rota desconhecida', async () => {
    window.history.pushState({}, '', '/rota-inexistente');

    render(<App />);

    expect(await screen.findByText('not-found-page')).toBeInTheDocument();
  });
});
