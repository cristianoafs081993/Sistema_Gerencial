-- A sessão SUAP cifrada só é usada pelo Edge Function com service_role.
DROP POLICY IF EXISTS suap_connections_owner ON public.suap_connections;
REVOKE ALL ON TABLE public.suap_connections FROM authenticated;

COMMENT ON TABLE public.suap_connections IS
  'Sessões SUAP cifradas e de curta duração; nunca expostas diretamente ao cliente.';
