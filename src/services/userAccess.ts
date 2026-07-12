import type { User } from '@supabase/supabase-js';

import { appScreens, expandScreenAccessIds } from '@/lib/appScreens';
import { supabase } from '@/lib/supabase';
import { getAuthUserMatricula } from '@/lib/terceirizadoIdentity';

export type UserAccessGroup = {
  id: string;
  name: string;
  slug: string;
};

export type UserOrg = {
  id: string;
  slug: string;
  name: string;
  role: 'admin' | 'member';
};

export type UserAccess = {
  groups: UserAccessGroup[];
  screenIds: string[];
  /** Órgão do usuário (1 usuário = 1 órgão) */
  org: UserOrg | null;
};

type MembershipRow = {
  group_id: string;
  user_groups?: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

type PermissionRow = {
  screen_id: string;
};

type OrgModulePermissionRow = {
  screen_id: string;
};

type OrgUserRow = {
  role: string;
  orgs: {
    id: string;
    slug: string;
    name: string;
  } | null;
};

type TerceirizadoAccessRow = {
  tipo: string | null;
};

async function fetchTerceirizadoAccess(user: User): Promise<TerceirizadoAccessRow | null> {
  const matricula = getAuthUserMatricula(user);

  if (matricula) {
    const { data, error } = await supabase
      .from('terceirizados')
      .select('tipo')
      .eq('matricula', matricula)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as TerceirizadoAccessRow;
  }

  if (!user.email) return null;

  const { data, error } = await supabase
    .from('terceirizados')
    .select('tipo')
    .eq('email', user.email)
    .maybeSingle();

  if (error) throw error;
  return (data as TerceirizadoAccessRow | null) || null;
}

/** Busca o órgão do usuário (1 usuário = 1 órgão). */
async function fetchUserOrg(userId: string): Promise<UserOrg | null> {
  const { data, error } = await supabase
    .from('org_users')
    .select('role, orgs(id, slug, name)')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    // Tabela pode ainda não existir em rollout gradual
    console.warn('[userAccess] org_users indisponível:', error.message);
    return null;
  }

  if (!data) return null;

  const row = data as OrgUserRow;
  if (!row.orgs) return null;

  return {
    id: row.orgs.id,
    slug: row.orgs.slug,
    name: row.orgs.name,
    role: (row.role as 'admin' | 'member') ?? 'member',
  };
}

/**
 * Busca os screen_ids habilitados para o órgão do usuário.
 * Retorna null se a tabela não existir (sem restrição de módulo como fallback).
 */
async function fetchOrgEnabledScreenIds(orgId: string): Promise<string[] | null> {
  const { data, error } = await supabase
    .from('org_module_permissions')
    .select('screen_id')
    .eq('org_id', orgId)
    .eq('can_access', true);

  if (error) {
    console.warn('[userAccess] org_module_permissions indisponível:', error.message);
    return null;
  }

  return ((data || []) as OrgModulePermissionRow[]).map((row) => row.screen_id);
}

export async function fetchUserAccess(user: User, isSuperAdmin: boolean): Promise<UserAccess> {
  if (isSuperAdmin) {
    const org = await fetchUserOrg(user.id);

    return {
      groups: [{ id: 'superadmin', name: 'Superadministrador', slug: 'superadmin' }],
      screenIds: expandScreenAccessIds(appScreens.map((screen) => screen.id)),
      org,
    };
  }

  // Busca paralela: grupos de acesso + órgão do usuário (1 usuário = 1 órgão)
  const [membershipsResult, orgResult] = await Promise.all([
    supabase
      .from('user_group_memberships')
      .select('group_id,user_groups(id,name,slug)')
      .eq('user_id', user.id),
    fetchUserOrg(user.id),
  ]);

  if (membershipsResult.error) throw membershipsResult.error;

  const rows = (membershipsResult.data || []) as MembershipRow[];
  const groupIds = rows.map((row) => row.group_id).filter(Boolean);
  const groups = rows.flatMap((row) => {
    const group = row.user_groups;
    if (!group) return [];
    return [{ id: group.id, name: group.name, slug: group.slug }];
  });

  // Lógica de terceirizado (refeitório)
  const terceirizadoAccess = await fetchTerceirizadoAccess(user);
  const isRefeitorioTerceirizado = terceirizadoAccess?.tipo === 'refeitorio';
  const isTerceirizado = groups.some((g) => g.slug === 'terceirizado');

  if (isRefeitorioTerceirizado && !isTerceirizado) {
    groups.push({ id: 'terceirizado', name: 'Terceirizado', slug: 'terceirizado' });
  }

  if (isRefeitorioTerceirizado) {
    return {
      groups: groups.filter((group) => group.slug === 'terceirizado'),
      screenIds: expandScreenAccessIds(['requisicao-compra']),
      org: orgResult,
    };
  }

  if (groupIds.length === 0) {
    return { groups, screenIds: expandScreenAccessIds([]), org: orgResult };
  }

  // Permissões de tela pelo grupo de usuário
  const { data: permissions, error: permissionsError } = await supabase
    .from('user_group_screen_permissions')
    .select('screen_id')
    .in('group_id', groupIds)
    .eq('can_access', true);

  if (permissionsError) throw permissionsError;

  let screenIds = Array.from(
    new Set(((permissions || []) as PermissionRow[]).map((row) => row.screen_id)),
  );

  if (isTerceirizado) {
    screenIds = screenIds.filter((id) => id !== 'requisicao-compra');
  }

  // Intersecção com módulos habilitados pelo órgão
  // Se o órgão tiver restrições, aplica o filtro sobre o que o grupo já permite
  if (orgResult?.id) {
    const orgScreenIds = await fetchOrgEnabledScreenIds(orgResult.id);
    if (orgScreenIds !== null) {
      const orgScreenSet = new Set(orgScreenIds);
      screenIds = screenIds.filter((id) => orgScreenSet.has(id));
    }
  }

  return { groups, screenIds: expandScreenAccessIds(screenIds), org: orgResult };
}
