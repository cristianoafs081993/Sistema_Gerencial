// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryResult = { data: unknown; error: { message: string } | null };

const results = new Map<string, QueryResult>();

function queryFor(table: string) {
  const result = () => results.get(table) ?? { data: [], error: null };
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in']) builder[method] = () => builder;
  builder.maybeSingle = () => Promise.resolve(result());
  builder.then = (resolve: (value: QueryResult) => unknown) => Promise.resolve(result()).then(resolve);
  return builder;
}

vi.mock('../../mobile/src/lib/supabase', () => ({
  supabase: { from: (table: string) => queryFor(table) },
  DEFAULT_CAMPUS_UASG: '158366',
}));

import { translateAuthError } from '../../mobile/src/contexts/AuthContext';
import {
  ALL_TABS,
  fetchAppAccess,
  isSuperAdminUser,
  tabsFromScreens,
} from '../../mobile/src/services/access';

const user = (overrides: Record<string, unknown> = {}) =>
  ({ id: 'u1', email: 'gestor@ifrn.edu.br', app_metadata: {}, ...overrides }) as never;

describe('mobile — regras de acesso', () => {
  beforeEach(() => results.clear());

  it('mapeia as telas do web para as abas do app', () => {
    expect(tabsFromScreens(['dashboard', 'contratos'])).toEqual(['dashboard', 'contratos']);
    expect(tabsFromScreens(['atas-registro-precos'])).toEqual(['licitacoes']);
    expect(tabsFromScreens(['energia-esg'])).toEqual(['infraestrutura']);
    expect(tabsFromScreens(['pesquisa-precos'])).toEqual([]);
  });

  it('reconhece superadministrador por e-mail ou app_metadata', () => {
    expect(isSuperAdminUser(user({ email: 'Cristiano.CNRN@gmail.com' }))).toBe(true);
    expect(isSuperAdminUser(user({ app_metadata: { role: 'superadmin' } }))).toBe(true);
    expect(isSuperAdminUser(user({ app_metadata: { is_superadmin: true } }))).toBe(true);
    expect(isSuperAdminUser(user())).toBe(false);
    expect(isSuperAdminUser(null)).toBe(false);
  });

  it('superadministrador vê todas as abas', async () => {
    const access = await fetchAppAccess(user({ app_metadata: { role: 'superadmin' } }));

    expect(access.isSuperAdmin).toBe(true);
    expect(access.tabs).toEqual(ALL_TABS);
  });

  it('libera só as telas permitidas ao grupo do usuário', async () => {
    results.set('user_group_memberships', {
      data: [{ group_id: 'g1', user_groups: { id: 'g1', name: 'Diretores', slug: 'diretores' } }],
      error: null,
    });
    results.set('user_group_screen_permissions', {
      data: [{ screen_id: 'dashboard' }, { screen_id: 'empenhos' }, { screen_id: 'contratos' }],
      error: null,
    });

    const access = await fetchAppAccess(user());

    expect(access.tabs).toEqual(['dashboard', 'empenhos', 'contratos']);
    expect(access.groupNames).toEqual(['Diretores']);
  });

  it('restringe pelos módulos habilitados para o órgão, como no web', async () => {
    results.set('user_group_memberships', {
      data: [{ group_id: 'g1', user_groups: { id: 'g1', name: 'Diretores', slug: 'diretores' } }],
      error: null,
    });
    results.set('org_users', { data: { orgs: { id: 'o1', name: 'IFRN CNRN' } }, error: null });
    results.set('user_group_screen_permissions', {
      data: [{ screen_id: 'dashboard' }, { screen_id: 'empenhos' }, { screen_id: 'contratos' }],
      error: null,
    });
    results.set('org_module_permissions', { data: [{ screen_id: 'contratos' }], error: null });

    const access = await fetchAppAccess(user());

    expect(access.tabs).toEqual(['contratos']);
    expect(access.orgName).toBe('IFRN CNRN');
  });

  it('órgão com tabela de módulos vazia não libera nada (igual ao web)', async () => {
    results.set('user_group_memberships', {
      data: [{ group_id: 'g1', user_groups: { id: 'g1', name: 'Diretores', slug: 'diretores' } }],
      error: null,
    });
    results.set('org_users', { data: { orgs: { id: 'o1', name: 'IFRN CNRN' } }, error: null });
    results.set('user_group_screen_permissions', { data: [{ screen_id: 'dashboard' }], error: null });
    results.set('org_module_permissions', { data: [], error: null });

    expect((await fetchAppAccess(user())).tabs).toEqual([]);
  });

  it('usuário terceirizado ou sem grupo não tem acesso ao app', async () => {
    results.set('user_group_memberships', {
      data: [{ group_id: 'g9', user_groups: { id: 'g9', name: 'Terceirizado', slug: 'terceirizado' } }],
      error: null,
    });
    const terceirizado = await fetchAppAccess(user());
    expect(terceirizado.isTerceirizado).toBe(true);
    expect(terceirizado.tabs).toEqual([]);

    results.set('user_group_memberships', { data: [], error: null });
    expect((await fetchAppAccess(user())).tabs).toEqual([]);
  });

  it('propaga falha ao carregar os grupos (o app mostra a tela de erro)', async () => {
    results.set('user_group_memberships', { data: null, error: { message: 'boom' } });

    await expect(fetchAppAccess(user())).rejects.toEqual({ message: 'boom' });
  });
});

describe('mobile — mensagens de login', () => {
  it('traduz os erros mais comuns do Supabase Auth', () => {
    expect(translateAuthError('Invalid login credentials')).toBe('E-mail ou senha incorretos.');
    expect(translateAuthError('Email not confirmed')).toMatch(/não foi confirmado/);
    expect(translateAuthError('Too many requests')).toMatch(/Muitas tentativas/);
    expect(translateAuthError('Failed to fetch')).toMatch(/Sem conexão/);
    expect(translateAuthError(undefined)).toMatch(/Não foi possível entrar/);
  });
});
