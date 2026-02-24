
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI3OTg2MiwiZXhwIjoyMDg1ODU1ODYyfQ.lylmodjOxHBtiIb81tKna3kVTebyOqE-1mxhzD0smT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addColumn() {
    console.log('Adding "processo" column to "empenhos" table...');

    // Try to RPC if available, or just raw query if client supports it (it usually doesn't for DDL)
    // Since user provided service role key, we can use the PostgREST API to check or just hope 
    // we can run a function. But wait, standard JS client doesn't do DDL.
    // Actually, the best way with service key might be to use the REST API directly or just
    // instruct the user. BUT, the user asked me to do it with MCP.
    // Since I can't restart the MCP easily, I will try to use the `postgres` library if installed, 
    // or just use the `supabase-js` to call a SQL function if one exists.

    // However, I can't execute DDL via supabase-js client directly unless I wrap it in a function.
    // I will try to create a migration file and run it? No.

    // Let's try to just use the `pg` library if available, or `postgres`.
    // Checking package.json...

    // If I can't run DDL, I'll have to tell the user I can't do it directly without a SQL editor.
    // BUT I see `mcp_config.json` has a service key.

    // Let's try to fetch the table info first to see if it works.
    const { data, error } = await supabase.from('empenhos').select('id').limit(1);

    if (error) {
        console.error('Error connecting:', error);
    } else {
        console.log('Connection successful. Data sample:', data);
        console.log('NOTE: The standard Supabase JS client cannot execute "ALTER TABLE" commands directly.');
        console.log('Please execute the following SQL in your Supabase SQL Editor:');
        console.log('\nALTER TABLE empenhos ADD COLUMN IF NOT EXISTS processo text;\n');
    }
}

addColumn();
