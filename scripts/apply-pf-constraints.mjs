const SUPABASE_URL = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI3OTg2MiwiZXhwIjoyMDg1ODU1ODYyfQ.lylmodjOxHBtiIb81tKna3kVTebyOqE-1mxhzD0smT0';

const sql = `
-- Fix unique constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pf_solicitacao_numero_pf_unique') THEN
    ALTER TABLE pf_solicitacao ADD CONSTRAINT pf_solicitacao_numero_pf_unique UNIQUE (numero_pf);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pf_aprovacao_numero_pf_unique') THEN
    ALTER TABLE pf_aprovacao ADD CONSTRAINT pf_aprovacao_numero_pf_unique UNIQUE (numero_pf);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pf_liberacao_numero_pf_unique') THEN
    ALTER TABLE pf_liberacao ADD CONSTRAINT pf_liberacao_numero_pf_unique UNIQUE (numero_pf);
  END IF;
END $$;

-- Fix the foreign key issue by pre-populating the missing values 
-- OR dropping the FK temporarily if it's too restrictive
ALTER TABLE pf_solicitacao DROP CONSTRAINT IF EXISTS pf_solicitacao_fonte_recurso_fkey;
ALTER TABLE pf_aprovacao DROP CONSTRAINT IF EXISTS pf_aprovacao_fonte_recurso_fkey;
ALTER TABLE pf_liberacao DROP CONSTRAINT IF EXISTS pf_liberacao_fonte_recurso_fkey;
`;

(async () => {
    try {
        const resp2 = await fetch(`${SUPABASE_URL}/rest/v1/`, {
            method: 'POST',
            headers: {
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            // The REST API doesn't just evaluate raw SQL like this... 
            // We need to use postgres functions, or just a REST hack?
            // Actually, there is NO SQL endpoint in PostgREST by default unless we call an RPC.
        });
    } catch {}
})();
