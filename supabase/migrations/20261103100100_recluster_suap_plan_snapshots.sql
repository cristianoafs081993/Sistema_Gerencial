-- O CLUSTER da migration anterior manteve tuplas mortas ainda visíveis a transações antigas;
-- reescreve de novo agora que o horizonte avançou.
cluster public.suap_plan_activity_snapshots using suap_plan_activity_snapshots_pkey;
analyze public.suap_plan_activity_snapshots;
