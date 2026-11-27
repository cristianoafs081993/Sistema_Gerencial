import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {
  buildSuapPhotoUrl,
  decideCampusPreference,
  decideGroupSync,
  extractSuapCampus,
  isGrantActive,
  resolveCampusUasg,
} from '../_shared/suap_access.ts';

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

    const defaultClientId = Deno.env.get('SUAP_CLIENT_ID') || 'Oe1jZhORICjEB840r23FR4P1OGQCInNqyNcCzLip';
    const devClientId = Deno.env.get('SUAP_DEV_CLIENT_ID') || '';
    const clientId = reqClientId || defaultClientId;
    const clientSecret =
      devClientId && clientId === devClientId
        ? Deno.env.get('SUAP_DEV_CLIENT_SECRET') || ''
        : Deno.env.get('SUAP_CLIENT_SECRET') || 'B2wQ8Ikaoj6DILy1RTpXgkfsEQcr81hqPK7gLitQWmIlYSYvNAKY2if1MrRL8pBhan56jM4qcTxKMdHRzN9iDkyFjWOqaNLz5ARrQsk2k3QSlLHnMzEX12I3yYz9OPRj';

    if (!clientSecret) {
      return new Response(JSON.stringify({ error: 'Secret OAuth do SUAP nao configurado para o client informado.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
      email: profileData.email || profileData.email_secundario || profileData.email_institucional || profileData.email_preferencial || profileData.email_google || '',
      foto: buildSuapPhotoUrl(profileData),
    };
    const suapCampus = extractSuapCampus(profileData);
    let suapCampusUasg: string | null = null;
    let accessPending = false;
    const normalizedMatricula = String(userProfile.matricula || '').trim().replace(/[^0-9A-Za-z]/g, '').toLowerCase();

    let actionLink = null;
    let hashedToken = null;
    let emailOtp = null;
    let verificationType = null;

    if (userProfile.email) {
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
        let isNewUser = false;

        // Campus do SUAP -> UASG (sem a tabela de mapa, resolve só pelo nome do campus).
        if (suapCampus) {
          try {
            const [{ data: campusMap }, { data: uasgRows }] = await Promise.all([
              supabaseAdmin.from('suap_campus_map').select('sigla,campus_uasg'),
              supabaseAdmin.from('licitacoes_pncp_uasgs').select('codigo_uasg,nome_uasg').eq('cnpj_orgao', '10877412000168'),
            ]);
            suapCampusUasg = resolveCampusUasg(suapCampus, campusMap || [], uasgRows || []);
            if (!suapCampusUasg) console.warn('Campus do SUAP sem UASG correspondente:', suapCampus);
          } catch (err) {
            console.error('Falha ao resolver campus do SUAP:', err);
          }
        }

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
              isNewUser = Boolean(userId);
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

        // 3. Keep SUAP identity metadata and terceirizado links synchronized by matricula.
        if (userId) {
          try {
            const mergedMetadata = {
              ...(userObj?.user_metadata || {}),
              nome: userProfile.nome,
              matricula: normalizedMatricula,
              vinculo: userProfile.vinculo,
              foto: userProfile.foto,
              uses_default_password: false,
            };

            // app_metadata só é gravado pelo servidor: é a fonte confiável de matrícula e campus.
            const mergedAppMetadata = {
              ...(userObj?.app_metadata || {}),
              ...(normalizedMatricula ? { matricula: normalizedMatricula } : {}),
              ...(userProfile.vinculo ? { suap_vinculo: userProfile.vinculo } : {}),
              ...(suapCampus?.sigla ? { suap_campus: suapCampus.sigla } : {}),
              ...(suapCampusUasg ? { suap_campus_uasg: suapCampusUasg } : {}),
            };

            const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
              user_metadata: mergedMetadata,
              app_metadata: mergedAppMetadata,
            });

            if (updateUserError) {
              console.error('Erro ao atualizar metadados SUAP do usuario:', updateUserError);
            }
          } catch (err) {
            console.error('Falha ao sincronizar metadados SUAP do usuario:', err);
          }

          // Foto e campus do SUAP no perfil (preserva a escolha de ocultar a foto).
          try {
            const { error: profileError } = await supabaseAdmin.from('user_profiles').upsert({
              user_id: userId,
              foto_url: userProfile.foto,
              suap_matricula: normalizedMatricula || null,
              suap_campus_sigla: suapCampus?.sigla || suapCampus?.nome || null,
              suap_campus_uasg: suapCampusUasg,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
            if (profileError) console.error('Erro ao gravar perfil SUAP do usuario:', profileError);
          } catch (err) {
            console.error('Falha ao gravar perfil SUAP do usuario:', err);
          }

          let isTerceirizado = false;
          if (normalizedMatricula) {
            let terceirizadoMatch: { id: string; matricula: string | null } | null = null;
            const { data: exactMatches, error: terceirizadoError } = await supabaseAdmin
              .from('terceirizados')
              .select('id,matricula')
              .eq('matricula', normalizedMatricula)
              .limit(1);

            if (terceirizadoError) {
              console.error('Erro ao verificar terceirizado por matricula:', terceirizadoError);
            } else {
              terceirizadoMatch = exactMatches?.[0] || null;

              if (!terceirizadoMatch) {
                const { data: candidates, error: candidatesError } = await supabaseAdmin
                  .from('terceirizados')
                  .select('id,matricula')
                  .not('matricula', 'is', null)
                  .limit(1000);
                if (candidatesError) {
                  console.error('Erro ao procurar terceirizado por matricula normalizada:', candidatesError);
                } else {
                  terceirizadoMatch = (candidates || []).find((candidate) =>
                    String(candidate.matricula || '').trim().replace(/[^0-9A-Za-z]/g, '').toLowerCase() === normalizedMatricula,
                  ) || null;
                }
              }
            }

            if (terceirizadoMatch) {
              isTerceirizado = true;
              await supabaseAdmin.from('terceirizados').update({ user_id: userId }).eq('id', terceirizadoMatch.id);
              await supabaseAdmin
                .from('terceirizado_permissions')
                .update({ user_id: userId })
                .eq('user_matricula', normalizedMatricula);
            }
          }

          if (!isTerceirizado && email) {
            const { data: legacyTerceirizadoMatch, error: legacyTerceirizadoError } = await supabaseAdmin
              .from('terceirizados')
              .select('id')
              .eq('email', email)
              .maybeSingle();

            if (legacyTerceirizadoError) {
              console.error('Erro ao verificar terceirizado legado por email:', legacyTerceirizadoError);
            } else if (legacyTerceirizadoMatch) {
              isTerceirizado = true;
              await supabaseAdmin.from('terceirizados').update({ user_id: userId }).eq('id', legacyTerceirizadoMatch.id);
              await supabaseAdmin
                .from('terceirizado_permissions')
                .update({ user_id: userId })
                .eq('user_email', email);
            }
          }

          // Autorização por matrícula e configuração do login SUAP.
          let requireGrant = false;
          {
            const { data: settingsRow, error: settingsError } = await supabaseAdmin
              .from('suap_access_settings')
              .select('require_grant')
              .eq('id', true)
              .maybeSingle();
            // Sem a tabela (migration ainda não aplicada) ou com erro, mantém a regra antiga.
            if (settingsError) console.warn('Configuracao do login SUAP indisponivel:', settingsError.message);
            requireGrant = settingsRow?.require_grant === true;
          }

          let grant: { matricula: string; status: string; valid_until: string | null } | null = null;
          let grantGroupIds: string[] = [];
          let grantCampi: string[] = [];
          if (normalizedMatricula) {
            const { data: grantRow, error: grantError } = await supabaseAdmin
              .from('user_access_grants')
              .select('matricula,status,valid_until')
              .eq('matricula', normalizedMatricula)
              .maybeSingle();
            if (grantError) {
              console.warn('Autorizacao por matricula indisponivel:', grantError.message);
            } else if (grantRow) {
              grant = grantRow;
              const [{ data: grantGroups }, { data: grantCampusRows }] = await Promise.all([
                supabaseAdmin.from('user_access_grant_groups').select('group_id').eq('matricula', normalizedMatricula),
                supabaseAdmin.from('user_access_grant_campi').select('campus_uasg').eq('matricula', normalizedMatricula),
              ]);
              grantGroupIds = (grantGroups || []).map((row) => row.group_id);
              grantCampi = (grantCampusRows || []).map((row) => row.campus_uasg);
            }
          }

          const grantActive = isGrantActive(grant, new Date().toISOString().slice(0, 10));

          if (grant) {
            const { error: grantUpdateError } = await supabaseAdmin
              .from('user_access_grants')
              .update({
                user_id: userId,
                nome: userProfile.nome,
                email_suap: email,
                suap_campus_sigla: suapCampus?.sigla || suapCampus?.nome || null,
                last_login_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('matricula', grant.matricula);
            if (grantUpdateError) console.error('Erro ao atualizar autorizacao por matricula:', grantUpdateError);
          }

          const { data: memberships, error: memError } = await supabaseAdmin
            .from('user_group_memberships')
            .select('group_id')
            .eq('user_id', userId);

          if (memError) {
            console.error('Erro ao buscar grupos do usuário:', memError);
          } else {
            const currentGroupIds = (memberships || []).map((membership) => membership.group_id);
            const decision = decideGroupSync({
              grantActive,
              grantGroupIds,
              isTerceirizado,
              requireGrant,
              isAppLogin: Boolean(loginSupabase),
              currentGroupIds,
            });

            if (decision.mode === 'grant') {
              const toRemove = currentGroupIds.filter((groupId) => !decision.groupIds.includes(groupId));
              const toAdd = decision.groupIds.filter((groupId) => !currentGroupIds.includes(groupId));
              if (toRemove.length > 0) {
                const { error } = await supabaseAdmin
                  .from('user_group_memberships')
                  .delete()
                  .eq('user_id', userId)
                  .in('group_id', toRemove);
                if (error) console.error('Erro ao remover grupos fora da autorizacao:', error);
              }
              if (toAdd.length > 0) {
                const { error } = await supabaseAdmin
                  .from('user_group_memberships')
                  .insert(toAdd.map((groupId) => ({ user_id: userId, email, group_id: groupId })));
                if (error) console.error('Erro ao aplicar grupos da autorizacao:', error);
              }
            } else if (decision.mode === 'terceirizado' || decision.mode === 'legacy-default') {
              // Regra anterior, sem alteração.
              const targetGroupSlug = decision.mode === 'terceirizado' ? 'terceirizado' : decision.groupSlug;
              const { data: groupData, error: groupError } = await supabaseAdmin
                .from('user_groups')
                .select('id')
                .eq('slug', targetGroupSlug)
                .single();

              if (groupError) {
                console.error(`Erro ao buscar o grupo ${targetGroupSlug}:`, groupError);
              } else if (groupData) {
                if (decision.mode === 'terceirizado') {
                  const { error: cleanupError } = await supabaseAdmin
                    .from('user_group_memberships')
                    .delete()
                    .eq('user_id', userId)
                    .neq('group_id', groupData.id);

                  if (cleanupError) {
                    console.error('Erro ao remover grupos incompatíveis do terceirizado:', cleanupError);
                  }
                }

                if (!currentGroupIds.includes(groupData.id)) {
                  console.log(`Associando usuario ${email} ao grupo ${targetGroupSlug}`);
                  const { error: insertError } = await supabaseAdmin
                    .from('user_group_memberships')
                    .insert({
                      user_id: userId,
                      email,
                      group_id: groupData.id,
                    });

                  if (insertError) {
                    console.error('Erro ao associar usuario ao grupo:', insertError);
                  }
                }
              }
            } else if (decision.mode === 'pending') {
              accessPending = true;
              if (normalizedMatricula) {
                const { data: existingRequest } = await supabaseAdmin
                  .from('suap_access_requests')
                  .select('attempts')
                  .eq('matricula', normalizedMatricula)
                  .maybeSingle();
                const { error: requestError } = await supabaseAdmin.from('suap_access_requests').upsert({
                  matricula: normalizedMatricula,
                  nome: userProfile.nome,
                  email,
                  user_id: userId,
                  vinculo: userProfile.vinculo || null,
                  suap_campus_sigla: suapCampus?.sigla || suapCampus?.nome || null,
                  suap_campus_uasg: suapCampusUasg,
                  attempts: (existingRequest?.attempts || 0) + 1,
                  last_seen_at: new Date().toISOString(),
                }, { onConflict: 'matricula' });
                if (requestError) console.error('Erro ao registrar solicitacao de acesso:', requestError);
              }
            }
            // decision.mode === 'keep': grupos atuais preservados.
          }

          // Campus ativo: só para usuário novo ou quando a autorização limita os campi.
          try {
            const { data: currentPreference } = await supabaseAdmin
              .from('user_campus_preferences')
              .select('campus_uasg')
              .eq('user_id', userId)
              .maybeSingle();
            const campusToSet = decideCampusPreference({
              isNewUser,
              suapCampusUasg,
              grantCampi: grantActive ? grantCampi : [],
              currentCampusUasg: currentPreference?.campus_uasg || null,
            });
            if (campusToSet) {
              const { error: campusError } = await supabaseAdmin
                .from('user_campus_preferences')
                .upsert({ user_id: userId, campus_uasg: campusToSet, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
              if (campusError) console.error('Erro ao definir campus do usuario:', campusError);
            }
          } catch (err) {
            console.error('Falha ao definir campus do usuario:', err);
          }
        }
        // 4. Generate login verification link (magiclink) only if loginSupabase is true
        if (loginSupabase) {
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

          // Return token properties so frontend can verify locally via verifyOtp
          // instead of redirecting through Supabase (which validates redirect URLs).
          hashedToken = linkData?.properties?.hashed_token || null;
          emailOtp = linkData?.properties?.email_otp || null;
          verificationType = linkData?.properties?.verification_type || 'magiclink';
        }
      } else {
        console.error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente');
      }
    }

    return new Response(JSON.stringify({
      token: tokenData,
      user: userProfile,
      action_link: actionLink,
      hashed_token: hashedToken,
      email_otp: emailOtp,
      verification_type: verificationType,
      access_pending: accessPending,
      suap_campus: suapCampus,
      suap_campus_uasg: suapCampusUasg,
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
