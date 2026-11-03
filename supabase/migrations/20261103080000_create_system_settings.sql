-- Migration to create system_settings table for dynamic application configurations,
-- including the system-wide maintenance mode controlled by superadmins.

CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists then recreate
DROP POLICY IF EXISTS "system_settings_public_read" ON public.system_settings;
CREATE POLICY "system_settings_public_read"
  ON public.system_settings
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "system_settings_superadmin_manage" ON public.system_settings;
CREATE POLICY "system_settings_superadmin_manage"
  ON public.system_settings
  FOR ALL
  TO authenticated
  USING (public.is_superadmin_jwt())
  WITH CHECK (public.is_superadmin_jwt());

-- Seed initial row for maintenance_mode
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'maintenance_mode',
  '{"enabled": true, "title": "Sistema em Manutenção", "subtitle": "Estamos realizando melhorias programadas na infraestrutura do SIAGES.", "description": "O acesso aos módulos do sistema está temporariamente suspenso para realização de atualizações e manutenções programadas no ambiente. Voltaremos em breve.", "estimated_return": "Previsão de retorno em breve", "bypass_secret": "siages"}'::jsonb,
  'Controle do modo de manutenção do sistema'
)
ON CONFLICT (key) DO NOTHING;
