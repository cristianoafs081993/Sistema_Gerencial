// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261103100000_reduce_database_size_and_log_volume.sql'),
  'utf8',
);

describe('migration de redução do banco e dos logs', () => {
  it('apaga a base de preços de referência e desagenda os jobs que a reabasteceriam', () => {
    expect(migrationSql).toContain('truncate table public.preco_referencia_itens;');
    for (const job of ['sync-precos-referencia-daily', 'sync-precos-referencia-resume', 'precos-embeddings-pending']) {
      expect(migrationSql).toContain(`'${job}'`);
    }
    expect(migrationSql).toContain('cron.unschedule');
  });

  it('mantém só o snapshot mais recente do Plano 8 e poda após cada sincronização aplicada', () => {
    expect(migrationSql).toContain('delete from public.suap_plan_activity_snapshots');
    expect(migrationSql).toContain('distinct on (org_id, plan_id, suap_unit_code)');
    expect(migrationSql).toContain('after update of status on public.suap_plan_sync_runs');
    expect(migrationSql).toContain("new.status = 'success'");
  });

  it('recupera o bloat reescrevendo as tabelas e restringe a purga de logs ao serviço', () => {
    expect(migrationSql).toContain("cluster public.%I using %I");
    expect(migrationSql).toContain('revoke all on function public.purge_cron_run_details(integer) from public, anon, authenticated;');
    expect(migrationSql).toContain("cron.schedule('purge-cron-run-details-daily'");
  });

  it('roda de hora em hora o cron de documentos PNCP', () => {
    expect(migrationSql).toContain("schedule := '7 * * * *'");
  });
});
