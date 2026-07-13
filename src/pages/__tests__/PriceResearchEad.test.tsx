import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PriceResearchEad from '@/pages/PriceResearchEad';
import { priceResearchEadService, type PriceResearchEadVideo } from '@/services/priceResearchEad';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/components/HeaderParts', () => ({
  HeaderSubtitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/services/priceResearchEad', () => ({
  priceResearchEadService: {
    list: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
}));

const video: PriceResearchEadVideo = {
  id: 'video-1',
  title: 'Pesquisa de preços - introdução',
  description: 'Primeira aula do módulo.',
  youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  youtubeVideoId: 'dQw4w9WgXcQ',
  sortOrder: 1,
  isActive: true,
  createdBy: 'user-1',
  createdByEmail: 'admin@ifrn.edu.br',
  createdAt: '2026-07-13T10:00:00.000Z',
  updatedAt: '2026-07-13T10:00:00.000Z',
};

function renderPage(isSuperAdmin = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  vi.mocked(useAuth).mockReturnValue({
    isSuperAdmin,
  } as ReturnType<typeof useAuth>);

  return render(
    <QueryClientProvider client={queryClient}>
      <PriceResearchEad />
    </QueryClientProvider>,
  );
}

describe('PriceResearchEad', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(priceResearchEadService.list).mockResolvedValue([video]);
    vi.mocked(priceResearchEadService.save).mockResolvedValue(video);
  });

  it('renderiza aulas ativas com iframe youtube-nocookie e oculta gestao para usuario comum', async () => {
    renderPage(false);

    const iframe = await screen.findByTitle('Aula EAD: Pesquisa de preços - introdução');
    expect(iframe).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(screen.queryByText('Gestão do EAD')).not.toBeInTheDocument();
    expect(priceResearchEadService.list).toHaveBeenCalledWith({ includeInactive: false });
  });

  it('mostra estado vazio quando nao ha aulas ativas', async () => {
    vi.mocked(priceResearchEadService.list).mockResolvedValueOnce([]);

    renderPage(false);

    expect(await screen.findByText('Nenhuma aula cadastrada')).toBeInTheDocument();
    expect(screen.getByText(/catálogo EAD ainda não possui vídeos ativos/i)).toBeInTheDocument();
  });

  it('permite ao superadmin cadastrar aula e valida erro retornado pelo service', async () => {
    vi.mocked(priceResearchEadService.save)
      .mockRejectedValueOnce(new Error('Informe uma URL valida do YouTube.'))
      .mockResolvedValueOnce(video);

    renderPage(true);

    fireEvent.click(await screen.findByRole('button', { name: /Cadastrar aula/i }));
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Aula nova' } });
    fireEvent.change(screen.getByLabelText('URL do YouTube'), { target: { value: 'https://example.com/video' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar aula/i }));

    expect(await screen.findByText('URL do YouTube inválida.')).toBeInTheDocument();
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Informe uma URL valida do YouTube.');
    });

    fireEvent.change(screen.getByLabelText('URL do YouTube'), {
      target: { value: 'https://youtu.be/dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Salvar aula/i }));

    await waitFor(() => {
      expect(priceResearchEadService.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          title: 'Aula nova',
          youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
          isActive: true,
        }),
        undefined,
      );
    });
  });
});
