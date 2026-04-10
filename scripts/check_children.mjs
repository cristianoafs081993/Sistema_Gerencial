import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function checkChildren() {
    // Load .env manually
    const envPath = '.env';
    const envContent = fs.readFileSync(envPath, 'utf8');
    const urlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*(.*)/);
    const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY\s*=\s*(.*)/);
    const supabaseUrl = urlMatch ? urlMatch[1].trim().replace(/['"]/g, '') : '';
    const supabaseKey = keyMatch ? keyMatch[1].trim().replace(/['"]/g, '') : '';

    const supabase = createClient(supabaseUrl, supabaseKey);

    const toDelete = JSON.parse(fs.readFileSync('scripts/docs_to_delete.json', 'utf8'));

    console.log(`Checking children for ${toDelete.length} docs...`);

    const { data: itemsCount } = await supabase
        .from('documentos_habeis_itens')
        .select('documento_habil_id')
        .in('documento_habil_id', toDelete);

    const { data: sitCount } = await supabase
        .from('documentos_habeis_situacoes')
        .select('documento_habil_id')
        .in('documento_habil_id', toDelete);

    console.log(`Found ${itemsCount?.length || 0} items linked to these docs.`);
    console.log(`Found ${sitCount?.length || 0} situacoes linked to these docs.`);
}

checkChildren();
