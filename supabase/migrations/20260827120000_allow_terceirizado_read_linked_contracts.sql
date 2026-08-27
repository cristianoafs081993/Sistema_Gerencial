-- Permite que terceirizados acessem a tela de contratos.
-- A lista exibida no frontend é filtrada pelos vínculos em terceirizado_permissions.

INSERT INTO public.user_group_screen_permissions (group_id, screen_id, can_access)
SELECT id, 'contratos', true
FROM public.user_groups
WHERE slug = 'terceirizado'
ON CONFLICT (group_id, screen_id) DO UPDATE
SET can_access = true,
    updated_at = now();
