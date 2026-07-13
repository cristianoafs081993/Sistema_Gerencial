insert into public.app_screens (id, screen_group_id, name, path, sort_order, is_admin_only, is_active)
values
  ('cadastro-fornecedores', 'licitacoes', 'Cadastro de Fornecedores', '/cadastro-fornecedores', 30, false, true),
  ('pesquisa-precos-ead', 'licitacoes', 'Capacitação EAD', '/pesquisa-precos/ead', 6, false, true)
on conflict (id) do update
set screen_group_id = excluded.screen_group_id,
    name = excluded.name,
    path = excluded.path,
    sort_order = excluded.sort_order,
    is_admin_only = excluded.is_admin_only,
    is_active = excluded.is_active;

insert into public.user_group_screen_permissions (group_id, screen_id, can_access)
select distinct permission.group_id, child.screen_id, true
from public.user_group_screen_permissions permission
cross join (
  values
    ('cadastro-fornecedores'),
    ('pesquisa-precos-ead')
) as child(screen_id)
where permission.screen_id = 'pesquisa-precos'
  and permission.can_access = true
on conflict (group_id, screen_id) do update
set can_access = true,
    updated_at = now();

insert into public.org_module_permissions (org_id, screen_id, can_access)
select distinct permission.org_id, child.screen_id, true
from public.org_module_permissions permission
cross join (
  values
    ('cadastro-fornecedores'),
    ('pesquisa-precos-ead')
) as child(screen_id)
where permission.screen_id = 'pesquisa-precos'
  and permission.can_access = true
on conflict (org_id, screen_id) do update
set can_access = true,
    updated_at = now();
