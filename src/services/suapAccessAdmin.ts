import { supabase } from '@/lib/supabase';
import { normalizeMatricula } from '@/lib/terceirizadoIdentity';

export type SuapAccessGrant = {
  matricula: string;
  nome: string | null;
  status: 'ativo' | 'suspenso';
  validUntil: string | null;
  notes: string | null;
  userId: string | null;
  emailSuap: string | null;
  suapCampusSigla: string | null;
  lastLoginAt: string | null;
  groupIds: string[];
  campi: string[];
};

export type SuapAccessRequest = {
  matricula: string;
  nome: string | null;
  email: string | null;
  vinculo: string | null;
  suapCampusSigla: string | null;
  suapCampusUasg: string | null;
  attempts: number;
  lastSeenAt: string;
};

export type SuapAccessState = {
  requireGrant: boolean;
  grants: SuapAccessGrant[];
  requests: SuapAccessRequest[];
};

export type UpsertSuapAccessGrantInput = {
  matricula: string;
  nome?: string | null;
  status: 'ativo' | 'suspenso';
  validUntil?: string | null;
  notes?: string | null;
  groupIds: string[];
  campi: string[];
};

type GrantRow = {
  matricula: string;
  nome: string | null;
  status: 'ativo' | 'suspenso';
  valid_until: string | null;
  notes: string | null;
  user_id: string | null;
  email_suap: string | null;
  suap_campus_sigla: string | null;
  last_login_at: string | null;
};

function throwIfError(error: { message?: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback);
}

export async function fetchSuapAccessState(): Promise<SuapAccessState> {
  const [settingsResult, grantsResult, groupsResult, campiResult, requestsResult] = await Promise.all([
    supabase.from('suap_access_settings').select('require_grant').eq('id', true).maybeSingle(),
    supabase
      .from('user_access_grants')
      .select('matricula,nome,status,valid_until,notes,user_id,email_suap,suap_campus_sigla,last_login_at')
      .order('nome', { ascending: true, nullsFirst: false }),
    supabase.from('user_access_grant_groups').select('matricula,group_id'),
    supabase.from('user_access_grant_campi').select('matricula,campus_uasg'),
    supabase
      .from('suap_access_requests')
      .select('matricula,nome,email,vinculo,suap_campus_sigla,suap_campus_uasg,attempts,last_seen_at')
      .order('last_seen_at', { ascending: false }),
  ]);

  throwIfError(settingsResult.error, 'Não foi possível carregar a configuração do login SUAP.');
  throwIfError(grantsResult.error, 'Não foi possível carregar as autorizações por matrícula.');
  throwIfError(groupsResult.error, 'Não foi possível carregar os perfis das matrículas.');
  throwIfError(campiResult.error, 'Não foi possível carregar os campi das matrículas.');
  throwIfError(requestsResult.error, 'Não foi possível carregar as solicitações de acesso.');

  const groupsByMatricula = new Map<string, string[]>();
  for (const row of (groupsResult.data || []) as Array<{ matricula: string; group_id: string }>) {
    groupsByMatricula.set(row.matricula, [...(groupsByMatricula.get(row.matricula) || []), row.group_id]);
  }
  const campiByMatricula = new Map<string, string[]>();
  for (const row of (campiResult.data || []) as Array<{ matricula: string; campus_uasg: string }>) {
    campiByMatricula.set(row.matricula, [...(campiByMatricula.get(row.matricula) || []), row.campus_uasg]);
  }

  const grantedMatriculas = new Set(((grantsResult.data || []) as GrantRow[]).map((row) => row.matricula));

  return {
    requireGrant: settingsResult.data?.require_grant === true,
    grants: ((grantsResult.data || []) as GrantRow[]).map((row) => ({
      matricula: row.matricula,
      nome: row.nome,
      status: row.status,
      validUntil: row.valid_until,
      notes: row.notes,
      userId: row.user_id,
      emailSuap: row.email_suap,
      suapCampusSigla: row.suap_campus_sigla,
      lastLoginAt: row.last_login_at,
      groupIds: groupsByMatricula.get(row.matricula) || [],
      campi: campiByMatricula.get(row.matricula) || [],
    })),
    requests: ((requestsResult.data || []) as Array<Record<string, unknown>>)
      .filter((row) => !grantedMatriculas.has(String(row.matricula)))
      .map((row) => ({
        matricula: String(row.matricula),
        nome: (row.nome as string | null) ?? null,
        email: (row.email as string | null) ?? null,
        vinculo: (row.vinculo as string | null) ?? null,
        suapCampusSigla: (row.suap_campus_sigla as string | null) ?? null,
        suapCampusUasg: (row.suap_campus_uasg as string | null) ?? null,
        attempts: Number(row.attempts || 1),
        lastSeenAt: String(row.last_seen_at),
      })),
  };
}

export async function upsertSuapAccessGrant(input: UpsertSuapAccessGrantInput) {
  const matricula = normalizeMatricula(input.matricula);
  if (!matricula) throw new Error('Informe a matrícula do SUAP.');
  if (input.groupIds.length === 0) throw new Error('Escolha pelo menos um perfil para a matrícula.');

  const { error: grantError } = await supabase.from('user_access_grants').upsert({
    matricula,
    nome: input.nome?.trim() || null,
    status: input.status,
    valid_until: input.validUntil || null,
    notes: input.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'matricula' });
  throwIfError(grantError, 'Não foi possível salvar a autorização.');

  const { error: deleteGroupsError } = await supabase.from('user_access_grant_groups').delete().eq('matricula', matricula);
  throwIfError(deleteGroupsError, 'Não foi possível atualizar os perfis da matrícula.');
  const { error: insertGroupsError } = await supabase
    .from('user_access_grant_groups')
    .insert(Array.from(new Set(input.groupIds)).map((groupId) => ({ matricula, group_id: groupId })));
  throwIfError(insertGroupsError, 'Não foi possível atualizar os perfis da matrícula.');

  const { error: deleteCampiError } = await supabase.from('user_access_grant_campi').delete().eq('matricula', matricula);
  throwIfError(deleteCampiError, 'Não foi possível atualizar os campi da matrícula.');
  if (input.campi.length > 0) {
    const { error: insertCampiError } = await supabase
      .from('user_access_grant_campi')
      .insert(Array.from(new Set(input.campi)).map((campus) => ({ matricula, campus_uasg: campus })));
    throwIfError(insertCampiError, 'Não foi possível atualizar os campi da matrícula.');
  }

  return matricula;
}

/** Remove a autorização. Os grupos que a pessoa já recebeu continuam até serem alterados na tabela de usuários. */
export async function deleteSuapAccessGrant(matricula: string) {
  const { error } = await supabase.from('user_access_grants').delete().eq('matricula', normalizeMatricula(matricula));
  throwIfError(error, 'Não foi possível remover a autorização.');
}

export async function dismissSuapAccessRequest(matricula: string) {
  const { error } = await supabase.from('suap_access_requests').delete().eq('matricula', normalizeMatricula(matricula));
  throwIfError(error, 'Não foi possível descartar a solicitação.');
}

export async function setSuapRequireGrant(requireGrant: boolean) {
  const { error } = await supabase
    .from('suap_access_settings')
    .update({ require_grant: requireGrant, updated_at: new Date().toISOString() })
    .eq('id', true);
  throwIfError(error, 'Não foi possível alterar a configuração do login SUAP.');
}
