import type { User } from '@supabase/supabase-js';

import { appScreens } from '@/lib/appScreens';
import { supabase } from '@/lib/supabase';
import { getAuthUserMatricula } from '@/lib/terceirizadoIdentity';

export type UserAccessGroup = {
  id: string;
  name: string;
  slug: string;
};

export type UserAccess = {
  groups: UserAccessGroup[];
  screenIds: string[];
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

export async function fetchUserAccess(user: User, isSuperAdmin: boolean): Promise<UserAccess> {
  if (isSuperAdmin) {
    return {
      groups: [{ id: 'superadmin', name: 'Superadministrador', slug: 'superadmin' }],
      screenIds: appScreens.map((screen) => screen.id),
    };
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from('user_group_memberships')
    .select('group_id,user_groups(id,name,slug)')
    .eq('user_id', user.id);

  if (membershipsError) {
    throw membershipsError;
  }

  const rows = (memberships || []) as MembershipRow[];
  const groupIds = rows.map((row) => row.group_id).filter(Boolean);
  const groups = rows.flatMap((row) => {
    const group = row.user_groups;
    if (!group) return [];
    return [
      {
        id: group.id,
        name: group.name,
        slug: group.slug,
      },
    ];
  });
  const terceirizadoAccess = await fetchTerceirizadoAccess(user);
  const isRefeitorioTerceirizado = terceirizadoAccess?.tipo === 'refeitorio';
  const isTerceirizado = groups.some((g) => g.slug === 'terceirizado');

  if (isRefeitorioTerceirizado && !isTerceirizado) {
    groups.push({ id: 'terceirizado', name: 'Terceirizado', slug: 'terceirizado' });
  }

  if (isRefeitorioTerceirizado) {
    return {
      groups: groups.filter((group) => group.slug === 'terceirizado'),
      screenIds: ['requisicao-compra'],
    };
  }

  if (groupIds.length === 0) {
    return {
      groups,
      screenIds: isRefeitorioTerceirizado ? ['requisicao-compra'] : [],
    };
  }

  const { data: permissions, error: permissionsError } = await supabase
    .from('user_group_screen_permissions')
    .select('screen_id')
    .in('group_id', groupIds)
    .eq('can_access', true);

  if (permissionsError) {
    throw permissionsError;
  }

  let screenIds = Array.from(new Set(((permissions || []) as PermissionRow[]).map((row) => row.screen_id)));

  if (isTerceirizado && !isSuperAdmin) {
    screenIds = screenIds.filter((id) => id !== 'requisicao-compra');
  }

  return {
    groups,
    screenIds,
  };
}
