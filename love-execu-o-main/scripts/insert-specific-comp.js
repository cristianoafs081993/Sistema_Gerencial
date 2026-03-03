
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI3OTg2MiwiZXhwIjoyMDg1ODU1ODYyfQ.lylmodjOxHBtiIb81tKna3kVTebyOqE-1mxhzD0smT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertSpecificComponent() {
    console.log('Buscando dimensão Extensão...');
    const { data: dim, error: errDim } = await supabase
        .from('dimensoes')
        .select('id')
        .eq('codigo', 'EX')
        .single();

    if (errDim || !dim) {
        console.error('Erro ao encontrar dimensão EX:', errDim);
        return;
    }

    console.log('Inserindo componente específico...');
    const { error: errIns } = await supabase
        .from('componentes_funcionais')
        .upsert({
            dimensao_id: dim.id,
            nome: '11 - Gestão de Programas e Projetos de Extensão'
        }, { onConflict: 'dimensao_id, nome' });

    if (errIns) {
        console.error('Erro ao inserir componente:', errIns);
    } else {
        console.log('Sucesso! Componente "11 - Gestão de Programas e Projetos de Extensão" inserido na dimensão Extensão.');
    }
}

insertSpecificComponent();
