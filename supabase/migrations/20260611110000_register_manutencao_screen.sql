-- Migration to register the Maintenance and Cleaning screen in app_screens table
INSERT INTO public.app_screens (id, screen_group_id, name, path, sort_order, is_admin_only, is_active)
VALUES (
  'manutencao',
  'administracao',
  'Limpeza e Manutenção',
  '/manutencao',
  40,
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET
  screen_group_id = EXCLUDED.screen_group_id,
  name = EXCLUDED.name,
  path = EXCLUDED.path,
  sort_order = EXCLUDED.sort_order,
  is_admin_only = EXCLUDED.is_admin_only,
  is_active = EXCLUDED.is_active;
