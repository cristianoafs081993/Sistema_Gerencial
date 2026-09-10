import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { DEFAULT_BOLSA_PROCESS_MAPPING, DEFAULT_PROCESS_MAPPING } from '@/data/defaultProcessMapping';
import SuapProcessMappingPage from '@/pages/SuapProcessMapping';
import { processMappingsService } from '@/services/processMappings';

vi.mock('@/services/processMappings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/processMappings')>();
  const { DEFAULT_PROCESS_MAPPING, DEFAULT_PROCESS_MAPPINGS } = await import('@/data/defaultProcessMapping');
  return {
    ...actual,
    processMappingsService: {
      ...actual.processMappingsService,
      getById: vi.fn().mockResolvedValue(DEFAULT_PROCESS_MAPPING),
      listPublished: vi.fn().mockResolvedValue(DEFAULT_PROCESS_MAPPINGS),
    },
  };
});

describe('SuapProcessMapping', () => {
  it('renderiza o mapa completo, o guia e os detalhes de uma etapa', async () => {
    render(
      <MemoryRouter initialEntries={['/mapeamentos/liquidacao-pagamento-nota-fiscal']}>
        <Routes><Route path="/mapeamentos/:mappingId" element={<SuapProcessMappingPage />} /></Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Liquidação e pagamento de nota fiscal' })).toBeInTheDocument();
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

  it('permite alternar entre os modos de visão: Fluxograma, Matriz e Guia', async () => {
    render(
      <MemoryRouter initialEntries={['/mapeamentos']}>
        <Routes>
          <Route path="/mapeamentos" element={<SuapProcessMappingPage />} />
          <Route path="/mapeamentos/:mappingId" element={<SuapProcessMappingPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Liquidação e pagamento de nota fiscal' })).toBeInTheDocument();

    // Alternar para visão em Matriz
    const matrizTab = screen.getByRole('tab', { name: /Matriz/i });
    fireEvent.click(matrizTab);
    expect(screen.getByText('Matriz de Processo & Gestão de Procedimentos')).toBeInTheDocument();
    expect(screen.getByText(/Com Link de Sistema/i)).toBeInTheDocument();

    // Alternar para visão em Guia
    const guiaTab = screen.getByRole('tab', { name: /Guia/i });
    fireEvent.click(guiaTab);
    expect(screen.getByText('Progresso Geral')).toBeInTheDocument();

    // Alternar de volta para Fluxograma
    const fluxogramaTab = screen.getByRole('tab', { name: /Fluxograma/i });
    fireEvent.click(fluxogramaTab);
    expect(screen.getByRole('button', { name: /Reduzir zoom/i })).toBeInTheDocument();
  });
});

