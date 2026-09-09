import { describe, it, expect, vi } from 'vitest';

import {
  fetchDashboardMetrics,
  fetchEmpenhos,
  fetchContratos,
  fetchNotifications,
  interleaveEvents,
  isOrigemRecursoIgnoradaNoEmpenhado,
} from '../../mobile/src/services/api';
import type { NotificationItem } from '../../mobile/src/types';

describe('SIAGES Mobile - Serviços de Integração ao Backend (Dados Reais)', () => {
  it('deve identificar corretamente origens de recursos ignoradas no cálculo de empenhado descentralizado (ex: 230446)', () => {
    expect(isOrigemRecursoIgnoradaNoEmpenhado('230446')).toBe(true);
    expect(isOrigemRecursoIgnoradaNoEmpenhado('AD.20RL.230446.3')).toBe(true);
    expect(isOrigemRecursoIgnoradaNoEmpenhado('230446 - PNAE')).toBe(true);
    expect(isOrigemRecursoIgnoradaNoEmpenhado('231796')).toBe(false);
    expect(isOrigemRecursoIgnoradaNoEmpenhado('Tesouro')).toBe(false);
    expect(isOrigemRecursoIgnoradaNoEmpenhado(null)).toBe(false);
    expect(isOrigemRecursoIgnoradaNoEmpenhado(undefined)).toBe(false);
  });

  it('deve buscar e agregar métricas do exercício 2026 com destaque para o Planejado', async () => {
    const metrics = await fetchDashboardMetrics('158366');

    expect(metrics).toBeDefined();
    expect(metrics.instituicao).toBe('IFRN');
    expect(metrics.campus).toBe('Campus Currais Novos');
    expect(metrics.exercicio).toBe('2026');

    // Validações do Planejado (Métrica Principal)
    expect(metrics.planejado).toBeGreaterThan(3000000);
    expect(metrics.totalAtividades).toBeGreaterThan(300);
    expect(metrics.percentualExecutadoNum).toBeGreaterThan(60);
    expect(metrics.aDescentralizar).toBe(metrics.planejado - metrics.descentralizado);

    // Validações orçamentárias exatas
    expect(metrics.empenhado).toBeGreaterThan(2000000);
    expect(metrics.descentralizado).toBeGreaterThan(2500000);
    expect(metrics.saldoDisponivel).toBe(metrics.descentralizado - metrics.empenhado);
    expect(metrics.liquidado).toBeGreaterThan(1200000);
    expect(metrics.pago).toBeGreaterThan(1100000);
    expect(metrics.aPagar).toBe(metrics.liquidado - metrics.pago);
    expect(metrics.contratosAVencerCount).toBeGreaterThanOrEqual(1);

    expect(metrics.monthlyChart).toHaveLength(6);
  });

  it('deve buscar e mapear a lista de empenhos do exercício 2026 sem empenhos cancelados', async () => {
    const empenhos = await fetchEmpenhos('158366', 'exercicio');

    expect(empenhos.length).toBeGreaterThan(0);
    const first = empenhos[0];
    expect(first.id).toBeDefined();
    expect(first.name).toBeDefined();
    expect(first.value).toBeGreaterThanOrEqual(0);
    expect(['liquidar', 'pagar', 'pago']).toContain(first.status);
    expect(first.date).toBeDefined();
    expect(first.nd).toBeDefined();
  });

  it('deve buscar e mapear os contratos do campus com cálculo de vigência', async () => {
    const contratos = await fetchContratos('158366');

    expect(contratos.length).toBeGreaterThan(0);
    const first = contratos[0];
    expect(first.id).toBeDefined();
    expect(first.title).toBeDefined();
    expect(first.name).toBeDefined();
    expect(first.value).toBeGreaterThanOrEqual(0);
    expect(['shield', 'building', 'doc']).toContain(first.icon);
    expect(typeof first.warning).toBe('boolean');
    expect(first.remaining).toBeDefined();
  });

  it('deve buscar notificações da plataforma web intercalando empenhos, descentralizações e requisições', async () => {
    const notifications = await fetchNotifications('158366');

    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications.length).toBeLessThanOrEqual(20);

    const types = new Set(notifications.map((n) => n.type));
    expect(types.has('empenho') || types.has('descentralizacao') || types.has('requisicao')).toBe(true);

    const first = notifications[0];
    expect(first.id).toBeDefined();
    expect(first.title).toBeDefined();
    expect(first.valor).toBeGreaterThanOrEqual(0);
    expect(first.date instanceof Date).toBe(true);
  });

  it('deve intercalar eventos em rodízio respeitando o limite máximo', () => {
    const mockEmpenhos: NotificationItem[] = [
      { id: 'e1', type: 'empenho', date: new Date(), title: 'E1', subtitle: '', description: '', valor: 100 },
      { id: 'e2', type: 'empenho', date: new Date(), title: 'E2', subtitle: '', description: '', valor: 200 },
    ];
    const mockDesc: NotificationItem[] = [
      { id: 'd1', type: 'descentralizacao', date: new Date(), title: 'D1', subtitle: '', description: '', valor: 300 },
    ];
    const mockReq: NotificationItem[] = [
      { id: 'r1', type: 'requisicao', date: new Date(), title: 'R1', subtitle: '', description: '', valor: 400 },
    ];

    const result = interleaveEvents(mockEmpenhos, mockDesc, mockReq, 10);
    expect(result.map((item) => item.id)).toEqual(['r1', 'd1', 'e1', 'e2']);
  });
});

