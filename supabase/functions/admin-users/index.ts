import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const DEFAULT_PASSWORD = 'ifrn';
const SUPERADMIN_EMAIL = 'cristiano.cnrn@gmail.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

type AdminUsersRequest =
  | { action: 'list' }
  | { action: 'create-user'; email?: string; groupId?: string }
  | { action: 'invite-user'; email?: string; groupId?: string; redirectTo?: string }
  | { action: 'upsert-group'; id?: string; name?: string; description?: string; screenIds?: string[] }
  | { action: 'set-user-groups'; userId?: string; email?: string; groupIds?: string[] };

type AuthUserLike = {
  id: string;
  email?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

type AuthUserForAdminCheck = {
  email?: string | null;
  app_metadata?: {
    role?: string;
    is_superadmin?: boolean;
  };
};

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
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`A variavel ${name} precisa estar configurada no ambiente do Supabase.`);
  }
  return value;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const [, token] = authorization.match(/^Bearer\s+(.+)$/i) || [];

  if (!token) {
    throw new Response(JSON.stringify({ error: 'Sessao ausente. Faca login para administrar usuarios.' }), {
      status: 401,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }

  return token;
}

function assertValidEmail(email: string) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    throw new Response(JSON.stringify({ error: 'Informe um e-mail valido.' }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
}

function assertString(value: string | undefined, message: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
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

async function assertAllowedAdmin(supabase: ReturnType<typeof createClient>, accessToken: string) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    throw new Response(JSON.stringify({ error: 'Nao foi possivel validar o usuario autenticado.' }), {
      status: 401,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }

  if (!isSuperAdminUser(user)) {
    throw new Response(JSON.stringify({ error: 'Somente o superadministrador pode administrar usuarios.' }), {
      status: 403,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }

  return user;
}

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

  const { error: deleteError } = await supabase
    .from('user_group_memberships')
    .delete()
    .eq('user_id', userId);

  if (deleteError) throw deleteError;

  if (uniqueGroupIds.length === 0) return;

  const { error: insertError } = await supabase.from('user_group_memberships').insert(
    uniqueGroupIds.map((groupId) => ({
      user_id: userId,
      email: normalizedEmail,
      group_id: groupId,
    })),
  );

  if (insertError) throw insertError;
}

async function listState(supabase: ReturnType<typeof createClient>) {
  const [users, screenGroupsResult, screensResult, groupsResult, permissionsResult, membershipsResult] = await Promise.all([
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
  assertValidEmail(email);

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      uses_default_password: true,
    },
  });

  if (error) throw error;
  if (!data.user?.id) throw new Error('Usuario criado sem identificador retornado pelo Supabase.');

  await assignUserGroups(supabase, data.user.id, email, [groupId]);
}

async function inviteUser(supabase: ReturnType<typeof createClient>, request: AdminUsersRequest, inviterEmail: string) {
  if (request.action !== 'invite-user') return;

  const email = normalizeEmail(assertString(request.email, 'Informe o e-mail do usuario.'));
  const groupId = assertString(request.groupId, 'Informe o grupo do usuario.');
  const redirectTo = request.redirectTo?.trim();
  assertValidEmail(email);

  if (redirectTo) {
    try {
      new URL(redirectTo);
    } catch {
      throw new Response(JSON.stringify({ error: 'A URL de redirecionamento do convite e invalida.' }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
  }

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectTo || undefined,
    data: {
      invited_by: inviterEmail,
      invited_at: new Date().toISOString(),
    },
  });

  if (error) throw error;
  if (!data.user?.id) throw new Error('Convite enviado sem identificador de usuario retornado pelo Supabase.');

  await assignUserGroups(supabase, data.user.id, email, [groupId]);
}

async function upsertGroup(supabase: ReturnType<typeof createClient>, request: AdminUsersRequest) {
  if (request.action !== 'upsert-group') return;

  const name = assertString(request.name, 'Informe o nome do grupo.');
  const screenIds = Array.from(new Set(request.screenIds || []));
  const description = request.description?.trim() || null;
  let groupId = request.id?.trim();

  if (groupId) {
    const { error } = await supabase
      .from('user_groups')
      .update({
        name,
        description,
        updated_at: new Date().toISOString(),
      })
      .eq('id', groupId);

    if (error) throw error;
  } else {
    const slug = slugify(name);
    if (!slug) throw new Error('Informe um nome de grupo valido.');

    const { data, error } = await supabase
      .from('user_groups')
      .insert({
        slug,
        name,
        description,
        is_system: false,
      })
      .select('id')
      .single();

    if (error) throw error;
    groupId = data.id;
  }

  const { error: deleteError } = await supabase
    .from('user_group_screen_permissions')
    .delete()
    .eq('group_id', groupId);

  if (deleteError) throw deleteError;

  if (screenIds.length > 0) {
    const { error: insertError } = await supabase.from('user_group_screen_permissions').insert(
      screenIds.map((screenId) => ({
        group_id: groupId,
        screen_id: screenId,
        can_access: true,
      })),
    );

    if (insertError) throw insertError;
  }
}

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

    if (body.action === 'create-user') {
      await createDirectUser(supabase, body);
    } else if (body.action === 'invite-user') {
      await inviteUser(supabase, body, normalizeEmail(admin.email));
    } else if (body.action === 'upsert-group') {
      await upsertGroup(supabase, body);
    } else if (body.action === 'set-user-groups') {
      const userId = assertString(body.userId, 'Informe o usuario.');
      const email = normalizeEmail(assertString(body.email, 'Informe o e-mail do usuario.'));
      await assignUserGroups(supabase, userId, email, body.groupIds || []);
    } else if (body.action !== 'list') {
      return jsonResponse({ error: 'Acao nao suportada.' }, 400);
    }

    return jsonResponse(await listState(supabase));
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error('admin-users', error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Falha inesperada ao administrar usuarios.',
      },
      500,
    );
  }
});
