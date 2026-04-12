import type { User } from '@supabase/supabase-js';

import { appScreens } from '@/lib/appScreens';
import { supabase } from '@/lib/supabase';

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

  if (groupIds.length === 0) {
    return { groups, screenIds: [] };
  }

  const { data: permissions, error: permissionsError } = await supabase
    .from('user_group_screen_permissions')
    .select('screen_id')
    .in('group_id', groupIds)
    .eq('can_access', true);

  if (permissionsError) {
    throw permissionsError;
  }

  return {
    groups,
    screenIds: Array.from(new Set(((permissions || []) as PermissionRow[]).map((row) => row.screen_id))),
  };
}
