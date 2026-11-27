-- Parelhas, Lajes, Touros, São Miguel e Umarizal emitem NE pela UG própria (migration 20261103090000),
-- mas o Plano 8 continuava gravando as atividades no UASG antigo (158366 ou 158155). Resultado: nesses
-- campi o painel mostrava empenhado sem planejado, e em Currais Novos/Reitoria o planejado ficava somado
-- a unidades que não emitem NE ali. Esta migration move o planejamento dessas unidades para a UG certa.

-- Mapeamento (unidade, UASG antigo, UG própria): 29 Parelhas -> 158882, 21 Lajes -> 158887,
-- 43 Touros -> 158896, 42 São Miguel -> 158897, 44 Umarizal -> 158898.

-- Catálogo das RDs. A FK de suap_rd_sync_runs não tem ON UPDATE CASCADE; hoje não há RDs dessas
-- unidades, e se houver a migration falha em vez de deixar runs órfãos.
UPDATE public.suap_rd_units u
SET campus_uasg = f.new_uasg
FROM (VALUES ('29', '158366', '158882'), ('21', '158155', '158887'), ('43', '158155', '158896'), ('42', '158155', '158897'), ('44', '158155', '158898')) AS f(suap_unit_code, old_uasg, new_uasg)
WHERE u.suap_unit_code = f.suap_unit_code AND u.campus_uasg = f.old_uasg;

UPDATE public.atividades a
SET campus_uasg = f.new_uasg
FROM (VALUES ('29', '158366', '158882'), ('21', '158155', '158887'), ('43', '158155', '158896'), ('42', '158155', '158897'), ('44', '158155', '158898')) AS f(suap_unit_code, old_uasg, new_uasg)
WHERE a.sync_source = 'suap_plan_8'
  AND a.suap_unit_code = f.suap_unit_code
  AND a.campus_uasg = f.old_uasg;

UPDATE public.suap_plan_sync_runs r
SET campus_uasg = f.new_uasg
FROM (VALUES ('29', '158366', '158882'), ('21', '158155', '158887'), ('43', '158155', '158896'), ('42', '158155', '158897'), ('44', '158155', '158898')) AS f(suap_unit_code, old_uasg, new_uasg)
WHERE r.suap_unit_code = f.suap_unit_code AND r.campus_uasg = f.old_uasg;

UPDATE public.suap_plan_activity_snapshots s
SET campus_uasg = f.new_uasg
FROM (VALUES ('29', '158366', '158882'), ('21', '158155', '158887'), ('43', '158155', '158896'), ('42', '158155', '158897'), ('44', '158155', '158898')) AS f(suap_unit_code, old_uasg, new_uasg)
WHERE s.suap_unit_code = f.suap_unit_code AND s.campus_uasg = f.old_uasg;
