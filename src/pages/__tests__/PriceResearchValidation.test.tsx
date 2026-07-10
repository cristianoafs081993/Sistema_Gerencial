import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PriceResearchValidation from '@/pages/PriceResearchValidation';
import { priceResearchService } from '@/services/priceResearch';

vi.mock('@/services/priceResearch', () => ({
  priceResearchService: {
    validateAuthentication: vi.fn(),
  },
}));

const validationResearch = {
  id: 'research-1',
  processNumber: '23035.000001/2026-00',
  objectDescription: 'Aquisicao de cafe',
  responsibleName: 'Agente',
  institutionName: 'IFRN',
  institutionUnit: 'Campus Currais Novos',
  researchDate: '2026-07-10',
  status: 'completed' as const,
  updatedAt: '2026-07-10T11:00:00.000Z',
  itemsCount: 1,
};

function renderValidation(route: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <PriceResearchValidation />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PriceResearchValidation', () => {
  beforeEach(() => {
    vi.mocked(priceResearchService.validateAuthentication).mockReset();
  });

  it('confirma relatorio quando o hash do QR corresponde ao snapshot salvo', async () => {
    vi.mocked(priceResearchService.validateAuthentication).mockResolvedValue({
      found: true,
      isValid: true,
      expectedHash: 'abcdef1234567890',
      providedHash: 'abcdef1234567890',
      research: validationResearch,
    });

    renderValidation('/pesquisa-precos/validar?id=research-1&auth=abcdef1234567890');

    expect(await screen.findByText('Relatório autenticado')).toBeInTheDocument();
    expect(screen.getByText('23035.000001/2026-00')).toBeInTheDocument();
  });

  it('alerta divergencia quando o hash informado nao corresponde ao snapshot salvo', async () => {
    vi.mocked(priceResearchService.validateAuthentication).mockResolvedValue({
      found: true,
      isValid: false,
      expectedHash: 'abcdef1234567890',
      providedHash: '0000000000000000',
      research: validationResearch,
    });

    renderValidation('/pesquisa-precos/validar?id=research-1&auth=0000000000000000');

    expect(await screen.findByText('Hash divergente')).toBeInTheDocument();
    expect(screen.getByText('0000000000000000')).toBeInTheDocument();
  });
});
