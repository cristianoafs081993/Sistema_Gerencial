import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  memberships: [] as unknown[],
  permissions: [] as unknown[],
  orgUser: null as unknown,
  orgPermissions: [] as unknown[],
  terceirizadosByMatricula: new Map<string, unknown>(),
  terceirizadosByEmail: new Map<string, unknown>(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: supabaseMocks.from,
  },
}));

function mockQueryBuilders() {
  supabaseMocks.from.mockImplementation((table: string) => {
    if (table === 'user_group_memberships') {
      return {
        select: () => ({
          eq: async () => ({ data: supabaseMocks.memberships, error: null }),
        }),
      };
    }

    if (table === 'user_group_screen_permissions') {
      return {
        select: () => ({
          in: () => ({
            eq: async () => ({ data: supabaseMocks.permissions, error: null }),
          }),
        }),
      };
    }

    if (table === 'org_users') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: supabaseMocks.orgUser, error: null }),
          }),
        }),
      };
    }

    if (table === 'org_module_permissions') {
      return {
        select: () => ({
          eq: () => ({
            eq: async () => ({ data: supabaseMocks.orgPermissions, error: null }),
          }),
        }),
      };
    }

    if (table === 'terceirizados') {
      return {
        select: () => ({
          limit: async () => ({ data: [], error: null }),
          eq: (column: string, value: string) => ({
            limit: async () => {
              const record =
                column === 'matricula'
                  ? supabaseMocks.terceirizadosByMatricula.get(value) || null
                  : supabaseMocks.terceirizadosByEmail.get(value) || null;
              return { data: record ? [record] : [], error: null };
            },
            maybeSingle: async () => ({
              data:
                column === 'matricula'
                  ? supabaseMocks.terceirizadosByMatricula.get(value) || null
                  : supabaseMocks.terceirizadosByEmail.get(value) || null,
              error: null,
            }),
          }),
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });
}

function makeUser(overrides: Partial<User> = {}) {
  return {
    id: 'user-3128880',
    email: 'usuario.suap@ifrn.edu.br',
    user_metadata: {
      matricula: '3128880',
      nome: 'Usuario Teste',
    },
    ...overrides,
  } as User;
}

describe('fetchUserAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.memberships = [];
    supabaseMocks.permissions = [];
    supabaseMocks.orgUser = null;
    supabaseMocks.orgPermissions = [];
    supabaseMocks.terceirizadosByMatricula.clear();
    supabaseMocks.terceirizadosByEmail.clear();
    mockQueryBuilders();
  });

  it('carrega o orgao do superadmin sem restringir suas telas', async () => {
    supabaseMocks.memberships = [
      {
        group_id: 'group-superadmin',
        user_groups: { id: 'group-superadmin', name: 'Superadmin', slug: 'superadmin' },
      },
    ];
    supabaseMocks.orgUser = {
      role: 'admin',
      orgs: {
        id: 'org-currais-novos',
        name: 'Campus Currais Novos',
        slug: 'ifrn-cnrn',
      },
    };
    supabaseMocks.orgPermissions = [{ screen_id: 'almoxarifado' }];

    const { fetchUserAccess } = await import('@/services/userAccess');

    const access = await fetchUserAccess(makeUser(), true);

    expect(access.org).toEqual({
      id: 'org-currais-novos',
      name: 'Campus Currais Novos',
      slug: 'ifrn-cnrn',
      role: 'admin',
    });
    expect(access.screenIds).toContain('dashboard');
    expect(access.screenIds).toContain('planejamento');
    expect(access.screenIds).toContain('almoxarifado');
  });

  it('libera requisicao de compra para terceirizado do refeitorio identificado pela matricula SUAP', async () => {
    supabaseMocks.terceirizadosByMatricula.set('3128880', { tipo: 'refeitorio' });

    const { fetchUserAccess } = await import('@/services/userAccess');

    const access = await fetchUserAccess(makeUser(), false);

    expect(access.groups.map((group) => group.slug)).toEqual(['terceirizado']);
    expect(access.screenIds).toEqual(['contratos', 'requisicao-compra']);
  });

  it('libera cadastro de fornecedores quando o orgao tem acesso ao modulo pesquisa de precos', async () => {
    supabaseMocks.memberships = [
      {
        group_id: 'group-compras',
        user_groups: { id: 'group-compras', name: 'Compras', slug: 'compras' },
      },
    ];
    supabaseMocks.permissions = [{ screen_id: 'pesquisa-precos' }];
    supabaseMocks.orgUser = {
      role: 'member',
      orgs: {
        id: 'org-currais-novos',
        slug: 'ifrn-cnrn',
        name: 'Campus Currais Novos',
      },
    };
    supabaseMocks.orgPermissions = [{ screen_id: 'pesquisa-precos' }];

    const { fetchUserAccess } = await import('@/services/userAccess');

    const access = await fetchUserAccess(
      makeUser({
        id: 'user-compras',
        email: 'compras@ifrn.edu.br',
        user_metadata: { matricula: '9999999', nome: 'Compras' },
      }),
      false,
    );

    expect(access.screenIds).toContain('pesquisa-precos');
    expect(access.screenIds).toContain('cadastro-fornecedores');
  });

  it('mantem subpaginas implicitas quando o orgao libera somente o modulo pai', async () => {
    supabaseMocks.memberships = [
      {
        group_id: 'group-compras',
        user_groups: { id: 'group-compras', name: 'Compras', slug: 'compras' },
      },
    ];
    supabaseMocks.permissions = [
      { screen_id: 'pesquisa-precos-ead' },
      { screen_id: 'dashboard' },
    ];
    supabaseMocks.orgUser = {
      role: 'member',
      orgs: {
        id: 'org-currais-novos',
        slug: 'ifrn-cnrn',
        name: 'Campus Currais Novos',
      },
    };
    supabaseMocks.orgPermissions = [{ screen_id: 'pesquisa-precos' }];

    const { fetchUserAccess } = await import('@/services/userAccess');

    const access = await fetchUserAccess(
      makeUser({
        id: 'user-compras',
        email: 'compras@ifrn.edu.br',
        user_metadata: { matricula: '9999999', nome: 'Compras' },
      }),
      false,
    );

    expect(access.screenIds).toContain('pesquisa-precos-ead');
    expect(access.screenIds).not.toContain('dashboard');
  });

  it('mantem requisicao de compra para terceirizado do refeitorio mesmo sem permissao de tela no grupo', async () => {
    supabaseMocks.memberships = [
      {
        group_id: 'group-terceirizado',
        user_groups: { id: 'group-terceirizado', name: 'Terceirizado', slug: 'terceirizado' },
      },
    ];
    supabaseMocks.terceirizadosByMatricula.set('3128880', { tipo: 'refeitorio' });

    const { fetchUserAccess } = await import('@/services/userAccess');

    const access = await fetchUserAccess(makeUser(), false);

    expect(access.groups.map((group) => group.slug)).toEqual(['terceirizado']);
    expect(access.screenIds).toEqual(['contratos', 'requisicao-compra']);
  });

  it('ignora permissoes antigas de outros grupos para terceirizado do refeitorio', async () => {
    supabaseMocks.memberships = [
      {
        group_id: 'group-gestor',
        user_groups: { id: 'group-gestor', name: 'Gestor', slug: 'gestor' },
      },
    ];
    supabaseMocks.permissions = [{ screen_id: 'dashboard' }, { screen_id: 'contratos' }];
    supabaseMocks.terceirizadosByMatricula.set('3128880', { tipo: 'refeitorio' });

    const { fetchUserAccess } = await import('@/services/userAccess');

    const access = await fetchUserAccess(makeUser(), false);

    expect(access.groups.map((group) => group.slug)).toEqual(['terceirizado']);
    expect(access.screenIds).toEqual(['contratos', 'requisicao-compra']);
  });

  it('libera requisicao de compra para terceirizado com outro tipo de servico', async () => {
    supabaseMocks.memberships = [
      {
        group_id: 'group-terceirizado',
        user_groups: { id: 'group-terceirizado', name: 'Terceirizado', slug: 'terceirizado' },
      },
    ];
    supabaseMocks.permissions = [{ screen_id: 'requisicao-compra' }];
    supabaseMocks.terceirizadosByMatricula.set('3128880', { tipo: 'limpeza_manutencao' });

    const { fetchUserAccess } = await import('@/services/userAccess');

    const access = await fetchUserAccess(makeUser(), false);

    expect(access.screenIds).toContain('requisicao-compra');
  });
});
