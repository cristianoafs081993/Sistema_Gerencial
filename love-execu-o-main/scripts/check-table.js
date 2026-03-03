
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI3OTg2MiwiZXhwIjoyMDg1ODU1ODYyfQ.lylmodjOxHBtiIb81tKna3kVTebyOqE-1mxhzD0smT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    const tables = ['dimensoes', 'componentes_funcionais', 'naturezas_despesa', 'origens_recurso'];
    
    for (const table of tables) {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`Tabela ${table}: AUSENTE (${error.message})`);
        } else {
            console.log(`Tabela ${table}: PRESENTE`);
        }
    }
}

checkTables();
