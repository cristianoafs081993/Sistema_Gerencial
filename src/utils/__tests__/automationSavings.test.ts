import {
  buildAutomationSavingsRows,
  getEventExecutionCount,
  getInclusivePeriodDays,
  summarizeAutomationSavings,
  type AutomationSavingsScenario,
} from '@/utils/automationSavings';

const scenario: AutomationSavingsScenario = {
  id: 'scenario-a',
  interactionName: 'Atividade automatizada',
  moduleName: 'Modulo',
  source: 'Sistema',
  baselineMinutes: 10,
  automatedMinutes: 4,
  estimatedMonthlyRuns: 30,
  status: 'active',
  sortOrder: 10,
};

describe('automationSavings', () => {
  it('calcula o periodo de forma inclusiva', () => {
    expect(getInclusivePeriodDays('2026-04-01', '2026-04-30')).toBe(30);
    expect(getInclusivePeriodDays('2026-04-10', '2026-04-10')).toBe(1);
  });

  it('usa estimativa mensal proporcional quando nao existem eventos reais', () => {
    const rows = buildAutomationSavingsRows({
      scenarios: [scenario],
      events: [],
      startDate: '2026-04-01',
      endDate: '2026-04-15',
    });

    expect(rows[0]).toMatchObject({
      estimatedExecutions: 15,
      realExecutions: 0,
      totalSavedMinutes: 90,
      dataOrigin: 'estimated',
    });
  });

  it('usa eventos reais e multiplica por metadata.count', () => {
    const rows = buildAutomationSavingsRows({
      scenarios: [scenario],
      events: [
        {
          scenarioId: 'scenario-a',
          source: 'extensao',
          eventName: 'lote',
          occurredAt: '2026-04-05T12:00:00.000Z',
          metadata: { count: 3 },
          baselineMinutes: 10,
          automatedMinutes: 4,
          savedMinutes: 6,
        },
      ],
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });

    expect(getEventExecutionCount({ metadata: { count: 3 } })).toBe(3);
    expect(rows[0]).toMatchObject({
      estimatedExecutions: 0,
      realExecutions: 3,
      totalManualMinutes: 30,
      totalAutomatedMinutes: 12,
      totalSavedMinutes: 18,
      dataOrigin: 'real',
    });
  });

  it('resume totais agregados das linhas', () => {
    const rows = buildAutomationSavingsRows({
      scenarios: [scenario],
      events: [],
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });

    expect(summarizeAutomationSavings(rows)).toMatchObject({
      mappedInteractions: 1,
      totalEstimatedExecutions: 30,
      totalSavedMinutes: 180,
    });
  });
});
