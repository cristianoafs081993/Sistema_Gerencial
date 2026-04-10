
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAtividades() {
    const { data, count, error } = await supabase.from('atividades').select('*', { count: 'exact' }).limit(5);
    if (error) {
        console.error('Erro:', error.message);
        return;
    }
    console.log(`Total de registros em atividades: ${count}`);
    console.log('Primeiros 5 registros:', JSON.stringify(data, null, 2));
}

checkAtividades();
