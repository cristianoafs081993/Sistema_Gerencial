import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzk4NjIsImV4cCI6MjA4NTg1NTg2Mn0.g9h5nF0l8yKG-yjQRI8i_mq084IzKTrH64F2FpreVIg';
const supabaseClient = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log('Testing pf_fonte_recurso upsert with descricao...');
    let { error: err1 } = await supabaseClient
      .from('pf_fonte_recurso')
      .upsert({ codigo: '1000000000', descricao: 'Fonte 1000000000' }, { onConflict: 'codigo' });
    console.log('Upsert result:', err1);

    if (err1 && (err1.code === '42P10' || err1.code === '409' || String(err1.code).startsWith('PGRST'))) {
      console.log('Trying plain insert...');
      let { error: err2 } = await supabaseClient.from('pf_fonte_recurso').insert({ codigo: '1000000000', descricao: 'Fonte 1000000000' });
      console.log('Insert result:', err2);
    }
}

test();
