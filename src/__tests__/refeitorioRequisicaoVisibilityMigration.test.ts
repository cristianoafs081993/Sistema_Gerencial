import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260911100000_allow_refeitorio_viewers_read_requisicoes.sql'),
  'utf8',
);

describe('migration de visibilidade das requisições no Refeitório', () => {
  it('usa o acesso ao menu Refeitório para liberar leitura compartilhada', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.can_view_refeitorio_requisicoes()');
    expect(migrationSql).toContain("permission.screen_id IN ('refeitorio', 'refeitorio-insumos', 'requisicao-compra')");
    expect(migrationSql).toContain('public.current_user_org_id()');
    expect(migrationSql).toContain("group_row.slug = 'terceirizado'");
    expect(migrationSql).toContain("'fiscal-contratos', 'fiscais-de-contratos'");
    expect(migrationSql).toContain('org_id = public.current_user_org_id()');
    expect(migrationSql).toContain('parent.org_id = public.current_user_org_id()');
  });

  it('aplica a mesma leitura compartilhada ao cabeçalho e aos dois detalhes', () => {
    expect(migrationSql.match(/public\.can_view_refeitorio_requisicoes\(\)/g)).toHaveLength(6);
    expect(migrationSql).toContain('Leitura de requisicoes_compra');
    expect(migrationSql).toContain('Leitura de requisicao_compra_itens');
    expect(migrationSql).toContain('Leitura de requisicao_compra_empenhos');
    expect(migrationSql).not.toContain('CREATE POLICY "Atualizar requisicoes_compra"');
    expect(migrationSql).not.toContain('CREATE POLICY "Excluir requisicoes_compra"');
  });
});
