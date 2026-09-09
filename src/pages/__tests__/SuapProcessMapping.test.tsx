import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { DEFAULT_BOLSA_PROCESS_MAPPING, DEFAULT_PROCESS_MAPPING } from '@/data/defaultProcessMapping';
import SuapProcessMappingPage from '@/pages/SuapProcessMapping';
import { processMappingsService } from '@/services/processMappings';

vi.mock('@/services/processMappings', () => ({
  processMappingsService: { getById: vi.fn().mockResolvedValue(DEFAULT_PROCESS_MAPPING) },
}));

describe('SuapProcessMapping', () => {
  it('renderiza o mapa completo, o guia e os detalhes de uma etapa', async () => {
    render(
      <MemoryRouter initialEntries={['/mapeamentos/liquidacao-pagamento-nota-fiscal']}>
        <Routes><Route path="/mapeamentos/:mappingId" element={<SuapProcessMappingPage />} /></Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Liquidação e pagamento de nota fiscal' })).toBeInTheDocument();
    expect(screen.getByText('Mapa operacional')).toBeInTheDocument();
    expect(screen.getByText('Guia de execução')).toBeInTheDocument();
    expect(screen.getAllByText('Registrar a liquidação')).not.toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /2 Validar documentação fiscal/i }));
    await waitFor(() => expect(screen.getByText('Base normativa')).toBeInTheDocument());
    expect(screen.getAllByText('DIAD/CN')).not.toHaveLength(0);
  });

  it('renderiza o mapa específico de bolsas e suas responsabilidades', async () => {
    vi.mocked(processMappingsService.getById).mockResolvedValueOnce(DEFAULT_BOLSA_PROCESS_MAPPING);

    render(
      <MemoryRouter initialEntries={['/mapeamentos/liquidacao-pagamento-bolsas']}>
        <Routes><Route path="/mapeamentos/:mappingId" element={<SuapProcessMappingPage />} /></Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Liquidação e pagamento de bolsas de ensino, pesquisa ou extensão' })).toBeInTheDocument();
    expect(screen.getByText('Coordenação responsável pelo projeto · COPEIN, COEX ou DIAC')).toBeInTheDocument();
    expect(screen.getAllByText('DG · Direção-Geral')).not.toHaveLength(0);
    expect(screen.getAllByText('Realizar o pagamento e concluir o processo')).not.toHaveLength(0);
  });
});
