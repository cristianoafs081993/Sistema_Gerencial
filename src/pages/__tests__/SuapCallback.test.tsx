import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import SuapCallback from '@/pages/SuapCallback';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: null, isLoading: false }) }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { verifyOtp: vi.fn() } } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn() } }));

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/suap-callback" element={<SuapCallback />} />
        <Route path="*" element={<div>outra rota</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SuapCallback', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('não troca o código de um login iniciado pela extensão', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderAt('/suap-callback?code=codigo-da-extensao&state=ext:abc123');

    expect(await screen.findByText(/Concluindo o login na extensão/)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText('outra rota')).not.toBeInTheDocument();
  });
});
