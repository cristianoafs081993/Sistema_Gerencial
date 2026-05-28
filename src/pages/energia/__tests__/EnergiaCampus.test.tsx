import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EnergiaCampus from '@/pages/energia/EnergiaCampus';
import { loadEnergiaCampusData } from '@/services/energiaCampusService';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isSuperAdmin: false,
  }),
}));

vi.mock('@/services/energiaCampusService', async () => {
  const actual = await vi.importActual<typeof import('@/services/energiaCampusService')>('@/services/energiaCampusService');
  return {
    ...actual,
    loadEnergiaCampusData: vi.fn(),
    saveEnergiaCampusImport: vi.fn(),
  };
});

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Line: () => null,
  Bar: () => null,
  Pie: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
}));

const mockedLoadEnergiaCampusData = vi.mocked(loadEnergiaCampusData);

describe('EnergiaCampus', () => {
  beforeEach(() => {
    mockedLoadEnergiaCampusData.mockResolvedValue({
      latestRun: {
        id: 'run-1',
        sourceFile: 'energia.xlsx',
        importedAt: '2026-05-27T12:00:00.000Z',
      },
      warnings: ['A aba Mercatto não traz kWh real.'],
      consumoFaturas: [
        {
          fonte: 'cosern',
          competencia: '2026-01-01',
          consumoTotalKwh: 1000,
          valorFaturado: 900,
          faturaNumero: '1',
        },
        {
          fonte: 'mercatto',
          competencia: '2026-01-01',
          consumoTotalKwh: null,
          valorFaturado: 700,
        },
      ],
      solarGeracao: [
        {
          ufvNome: 'UFV 01',
          dataReferencia: '2026-01-01',
          ano: 2026,
          granularidade: 'anual',
          energiaGeradaKwh: 2000,
        },
      ],
      contratos: [{ fonte: 'cosern', situacao: 'Ativo', contratoNumero: '82/2021' }],
      contratoExecucoes: [],
      mercattoContratosApi: {
        contratos: [{
          id: 'contrato-mercatto',
          apiContratoId: 123,
          numero: 'ML-001',
          fornecedorNome: 'MERCATTO ENERGIA LTDA',
          valorGlobal: 10000,
        }],
        faturas: [{
          id: 'fat-1',
          contratoApiId: 'contrato-mercatto',
          apiFaturaId: 456,
          numeroInstrumentoCobranca: 'ML-2026-01',
          valorLiquido: 900,
          valorBruto: 900,
          dataEmissao: '2026-01-15',
        }],
        liquidacoes: [],
      },
    });
  });

  it('renderiza a visão geral com KPIs e aviso metodológico', async () => {
    render(
      <MemoryRouter initialEntries={['/energia']}>
        <EnergiaCampus />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Energia Campus')).toBeInTheDocument();
    expect(screen.getByText('Energia monitorada')).toBeInTheDocument();
    expect(screen.getByText('Consumo por subestação - COSERN (kWh)')).toBeInTheDocument();
    expect(screen.getByText('Estimado por faturas/liquidações')).toBeInTheDocument();
    expect(screen.getByText('A aba Mercatto não traz kWh real.')).toBeInTheDocument();
  });

  it('renderiza a tela ESG pela rota específica', async () => {
    render(
      <MemoryRouter initialEntries={['/energia/esg']}>
        <EnergiaCampus />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Energia Campus - Indicadores ESG')).toBeInTheDocument());
    expect(screen.getByText('Emissões evitadas')).toBeInTheDocument();
  });
});
