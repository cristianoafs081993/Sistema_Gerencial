import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AdminOrg = {
  id: string;
  slug: string;
  name: string;
  cnpj?: string | null;
  logoUrl?: string | null;
  isActive: boolean;
  createdAt?: string | null;
  userCount: number;
  enabledModuleCount: number;
};

export type AdminOrgUser = {
  userId: string;
  email: string;
  role: 'admin' | 'member';
  createdAt?: string | null;
};

export type AdminOrgDetail = AdminOrg & {
  users: AdminOrgUser[];
  enabledScreenIds: string[];
};

export type AdminOrgsState = {
  orgs: AdminOrg[];
};

export type UpsertOrgInput = {
  id?: string;
  slug: string;
  name: string;
  cnpj?: string;
  logoUrl?: string;
  isActive?: boolean;
};

export type SetOrgUsersInput = {
  orgId: string;
  users: { userId: string; role: 'admin' | 'member' }[];
};

export type SetOrgModulesInput = {
  orgId: string;
  screenIds: string[];
};

export type GetOrgDetailInput = {
  orgId: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Action types for Edge Function
// ─────────────────────────────────────────────────────────────────────────────

type OrgAdminAction =
  | { action: 'list-orgs' }
  | ({ action: 'upsert-org' } & UpsertOrgInput)
  | ({ action: 'get-org-detail' } & GetOrgDetailInput)
  | ({ action: 'set-org-users' } & SetOrgUsersInput)
  | ({ action: 'set-org-modules' } & SetOrgModulesInput);

// ─────────────────────────────────────────────────────────────────────────────
// Shared token helper (reuses the same pattern as userAdmin.ts)
// ─────────────────────────────────────────────────────────────────────────────

async function getAdminAccessToken() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;

  if (!session?.access_token) {
    throw new Error('Sessão ausente. Faça login novamente para administrar órgãos.');
  }

  const { error: userError } = await supabase.auth.getUser();
  if (!userError) {
    const {
      data: { session: refreshedSession },
    } = await supabase.auth.getSession();

    return refreshedSession?.access_token || session.access_token;
  }

  const {
    data: { session: nextSession },
    error: refreshError,
  } = await supabase.auth.refreshSession();

  if (refreshError || !nextSession?.access_token) {
    throw new Error('Sua sessão expirou. Entre novamente para administrar órgãos.');
  }

  return nextSession.access_token;
}

async function invokeAdminUsers<T>(body: OrgAdminAction) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function listOrgs() {
  return invokeAdminUsers<AdminOrgsState>({ action: 'list-orgs' });
}

export function upsertOrg(input: UpsertOrgInput) {
  return invokeAdminUsers<AdminOrgsState>({ action: 'upsert-org', ...input });
}

export function getOrgDetail(orgId: string) {
  return invokeAdminUsers<AdminOrgDetail>({ action: 'get-org-detail', orgId });
}

export function setOrgUsers(input: SetOrgUsersInput) {
  return invokeAdminUsers<AdminOrgDetail>({ action: 'set-org-users', ...input });
}

export function setOrgModules(input: SetOrgModulesInput) {
  return invokeAdminUsers<AdminOrgDetail>({ action: 'set-org-modules', ...input });
}
