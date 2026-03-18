
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI3OTg2MiwiZXhwIjoyMDg1ODU1ODYyfQ.lylmodjOxHBtiIb81tKna3kVTebyOqE-1mxhzD0smT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDatabase() {
    console.log('Tentando criar a tabela componentes_funcionais...');
    
    // Como não posso rodar SQL arbitrário facilmente sem RPC, vou tentar usar o PostgREST para inserir 
    // mas se a tabela não existe, vai falhar.
    
    // A melhor forma de rodar esse SQL é via o Dashboard do Supabase, mas como sou Dara, 
    // vou tentar rodar um script que "emula" a migração via JS se possível, ou admitir que 
    // preciso que o SQL seja rodado.
    
    // Mas espere, eu posso tentar criar via RPC se houver uma função exec_sql (comum em alguns setups).
    // Se não, vou tentar verificar porque ela sumiu.
    
    const { error } = await supabase.from('componentes_funcionais').select('id').limit(1);
    if (error && error.message.includes('schema cache')) {
        console.log('Confirmado: Tabela não existe. Por favor, execute o SQL da migração 0006_domain_tables.sql no Dashboard do Supabase.');
        console.log('Especificamente a seção 1.2 e 4.');
    } else {
        console.log('A tabela parece existir agora ou o erro é outro:', error);
    }
}

fixDatabase();
