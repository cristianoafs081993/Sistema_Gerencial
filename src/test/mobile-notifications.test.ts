// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '../../mobile/src/types';

type Row = Record<string, unknown>;
const tables = new Map<string, Row[]>();
const calls: { table: string; method: string; args: unknown[] }[] = [];

vi.mock('../../mobile/src/lib/supabase', () => ({
  DEFAULT_CAMPUS_UASG: '158366',
  supabase: {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'neq', 'in', 'order']) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        };
      }
      builder.limit = (limit: number) => {
        calls.push({ table, method: 'limit', args: [limit] });
        return Promise.resolve({ data: (tables.get(table) ?? []).slice(0, limit), error: null });
      };
      return builder;
    },
  },
}));

import { fetchNotifications, sortNotificationEvents } from '../../mobile/src/services/api';

const event = (id: string, date: string, type: NotificationItem['type'] = 'empenho'): NotificationItem => ({
  id, type, date: new Date(date), title: id, subtitle: '', description: '', valor: 100,
});

describe('mobile — notificações cronológicas', () => {
  beforeEach(() => {
    tables.clear();
    calls.length = 0;
  });

  it('ordena todas as categorias antes do limite, sem alterar as listas de entrada', () => {
    const empenhos = [event('emp-old', '2026-01-01'), event('emp-new', '2026-10-09')];
    const desc = [event('desc-new', '2026-10-08', 'descentralizacao')];
    const req = [event('req-old', '2026-02-01', 'requisicao')];
    const result = sortNotificationEvents(empenhos, desc, req, 2);
    expect(result.map((n) => n.id)).toEqual(['emp-new', 'desc-new']);
    expect(empenhos.map((n) => n.id)).toEqual(['emp-old', 'emp-new']);
  });

  it('desempata datas iguais pelo identificador independentemente da entrada', () => {
    const a = event('a', '2026-10-09');
    const b = event('b', '2026-10-09');
    const c = event('c', '2026-10-09', 'requisicao');
    expect(sortNotificationEvents([b, a], [], [c]).map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(sortNotificationEvents([a, b], [], [c]).map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('usa emissão e atualização, sem priorizar número ou importação recente', async () => {
    tables.set('empenhos', [
      { id: 'old', numero: '2026NE999999', data_empenho: '2026-08-01', created_at: '2026-10-09' },
      { id: 'new', numero: '2026NE000001', data_empenho: '2026-10-08', created_at: '2026-10-08' },
    ]);
    tables.set('descentralizacoes', [
      { id: 'nc', nota_credito: '2026NC000001', data_emissao: '2026-10-07', created_at: '2026-10-09' },
    ]);
    tables.set('requisicoes_compra', [
      { id: 'req', number: 'REQ-1', updated_at: '2026-09-01', created_at: '2026-01-01' },
    ]);
    const result = await fetchNotifications();
    expect(result.map((n) => n.id)).toEqual(['emp-new', 'desc-nc', 'req-req', 'emp-old']);
    expect(result[result.length - 1]?.documentDate).toEqual(new Date('2026-08-01T12:00:00'));
  });

  it.each([null, 'inválida', Number.NaN, Number.POSITIVE_INFINITY])('usa criação válida quando a data principal falha (%s)', async (invalid) => {
    tables.set('empenhos', [{ id: 'e', data_empenho: invalid, created_at: '2026-08-18' }]);
    tables.set('descentralizacoes', [{ id: 'd', data_emissao: invalid, created_at: '19/08/2026' }]);
    tables.set('requisicoes_compra', [{ id: 'r', updated_at: invalid, created_at: '2026-08-20T12:00:00Z' }]);
    const result = await fetchNotifications();
    expect(result.map((n) => n.id)).toEqual(['req-r', 'desc-d', 'emp-e']);
    expect(result.map((n) => n.date)).toEqual([
      new Date('2026-08-20T12:00:00Z'), new Date('2026-08-19T12:00:00'), new Date('2026-08-18T12:00:00'),
    ]);
    expect(result.every((n) => n.documentDate?.getTime() === n.date.getTime())).toBe(true);
  });

  it('coloca datas totalmente inválidas ao final e retorna vazio sem eventos', async () => {
    expect(await fetchNotifications()).toEqual([]);
    tables.set('empenhos', [{ id: 'e', data_empenho: 'inválida', created_at: Number.NaN }]);
    tables.set('descentralizacoes', [{ id: 'd', data_emissao: '2026-10-09', created_at: null }]);
    tables.set('requisicoes_compra', [{ id: 'r', updated_at: null, created_at: null }]);
    const result = await fetchNotifications();
    expect(result.map((n) => n.id)).toEqual(['desc-d', 'emp-e', 'req-r']);
    expect(result.map((n) => Number.isFinite(n.date.getTime()))).toEqual([true, true, true]);
    expect(result.slice(1).every((n) => n.date.getTime() === 0)).toBe(true);
  });

  it('preserva os filtros, 20 registros por categoria e 60 no total', async () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      id: String(i), data_empenho: '2026-10-09', data_emissao: '2026-10-08', updated_at: '2026-10-07',
    }));
    for (const table of ['empenhos', 'descentralizacoes', 'requisicoes_compra']) tables.set(table, rows);
    const result = await fetchNotifications('158367');
    expect(result).toHaveLength(60);
    for (const type of ['empenho', 'descentralizacao', 'requisicao']) {
      expect(result.filter((n) => n.type === type)).toHaveLength(20);
    }
    expect(calls.filter((c) => c.method === 'limit').map((c) => c.args)).toEqual([[20], [20], [20]]);
    expect(calls).toEqual(expect.arrayContaining([
      { table: 'empenhos', method: 'eq', args: ['campus_uasg', '158367'] },
      { table: 'descentralizacoes', method: 'eq', args: ['campus_uasg', '158367'] },
      { table: 'empenhos', method: 'eq', args: ['tipo', 'exercicio'] },
      { table: 'empenhos', method: 'neq', args: ['status', 'cancelado'] },
      { table: 'requisicoes_compra', method: 'in', args: ['status', ['enviada_fornecedor', 'review', 'approved']] },
    ]));
    expect(result.slice(0, 20).every((n) => n.type === 'empenho')).toBe(true);
    expect(result.slice(20, 40).every((n) => n.type === 'descentralizacao')).toBe(true);
    expect(result.slice(40).every((n) => n.type === 'requisicao')).toBe(true);
  });

  it('o limite padrão do helper mantém apenas os 60 mais recentes', () => {
    const events = Array.from({ length: 70 }, (_, i) => event(String(i), `2026-10-09T12:${String(i % 60).padStart(2, '0')}:00Z`));
    const result = sortNotificationEvents(events, []);
    expect(result).toHaveLength(60);
    expect(result[0].date.getTime()).toBe(Math.max(...events.map((n) => n.date.getTime())));
    expect(result.every((n, i) => i === 0 || result[i - 1].date.getTime() >= n.date.getTime())).toBe(true);
  });
});
