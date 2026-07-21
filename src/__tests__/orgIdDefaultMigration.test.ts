import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260716103000_set_default_org_id_for_data_tables.sql'),
  'utf8',
);

describe('org_id default migration', () => {
  it('keeps descentralizacoes imports from inserting null org_id', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.default_org_id()');
    expect(migrationSql).toContain('public.current_user_org_id()');
    expect(migrationSql).toContain("WHERE slug = 'ifrn-cn'");
    expect(migrationSql).toContain("'descentralizacoes'");
    expect(migrationSql).toContain("'descentralizacoes_conta_saldos'");
    expect(migrationSql).toContain(
      'ALTER TABLE public.%I ALTER COLUMN org_id SET DEFAULT public.default_org_id()',
    );
  });
});