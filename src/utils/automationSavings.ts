export type AutomationSavingsScenario = {
  id: string;
  interactionName: string;
  moduleName: string;
  source: string;
  baselineMinutes: number;
  automatedMinutes: number;
  estimatedMonthlyRuns: number;
  status: 'active' | 'inactive';
  sortOrder: number;
};

export type AutomationSavingsEvent = {
  id?: string;
  scenarioId: string;
  source: string;
  eventName: string;
  occurredAt: string;
  userEmail?: string | null;
  metadata?: Record<string, unknown> | null;
  baselineMinutes: number;
  automatedMinutes: number;
  savedMinutes: number;
};

export type AutomationSavingsRow = AutomationSavingsScenario & {
  savedMinutesPerRun: number;
  realExecutions: number;
  estimatedExecutions: number;
  effectiveExecutions: number;
  totalManualMinutes: number;
  totalAutomatedMinutes: number;
  totalSavedMinutes: number;
  dataOrigin: 'real' | 'estimated';
};

export type AutomationSavingsTotals = {
  totalSavedMinutes: number;
  totalManualMinutes: number;
  totalAutomatedMinutes: number;
  totalRealExecutions: number;
  totalEstimatedExecutions: number;
  mappedInteractions: number;
};

export const DEFAULT_AUTOMATION_SAVINGS_SCENARIOS: AutomationSavingsScenario[] = [
  {
    id: 'siafi-login',
    interactionName: 'Login e preparação no SIAFI',
    moduleName: 'SIAFI',
    source: 'Sistema + extensão',
    baselineMinutes: 8,
    automatedMinutes: 2,
    estimatedMonthlyRuns: 40,
    status: 'active',
    sortOrder: 10,
  },
  {
    id: 'relatorios-gerenciais',
    interactionName: 'Montagem de relatório gerencial',
    moduleName: 'Relatórios',
    source: 'Sistema Gerencial',
    baselineMinutes: 45,
    automatedMinutes: 5,
    estimatedMonthlyRuns: 12,
    status: 'active',
    sortOrder: 20,
  },
  {
    id: 'documentos-liquidacoes',
    interactionName: 'Consulta de documentos/liquidações',
    moduleName: 'Financeiro',
    source: 'Sistema Gerencial',
    baselineMinutes: 25,
    automatedMinutes: 4,
    estimatedMonthlyRuns: 30,
    status: 'active',
    sortOrder: 30,
  },
  {
    id: 'conciliacao-pfs-lc',
    interactionName: 'Conciliação de PFs/LC',
    moduleName: 'PFs e LC',
    source: 'Sistema Gerencial',
    baselineMinutes: 60,
    automatedMinutes: 10,
    estimatedMonthlyRuns: 8,
    status: 'active',
    sortOrder: 40,
  },
  {
    id: 'contratos-comprasnet',
    interactionName: 'Consulta de contratos/Comprasnet',
    moduleName: 'Contratos',
    source: 'API Comprasnet',
    baselineMinutes: 40,
    automatedMinutes: 6,
    estimatedMonthlyRuns: 10,
    status: 'active',
    sortOrder: 50,
  },
  {
    id: 'suap-processos',
    interactionName: 'Sincronização SUAP/processos/PDFs',
    moduleName: 'SUAP',
    source: 'Extensão SUAP Scraper',
    baselineMinutes: 35,
    automatedMinutes: 6,
    estimatedMonthlyRuns: 20,
    status: 'active',
    sortOrder: 60,
  },
  {
    id: 'importacoes-arquivos',
    interactionName: 'Importações CSV/XLSX/PDF',
    moduleName: 'Importações',
    source: 'Uploads e Gmail',
    baselineMinutes: 30,
    automatedMinutes: 5,
    estimatedMonthlyRuns: 10,
    status: 'active',
    sortOrder: 70,
  },
  {
    id: 'geracao-documentos',
    interactionName: 'Geração assistida de documentos',
    moduleName: 'Documentos',
    source: 'IA e modelos',
    baselineMinutes: 90,
    automatedMinutes: 20,
    estimatedMonthlyRuns: 6,
    status: 'active',
    sortOrder: 80,
  },
];

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function parseDay(value: string, endOfDay = false) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  if (endOfDay) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
}

export function getInclusivePeriodDays(startDate: string, endDate: string) {
  const start = parseDay(startDate);
  const end = parseDay(endDate);
  if (end < start) return 1;
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / DAY_IN_MS) + 1);
}

export function getEventExecutionCount(event: Pick<AutomationSavingsEvent, 'metadata'>) {
  const count = event.metadata?.count;
  return typeof count === 'number' && Number.isFinite(count) && count > 0 ? count : 1;
}

export function isEventInPeriod(event: Pick<AutomationSavingsEvent, 'occurredAt'>, startDate: string, endDate: string) {
  const occurredAt = new Date(event.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) return false;
  return occurredAt >= parseDay(startDate) && occurredAt <= parseDay(endDate, true);
}

export function buildAutomationSavingsRows(params: {
  scenarios: AutomationSavingsScenario[];
  events: AutomationSavingsEvent[];
  startDate: string;
  endDate: string;
}): AutomationSavingsRow[] {
  const periodDays = getInclusivePeriodDays(params.startDate, params.endDate);
  const eventsByScenario = new Map<string, AutomationSavingsEvent[]>();

  params.events
    .filter((event) => isEventInPeriod(event, params.startDate, params.endDate))
    .forEach((event) => {
      const current = eventsByScenario.get(event.scenarioId) || [];
      current.push(event);
      eventsByScenario.set(event.scenarioId, current);
    });

  return params.scenarios
    .filter((scenario) => scenario.status === 'active')
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((scenario) => {
      const savedMinutesPerRun = Math.max(0, scenario.baselineMinutes - scenario.automatedMinutes);
      const realEvents = eventsByScenario.get(scenario.id) || [];

      if (realEvents.length > 0) {
        const realExecutions = realEvents.reduce((total, event) => total + getEventExecutionCount(event), 0);
        const totalManualMinutes = realEvents.reduce(
          (total, event) => total + event.baselineMinutes * getEventExecutionCount(event),
          0,
        );
        const totalAutomatedMinutes = realEvents.reduce(
          (total, event) => total + event.automatedMinutes * getEventExecutionCount(event),
          0,
        );
        const totalSavedMinutes = realEvents.reduce(
          (total, event) => total + event.savedMinutes * getEventExecutionCount(event),
          0,
        );

        return {
          ...scenario,
          savedMinutesPerRun,
          realExecutions,
          estimatedExecutions: 0,
          effectiveExecutions: realExecutions,
          totalManualMinutes,
          totalAutomatedMinutes,
          totalSavedMinutes,
          dataOrigin: 'real' as const,
        };
      }

      const estimatedExecutions = (scenario.estimatedMonthlyRuns / 30) * periodDays;
      const totalManualMinutes = scenario.baselineMinutes * estimatedExecutions;
      const totalAutomatedMinutes = scenario.automatedMinutes * estimatedExecutions;

      return {
        ...scenario,
        savedMinutesPerRun,
        realExecutions: 0,
        estimatedExecutions,
        effectiveExecutions: estimatedExecutions,
        totalManualMinutes,
        totalAutomatedMinutes,
        totalSavedMinutes: savedMinutesPerRun * estimatedExecutions,
        dataOrigin: 'estimated' as const,
      };
    });
}

export function summarizeAutomationSavings(rows: AutomationSavingsRow[]): AutomationSavingsTotals {
  return rows.reduce<AutomationSavingsTotals>(
    (total, row) => ({
      totalSavedMinutes: total.totalSavedMinutes + row.totalSavedMinutes,
      totalManualMinutes: total.totalManualMinutes + row.totalManualMinutes,
      totalAutomatedMinutes: total.totalAutomatedMinutes + row.totalAutomatedMinutes,
      totalRealExecutions: total.totalRealExecutions + row.realExecutions,
      totalEstimatedExecutions: total.totalEstimatedExecutions + row.estimatedExecutions,
      mappedInteractions: total.mappedInteractions + 1,
    }),
    {
      totalSavedMinutes: 0,
      totalManualMinutes: 0,
      totalAutomatedMinutes: 0,
      totalRealExecutions: 0,
      totalEstimatedExecutions: 0,
      mappedInteractions: 0,
    },
  );
}

export function getMonthlySavingsProjectionMinutes(totalSavedMinutes: number, startDate: string, endDate: string) {
  return (totalSavedMinutes / getInclusivePeriodDays(startDate, endDate)) * 30;
}
