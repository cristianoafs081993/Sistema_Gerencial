import type { Empenho } from '@/types';
import {
  filterEmpenhos,
  getRapBase,
  getRapLiquidado,
  getRapSaldo,
  matchesEmpenhoStatusFilter,
} from '@/pages/empenhosFilters';

const createEmpenho = (overrides: Partial<Empenho> = {}): Empenho => ({
  id: 'empenho-1',
  numero: '2026NE0001',
  descricao: 'Empenho teste',
  valor: 100,
  dimensao: 'EN - Ensino',
  componenteFuncional: 'Ensino Base',
  origemRecurso: 'Tesouro',
  naturezaDespesa: '339039',
  planoInterno: 'PI-EN',
  tipo: 'exercicio',
  dataEmpenho: new Date('2026-02-10'),
  status: 'pendente',
  createdAt: new Date('2026-02-10'),
  updatedAt: new Date('2026-02-10'),
  ...overrides,
});

describe('empenhosFilters', () => {
  it('infere a dimensao pelo plano interno quando o campo dimensao vier vazio', () => {
    const empenhos = [
      createEmpenho({
        id: 'en',
        dimensao: '',
        planoInterno: 'PROJ-EN',
        descricao: 'Empenho vinculado ao ensino',
      }),
      createEmpenho({
        id: 'ad',
        numero: '2026NE0002',
        dimensao: '',
        planoInterno: 'PROJ-AD',
        descricao: 'Empenho vinculado a administracao',
      }),
    ];

    const result = filterEmpenhos(empenhos, {
      searchTerm: '',
      filterStatus: 'pendente',
      filterDimensao: 'EN',
      filterComponente: 'all',
      filterOrigem: 'all',
      filterPlanoInterno: 'all',
      dataInicio: '',
      dataFim: '',
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('en');
  });

  it('aplica as regras especificas de status para RAP', () => {
    const rapPendente = createEmpenho({
      id: 'rap-pendente',
      tipo: 'rap',
      rapInscrito: 100,
      rapALiquidar: 30,
      rapPago: 0,
      status: 'pendente',
    });
    const rapLiquidado = createEmpenho({
      id: 'rap-liquidado',
      numero: '2025NE0002',
      tipo: 'rap',
      rapInscrito: 100,
      rapALiquidar: 0,
      saldoRapOficial: 20,
      rapPago: 80,
      status: 'pendente',
    });
    const rapReinscrito = createEmpenho({
      id: 'rap-reinscrito',
      numero: '2024NE0003',
      tipo: 'rap',
      rapInscrito: 150,
      rapALiquidar: 90,
      saldoRapOficial: 60,
      rapPago: 30,
      status: 'pendente',
    });
    const rapPago = createEmpenho({
      id: 'rap-pago',
      tipo: 'rap',
      rapInscrito: 100,
      rapALiquidar: 0,
      saldoRapOficial: 0,
      rapPago: 100,
      status: 'pago',
    });

    expect(matchesEmpenhoStatusFilter(rapPendente, 'pendente')).toBe(true);
    expect(matchesEmpenhoStatusFilter(rapPendente, 'pago')).toBe(false);

    expect(matchesEmpenhoStatusFilter(rapLiquidado, 'liquidado')).toBe(true);
    expect(getRapSaldo(rapLiquidado)).toBe(20);
    expect(getRapLiquidado(rapLiquidado)).toBe(80);
    expect(getRapBase(rapReinscrito)).toBe(90);
    expect(getRapSaldo(rapReinscrito)).toBe(60);
    expect(getRapLiquidado(rapReinscrito)).toBe(30);

    expect(matchesEmpenhoStatusFilter(rapPago, 'pago')).toBe(true);
    expect(matchesEmpenhoStatusFilter(rapPago, 'pendente')).toBe(false);
  });

  it('combina busca textual, busca por documento e periodo', () => {
    const empenhos = [
      createEmpenho({
        id: 'favorecido',
        favorecidoNome: 'Fundacao de Apoio',
        favorecidoDocumento: '12.345.678/0001-90',
        dataEmpenho: new Date('2026-03-10'),
      }),
      createEmpenho({
        id: 'fora-periodo',
        numero: '2026NE0002',
        favorecidoNome: 'Outro fornecedor',
        favorecidoDocumento: '98.765.432/0001-10',
        dataEmpenho: new Date('2026-01-05'),
      }),
    ];

    const byDocumento = filterEmpenhos(empenhos, {
      searchTerm: '12345678000190',
      filterStatus: 'pendente',
      filterDimensao: 'all',
      filterComponente: 'all',
      filterOrigem: 'all',
      filterPlanoInterno: 'all',
      dataInicio: '2026-03-01',
      dataFim: '2026-03-31',
    });

    expect(byDocumento).toHaveLength(1);
    expect(byDocumento[0].id).toBe('favorecido');
  });
});
