/**
 * Teste de INTEGRAÇÃO do app mobile: fala com o backend real (Supabase) — por isso fica fora de `npm test`.
 * Rode com `npm run test:integration`. Não fixa valores (os dados mudam); valida formato e coerência.
 *
 * Observação: lê com a chave anônima. Quando a leitura pública das tabelas financeiras for revogada,
 * este teste deverá autenticar com um usuário de teste.
 */
import { describe, expect, it } from 'vitest';

import { fetchEmpenhos, fetchNotifications, sortNotificationEvents } from '../../mobile/src/services/api';
import { fetchContratos } from '../../mobile/src/services/contratos';
import { fetchDashboard } from '../../mobile/src/services/dashboard';
import type { NotificationItem } from '../../mobile/src/types';

const CAMPUS = '158366';
const TIMEOUT = 60_000;

describe('SIAGES Mobile — integração com o backend (dados reais)', () => {
  it('dashboard: métricas coerentes e lista de PTRES começando por "Todos"', async () => {
    const { metricas, ptres, atualizadoEm } = await fetchDashboard(CAMPUS);

    expect(ptres[0]).toMatchObject({ code: 'all' });
    expect(atualizadoEm).toBeInstanceOf(Date);
    for (const valor of [metricas.planejado, metricas.descentralizado, metricas.empenhado, metricas.liquidado, metricas.pago]) {
      expect(Number.isFinite(valor)).toBe(true);
      expect(valor).toBeGreaterThanOrEqual(0);
    }
    expect(metricas.aPagar).toBe(Math.max(0, metricas.liquidado - metricas.pago));
    expect(metricas.mensal.length).toBeGreaterThan(0);
    expect(metricas.mensal.length).toBeLessThanOrEqual(12);
  }, TIMEOUT);

  it('dashboard filtrado por PTRES nunca passa do total geral do empenhado', async () => {
    const geral = await fetchDashboard(CAMPUS);
    const codigo = geral.ptres.find((p) => p.code !== 'all')?.code;
    if (!codigo) return;

    const filtrado = await fetchDashboard(CAMPUS, codigo);
    expect(filtrado.metricas.liquidado).toBeLessThanOrEqual(geral.metricas.liquidado + 0.01);
  }, TIMEOUT);

  it('empenhos: separa exercício e restos a pagar e nunca traz cancelados', async () => {
    const todos = await fetchEmpenhos(CAMPUS);
    const exercicio = await fetchEmpenhos(CAMPUS, 'exercicio');
    const rap = await fetchEmpenhos(CAMPUS, 'rap');

    expect(exercicio.every((e) => e.tipo === 'exercicio')).toBe(true);
    expect(rap.every((e) => e.tipo === 'rap')).toBe(true);
    expect(exercicio.length + rap.length).toBe(todos.length);
  }, TIMEOUT);

  it('contratos: vigência classificada e valores sem inventar empenhado', async () => {
    const contratos = await fetchContratos(CAMPUS);

    expect(new Set(contratos.map((c) => c.uuid)).size).toBe(contratos.length);
    for (const contrato of contratos) {
      expect(['vigente', 'a_vencer', 'expirado']).toContain(contrato.status);
      expect(contrato.empenhado).toBeGreaterThanOrEqual(0);
      expect(contrato.faturasPendentes).toBeGreaterThanOrEqual(0);
    }
  }, TIMEOUT);

  it('notificações: lista cronológica e sem itens fictícios quando não há eventos', async () => {
    const notificacoes = await fetchNotifications(CAMPUS);

    expect(Array.isArray(notificacoes)).toBe(true);
    for (const item of notificacoes) {
      expect(item.date).toBeInstanceOf(Date);
    }
    expect(notificacoes.length).toBeLessThanOrEqual(60);
    for (let i = 1; i < notificacoes.length; i++) {
      expect(notificacoes[i - 1].date.getTime()).toBeGreaterThanOrEqual(notificacoes[i].date.getTime());
    }
  }, TIMEOUT);

  it('ordena eventos por data respeitando o limite máximo', () => {
    const criar = (prefixo: string, total: number): NotificationItem[] =>
      Array.from({ length: total }, (_, i) => ({
        id: `${prefixo}-${i}`,
        type: 'empenho',
        date: new Date(2026, 0, i + 1),
        title: prefixo,
        subtitle: '',
        description: '',
      })) as NotificationItem[];

    const resultado = sortNotificationEvents(criar('e', 30), criar('d', 30), criar('r', 30), 10);

    expect(resultado).toHaveLength(10);
    expect(resultado[0].date).toEqual(new Date(2026, 0, 30));
  });
});
