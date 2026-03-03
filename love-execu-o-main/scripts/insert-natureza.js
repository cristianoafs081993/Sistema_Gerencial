
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI3OTg2MiwiZXhwIjoyMDg1ODU1ODYyfQ.lylmodjOxHBtiIb81tKna3kVTebyOqE-1mxhzD0smT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertNatureza() {
    console.log('Inserindo natureza de despesa...');
    const { error } = await supabase
        .from('naturezas_despesa')
        .upsert({
            codigo: '339020',
            nome: 'Auxílio Financeiro a Pesquisadores'
        }, { onConflict: 'codigo' });

    if (error) {
        console.error('Erro ao inserir natureza:', error);
    } else {
        console.log('Sucesso! Natureza "339020 - Auxílio Financeiro a Pesquisadores" adicionada.');
    }
}

insertNatureza();
