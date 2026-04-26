import { supabase } from '@/lib/supabase';
import {
  DEFAULT_AUTOMATION_SAVINGS_SCENARIOS,
  buildAutomationSavingsRows,
  getMonthlySavingsProjectionMinutes,
  summarizeAutomationSavings,
  type AutomationSavingsEvent,
  type AutomationSavingsScenario,
} from '@/utils/automationSavings';

type AutomationSavingsScenarioRow = {
  id: string;
  interaction_name: string;
  module_name: string;
  source: string;
  baseline_minutes: number;
  automated_minutes: number;
  estimated_monthly_runs: number;
  status: 'active' | 'inactive';
  sort_order: number;
};

type AutomationSavingsEventRow = {
  id: string;
  scenario_id: string;
  source: string;
  event_name: string;
  occurred_at: string;
  user_email?: string | null;
  metadata?: Record<string, unknown> | null;
  baseline_minutes: number;
  automated_minutes: number;
  saved_minutes: number;
};

export type AutomationSavingsSummary = {
  scenarios: AutomationSavingsScenario[];
  events: AutomationSavingsEvent[];
  rows: ReturnType<typeof buildAutomationSavingsRows>;
  totals: ReturnType<typeof summarizeAutomationSavings>;
  monthlyProjectionMinutes: number;
  modules: string[];
  usedFallback: boolean;
};

export type AutomationSavingsEventPayload = {
  scenarioId: string;
  source: string;
  eventName: string;
  occurredAt?: string;
  userEmail?: string;
  metadata?: Record<string, unknown>;
};

const SCENARIO_SELECT =
  'id,interaction_name,module_name,source,baseline_minutes,automated_minutes,estimated_monthly_runs,status,sort_order';
const EVENT_SELECT =
  'id,scenario_id,source,event_name,occurred_at,user_email,metadata,baseline_minutes,automated_minutes,saved_minutes';

function mapScenario(row: AutomationSavingsScenarioRow): AutomationSavingsScenario {
  return {
    id: row.id,
    interactionName: row.interaction_name,
    moduleName: row.module_name,
    source: row.source,
    baselineMinutes: Number(row.baseline_minutes) || 0,
    automatedMinutes: Number(row.automated_minutes) || 0,
    estimatedMonthlyRuns: Number(row.estimated_monthly_runs) || 0,
    status: row.status,
    sortOrder: Number(row.sort_order) || 0,
  };
}

function mapEvent(row: AutomationSavingsEventRow): AutomationSavingsEvent {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    source: row.source,
    eventName: row.event_name,
    occurredAt: row.occurred_at,
    userEmail: row.user_email,
    metadata: row.metadata,
    baselineMinutes: Number(row.baseline_minutes) || 0,
    automatedMinutes: Number(row.automated_minutes) || 0,
    savedMinutes: Number(row.saved_minutes) || 0,
  };
}

function endOfDayIso(date: string) {
  const parsed = new Date(`${date}T23:59:59.999`);
  return parsed.toISOString();
}

function startOfDayIso(date: string) {
  const parsed = new Date(`${date}T00:00:00.000`);
  return parsed.toISOString();
}

export async function loadAutomationSavingsSummary(params: {
  startDate: string;
  endDate: string;
}): Promise<AutomationSavingsSummary> {
  let usedFallback = false;

  const { data: scenarioData, error: scenarioError } = await supabase
    .from('automation_savings_scenarios')
    .select(SCENARIO_SELECT)
    .eq('status', 'active')
    .order('sort_order', { ascending: true });

  let scenarios = ((scenarioData || []) as AutomationSavingsScenarioRow[]).map(mapScenario);

  if (scenarioError || scenarios.length === 0) {
    if (scenarioError) {
      console.warn('loadAutomationSavingsSummary: usando catalogo local de economia de tempo', scenarioError);
    }
    usedFallback = true;
    scenarios = DEFAULT_AUTOMATION_SAVINGS_SCENARIOS;
  }

  const { data: eventData, error: eventError } = await supabase
    .from('automation_savings_events')
    .select(EVENT_SELECT)
    .gte('occurred_at', startOfDayIso(params.startDate))
    .lte('occurred_at', endOfDayIso(params.endDate));

  const events = eventError ? [] : ((eventData || []) as AutomationSavingsEventRow[]).map(mapEvent);
  if (eventError) {
    usedFallback = true;
    console.warn('loadAutomationSavingsSummary: eventos reais indisponiveis, usando estimativas', eventError);
  }

  const rows = buildAutomationSavingsRows({
    scenarios,
    events,
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const totals = summarizeAutomationSavings(rows);

  return {
    scenarios,
    events,
    rows,
    totals,
    monthlyProjectionMinutes: getMonthlySavingsProjectionMinutes(
      totals.totalSavedMinutes,
      params.startDate,
      params.endDate,
    ),
    modules: Array.from(new Set(scenarios.map((scenario) => scenario.moduleName))).sort(),
    usedFallback,
  };
}

export async function recordAutomationSavingsEvent(payload: AutomationSavingsEventPayload) {
  const { data, error } = await supabase.functions.invoke('record-automation-savings-event', {
    body: payload,
  });

  if (error) throw error;
  return data;
}
