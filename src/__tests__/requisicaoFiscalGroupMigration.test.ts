import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260908100000_fix_requisicao_fiscal_group_slug.sql'),
  'utf8',
);

describe('migration de acesso às requisições de compra', () => {
  it('aceita o slug canônico e preserva o slug legado nas políticas e na RPC', () => {
    expect(migrationSql).toContain("'fiscais-de-contratos'");
    expect(migrationSql).toContain("'fiscal-contratos'");
    expect(migrationSql).toContain('Leitura de requisicoes_compra');
    expect(migrationSql).toContain('Leitura de requisicao_compra_itens');
    expect(migrationSql).toContain('Leitura de requisicao_compra_empenhos');
    expect(migrationSql).toContain("pg_get_functiondef('public.save_requisicao_compra(jsonb,jsonb,uuid)'::regprocedure)");
  });
});
