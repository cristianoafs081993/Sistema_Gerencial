import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPERADMIN_EMAIL = 'cristiano.cnrn@gmail.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

// ─────────────────────────────────────────────────────────────────────────────
// Request types
// ─────────────────────────────────────────────────────────────────────────────

type AdminUsersRequest =
  // Usuários
  | { action: 'list' }
  | { action: 'create-user'; email?: string; groupId?: string; password?: string }
  | { action: 'invite-user'; email?: string; groupId?: string; redirectTo?: string }
  | { action: 'update-user-password'; userId?: string; password?: string }
  | { action: 'delete-user'; userId?: string; email?: string }
  | { action: 'upsert-group'; id?: string; name?: string; description?: string; screenIds?: string[] }
  | { action: 'set-user-groups'; userId?: string; email?: string; groupIds?: string[] }
  // Órgãos (multi-tenant)
  | { action: 'list-orgs' }
  | { action: 'upsert-org'; id?: string; slug?: string; name?: string; cnpj?: string; logoUrl?: string; isActive?: boolean }
  | { action: 'get-org-detail'; orgId?: string }
  | { action: 'set-org-users'; orgId?: string; users?: { userId: string; role: string }[] }
  | { action: 'set-org-modules'; orgId?: string; screenIds?: string[] }
  // Auditoria
  | { action: 'list-audit-log'; orgId?: string; userId?: string; eventType?: string; limit?: number; offset?: number };

type AuthUserLike = {
  id: string;
  email?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

type AuthUserForAdminCheck = {
  id?: string | null;
  email?: string | null;
  app_metadata?: { role?: string; is_superadmin?: boolean };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || '';
}

function isSuperAdminUser(user?: AuthUserForAdminCheck | null) {
  if (!user) return false;
  return (
    normalizeEmail(user.email) === SUPERADMIN_EMAIL ||
    user.app_metadata?.role === 'superadmin' ||
    user.app_metadata?.is_superadmin === true
  );
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`A variavel ${name} precisa estar configurada.`);
  return value;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const [, token] = authorization.match(/^Bearer\s+(.+)$/i) || [];
  if (!token) {
    throw new Response(JSON.stringify({ error: 'Sessao ausente. Faca login para administrar.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return token;
}

function assertValidEmail(email: string) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    throw new Response(JSON.stringify({ error: 'Informe um e-mail valido.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

function assertString(value: string | undefined, message: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return normalized;
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function assertValidPassword(password: string, message = 'A senha deve ter pelo menos 8 caracteres.') {
  if (password.length < 8) {
    throw new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function assertAllowedAdmin(supabase: ReturnType<typeof createClient>, accessToken: string) {
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
    throw new Response(JSON.stringify({ error: 'Nao foi possivel validar o usuario autenticado.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!isSuperAdminUser(user)) {
    throw new Response(JSON.stringify({ error: 'Somente o superadministrador pode administrar usuarios e orgaos.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return user;
}

// ─────────────────────────────────────────────────────────────────────────────
// User management (original logic)
// ─────────────────────────────────────────────────────────────────────────────

async function listAllUsers(supabase: ReturnType<typeof createClient>) {
  const users: AuthUserLike[] = [];
  let page = 1;
  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...((data?.users || []) as AuthUserLike[]));
    if (!data?.users || data.users.length < 1000) break;
    page += 1;
  }
  return users;
}

async function assignUserGroups(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  email: string,
  groupIds: string[],
) {
  const normalizedEmail = normalizeEmail(email);
  const uniqueGroupIds = Array.from(new Set(groupIds.filter(Boolean)));
  const { error: deleteError } = await supabase.from('user_group_memberships').delete().eq('user_id', userId);
  if (deleteError) throw deleteError;
  if (uniqueGroupIds.length === 0) return;
  const { error: insertError } = await supabase.from('user_group_memberships').insert(
    uniqueGroupIds.map((groupId) => ({ user_id: userId, email: normalizedEmail, group_id: groupId })),
  );
  if (insertError) throw insertError;
}

async function listState(supabase: ReturnType<typeof createClient>) {
  const [users, screenGroupsResult, screensResult, groupsResult, permissionsResult, membershipsResult] =
    await Promise.all([
      listAllUsers(supabase),
      supabase.from('screen_groups').select('id,name,sort_order').order('sort_order'),
      supabase.from('app_screens').select('id,screen_group_id,name,path,sort_order,is_admin_only').eq('is_active', true).order('sort_order'),
      supabase.from('user_groups').select('id,slug,name,description,is_system').order('name'),
      supabase.from('user_group_screen_permissions').select('group_id,screen_id,can_access').eq('can_access', true),
      supabase.from('user_group_memberships').select('user_id,email,group_id'),
    ]);

  for (const result of [screenGroupsResult, screensResult, groupsResult, permissionsResult, membershipsResult]) {
    if (result.error) throw result.error;
  }

  const membershipsByUserId = new Map<string, string[]>();
  for (const membership of membershipsResult.data || []) {
    const current = membershipsByUserId.get(membership.user_id) || [];
    current.push(membership.group_id);
    membershipsByUserId.set(membership.user_id, current);
  }

  const screenIdsByGroupId = new Map<string, string[]>();
  for (const permission of permissionsResult.data || []) {
    const current = screenIdsByGroupId.get(permission.group_id) || [];
    current.push(permission.screen_id);
    screenIdsByGroupId.set(permission.group_id, current);
  }

  return {
    users: users
      .filter((user) => Boolean(user.email))
      .map((user) => ({
        id: user.id,
        email: normalizeEmail(user.email),
        createdAt: user.created_at || null,
        lastSignInAt: user.last_sign_in_at || null,
        usesDefaultPassword: user.user_metadata?.uses_default_password === true,
        groupIds: membershipsByUserId.get(user.id) || [],
      }))
      .sort((left, right) => left.email.localeCompare(right.email, 'pt-BR')),
    groups: (groupsResult.data || []).map((group) => ({
      id: group.id,
      slug: group.slug,
      name: group.name,
      description: group.description,
      isSystem: group.is_system,
      screenIds: screenIdsByGroupId.get(group.id) || [],
    })),
    screens: (screensResult.data || []).map((screen) => ({
      id: screen.id,
      groupId: screen.screen_group_id,
      name: screen.name,
      path: screen.path,
      sortOrder: screen.sort_order,
      isAdminOnly: screen.is_admin_only,
    })),
    screenGroups: (screenGroupsResult.data || []).map((group) => ({
      id: group.id,
      name: group.name,
      sortOrder: group.sort_order,
    })),
  };
}

async function createDirectUser(supabase: ReturnType<typeof createClient>, request: AdminUsersRequest) {
  if (request.action !== 'create-user') return;
  const email = normalizeEmail(assertString(request.email, 'Informe o e-mail do usuario.'));
  const groupId = assertString(request.groupId, 'Informe o grupo do usuario.');
  const password = assertString(request.password, 'Informe a senha inicial do usuario.');
  assertValidEmail(email);
  assertValidPassword(password, 'A senha inicial deve ter pelo menos 8 caracteres.');

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { uses_default_password: false, initial_password_set_by_admin: true },
  });
  if (error) throw error;
  if (!data.user?.id) throw new Error('Usuario criado sem identificador retornado pelo Supabase.');
  await assignUserGroups(supabase, data.user.id, email, [groupId]);
}

async function inviteUser(
  supabase: ReturnType<typeof createClient>,
  request: AdminUsersRequest,
  inviterEmail: string,
) {
  if (request.action !== 'invite-user') return;
  const email = normalizeEmail(assertString(request.email, 'Informe o e-mail do usuario.'));
  const groupId = assertString(request.groupId, 'Informe o grupo do usuario.');
  const redirectTo = request.redirectTo?.trim();
  assertValidEmail(email);
  if (redirectTo) {
    try { new URL(redirectTo); } catch {
      throw new Response(JSON.stringify({ error: 'A URL de redirecionamento do convite e invalida.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectTo || undefined,
    data: { invited_by: inviterEmail, invited_at: new Date().toISOString() },
  });
  if (error) throw error;
  if (!data.user?.id) throw new Error('Convite enviado sem identificador de usuario retornado.');
  await assignUserGroups(supabase, data.user.id, email, [groupId]);
}

async function updateUserPassword(supabase: ReturnType<typeof createClient>, request: AdminUsersRequest) {
  if (request.action !== 'update-user-password') return;
  const userId = assertString(request.userId, 'Informe o usuario.');
  const password = assertString(request.password, 'Informe a nova senha do usuario.');
  assertValidPassword(password, 'A nova senha deve ter pelo menos 8 caracteres.');

  const { data: currentUserData, error: currentUserError } = await supabase.auth.admin.getUserById(userId);
  if (currentUserError) throw currentUserError;
  if (!currentUserData.user?.id) {
    throw new Response(JSON.stringify({ error: 'Usuario nao encontrado.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password,
    user_metadata: {
      ...(currentUserData.user.user_metadata || {}),
      uses_default_password: false,
      password_reset_by_admin_at: new Date().toISOString(),
    },
  });
  if (error) throw error;
}

async function deleteUser(
  supabase: ReturnType<typeof createClient>,
  request: AdminUsersRequest,
  adminUserId?: string | null,
) {
  if (request.action !== 'delete-user') return;
  const userId = assertString(request.userId, 'Informe o usuario.');
  const email = normalizeEmail(assertString(request.email, 'Informe o e-mail do usuario.'));

  if (adminUserId && userId === adminUserId) {
    throw new Response(JSON.stringify({ error: 'Nao e permitido excluir o proprio superadministrador autenticado.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: currentUserData, error: currentUserError } = await supabase.auth.admin.getUserById(userId);
  if (currentUserError) throw currentUserError;
  if (!currentUserData.user?.id || normalizeEmail(currentUserData.user.email) !== email) {
    throw new Response(JSON.stringify({ error: 'Usuario nao encontrado para exclusao.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteAuthError) throw deleteAuthError;

  const cleanupResults = await Promise.all([
    supabase.from('user_group_memberships').delete().eq('user_id', userId),
    supabase.from('terceirizado_permissions').delete().eq('user_id', userId),
  ]);

  for (const result of cleanupResults) {
    if (result.error) throw result.error;
  }
}

async function upsertGroup(supabase: ReturnType<typeof createClient>, request: AdminUsersRequest) {
  if (request.action !== 'upsert-group') return;
  const name = assertString(request.name, 'Informe o nome do grupo.');
  const screenIds = Array.from(new Set(request.screenIds || []));
  const description = request.description?.trim() || null;
  let groupId = request.id?.trim();

  if (groupId) {
    const { error } = await supabase.from('user_groups').update({ name, description, updated_at: new Date().toISOString() }).eq('id', groupId);
    if (error) throw error;
  } else {
    const slug = slugify(name);
    if (!slug) throw new Error('Informe um nome de grupo valido.');
    const { data, error } = await supabase.from('user_groups').insert({ slug, name, description, is_system: false }).select('id').single();
    if (error) throw error;
    groupId = data.id;
  }

  const { error: deleteError } = await supabase.from('user_group_screen_permissions').delete().eq('group_id', groupId);
  if (deleteError) throw deleteError;

  if (screenIds.length > 0) {
    const { error: insertError } = await supabase.from('user_group_screen_permissions').insert(
      screenIds.map((screenId) => ({ group_id: groupId, screen_id: screenId, can_access: true })),
    );
    if (insertError) throw insertError;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Org management (multi-tenant — NEW)
// ─────────────────────────────────────────────────────────────────────────────

async function listOrgs(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from('orgs')
    .select('id,slug,name,cnpj,logo_url,is_active,created_at')
    .order('name');
  if (error) throw error;

  // Enriquecer com contagem de usuários e módulos
  const orgIds = (data || []).map((o: { id: string }) => o.id);
  const [usersResult, modulesResult] = await Promise.all([
    supabase.from('org_users').select('org_id').in('org_id', orgIds),
    supabase.from('org_module_permissions').select('org_id').in('org_id', orgIds).eq('can_access', true),
  ]);

  const userCountByOrg = new Map<string, number>();
  for (const row of usersResult.data || []) {
    userCountByOrg.set(row.org_id, (userCountByOrg.get(row.org_id) || 0) + 1);
  }

  const moduleCountByOrg = new Map<string, number>();
  for (const row of modulesResult.data || []) {
    moduleCountByOrg.set(row.org_id, (moduleCountByOrg.get(row.org_id) || 0) + 1);
  }

  return {
    orgs: (data || []).map((org: { id: string; slug: string; name: string; cnpj: string | null; logo_url: string | null; is_active: boolean; created_at: string }) => ({
      id: org.id,
      slug: org.slug,
      name: org.name,
      cnpj: org.cnpj,
      logoUrl: org.logo_url,
      isActive: org.is_active,
      createdAt: org.created_at,
      userCount: userCountByOrg.get(org.id) || 0,
      enabledModuleCount: moduleCountByOrg.get(org.id) || 0,
    })),
  };
}

async function upsertOrg(supabase: ReturnType<typeof createClient>, request: AdminUsersRequest) {
  if (request.action !== 'upsert-org') return;
  const name = assertString(request.name, 'Informe o nome do órgão.');
  const slug = request.slug?.trim() || slugify(name);
  if (!slug) throw new Error('Informe um slug válido para o órgão.');

  if (request.id) {
    const { error } = await supabase.from('orgs').update({
      slug,
      name,
      cnpj: request.cnpj?.trim() || null,
      logo_url: request.logoUrl?.trim() || null,
      is_active: request.isActive ?? true,
      updated_at: new Date().toISOString(),
    }).eq('id', request.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('orgs').insert({
      slug,
      name,
      cnpj: request.cnpj?.trim() || null,
      logo_url: request.logoUrl?.trim() || null,
      is_active: request.isActive ?? true,
    });
    if (error) throw error;
  }
}

async function getOrgDetail(supabase: ReturnType<typeof createClient>, request: AdminUsersRequest) {
  if (request.action !== 'get-org-detail') return null;
  const orgId = assertString(request.orgId, 'Informe o ID do órgão.');

  const [orgResult, usersResult, modulesResult] = await Promise.all([
    supabase.from('orgs').select('id,slug,name,cnpj,logo_url,is_active,created_at').eq('id', orgId).single(),
    supabase.from('org_users').select('user_id,role,created_at').eq('org_id', orgId),
    supabase.from('org_module_permissions').select('screen_id,can_access').eq('org_id', orgId).eq('can_access', true),
  ]);

  if (orgResult.error) throw orgResult.error;
  const org = orgResult.data;

  // Buscar e-mails dos usuários
  const userIds = (usersResult.data || []).map((u: { user_id: string }) => u.user_id);
  const authUsers = userIds.length > 0 ? await listAllUsers(supabase) : [];
  const emailById = new Map(authUsers.map((u) => [u.id, normalizeEmail(u.email)]));

  return {
    id: org.id,
    slug: org.slug,
    name: org.name,
    cnpj: org.cnpj,
    logoUrl: org.logo_url,
    isActive: org.is_active,
    createdAt: org.created_at,
    userCount: (usersResult.data || []).length,
    enabledModuleCount: (modulesResult.data || []).length,
    users: (usersResult.data || []).map((u: { user_id: string; role: string; created_at: string }) => ({
      userId: u.user_id,
      email: emailById.get(u.user_id) || u.user_id,
      role: u.role,
      createdAt: u.created_at,
    })),
    enabledScreenIds: (modulesResult.data || []).map((m: { screen_id: string }) => m.screen_id),
  };
}

async function setOrgUsers(supabase: ReturnType<typeof createClient>, request: AdminUsersRequest) {
  if (request.action !== 'set-org-users') return;
  const orgId = assertString(request.orgId, 'Informe o ID do órgão.');
  const users = request.users || [];

  // Remove todos os vínculos atuais do órgão
  const { error: deleteError } = await supabase.from('org_users').delete().eq('org_id', orgId);
  if (deleteError) throw deleteError;

  if (users.length > 0) {
    const { error: insertError } = await supabase.from('org_users').insert(
      users.map((u) => ({ org_id: orgId, user_id: u.userId, role: u.role || 'member' })),
    );
    if (insertError) throw insertError;
  }
}

async function setOrgModules(supabase: ReturnType<typeof createClient>, request: AdminUsersRequest) {
  if (request.action !== 'set-org-modules') return;
  const orgId = assertString(request.orgId, 'Informe o ID do órgão.');
  const screenIds = Array.from(new Set(request.screenIds || []));

  // Remove todas as permissões atuais do órgão
  const { error: deleteError } = await supabase.from('org_module_permissions').delete().eq('org_id', orgId);
  if (deleteError) throw deleteError;

  if (screenIds.length > 0) {
    const { error: insertError } = await supabase.from('org_module_permissions').insert(
      screenIds.map((screenId) => ({ org_id: orgId, screen_id: screenId, can_access: true })),
    );
    if (insertError) throw insertError;
  }
}

async function listAuditLog(supabase: ReturnType<typeof createClient>, request: AdminUsersRequest) {
  if (request.action !== 'list-audit-log') return { entries: [] };
  const limit = Math.min(request.limit || 100, 500);
  const offset = request.offset || 0;

  let query = supabase
    .from('audit_log')
    .select('id,org_id,user_id,user_email,event_type,resource_type,resource_id,metadata,ip_address,created_at,orgs(name)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (request.orgId) query = query.eq('org_id', request.orgId);
  if (request.userId) query = query.eq('user_id', request.userId);
  if (request.eventType) query = query.eq('event_type', request.eventType);

  const { data, error } = await query;
  if (error) throw error;

  return { entries: data || [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Metodo nao suportado.' }, 405);
  }

  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const accessToken = getBearerToken(request);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = await assertAllowedAdmin(supabase, accessToken);
    const body = (await request.json()) as AdminUsersRequest;

    // ── Ações de usuário ────────────────────────────────────────────────────
    if (body.action === 'create-user') {
      await createDirectUser(supabase, body);
      return jsonResponse(await listState(supabase));
    }
    if (body.action === 'invite-user') {
      await inviteUser(supabase, body, normalizeEmail(admin.email));
      return jsonResponse(await listState(supabase));
    }
    if (body.action === 'update-user-password') {
      await updateUserPassword(supabase, body);
      return jsonResponse(await listState(supabase));
    }
    if (body.action === 'delete-user') {
      await deleteUser(supabase, body, admin.id);
      return jsonResponse(await listState(supabase));
    }
    if (body.action === 'upsert-group') {
      await upsertGroup(supabase, body);
      return jsonResponse(await listState(supabase));
    }
    if (body.action === 'set-user-groups') {
      const userId = assertString(body.userId, 'Informe o usuario.');
      const email = normalizeEmail(assertString(body.email, 'Informe o e-mail do usuario.'));
      await assignUserGroups(supabase, userId, email, body.groupIds || []);
      return jsonResponse(await listState(supabase));
    }
    if (body.action === 'list') {
      return jsonResponse(await listState(supabase));
    }

    // ── Ações de órgão ──────────────────────────────────────────────────────
    if (body.action === 'list-orgs') {
      return jsonResponse(await listOrgs(supabase));
    }
    if (body.action === 'upsert-org') {
      await upsertOrg(supabase, body);
      return jsonResponse(await listOrgs(supabase));
    }
    if (body.action === 'get-org-detail') {
      return jsonResponse(await getOrgDetail(supabase, body));
    }
    if (body.action === 'set-org-users') {
      const orgId = assertString(body.orgId, 'Informe o ID do órgão.');
      await setOrgUsers(supabase, body);
      return jsonResponse(await getOrgDetail(supabase, { action: 'get-org-detail', orgId }));
    }
    if (body.action === 'set-org-modules') {
      const orgId = assertString(body.orgId, 'Informe o ID do órgão.');
      await setOrgModules(supabase, body);
      return jsonResponse(await getOrgDetail(supabase, { action: 'get-org-detail', orgId }));
    }

    // ── Auditoria ───────────────────────────────────────────────────────────
    if (body.action === 'list-audit-log') {
      return jsonResponse(await listAuditLog(supabase, body));
    }

    return jsonResponse({ error: 'Acao nao suportada.' }, 400);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('admin-users', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Falha inesperada ao administrar usuarios.' },
      500,
    );
  }
});
