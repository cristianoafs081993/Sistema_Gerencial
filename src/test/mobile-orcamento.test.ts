// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
type QueryResult = { data: Row[] | null; error: { message: string; code?: string } | null };

const tables = new Map<string, QueryResult>();

function queryFor(table: string) {
  const all = () => tables.get(table) ?? { data: [], error: null };
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'neq', 'order', 'limit']) builder[method] = () => builder;
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
  codigoDaDimensao,
  creditoPorPtres,
  ehEstorno,
  filtrarCredito,
  filtrarDescentralizacoes,
  resumirDescentralizacoes,
  totalCredito,
  type CreditoLinha,
  type DescentralizacaoLinha,
} from '../../mobile/src/lib/orcamentoRules';
import { ALL_TABS, secoesOrcamento, tabsFromScreens } from '../../mobile/src/services/access';
import { fetchCredito, fetchDescentralizacoes, fetchMovimentacoesPtres } from '../../mobile/src/services/orcamento';

const linha = (over: Partial<DescentralizacaoLinha>): DescentralizacaoLinha => ({
  id: 'd1',
  data: '2026-03-10',
  dimensao: 'AD - Administração',
  notaCredito: '2026NC000123',
  operacao: null,
  origem: '231796 - PROAD',
  naturezaDespesa: '339039',
  planoInterno: 'L2994P23ADN',
  descricao: 'Crédito para manutenção predial',
  valor: 1000,
  ...over,
});

describe('mobile — descentralizações', () => {
  const linhas = [
    linha({ id: 'a', valor: 1000 }),
    linha({ id: 'b', origem: '261941', dimensao: 'AE - Atividades Estudantis', descricao: 'Alimentação escolar', valor: 500 }),
    linha({ id: 'c', valor: -200, operacao: 'Anulação' }),
  ];

  it('usa o saldo oficial da conta quando não há busca', () => {
    const r = resumirDescentralizacoes({
      linhas,
      contaSaldos: [{ ptres: '231796', valor: 700 }, { ptres: '261941', valor: 450 }],
    });

    expect(r).toMatchObject({ total: 1150, oficial: true, quantidade: 3 });
    expect(r.porPtres).toEqual([{ ptres: '231796', valor: 700 }, { ptres: '261941', valor: 450 }]);
  });

  it('com busca soma só os lançamentos encontrados (como no web)', () => {
    const r = resumirDescentralizacoes({ linhas, contaSaldos: [{ ptres: '231796', valor: 700 }], busca: 'alimentacao' });

    expect(r).toMatchObject({ total: 500, oficial: false, quantidade: 1 });
  });

  it('sem conta importada soma as linhas e agrupa por PTRES', () => {
    const r = resumirDescentralizacoes({ linhas, contaSaldos: [] });

    expect(r).toMatchObject({ total: 1300, oficial: false });
    expect(r.porPtres).toEqual([{ ptres: '231796', valor: 800 }, { ptres: '261941', valor: 500 }]);
  });

  it('filtra por PTRES sem confundir códigos parecidos', () => {
    const r = resumirDescentralizacoes({ linhas, contaSaldos: [{ ptres: '231796', valor: 700 }, { ptres: '261941', valor: 450 }], ptres: '261941' });

    expect(r.total).toBe(450);
    expect(filtrarDescentralizacoes(linhas, { ptres: '23179' })).toHaveLength(0);
  });

  it('identifica dimensão e estorno', () => {
    expect(codigoDaDimensao('AD - Administração')).toBe('AD');
    expect(codigoDaDimensao('')).toBe('—');
    expect(ehEstorno(linha({ valor: -1 }))).toBe(true);
    expect(ehEstorno(linha({ valor: 1 }))).toBe(false);
  });
});

describe('mobile — crédito disponível', () => {
  const credito: CreditoLinha[] = [
    { id: '1', ptres: '231796', planoInterno: 'L2994P23ADN', descricao: 'Manutenção', valor: 300 },
    { id: '2', ptres: '231796', planoInterno: 'L2994P23ENN', descricao: 'Ensino', valor: 0 },
    { id: '3', ptres: '261941', planoInterno: 'L2994P23AEN', descricao: 'Alimentação', valor: 700 },
  ];

  it('filtra por saldo, PTRES e busca', () => {
    expect(filtrarCredito(credito, { saldo: 'com-saldo' }).map((c) => c.id)).toEqual(['1', '3']);
    expect(filtrarCredito(credito, { saldo: 'zerado' }).map((c) => c.id)).toEqual(['2']);
    expect(filtrarCredito(credito, { saldo: 'todos', ptres: '261941' }).map((c) => c.id)).toEqual(['3']);
    expect(filtrarCredito(credito, { saldo: 'todos', busca: 'alimentacao' }).map((c) => c.id)).toEqual(['3']);
  });

  it('soma e agrupa por PTRES', () => {
    expect(totalCredito(credito)).toBe(1000);
    expect(creditoPorPtres(credito)).toEqual([{ ptres: '261941', valor: 700 }, { ptres: '231796', valor: 300 }]);
  });
});

describe('mobile — permissões da aba Orçamento', () => {
  it('libera a aba com qualquer uma das três telas e as seções conforme a permissão', () => {
    expect(tabsFromScreens(['descentralizacoes'])).toEqual(['empenhos']);
    expect(tabsFromScreens(['credito-disponivel'])).toEqual(['empenhos']);
    expect(tabsFromScreens(['contratos'])).toEqual(['contratos']);
    expect(secoesOrcamento(['empenhos', 'credito-disponivel'])).toEqual(['empenhos', 'credito']);
    expect(secoesOrcamento(['dashboard'])).toEqual([]);
    expect(ALL_TABS).toContain('empenhos');
  });
});

describe('mobile — serviço orcamento', () => {
  beforeEach(() => tables.clear());

  it('fetchDescentralizacoes mapeia as linhas e a conta', async () => {
    tables.set('descentralizacoes', {
      data: [{ id: 'd1', dimensao: 'EN - Ensino', origem_recurso: '231802', valor: '250.5', data_emissao: '2026-02-01', descricao: 'x' }],
      error: null,
    });
    tables.set('descentralizacoes_conta_saldos', { data: [{ ptres: '231802', valor: '250.5' }], error: null });

    const r = await fetchDescentralizacoes('158366');

    expect(r.linhas[0]).toMatchObject({ id: 'd1', dimensao: 'EN - Ensino', origem: '231802', valor: 250.5 });
    expect(r.contaSaldos).toEqual([{ ptres: '231802', valor: 250.5 }]);
  });

  it('tolera conta inexistente (rollout antigo) mas propaga outros erros', async () => {
    tables.set('descentralizacoes', { data: [], error: null });
    tables.set('descentralizacoes_conta_saldos', { data: null, error: { message: 'relation does not exist', code: '42P01' } });
    expect((await fetchDescentralizacoes()).contaSaldos).toEqual([]);

    tables.set('descentralizacoes_conta_saldos', { data: null, error: { message: 'permission denied' } });
    await expect(fetchDescentralizacoes()).rejects.toThrow('permission denied');
  });

  it('fetchCredito devolve vazio sem relatório e mapeia o último lote', async () => {
    expect(await fetchCredito()).toEqual({ linhas: [], importadoEm: null, arquivo: null });

    tables.set('creditos_disponiveis_detalhes', {
      data: [{ id: 'c1', import_batch_id: 'b1', source_file: 'rel.csv', imported_at: '2026-09-01T10:00:00Z', ptres: 231796, plano_interno: null, descricao: null, valor: '99.9' }],
      error: null,
    });
    const r = await fetchCredito();

    expect(r).toMatchObject({ importadoEm: '2026-09-01T10:00:00Z', arquivo: 'rel.csv' });
    expect(r.linhas[0]).toEqual({ id: 'c1', ptres: '231796', planoInterno: '', descricao: '', valor: 99.9 });
  });

  it('fetchMovimentacoesPtres traz só empenhos e descentralizações do PTRES', async () => {
    tables.set('empenhos', {
      data: [
        { id: 'e1', numero: '2026NE1', favorecido_nome: 'A', origem_recurso: '231796 - PROAD', valor: 10, valor_liquidado_oficial: 6, valor_pago_oficial: 5 },
        { id: 'e2', numero: '2026NE2', favorecido_nome: null, origem_recurso: '261941', valor: 99 },
      ],
      error: null,
    });
    tables.set('descentralizacoes', {
      data: [
        { id: 'd1', origem_recurso: '231796', valor: 7 },
        { id: 'd2', origem_recurso: '261941', valor: 8 },
      ],
      error: null,
    });

    const r = await fetchMovimentacoesPtres('231796');

    expect(r.empenhos).toEqual([{ id: 'e1', numero: '2026NE1', favorecido: 'A', data: null, valor: 10, liquidado: 6, pago: 5 }]);
    expect(r.descentralizacoes.map((d) => d.id)).toEqual(['d1']);
  });
});
