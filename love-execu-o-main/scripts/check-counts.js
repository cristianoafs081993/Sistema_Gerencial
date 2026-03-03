
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI3OTg2MiwiZXhwIjoyMDg1ODU1ODYyfQ.lylmodjOxHBtiIb81tKna3kVTebyOqE-1mxhzD0smT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkComponentCounts() {
    console.log('Verificando componentes funcionais por dimensão...');
    
    const { data: dims, error: errDims } = await supabase.from('dimensoes').select('id, codigo, nome');
    if (errDims) {
        console.error('Erro ao buscar dimensões:', errDims);
        return;
    }

    for (const dim of dims) {
        const { count, error: errComp } = await supabase
            .from('componentes_funcionais')
            .select('*', { count: 'exact', head: true })
            .eq('dimensao_id', dim.id);
            
        if (errComp) {
            console.error(`Erro ao contar componentes para ${dim.codigo}:`, errComp);
        } else {
            console.log(`${dim.nome.padEnd(60)}: ${count} componentes`);
        }
    }
}

checkComponentCounts();
