import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

import { SUPERADMIN_EMAIL, isSuperAdminEmail, normalizeEmail } from '../../../src/lib/authz.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

type InviteUserRequest = {
  email?: string;
  redirectTo?: string;
};

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

function assertValidEmail(email: string) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    throw new Response(
      JSON.stringify({ error: 'Informe um e-mail valido para o convite.' }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const [, token] = authorization.match(/^Bearer\s+(.+)$/i) || [];

  if (!token) {
    throw new Response(
      JSON.stringify({ error: 'Sessao ausente. Faca login para enviar convites.' }),
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }

  return token;
}

function assertAllowedInviter(inviterEmail: string) {
  if (!isSuperAdminEmail(inviterEmail)) {
    throw new Response(
      JSON.stringify({ error: `Somente o superadministrador ${SUPERADMIN_EMAIL} pode enviar convites.` }),
      {
        status: 403,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
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
    const body = (await request.json()) as InviteUserRequest;
    const invitedEmail = normalizeEmail(body.email);
    const redirectTo = body.redirectTo?.trim();

    if (!invitedEmail) {
      return jsonResponse({ error: 'Informe o e-mail do usuario a ser convidado.' }, 400);
    }

    assertValidEmail(invitedEmail);

    if (redirectTo) {
      try {
        new URL(redirectTo);
      } catch {
        return jsonResponse({ error: 'A URL de redirecionamento do convite e invalida.' }, 400);
      }
    }

    const supabaseUrl = requireEnv('SUPABASE_URL');
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const accessToken = getBearerToken(request);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user: inviter },
      error: inviterError,
    } = await supabase.auth.getUser(accessToken);

    if (inviterError || !inviter) {
      return jsonResponse({ error: 'Nao foi possivel validar o usuario autenticado.' }, 401);
    }

    const inviterEmail = normalizeEmail(inviter.email);
    assertAllowedInviter(inviterEmail);

    if (inviterEmail === invitedEmail) {
      return jsonResponse({ error: 'Use outro e-mail. O convidante nao pode convidar a si mesmo.' }, 400);
    }

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(invitedEmail, {
      redirectTo: redirectTo || undefined,
      data: {
        invited_by: inviterEmail,
        invited_at: new Date().toISOString(),
      },
    });

    if (error) {
      throw error;
    }

    return jsonResponse({
      status: 'invited',
      invitedEmail,
      inviterEmail,
      userId: data.user?.id || null,
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error('invite-user', error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Falha inesperada ao enviar o convite.',
      },
      500,
    );
  }
});
