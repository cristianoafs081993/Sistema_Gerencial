// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
type QueryResult = { data: Row[] | null; error: { message: string; code?: string } | null };

const tables = new Map<string, QueryResult>();

function queryFor(table: string) {
  const all = () => tables.get(table) ?? { data: [], error: null };
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'order', 'limit']) builder[method] = () => builder;
  builder.range = (from: number, to: number) => {
    const { data, error } = all();
    return Promise.resolve({ data: data ? data.slice(from, to + 1) : data, error });
  };
  builder.maybeSingle = () => Promise.resolve({ data: all().data?.[0] ?? null, error: all().error });
  builder.then = (resolve: (value: QueryResult) => unknown) => Promise.resolve(all()).then(resolve);
  return builder;
}

vi.mock('../../mobile/src/lib/supabase', () => ({
  supabase: { from: (table: string) => queryFor(table) },
  DEFAULT_CAMPUS_UASG: '158366',
}));

import {
  calcularVigencia,
  compararContratos,
  contratoVisivelPorPadrao,
  faturaPendente,
  valorTotalDoHistorico,
} from '../../mobile/src/lib/contratosRules';
import { formatarDataIso, formatarMoedaCompacta } from '../../mobile/src/lib/format';
import { fetchContratoDetalhe, fetchContratos } from '../../mobile/src/services/contratos';

const HOJE = new Date(2026, 8, 30); // 30/09/2026

describe('mobile — regras de vigência de contratos', () => {
  it('classifica vigente, a vencer (até 90 dias) e expirado', () => {
    expect(calcularVigencia('2025-01-01', '2027-12-31', true, HOJE).status).toBe('vigente');
    expect(calcularVigencia('2025-01-01', '2026-12-29', true, HOJE).status).toBe('a_vencer'); // 90 dias
    expect(calcularVigencia('2025-01-01', '2026-12-30', true, HOJE).status).toBe('vigente'); // 91 dias
    expect(calcularVigencia('2025-01-01', '2026-09-30', true, HOJE)).toMatchObject({ status: 'a_vencer', texto: 'Vence hoje' });
    expect(calcularVigencia('2025-01-01', '2026-09-18', true, HOJE)).toMatchObject({ status: 'expirado', texto: 'Expirou há 12 dias' });
  });

  it('trata contrato encerrado pelo servidor (situação derivada falsa) como expirado', () => {
    expect(calcularVigencia('2025-01-01', '2027-12-31', false, HOJE).status).toBe('expirado');
    expect(calcularVigencia(null, null, false, HOJE).texto).toBe('Encerrado');
    expect(calcularVigencia(null, null, true, HOJE).texto).toBe('Sem data de término');
  });

  it('calcula o percentual do prazo decorrido sem inventar valores', () => {
    const meio = calcularVigencia('2026-01-01', '2027-01-01', true, new Date(2026, 6, 2));
    expect(meio.percentualDecorrido).toBeGreaterThanOrEqual(49);
    expect(meio.percentualDecorrido).toBeLessThanOrEqual(51);
    expect(calcularVigencia(null, '2027-01-01', true, HOJE).percentualDecorrido).toBe(0);
  });

  it('mantém na lista vigentes e expirados há até 120 dias, como o web', () => {
    expect(contratoVisivelPorPadrao('2027-01-01', true, HOJE)).toBe(true);
    expect(contratoVisivelPorPadrao('2026-06-10', false, HOJE)).toBe(true); // 112 dias
    expect(contratoVisivelPorPadrao('2026-05-30', false, HOJE)).toBe(false); // 123 dias
    expect(contratoVisivelPorPadrao(null, false, HOJE)).toBe(false);
  });

  it('soma o valor inicial de todos os termos em centavos', () => {
    expect(valorTotalDoHistorico([])).toBe(0);
    expect(valorTotalDoHistorico([{ valor_inicial: 0.1 }, { valor_inicial: 0.2 }, { valor_inicial: '1000.5' }])).toBe(1000.8);
  });

  it('considera pendente toda fatura que não está paga nem apropriada no SIAFI', () => {
    expect(faturaPendente('Pendente')).toBe(true);
    expect(faturaPendente('Aguardando ateste')).toBe(true);
    expect(faturaPendente(null)).toBe(true);
    expect(faturaPendente('Pago')).toBe(false);
    expect(faturaPendente(' SIAFI Apropriado ')).toBe(false);
  });

  it('ordena: a vencer mais urgente, vigentes por prazo, expirados mais recentes primeiro', () => {
    const lista = [
      { id: 'exp-antigo', status: 'expirado' as const, dias: -100, temFaturaPendente: false },
      { id: 'vigente-longe', status: 'vigente' as const, dias: 400, temFaturaPendente: false },
      { id: 'exp-recente', status: 'expirado' as const, dias: -5, temFaturaPendente: false },
      { id: 'vencer-30', status: 'a_vencer' as const, dias: 30, temFaturaPendente: false },
      { id: 'vencer-10', status: 'a_vencer' as const, dias: 10, temFaturaPendente: false },
      { id: 'vigente-perto', status: 'vigente' as const, dias: 120, temFaturaPendente: false },
    ];
    expect([...lista].sort(compararContratos).map((c) => c.id)).toEqual([
      'vencer-10',
      'vencer-30',
      'vigente-perto',
      'vigente-longe',
      'exp-recente',
      'exp-antigo',
    ]);
  });
});

describe('mobile — formatação', () => {
  it('formata datas ISO sem deslocar o dia por fuso horário', () => {
    expect(formatarDataIso('2026-09-30')).toBe('30 set. 2026');
    expect(formatarDataIso('2026-01-01T00:00:00+00:00')).toBe('01 jan. 2026');
    expect(formatarDataIso(null)).toBe('—');
    expect(formatarDataIso('lixo', 'n/d')).toBe('n/d');
  });

  it('abrevia moeda para cartões estreitos', () => {
    expect(formatarMoedaCompacta(1_234_567)).toBe('R$ 1,23 mi');
    expect(formatarMoedaCompacta(350_000)).toBe('R$ 350 mil');
    expect(formatarMoedaCompacta(0)).toMatch(/R\$\s?0/);
  });
});

describe('mobile — fetchContratos', () => {
  beforeEach(() => tables.clear());

  const contrato = (over: Row) => ({
    id: 'c1',
    numero: '00001/2024',
    fornecedor_nome: 'EMPRESA LTDA',
    objeto: 'Serviços de limpeza',
    situacao_derivada: true,
    vigencia_inicio: '2025-01-01',
    vigencia_fim: '2027-12-31',
    valor_global: 100000,
    ...over,
  });

  it('retorna lista vazia quando o campus não tem contratos no escopo', async () => {
    tables.set('contratos_api_campus_scope', { data: [], error: null });

    expect(await fetchContratos('158366', HOJE)).toEqual([]);
  });

  it('usa dados reais: nada de empenhado inventado e empenhos só da UG do campus', async () => {
    tables.set('contratos_api_campus_scope', { data: [{ contrato_api_id: 'c1' }], error: null });
    tables.set('contratos_api', { data: [contrato({})], error: null });
    tables.set('contratos_api_empenhos', {
      data: [
        { contrato_api_id: 'c1', unidade_gestora: '158366', valor_empenhado: 1000, valor_a_liquidar: 400, valor_liquidado: 600, valor_pago: 500 },
        { contrato_api_id: 'c1', unidade_gestora: '158155', valor_empenhado: 99999, valor_a_liquidar: 1, valor_liquidado: 1, valor_pago: 1 },
      ],
      error: null,
    });
    tables.set('contratos_api_faturas', {
      data: [
        { contrato_api_id: 'c1', situacao: 'Pago' },
        { contrato_api_id: 'c1', situacao: 'Pendente' },
        { contrato_api_id: 'c1', situacao: 'Aguardando ateste' },
      ],
      error: null,
    });
    tables.set('contratos_api_historico', {
      data: [
        { contrato_api_id: 'c1', valor_inicial: 100000 },
        { contrato_api_id: 'c1', valor_inicial: 25000 },
      ],
      error: null,
    });

    const [item] = await fetchContratos('158366', HOJE);

    expect(item).toMatchObject({
      uuid: 'c1',
      numero: '00001/2024',
      fornecedor: 'EMPRESA LTDA',
      valorGlobal: 125000, // soma dos termos, não o valor_global
      empenhado: 1000,
      aLiquidar: 400,
      liquidado: 600,
      pago: 500,
      faturasPendentes: 2,
      status: 'vigente',
    });
  });

  it('sem histórico usa o valor global e sem empenhos zera (não inventa 70%)', async () => {
    tables.set('contratos_api_campus_scope', { data: [{ contrato_api_id: 'c1' }], error: null });
    tables.set('contratos_api', { data: [contrato({})], error: null });

    const [item] = await fetchContratos('158366', HOJE);

    expect(item.valorGlobal).toBe(100000);
    expect(item.empenhado).toBe(0);
    expect(item.faturasPendentes).toBe(0);
  });

  it('esconde contratos expirados há mais de 120 dias e ordena por urgência', async () => {
    tables.set('contratos_api_campus_scope', {
      data: ['c1', 'c2', 'c3', 'c4'].map((id) => ({ contrato_api_id: id })),
      error: null,
    });
    tables.set('contratos_api', {
      data: [
        contrato({ id: 'c1', numero: 'LONGE', vigencia_fim: '2028-01-01' }),
        contrato({ id: 'c2', numero: 'URGENTE', vigencia_fim: '2026-10-15' }),
        contrato({ id: 'c3', numero: 'ANTIGO', vigencia_fim: '2026-01-01', situacao_derivada: false }),
        contrato({ id: 'c4', numero: 'RECENTE', vigencia_fim: '2026-09-01', situacao_derivada: false }),
      ],
      error: null,
    });

    const lista = await fetchContratos('158366', HOJE);

    expect(lista.map((c) => c.numero)).toEqual(['URGENTE', 'LONGE', 'RECENTE']);
    expect(lista.map((c) => c.status)).toEqual(['a_vencer', 'vigente', 'expirado']);
  });

  it('propaga o erro em vez de mostrar contratos de demonstração', async () => {
    tables.set('contratos_api_campus_scope', { data: [{ contrato_api_id: 'c1' }], error: null });
    tables.set('contratos_api', { data: null, error: { message: 'falhou' } });

    await expect(fetchContratos('158366', HOJE)).rejects.toThrow('falhou');
  });

  it('cai no escopo legado quando a tabela de escopo não existe', async () => {
    tables.set('contratos_api_campus_scope', { data: null, error: { message: 'relation does not exist', code: '42P01' } });
    tables.set('contratos_api', { data: [contrato({})], error: null });

    expect(await fetchContratos('158366', HOJE)).toHaveLength(1);
  });
});

describe('mobile — fetchContratoDetalhe', () => {
  beforeEach(() => tables.clear());

  it('monta empenhos do campus, faturas, itens e termos', async () => {
    tables.set('contratos_api_empenhos', {
      data: [
        { id: 'e1', numero: '2026NE0001', unidade_gestora: '158366', valor_empenhado: 10, valor_a_liquidar: 4, valor_liquidado: 6, valor_pago: 5 },
        { id: 'e2', numero: '2026NE0002', unidade_gestora: '158155', valor_empenhado: 99 },
      ],
      error: null,
    });
    tables.set('contratos_api_faturas', {
      data: [
        { id: 'f1', numero_instrumento_cobranca: '123', mes_referencia: '3', ano_referencia: '2026', situacao: 'Pago', valor_bruto: 100, valor_liquido: 90 },
        { id: 'f2', api_fatura_id: 7, mes_referencia: null, situacao: null, valor_bruto: 50, valor_liquido: 50 },
      ],
      error: null,
    });
    tables.set('contratos_api_itens', {
      data: [{ id: 'i1', descricao_complementar: '  Limpeza mensal ', quantidade: '12', valor_unitario: '100.5', valor_total: '1206' }],
      error: null,
    });
    tables.set('contratos_api_historico', {
      data: [{ id: 't1', tipo: 'Termo Aditivo', numero: '01', valor_inicial: 500, observacao: ' prorroga ' }],
      error: null,
    });

    const detalhe = await fetchContratoDetalhe('c1', '158366');

    expect(detalhe.empenhos.map((e) => e.numero)).toEqual(['2026NE0001']);
    expect(detalhe.faturas[0]).toMatchObject({ referencia: '03/2026', pendente: false });
    expect(detalhe.faturas[1]).toMatchObject({ numero: '7', referencia: '—', situacao: 'Sem situação', pendente: true });
    expect(detalhe.itens[0]).toMatchObject({ descricao: 'Limpeza mensal', quantidade: 12, valorUnitario: 100.5, valorTotal: 1206 });
    expect(detalhe.termos[0]).toMatchObject({ tipo: 'Termo Aditivo', valor: 500, observacao: 'prorroga' });
  });
});
