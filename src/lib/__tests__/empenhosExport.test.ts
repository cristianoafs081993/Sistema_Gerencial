import * as XLSX from 'xlsx';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Empenho } from '@/types';
import { filterEmpenhos } from '@/pages/empenhosFilters';
import {
  buildEmpenhosExportRows,
  exportEmpenhosToExcel,
  getEmpenhosExportFileName,
} from '@/lib/empenhosExport';

vi.mock('xlsx', async () => {
  const actual = await vi.importActual<typeof import('xlsx')>('xlsx');
  return {
    ...actual,
    writeFile: vi.fn(),
  };
});

const createEmpenho = (overrides: Partial<Empenho>): Empenho => ({
  id: 'empenho-1',
  numero: '2026NE000001',
  descricao: 'Empenho teste',
  valor: 100,
  dimensao: 'AD - Administração',
  componenteFuncional: 'Contratos',
  origemRecurso: 'Tesouro',
  naturezaDespesa: '339039',
  planoInterno: 'PI-AD',
  favorecidoNome: 'Fornecedor Teste',
  favorecidoDocumento: '11222333000144',
  tipo: 'exercicio',
  dataEmpenho: new Date('2026-02-10T12:00:00Z'),
  status: 'pendente',
  createdAt: new Date('2026-02-10'),
  updatedAt: new Date('2026-02-10'),
  ...overrides,
});

describe('empenhosExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('monta linhas de execucao com saldo a liquidar', () => {
    const [row] = buildEmpenhosExportRows(
      [createEmpenho({ valor: 1000, valorLiquidado: 400, valorPago: 250 })],
      'execucao',
    );

    expect(row['Número (NE)']).toBe('2026NE000001');
    expect(row.Favorecido).toBe('Fornecedor Teste');
    expect(row['Data do Empenho']).toBe('10/02/2026');
    expect(row.Status).toBe('Pendente');
    expect(row.Empenhado).toBe(1000);
    expect(row.Liquidado).toBe(400);
    expect(row.Pago).toBe(250);
    expect(row['A Liquidar']).toBe(600);
  });

  it('monta linhas de restos a pagar com base, pago no ano e saldo atual', () => {
    const [row] = buildEmpenhosExportRows(
      [
        createEmpenho({
          numero: '2025NE000009',
          tipo: 'rap',
          rapInscrito: 500,
          rapPago: 200,
          saldoRapOficial: 300,
          dataEmpenho: new Date('2025-03-01T12:00:00Z'),
        }),
      ],
      'restos',
    );

    expect(row['Inscrito / Reinscrito']).toBe(500);
    expect(row['Pago no Ano']).toBe(200);
    expect(row['Saldo Atual']).toBe(300);
    expect(row).not.toHaveProperty('Empenhado');
  });

  it('exporta somente os empenhos que passaram pelos filtros', () => {
    const empenhos = [
      createEmpenho({ id: 'a', numero: '2026NE000001', favorecidoNome: 'Alfa' }),
      createEmpenho({ id: 'b', numero: '2026NE000002', favorecidoNome: 'Beta' }),
      createEmpenho({ id: 'c', numero: '2026NE000003', favorecidoNome: 'Alfa Pago', status: 'pago' }),
    ];

    const filtrados = filterEmpenhos(empenhos, {
      searchTerm: 'alfa',
      filterStatus: 'pendente',
      filterDimensao: 'all',
      filterComponente: 'all',
      filterOrigem: 'all',
      filterPlanoInterno: 'all',
      dataInicio: '',
      dataFim: '',
    });

    const total = exportEmpenhosToExcel(filtrados, 'execucao');

    expect(total).toBe(1);
    const workbook = vi.mocked(XLSX.writeFile).mock.calls[0][0];
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    expect(rows).toHaveLength(1);
    expect(rows[0]['Número (NE)']).toBe('2026NE000001');
  });

  it('nomeia o arquivo de acordo com a aba e a data', () => {
    const date = new Date('2026-11-05T10:00:00Z');
    expect(getEmpenhosExportFileName('execucao', date)).toBe('empenhos-execucao-2026-11-05.xlsx');
    expect(getEmpenhosExportFileName('restos', date)).toBe('empenhos-restos-a-pagar-2026-11-05.xlsx');
  });
});
