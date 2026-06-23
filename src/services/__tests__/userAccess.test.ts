import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  memberships: [] as unknown[],
  permissions: [] as unknown[],
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

    if (table === 'terceirizados') {
      return {
        select: () => ({
          eq: (column: string, value: string) => ({
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
    user_metadata: { matricula: '3128880' },
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-06-17T00:00:00.000Z',
    ...overrides,
  } as User;
}

describe('fetchUserAccess', () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset();
    supabaseMocks.memberships = [];
    supabaseMocks.permissions = [];
    supabaseMocks.terceirizadosByMatricula = new Map();
    supabaseMocks.terceirizadosByEmail = new Map();
    mockQueryBuilders();
  });

  it('libera requisicao de compra para terceirizado do refeitorio identificado pela matricula SUAP', async () => {
    supabaseMocks.terceirizadosByMatricula.set('3128880', { tipo: 'refeitorio' });

    const { fetchUserAccess } = await import('@/services/userAccess');

    const access = await fetchUserAccess(makeUser(), false);

    expect(access.screenIds).toContain('requisicao-compra');
    expect(access.groups.map((group) => group.slug)).toContain('terceirizado');
  });

  it('mantem requisicao de compra para terceirizado do refeitorio mesmo sem permissao de tela no grupo', async () => {
    supabaseMocks.memberships = [
      {
        group_id: 'group-terceirizado',
        user_groups: { id: 'group-terceirizado', name: 'Terceirizado', slug: 'terceirizado' },
      },
    ];
    supabaseMocks.permissions = [];
    supabaseMocks.terceirizadosByMatricula.set('3128880', { tipo: 'refeitorio' });

    const { fetchUserAccess } = await import('@/services/userAccess');

    const access = await fetchUserAccess(makeUser(), false);

    expect(access.screenIds).toEqual(['requisicao-compra']);
  });

  it('ignora permissoes antigas de outros grupos para terceirizado do refeitorio', async () => {
    supabaseMocks.memberships = [
      {
        group_id: 'group-diretores',
        user_groups: { id: 'group-diretores', name: 'Diretores', slug: 'diretores' },
      },
    ];
    supabaseMocks.permissions = [{ screen_id: 'cadastro-terceirizados' }, { screen_id: 'dashboard' }];
    supabaseMocks.terceirizadosByMatricula.set('3128880', { tipo: 'refeitorio' });

    const { fetchUserAccess } = await import('@/services/userAccess');
    const access = await fetchUserAccess(makeUser(), false);

    expect(access.groups.map((group) => group.slug)).toEqual(['terceirizado']);
    expect(access.screenIds).toEqual(['requisicao-compra']);
  });

  it('bloqueia requisicao de compra para terceirizado que nao e do refeitorio', async () => {
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

    expect(access.screenIds).not.toContain('requisicao-compra');
  });
});
