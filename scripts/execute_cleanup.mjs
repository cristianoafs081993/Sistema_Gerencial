import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function executeCleanup() {
    const envPath = '.env';
    const envContent = fs.readFileSync(envPath, 'utf8');
    const urlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*(.*)/);
    const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY\s*=\s*(.*)/);
    const supabaseUrl = urlMatch ? urlMatch[1].trim().replace(/['"]/g, '') : '';
    const supabaseKey = keyMatch ? keyMatch[1].trim().replace(/['"]/g, '') : '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const toDelete = JSON.parse(fs.readFileSync('scripts/docs_to_delete.json', 'utf8'));

    console.log(`Starting cleanup for ${toDelete.length} duplicate records...`);

    // 1. Delete situations
    const { error: sitError } = await supabase
        .from('documentos_habeis_situacoes')
        .delete()
        .in('documento_habil_id', toDelete);
    
    if (sitError) {
        console.error('Error deleting situations:', sitError);
        return;
    }
    console.log('✅ Situations deleted.');

    // 2. Delete parent records
    const { error: docError } = await supabase
        .from('documentos_habeis')
        .delete()
        .in('id', toDelete);

    if (docError) {
        console.error('Error deleting documents:', docError);
        return;
    }
    console.log('✅ Documentos Hábeis deleted.');

    console.log('--- Cleanup Complete ---');
}

executeCleanup();
