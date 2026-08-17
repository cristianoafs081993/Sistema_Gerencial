import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ComprasnetEtpExtension from '@/pages/ComprasnetEtpExtension';
import { COMPRASNET_ETP_CONTEXT_MESSAGE, COMPRASNET_PAGE_ORIGIN } from '@/lib/comprasnetEtpExtension';

const mocks = vi.hoisted(() => ({
  generatePreliminaryStudy: vi.fn(),
  getProcessoByNumero: vi.fn(),
}));

vi.mock('@/services/preliminaryStudies', () => ({
  preliminaryStudiesService: {
    generatePreliminaryStudy: mocks.generatePreliminaryStudy,
  },
}));

vi.mock('@/services/suapProcessos', () => ({
  suapProcessosService: {
    getProcessoByNumero: mocks.getProcessoByNumero,
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        })),
      })),
    })),
  },
}));

function sendTestContext(payloadOverrides = {}) {
  window.dispatchEvent(new MessageEvent('message', {
    origin: COMPRASNET_PAGE_ORIGIN,
    source: window.parent,
    data: {
      source: 'siages',
      type: COMPRASNET_ETP_CONTEXT_MESSAGE,
      version: 1,
      payload: {
        processNumber: '23035.000001/2026-11',
        fields: [
          { id: 'necessidade', title: 'Descrição da necessidade', required: true, existingText: 'Texto antigo' },
        ],
        theme: {
          fontFamily: 'Rawline, sans-serif',
          fontSize: '14px',
          textColor: '#333',
          mutedColor: '#666',
          surfaceColor: '#fff',
          backgroundColor: '#f5f5f5',
          borderColor: '#888',
          primaryColor: '#1351b4',
          primaryTextColor: '#fff',
          secondaryColor: '#fff',
          secondaryTextColor: '#333',
          focusColor: '#1351b4',
          radius: '4px',
        },
        generationPreferences: { length: 'detalhado', paragraphCount: 4 },
        ...payloadOverrides,
      },
    },
  }));
}

describe('ComprasnetEtpExtension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('abre e fecha as configurações a partir do ícone de engrenagem no cabeçalho', async () => {
    render(<ComprasnetEtpExtension />);

    await act(async () => {
      sendTestContext();
    });

    // Initially preferences panel is not visible
    expect(screen.queryByText('Preferências não sensíveis, lembradas neste navegador.')).not.toBeInTheDocument();

    const gearButton = screen.getByRole('button', { name: /configurar minuta/i });
    expect(gearButton).toBeInTheDocument();

    // Open preferences via gear button
    fireEvent.click(gearButton);
    expect(screen.getByText('Preferências não sensíveis, lembradas neste navegador.')).toBeInTheDocument();
    expect(screen.getByText('Parágrafos alvo')).toBeInTheDocument();

    // Close preferences via close button inside panel
    const closeSettingsButton = screen.getByRole('button', { name: /fechar configurações/i });
    fireEvent.click(closeSettingsButton);
    expect(screen.queryByText('Preferências não sensíveis, lembradas neste navegador.')).not.toBeInTheDocument();

    // Toggle again via gear button
    fireEvent.click(gearButton);
    expect(screen.getByText('Preferências não sensíveis, lembradas neste navegador.')).toBeInTheDocument();
  });

  it('renderiza o campo de número do processo com botão Buscar processo alinhado', async () => {
    render(<ComprasnetEtpExtension />);

    await act(async () => {
      sendTestContext();
    });

    const input = screen.getByPlaceholderText('Ex.: 23035.000001/2026-11');
    const searchButton = screen.getByRole('button', { name: /buscar processo/i });

    expect(input).toBeInTheDocument();
    expect(searchButton).toBeInTheDocument();
    expect(input.closest('.comprasnet-etp-process-row')).toContainElement(searchButton);
  });

  it('recebe contexto do Comprasnet e preenche o número do processo', async () => {
    mocks.getProcessoByNumero.mockResolvedValueOnce({
      numero: '23035.000001/2026-11',
      objeto: 'Aquisição de equipamentos de TI',
    });

    render(<ComprasnetEtpExtension />);

    await act(async () => {
      sendTestContext({ processNumber: '23035.000001/2026-11' });
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('23035.000001/2026-11')).toBeInTheDocument();
    });
  });
});
