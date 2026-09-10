import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const functionSource = readFileSync('supabase/functions/sync-suap-plan/index.ts', 'utf8');
const migrationSource = readFileSync('supabase/migrations/20260909120000_add_suap_plan_unit_scope.sql', 'utf8');

describe('isolamento do Plano 8 entre unidades', () => {
  it('grava a unidade SUAP e a UASG-pai em cada snapshot e execução', () => {
    expect(functionSource).toContain('suap_unit_code: suapUnitCode');
    expect(functionSource).toContain('campus_uasg: unit.parentUasg');
    expect(functionSource).toContain('toSnapshot(activity, user.orgId, run.id, suapUnitCode, unit.parentUasg)');
  });

  it('faz o diff somente dentro da unidade e UASG-pai processadas', () => {
    expect(functionSource).toContain(".eq('campus_uasg', getSuapPlanUnit(suapUnitCode)?.parentUasg ?? '158366')");
    expect(functionSource).toContain("String(row.suap_unit_code ?? DEFAULT_SUAP_PLAN_UNIT) === suapUnitCode");
    expect(migrationSource).toContain('activity.suap_unit_code = v_run.suap_unit_code');
    expect(migrationSource).toContain('activity.campus_uasg = v_run.campus_uasg');
  });

  it('substitui a chave antiga por uma chave que não colide entre campi', () => {
    expect(migrationSource).toContain('DROP CONSTRAINT IF EXISTS atividades_suap_activity_unique');
    expect(migrationSource).toContain('UNIQUE (org_id, suap_plan_id, suap_unit_code, suap_activity_id)');
    expect(migrationSource).toContain('ON CONFLICT (org_id, suap_plan_id, suap_unit_code, suap_activity_id)');
  });

  it('preserva o lock global do órgão para impedir dois lotes concorrentes', () => {
    expect(functionSource).toContain(".eq('status', 'running')");
    expect(functionSource).toContain('LOCK_TTL_MS = 30 * 60 * 1000');
    expect(functionSource).toContain("action === 'sync-all'");
  });

  it('processa o lote em blocos retomáveis para evitar timeout da requisição única', () => {
    expect(functionSource).toContain('BATCH_CHUNK_SIZE = 4');
    expect(functionSource).toContain('BATCH_RUN_LOCK_TTL_MS = 5 * 60 * 1000');
    expect(functionSource).toContain(".slice(0, BATCH_CHUNK_SIZE)");
    expect(functionSource).toContain("body.batchId");
    expect(functionSource).toContain('remainingCount');
    expect(functionSource).toContain('failStaleBatchRuns');
  });
});
