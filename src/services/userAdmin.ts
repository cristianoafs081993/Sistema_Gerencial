import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type AdminScreenGroup = {
  id: string;
  name: string;
  sortOrder: number;
};

export type AdminScreen = {
  id: string;
  groupId: string;
  name: string;
  path: string;
  sortOrder: number;
  isAdminOnly: boolean;
};

export type AdminUserGroup = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  screenIds: string[];
};

export type AdminUser = {
  id: string;
  email: string;
  createdAt?: string | null;
  lastSignInAt?: string | null;
  usesDefaultPassword: boolean;
  groupIds: string[];
};

export type AdminUsersState = {
  users: AdminUser[];
  groups: AdminUserGroup[];
  screens: AdminScreen[];
  screenGroups: AdminScreenGroup[];
};

export type CreateDirectUserInput = {
  email: string;
  groupId: string;
};

export type InviteAdminUserInput = {
  email: string;
  groupId: string;
  redirectTo: string;
};

export type UpsertUserGroupInput = {
  id?: string;
  name: string;
  description?: string;
  screenIds: string[];
};

type AdminUsersAction =
  | { action: 'list' }
  | ({ action: 'create-user' } & CreateDirectUserInput)
  | ({ action: 'invite-user' } & InviteAdminUserInput)
  | ({ action: 'upsert-group' } & UpsertUserGroupInput)
  | { action: 'set-user-groups'; userId: string; email: string; groupIds: string[] };

async function getAdminAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session?.access_token) {
    throw new Error('Sessão ausente. Faça login novamente para administrar usuários.');
  }

  return session.access_token;
}

async function invokeAdminUsers<T>(body: AdminUsersAction) {
  const accessToken = await getAdminAccessToken();
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const rawPayload = await error.context.text();
      if (rawPayload) {
        let message = rawPayload;
        try {
          const payload = JSON.parse(rawPayload) as { error?: string };
          message = payload.error || rawPayload;
        } catch {
          message = rawPayload;
        }

        throw new Error(message);
      }
    }

    throw error;
  }

  return data as T;
}

export function listAdminUsersState() {
  return invokeAdminUsers<AdminUsersState>({ action: 'list' });
}

export function createDirectUser(input: CreateDirectUserInput) {
  return invokeAdminUsers<AdminUsersState>({ action: 'create-user', ...input });
}

export function inviteAdminUser(input: InviteAdminUserInput) {
  return invokeAdminUsers<AdminUsersState>({ action: 'invite-user', ...input });
}

export function upsertUserGroup(input: UpsertUserGroupInput) {
  return invokeAdminUsers<AdminUsersState>({ action: 'upsert-group', ...input });
}

export function setAdminUserGroups(input: { userId: string; email: string; groupIds: string[] }) {
  return invokeAdminUsers<AdminUsersState>({ action: 'set-user-groups', ...input });
}
