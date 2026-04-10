import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function compareData() {
    const envPath = '.env';
    const envContent = fs.readFileSync(envPath, 'utf8');
    const urlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*(.*)/);
    const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY\s*=\s*(.*)/);
    const supabaseUrl = urlMatch ? urlMatch[1].trim().replace(/['"]/g, '') : '';
    const supabaseKey = keyMatch ? keyMatch[1].trim().replace(/['"]/g, '') : '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const oldId = '158366264352026RP000037';
    const newId = '2026RP000037';

    console.log(`--- Comparing ${oldId} vs ${newId} ---`);

    const { data: oldSit } = await supabase.from('documentos_habeis_situacoes').select('*').eq('documento_habil_id', oldId);
    const { data: newSit } = await supabase.from('documentos_habeis_situacoes').select('*').eq('documento_habil_id', newId);

    console.log(`Old ID has ${oldSit?.length || 0} situacoes.`);
    console.log(`New ID has ${newSit?.length || 0} situacoes.`);

    if (newSit?.length >= oldSit?.length) {
        console.log('New ID seems to have equal or more data. Safe to delete old ID.');
    } else {
        console.log('WARNING: Old ID has more data than new ID!');
    }
}

compareData();
