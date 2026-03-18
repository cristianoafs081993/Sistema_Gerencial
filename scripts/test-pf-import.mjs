import fs from 'fs';
import path from 'path';
import { supabase } from './src/lib/supabase.ts'; // wait, need to properly load with vite or just ts-node

// Let's create a standalone script
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabaseUrl = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzk4NjIsImV4cCI6MjA4NTg1NTg2Mn0.g9h5nF0l8yKG-yjQRI8i_mq084IzKTrH64F2FpreVIg';
const supabaseClient = createClient(supabaseUrl, supabaseKey);

// Just re-implement parsing minimally to test insertion
export function parseNumeroPF(numero) {
    return String(numero).trim();
}

export function cleanValor(v) {
    if (v === null || v === undefined || v === '') return 0.0;
    const str = String(v).replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
    const num = parseFloat(str);
    return isNaN(num) ? 0.0 : num;
}

export function safeFormatDate(val) {
    if (!val) return '';
    if (val instanceof Date) {
        return val.toISOString().split('T')[0];
    }
    const str = String(val);
    if (str.includes('/')) {
        const parts = str.split(' ')[0].split('/');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }
    return str.substring(0, 10);
}

async function test() {
    console.log('Testing pf_fonte_recurso insert...');
    let { error: err1 } = await supabaseClient
      .from('pf_fonte_recurso')
      .upsert({ codigo: '1000000000', nome: 'Teste Fonte' }, { onConflict: 'codigo' });
    console.log('Upsert pf_fonte_recurso result:', err1);

    if (err1 && err1.code === '409') {
        console.log('Trying plain insert...');
        let { error: err2 } = await supabaseClient.from('pf_fonte_recurso').insert({ codigo: '1000000000', nome: 'Teste Fonte' });
        console.log('Insert pf_fonte_recurso result:', err2);
    }

    console.log('Testing pf_solicitacao upsert...');
    let solData = {
      numero_pf: '12345678901234PF000000',
      ug_emitente: '123456',
      ug_favorecida: '12345678000199',
      evento: '591292',
      acao: '1',
      fonte_recurso: '1000000000',
      vinculacao: '400',
      modalidade: '1',
      mes_referencia: 'Março',
      data_emissao: '2026-03-18',
      valor: 100.5,
      finalidade: 'Teste',
    };

    let { data: solRes, error: solErr } = await supabaseClient
      .from('pf_solicitacao')
      .upsert(solData, { onConflict: 'numero_pf' })
      .select('id')
      .single();

    console.log('Upsert pf_solicitacao result:', solErr || solRes);
}

test();
