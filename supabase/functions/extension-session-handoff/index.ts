import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

// Emite uma sessão própria da extensão para quem já está logado no site do SIAGES.
// Recebe o JWT do site e devolve um token de uso único (magic link) que a extensão troca em /auth/v1/verify.
// Não copia o refresh token do site: com a rotação do Supabase, a renovação de um derrubaria o outro.
// Exposição: quem tem o JWT do site já tem acesso ao refresh token no mesmo localStorage,
// então esta função não amplia o que um token vazado permite.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function readBearerToken(header: string | null) {
  const match = /^Bearer\s+(\S+)$/i.exec(String(header || '').trim());
  return match ? match[1] : '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método não suportado' }, 405);

  const jwt = readBearerToken(req.headers.get('Authorization'));
  if (!jwt) return jsonResponse({ error: 'Sessão do site ausente.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Função sem configuração do Supabase.' }, 500);

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // getUser valida assinatura e validade do JWT no próprio Auth.
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    const user = userData?.user;
    if (userError || !user) return jsonResponse({ error: 'Sessão do site inválida ou expirada.' }, 401);
    if (!user.email) return jsonResponse({ error: 'A conta do site não tem e-mail para criar a sessão da extensão.' }, 400);
    const bannedUntil = (user as { banned_until?: string | null }).banned_until;
    if (bannedUntil && new Date(bannedUntil).getTime() > Date.now()) return jsonResponse({ error: 'Conta bloqueada.' }, 403);

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email.toLowerCase(),
    });
    const hashedToken = linkData?.properties?.hashed_token;
    if (linkError || !hashedToken) {
      console.error('Falha ao gerar o login da extensão:', linkError);
      return jsonResponse({ error: 'Não foi possível gerar a sessão da extensão.' }, 500);
    }

    console.log(`Sessão da extensão emitida a partir do site para o usuário ${user.id}`);
    return jsonResponse({ hashed_token: hashedToken, verification_type: 'magiclink' });
  } catch (error) {
    console.error('Erro inesperado no handoff da extensão:', error);
    return jsonResponse({ error: 'Erro interno do servidor' }, 500);
  }
});
