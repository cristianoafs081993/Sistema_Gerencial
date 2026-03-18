
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI3OTg2MiwiZXhwIjoyMDg1ODU1ODYyfQ.lylmodjOxHBtiIb81tKna3kVTebyOqE-1mxhzD0smT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findTable() {
    const variants = [
        'componentes_funcionais',
        'componnentes_funcionais',
        'componentes_funcional',
        'componente_funcional'
    ];
    
    for (const v of variants) {
        const { error } = await supabase.from(v).select('id').limit(1);
        if (!error) {
            console.log(`ACHEI! O nome da tabela no banco é: ${v}`);
            return;
        } else {
            console.log(`Tentativa ${v}: ${error.message}`);
        }
    }
    console.log('Nenhuma variante encontrada.');
}

findTable();
