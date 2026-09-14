-- Garante o vínculo multi-órgão do usuário que já possui acesso ao Refeitório.
-- A operação é idempotente e não altera um vínculo de órgão já existente.

INSERT INTO public.org_users (org_id, user_id, role)
SELECT org.id, auth_user.id, 'member'
FROM public.orgs org
JOIN auth.users auth_user
  ON lower(auth_user.email) = 'izaelson.lima@ifrn.edu.br'
WHERE org.slug = 'ifrn-cn'
ON CONFLICT (user_id) DO NOTHING;
