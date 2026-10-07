BEGIN;

CREATE OR REPLACE VIEW public.suap_rd_movimentacoes WITH (security_invoker = true) AS
 SELECT rd.org_id,rd.campus_uasg,rd.suap_unit_code,rd.run_id,rd.suap_rd_id,rd.captured_at,
 rd.payload->>'numero' AS rd_numero,rd.payload->>'tipo' AS tipo,
 rd.payload->>'situacao' AS rd_situacao,rd.payload->>'sourceUrl' AS source_url,
 rd.payload->>'activityName' AS atividade_nome,rd.payload->>'processo' AS processo,
 line.ordinality AS line_index,line.value->>'naturezaDespesa' AS natureza_despesa,
 (line.value->>'valor')::numeric(16,2) AS valor,line.value->>'empenhoNumero' AS empenho_numero,
 line.value->>'empenhoCompleto' AS empenho_completo,line.value->>'gestao' AS gestao,
 line.value->>'ro' AS ro,line.value->>'situacao' AS linha_situacao,
 source.value->>'activityId' AS suap_activity_id,(source.value->>'planId')::integer AS suap_plan_id,
 source.value->>'sourceUrl' AS activity_source_url,
 activity.id AS atividade_id,
 CASE WHEN ne.matches = 1 THEN ne.local_id ELSE NULL END AS empenho_id,
 CASE WHEN jsonb_array_length(rd.payload->'sources') > 1 THEN 'conflito_atividade'
      WHEN ne.matches > 1 THEN 'ne_ambigua'
      WHEN source.value IS NULL THEN 'historica_ou_sem_atividade'
      WHEN activity.id IS NULL THEN 'atividade_ausente'
      WHEN ne.matches = 0 THEN 'empenho_ausente'
      WHEN manual.atividade_id IS NOT NULL AND manual.atividade_id <> activity.id THEN 'conflito_manual'
      ELSE 'resolvido' END AS resolution,
 (rd.payload->>'situacao' = 'Concluída' AND line.value->>'situacao' = 'Confirmada'
   AND rd.payload->>'tipo' IN ('dotacao','reforco','anulacao')
   AND line.value->>'ug' = rd.campus_uasg AND line.value->>'empenhoNumero' IS NOT NULL) AS confirmed,
 rd.payload->>'dataCadastro' AS data_cadastro
 FROM public.suap_requisicoes_despesa rd
 CROSS JOIN LATERAL jsonb_array_elements(rd.payload->'linhas') WITH ORDINALITY AS line(value,ordinality)
 LEFT JOIN LATERAL jsonb_array_elements(rd.payload->'sources') AS source(value) ON true
 LEFT JOIN public.atividades activity ON activity.org_id=rd.org_id AND activity.campus_uasg=rd.campus_uasg
  AND activity.suap_unit_code=rd.suap_unit_code AND activity.suap_plan_id=(source.value->>'planId')::integer
  AND activity.suap_activity_id=source.value->>'activityId'
 LEFT JOIN LATERAL (
  SELECT count(*) AS matches,min(e.id::text)::uuid AS local_id FROM public.empenhos e
  WHERE e.org_id=rd.org_id AND e.campus_uasg=rd.campus_uasg
    AND upper(trim(e.numero)) IN (line.value->>'empenhoNumero',line.value->>'empenhoCompleto')
 ) ne ON true
 LEFT JOIN public.empenhos manual ON manual.id=ne.local_id AND ne.matches=1
 WHERE rd.active;

COMMENT ON COLUMN public.suap_rd_movimentacoes.data_cadastro IS
  'Data de cadastro da RD no SUAP, proveniente da coluna Data do cadastro do inventário; não é horário de captura.';

GRANT SELECT ON public.suap_rd_movimentacoes TO authenticated,service_role;

COMMIT;
