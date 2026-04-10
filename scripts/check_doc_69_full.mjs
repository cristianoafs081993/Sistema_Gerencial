import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function checkDoc69Full() {
    const envPath = '.env';
    const envContent = fs.readFileSync(envPath, 'utf8');
    const urlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*(.*)/);
    const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY\s*=\s*(.*)/);
    const supabaseUrl = urlMatch ? urlMatch[1].trim().replace(/['"]/g, '') : '';
    const supabaseKey = keyMatch ? keyMatch[1].trim().replace(/['"]/g, '') : '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const docId = '2026NP000069';
    const { data: doc } = await supabase
        .from('documentos_habeis')
        .select('*, itens(*), situacoes(*)')
        .eq('id', docId)
        .single();

    if (doc) {
        console.log(`ID: ${doc.id}`);
        console.log(`Estado: ${doc.estado}`);
        console.log(`Valor Original: ${doc.valor_original}`);
        console.log('Itens tipos:', doc.itens.map(i => i.doc_tipo));
        console.log('Situacoes:', doc.situacoes.map(s => `${s.situacao_codigo} (${s.valor})`));
    } else {
        console.log('Doc not found');
    }
}

checkDoc69Full();
