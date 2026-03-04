import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    const { data, error } = await supabase.from('empenhos').insert({
        numero: '2026NE999999',
        descricao: 'Teste',
        valor: 100,
        dimensao: '',
        componente_funcional: '',
        origem_recurso: '',
        natureza_despesa: '',
        plano_interno: null,
        favorecido_nome: null,
        favorecido_documento: null,
        processo: null,
        data_empenho: '2026-01-01',
        status: 'pendente',
        tipo: 'exercicio',
        valor_liquidado: 0,
        valor_pago: 0,
        valor_liquidado_a_pagar: 0,
        valor_liquidado_oficial: 0,
        valor_pago_oficial: 0,
        ultima_atualizacao_siafi: new Date().toISOString()
    });
    console.log('Error inserting:', error);
}

run();
