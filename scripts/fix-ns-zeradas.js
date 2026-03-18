
import { createClient } from '@supabase/supabase-js';
import https from 'https';

const supabaseUrl = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI3OTg2MiwiZXhwIjoyMDg1ODU1ODYyfQ.lylmodjOxHBtiIb81tKna3kVTebyOqE-1mxhzD0smT0';
const API_KEY = '931d4d57337bef94e775337c318342e9';
const HOST = 'api.portaldatransparencia.gov.br';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchPagamentosImpactados(codigoOB) {
    return new Promise((resolve) => {
        const path = `/api-de-dados/despesas/documentos/notas-fiscais?codigoDocumento=${codigoOB}&pagina=1`;
        const options = {
            hostname: HOST,
            path: path,
            method: 'GET',
            headers: { 'chave-api-dados': API_KEY, 'accept': '*/*' }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(data);
                        resolve(json);
                    } catch (e) { resolve([]); }
                } else { resolve([]); }
            });
        });
        req.on('error', () => resolve([]));
        req.end();
    });
}

function parseCurrency(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
}

async function fixLiquidações() {
    console.log('Iniciando transferência de valores de OB para NS (Restos a Pagar)...');

    // 1. Buscar todas as OBs recentes
    const { data: obs } = await supabase
        .from('transparencia_documentos')
        .select('documento, valor')
        .eq('fase', 'Pagamento')
        .gte('data_emissao', '2026-02-01');

    console.log(`Analisando ${obs.length} documentos de pagamento...`);

    for (const ob of obs) {
        // Buscar quais documentos esta OB pagou (geralmente NS)
        // O Portal não tem um endpoint direto "OB -> NS", mas as NS costumam estar na observação
        // ou podemos tentar inferir pelo empenho.
        // A melhor forma é usar o endpoint de documentos relacionados se houvesse, 
        // mas vamos usar a lógica de que se a NS está zerada e é o mesmo empenho/favorecido da OB,
        // o valor da OB pertence àquela liquidação.
        
        // Vamos focar nas OBs que sabemos que pagaram as NS zeradas
        // Ex: 2026OB000166 pagou várias coisas de 2025.
        
        const pathImpacto = `/api-de-dados/despesas/empenhos-impactados?codigoDocumento=${ob.documento}&fase=3&pagina=1`;
        const impacto = await new Promise(resolve => {
            https.get({
                hostname: HOST,
                path: pathImpacto,
                headers: { 'chave-api-dados': API_KEY }
            }, res => {
                let d = ''; res.on('data', c => d += c);
                res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve([]); } });
            });
        });

        if (impacto && impacto.length > 0) {
            for (const item of impacto) {
                const valorPago = parseCurrency(item.valorRestoPago || item.valorPago);
                if (valorPago > 0) {
                    // Tentar encontrar a liquidação (NS) correspondente a este empenho e favorecido
                    // que esteja zerada e seja próxima da data da OB
                    const { data: nsParaCorrigir } = await supabase
                        .from('transparencia_documentos')
                        .select('id, documento')
                        .eq('fase', 'Liquidação')
                        .eq('empenho_documento', item.empenhoResumido)
                        .eq('valor', 0)
                        .limit(1);

                    if (nsParaCorrigir && nsParaCorrigir.length > 0) {
                        console.log(`Corrigindo ${nsParaCorrigir[0].documento}: R$ ${valorPago} (via ${ob.documento})`);
                        await supabase
                            .from('transparencia_documentos')
                            .update({ valor: valorPago, valorLiquidado: valorPago })
                            .eq('id', nsParaCorrigir[0].id);
                    }
                }
            }
        }
    }

    console.log('Correção finalizada!');
}

fixLiquidações();
