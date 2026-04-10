import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function checkDuplicates() {
    // Load .env manually
    const envPath = '.env';
    const envContent = fs.readFileSync(envPath, 'utf8');
    const urlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*(.*)/);
    const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY\s*=\s*(.*)/);
    
    const supabaseUrl = urlMatch ? urlMatch[1].trim().replace(/['"]/g, '') : '';
    const supabaseKey = keyMatch ? keyMatch[1].trim().replace(/['"]/g, '') : '';

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing env vars');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('--- Scanning for duplicates in documentos_habeis ---');
    const { data: docs, error } = await supabase
        .from('documentos_habeis')
        .select('id, fonte_sof');

    if (error) {
        console.error('Error fetching docs:', error);
        return;
    }

    const suffixMap = new Map();
    const toDelete = [];

    docs.forEach(doc => {
        // Normalization suffix (last 12 chars)
        const suffix = doc.id.length > 12 ? doc.id.slice(-12) : doc.id;
        if (!suffixMap.has(suffix)) {
            suffixMap.set(suffix, []);
        }
        suffixMap.get(suffix).push(doc);
    });

    let duplicatesCount = 0;
    for (const [suffix, records] of suffixMap.entries()) {
        if (records.length > 1) {
            // Check if at least one has a "valid" Fonte
            const hasFonte = records.some(r => r.fonte_sof && !['158366', '26435', '-'].includes(r.fonte_sof));
            const withoutFonte = records.filter(r => !r.fonte_sof || ['158366', '26435', '-'].includes(r.fonte_sof));

            if (hasFonte && withoutFonte.length > 0) {
                duplicatesCount++;
                console.log(`\nDuplicate Suffix: ${suffix}`);
                records.forEach(r => {
                    console.log(`  - [${r.id}] Fonte: ${r.fonte_sof || 'NULL'}`);
                });
                withoutFonte.forEach(r => toDelete.push(r.id));
            }
        }
    }

    console.log(`\nFound ${duplicatesCount} duplicated groups with repairable instances.`);
    console.log(`Total records to delete: ${toDelete.length}`);
    
    if (toDelete.length > 0) {
        fs.writeFileSync('scripts/docs_to_delete.json', JSON.stringify(toDelete, null, 2));
        console.log('IDs saved to scripts/docs_to_delete.json');
    }
}

checkDuplicates();
