-- Limpeza diária das capturas do printup: 00:05 em Brasília (03:05 UTC; sem horário de verão desde 2019)
-- apaga todos os PDFs e registros anteriores ao início do dia. Segredo interno criado no Vault,
-- nunca embutido no código ou no texto do cron.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'siafi_capturas_cleanup_secret') THEN
    PERFORM vault.create_secret(gen_random_uuid()::text || gen_random_uuid()::text, 'siafi_capturas_cleanup_secret',
      'Autenticação interna da limpeza diária das capturas do printup');
  END IF;
END $$;

CREATE FUNCTION public.validate_siafi_capturas_cleanup_secret(p_secret text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT length(coalesce(p_secret, '')) >= 64 AND EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'siafi_capturas_cleanup_secret' AND decrypted_secret = p_secret);
$$;
REVOKE ALL ON FUNCTION public.validate_siafi_capturas_cleanup_secret(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_siafi_capturas_cleanup_secret(text) TO service_role;

CREATE FUNCTION public.dispatch_siafi_capturas_cleanup() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE token text; request_id bigint;
BEGIN
  SELECT decrypted_secret INTO token FROM vault.decrypted_secrets WHERE name = 'siafi_capturas_cleanup_secret' LIMIT 1;
  IF coalesce(token, '') = '' THEN RAISE EXCEPTION 'Segredo da limpeza das capturas não configurado'; END IF;
  SELECT net.http_post(url := 'https://mnqhwyrzhgykjlyyqodd.supabase.co/functions/v1/cleanup-siafi-capturas',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cleanup-secret', token),
    body := '{}'::jsonb, timeout_milliseconds := 120000) INTO request_id;
  RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_siafi_capturas_cleanup() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_siafi_capturas_cleanup() TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'siafi-capturas-cleanup-daily';
SELECT cron.schedule('siafi-capturas-cleanup-daily', '5 3 * * *', 'select public.dispatch_siafi_capturas_cleanup();');
