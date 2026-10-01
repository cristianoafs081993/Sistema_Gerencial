// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261001120000_use_requisicao_created_at_in_consumo_insumos.sql'),
  'utf8',
);

describe('migration da data do consumo de insumos das requisições', () => {
  it('data o consumo das requisições pelo cadastro da requisição', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE VIEW public.manutencao_consumo_insumos');
    expect(migrationSql).toContain('requisicao.created_at AS consumo_em');
    expect(migrationSql).not.toContain('requisicao.consumo_iniciado_em AS consumo_em');
  });

  it('mantém o check-in pela data do check-in e o filtro de requisições enviadas', () => {
    expect(migrationSql).toContain('checkin.created_at AS consumo_em');
    expect(migrationSql).toContain("WHERE requisicao.status <> 'draft'");
    expect(migrationSql).toContain('WITH (security_invoker = true)');
    expect(migrationSql).toContain('GRANT SELECT ON public.manutencao_consumo_insumos TO authenticated;');
  });
});
