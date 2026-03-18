const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Parse .env manually to avoid dotenv dependency issues
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            let key = match[1];
            let value = match[2] || '';
            value = value.replace(/(^['"]|['"]$)/g, '');
            process.env[key] = value;
        }
    });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const API_KEY = '931d4d57337bef94e775337c318342e9';
const API_HISTORICO = 'https://api.portaldatransparencia.gov.br/api-de-dados/despesas/itens-de-empenho/historico';
const UG = '158366';
const GESTAO = '26435';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseCurrency = (valueStr) => {
    if (!valueStr) return 0;
    let cleanStr = String(valueStr).replace(/[^\d,-]/g, '').trim();
    cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
    return Number(cleanStr);
};

async function fetchHistoricoEmpenho(codigoDocumento) {
    const allItems = [];
    try {
        for (let seq = 1; seq <= 10; seq++) {
            await delay(300);
            const url = `${API_HISTORICO}?codigoDocumento=${codigoDocumento}&sequencial=${seq}&pagina=1`;
            const response = await fetch(url, {
                headers: {
                    accept: '*/*',
                    'chave-api-dados': API_KEY,
                },
            });

            if (!response.ok) {
                console.warn(`[Historico] Erro seq ${seq} para ${codigoDocumento}: ${response.status}`);
                break;
            }

            let data;
            try {
                const text = await response.text();
                if (!text || text.trim() === '' || text.trim() === '[]') break;
                data = JSON.parse(text);
            } catch {
                break;
            }

            if (!Array.isArray(data) || data.length === 0) break;

            for (const item of data) {
                allItems.push({
                    data: item.data,
                    operacao: item.operacao,
                    quantidade: parseCurrency(item.quantidade),
                    valorUnitario: parseCurrency(item.valorUnitario),
                    valorTotal: parseCurrency(item.valorTotal),
                });
            }
        }
    } catch (error) {
        console.error(`[Historico] Erro ao buscar histórico de ${codigoDocumento}:`, error);
    }
    return allItems;
}

function calcularValorReal(historico) {
    let valor = 0;
    for (const op of historico) {
        if (op.operacao === 'INCLUSAO' || op.operacao === 'REFORCO') {
            valor += op.valorTotal;
        } else if (op.operacao === 'ANULACAO') {
            valor -= op.valorTotal;
        }
    }
    return Math.max(valor, 0);
}

async function backfill() {
    console.log('Fetching all empenhos...');
    const { data: empenhos, error } = await supabase.from('empenhos').select('id, numero, valor');

    if (error) {
        console.error('Error fetching empenhos:', error);
        process.exit(1);
    }

    console.log(`Found ${empenhos.length} empenhos to process.`);

    let updatedCount = 0;

    for (const empenho of empenhos) {
        const isNE = empenho.numero.includes('NE');
        if (!isNE) {
            console.log(`[Skip] ${empenho.numero} não parece ser um NE.`);
            continue;
        }

        const { numero, id, valor: valorBase } = empenho;
        let codigoDocumento = numero;
        if (!numero.startsWith(UG)) {
            codigoDocumento = `${UG}${GESTAO}${numero}`;
        }

        console.log(`Processing [${numero}] as ${codigoDocumento}...`);

        const historico = await fetchHistoricoEmpenho(codigoDocumento);

        if (historico.length > 0) {
            const valorCalculado = calcularValorReal(historico);
            console.log(`[Update] ${numero} Real Value: ${valorCalculado} (was ${valorBase}). History ops: ${historico.length}`);

            const { error: updateErr } = await supabase
                .from('empenhos')
                .update({
                    valor: valorCalculado,
                    historico_operacoes: historico
                })
                .eq('id', id);

            if (updateErr) {
                console.error(`Failed to update ${numero}:`, updateErr);
            } else {
                updatedCount++;
            }
        } else {
            console.log(`[Unchanged] ${numero} had no history data.`);
        }

        await delay(300); // polite delay
    }

    console.log(`Backfill complete. Updated ${updatedCount} empenhos.`);
    process.exit(0);
}

backfill();
