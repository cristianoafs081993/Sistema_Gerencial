import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não suportado' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { code, redirectUri, loginSupabase, clientId: reqClientId } = await req.json();

    if (!code || !redirectUri) {
      return new Response(JSON.stringify({ error: 'Parâmetros code e redirectUri são obrigatórios.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientId = reqClientId || Deno.env.get('SUAP_CLIENT_ID') || 'Oe1jZhORICjEB840r23FR4P1OGQCInNqyNcCzLip';
    const clientSecret = Deno.env.get('SUAP_CLIENT_SECRET') || 'B2wQ8Ikaoj6DILy1RTpXgkfsEQcr81hqPK7gLitQWmIlYSYvNAKY2if1MrRL8pBhan56jM4qcTxKMdHRzN9iDkyFjWOqaNLz5ARrQsk2k3QSlLHnMzEX12I3yYz9OPRj';

    // 1. Exchange authorization code for token
    const tokenUrl = 'https://suap.ifrn.edu.br/o/token/';
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('Erro de token no SUAP:', errorText);
      return new Response(JSON.stringify({ error: 'Falha ao obter token do SUAP', details: errorText }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. Fetch user profile from SUAP
    const profileUrl = 'https://suap.ifrn.edu.br/api/rh/meus-dados/';
    const profileRes = await fetch(profileUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!profileRes.ok) {
      const errorText = await profileRes.text();
      console.error('Erro de perfil no SUAP:', errorText);
      return new Response(JSON.stringify({ error: 'Falha ao obter perfil do SUAP', details: errorText }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const profileData = await profileRes.json();
    console.log('Dados do perfil retornados pelo SUAP:', profileData);

    const userProfile = {
      nome: profileData.nome_usual || profileData.nome || profileData.nome_completo || 'Colaborador',
      matricula: profileData.matricula || profileData.username || profileData.identificacao || '',
      vinculo: profileData.tipo_vinculo || profileData.vinculo?.tipo_vinculo || '',
      email: profileData.email || profileData.email_secundario || profileData.email_institucional || '',
      foto: profileData.url_foto_150x200 
        ? (profileData.url_foto_150x200.startsWith('http') ? profileData.url_foto_150x200 : `https://suap.ifrn.edu.br${profileData.url_foto_150x200}`) 
        : null,
    };

    let actionLink = null;

    if (loginSupabase && userProfile.email) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

      if (supabaseUrl && serviceRoleKey) {
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const email = userProfile.email.toLowerCase();

        // 1. Check if user exists in auth.users
        let userObj = null;
        try {
          const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserByEmail(email);
          if (getUserError || !userData?.user) {
            console.warn('Erro ao obter usuário por email ou usuário nulo, listando usuários como fallback:', getUserError);
            const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
            userObj = listData?.users?.find((u) => u.email?.toLowerCase() === email) || null;
          } else {
            userObj = userData?.user || null;
          }
        } catch (err) {
          console.error('Falha ao procurar usuário:', err);
        }

        let userId = userObj?.id;

        // 2. If user doesn't exist, create them
        if (!userId) {
          console.log(`Criando novo usuário para ${email} no Supabase Auth`);
          try {
            const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
              email,
              email_confirm: true,
              user_metadata: {
                nome: userProfile.nome,
                matricula: userProfile.matricula,
                vinculo: userProfile.vinculo,
                foto: userProfile.foto,
                uses_default_password: false,
              },
            });

            if (createError) {
              if (createError.message?.includes('already been registered') || createError.status === 422) {
                console.log('Usuário já registrado no Auth, buscando novamente via listUsers...');
                const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
                userObj = listData?.users?.find((u) => u.email?.toLowerCase() === email) || null;
                userId = userObj?.id;
                if (!userId) {
                  throw createError;
                }
              } else {
                console.error('Erro ao criar usuário no Supabase:', createError);
                throw createError;
              }
            } else {
              userId = createData.user?.id;
            }
          } catch (err) {
            if (err.message?.includes('already been registered')) {
              console.log('Capturado erro de email registrado: buscando novamente via listUsers...');
              const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
              userObj = listData?.users?.find((u) => u.email?.toLowerCase() === email) || null;
              userId = userObj?.id;
              if (!userId) throw err;
            } else {
              throw err;
            }
          }
        }

        // 3. Check and assign 'Diretores' group if no group membership exists
        if (userId) {
          const { data: memberships, error: memError } = await supabaseAdmin
            .from('user_group_memberships')
            .select('group_id')
            .eq('user_id', userId);

          if (memError) {
            console.error('Erro ao buscar grupos do usuário:', memError);
          } else if (!memberships || memberships.length === 0) {
            // Get group ID for 'diretores'
            const { data: groupData, error: groupError } = await supabaseAdmin
              .from('user_groups')
              .select('id')
              .eq('slug', 'diretores')
              .single();

            if (groupError) {
              console.error('Erro ao buscar o grupo diretores:', groupError);
            } else if (groupData) {
              console.log(`Associando usuário ${email} ao grupo Diretores`);
              const { error: insertError } = await supabaseAdmin
                .from('user_group_memberships')
                .insert({
                  user_id: userId,
                  email,
                  group_id: groupData.id,
                });

              if (insertError) {
                console.error('Erro ao associar usuário ao grupo:', insertError);
              }
            }
          }
        }

        // 4. Generate login verification link (magiclink)
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: {
            redirectTo: redirectUri,
          },
        });

        if (linkError) {
          console.error('Erro ao gerar link de acesso:', linkError);
          throw linkError;
        }

        actionLink = linkData?.properties?.action_link || null;
      } else {
        console.error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente');
      }
    }

    return new Response(JSON.stringify({
      token: tokenData,
      user: userProfile,
      action_link: actionLink,
      rawProfile: profileData
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro inesperado no token exchange:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
