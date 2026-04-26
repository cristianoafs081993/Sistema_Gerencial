import { loadAutomationSavingsSummary } from '@/services/automationSavingsService';

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  functionsInvoke: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: supabaseMocks.from,
    functions: {
      invoke: supabaseMocks.functionsInvoke,
    },
  },
}));

function createScenarioBuilder(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

function createEventBuilder(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

describe('automationSavingsService', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('carrega cenarios e eventos reais do Supabase', async () => {
    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === 'automation_savings_scenarios') {
        return createScenarioBuilder({
          data: [
            {
              id: 'suap-processos',
              interaction_name: 'Sincronização SUAP/processos/PDFs',
              module_name: 'SUAP',
              source: 'Extensão SUAP Scraper',
              baseline_minutes: 35,
              automated_minutes: 6,
              estimated_monthly_runs: 20,
              status: 'active',
              sort_order: 10,
            },
          ],
          error: null,
        });
      }

      return createEventBuilder({
        data: [
          {
            id: 'event-1',
            scenario_id: 'suap-processos',
            source: 'suap-atividades-extension',
            event_name: 'atividades_sincronizadas',
            occurred_at: '2026-04-10T12:00:00.000Z',
            user_email: null,
            metadata: { count: 2 },
            baseline_minutes: 35,
            automated_minutes: 6,
            saved_minutes: 29,
          },
        ],
        error: null,
      });
    });

    const summary = await loadAutomationSavingsSummary({
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });

    expect(summary.usedFallback).toBe(false);
    expect(summary.rows[0]).toMatchObject({
      realExecutions: 2,
      totalSavedMinutes: 58,
      dataOrigin: 'real',
    });
  });

  it('usa catalogo local quando a tabela de cenarios esta indisponivel', async () => {
    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === 'automation_savings_scenarios') {
        return createScenarioBuilder({
          data: null,
          error: { message: 'relation not found' },
        });
      }

      return createEventBuilder({
        data: [],
        error: null,
      });
    });

    const summary = await loadAutomationSavingsSummary({
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });

    expect(summary.usedFallback).toBe(true);
    expect(summary.rows.map((row) => row.id)).toContain('suap-processos');
    expect(summary.totals.totalSavedMinutes).toBeGreaterThan(0);
  });
});
