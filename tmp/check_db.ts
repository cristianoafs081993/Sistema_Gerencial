import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  console.log('--- Verificando documentos_habeis ---');
  const { data: docs, error: errDocs } = await supabase
    .from('documentos_habeis')
    .select('id, fonte_sof, processo, estado, valor_original')
    .limit(3);
  
  if (errDocs) console.error(errDocs);
  else console.log('Docs:', JSON.stringify(docs, null, 2));

  console.log('--- Verificando documentos_habeis_itens (OBs) ---');
  const { data: itens, error: errItens } = await supabase
    .from('documentos_habeis_itens')
    .select('*')
    .limit(3);
  
  if (errItens) console.error(errItens);
  else console.log('Itens:', JSON.stringify(itens, null, 2));

  console.log('--- Verificando documentos_habeis_situacoes ---');
  const { data: sits, error: errSits } = await supabase
    .from('documentos_habeis_situacoes')
    .select('*')
    .limit(3);
  
  if (errSits) console.error(errSits);
  else console.log('Sits:', JSON.stringify(sits, null, 2));
}

checkData();
