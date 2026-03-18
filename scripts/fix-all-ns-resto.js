
import { createClient } from '@supabase/supabase-js';
import https from 'https';

const supabaseUrl = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI3OTg2MiwiZXhwIjoyMDg1ODU1ODYyfQ.lylmodjOxHBtiIb81tKna3kVTebyOqE-1mxhzD0smT0';
const API_KEY = '931d4d57337bef94e775337c318342e9';
const HOST = 'api.portaldatransparencia.gov.br';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchAllImpactos(codigoDocumento, fase) {
    return new Promise((resolve) => {
        const path = `/api-de-dados/despesas/empenhos-impactados?codigoDocumento=${codigoDocumento}&fase=${fase}&pagina=1`;
        https.get({
            hostname: HOST,
            path: path,
            headers: { 'chave-api-dados': API_KEY, 'accept': '*/*' }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { resolve([]); }
            });
        }).on('error', () => resolve([]));
    });
}

function parseCurrency(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
}

async function fixAllZeradas() {
    console.log('Iniciando varredura completa de liquidações zeradas...');

    const { data: docs } = await supabase
        .from('transparencia_documentos')
        .select('id, documento, fase')
        .eq('fase', 'Liquidação')
        .eq('valor', 0);

    console.log(`Encontradas ${docs.length} liquidações com valor 0.`);

    for (const doc of docs) {
        const impactos = await fetchAllImpactos(doc.documento, 2);
        
        if (impactos && impactos.length > 0) {
            // Somar todos os campos possíveis de valor que a API pode retornar
            let totalEncontrado = 0;
            let maxLiq = 0;
            let maxResto = 0;

            impactos.forEach(item => {
                const vLiq = parseCurrency(item.valorLiquidado);
                const vResto = parseCurrency(item.valorRestoPago);
                maxLiq += vLiq;
                maxResto += vResto;
            });

            totalEncontrado = maxLiq > 0 ? maxLiq : maxResto;

            if (totalEncontrado > 0) {
                console.log(`Atualizando ${doc.documento}: R$ ${totalEncontrado} (Campo Resto: ${maxResto})`);
                await supabase
                    .from('transparencia_documentos')
                    .update({ 
                        valor: totalEncontrado,
                        valorLiquidado: maxLiq,
                        valorRestoPago: maxResto,
                        empenho_documento: impactos[0].empenhoResumido
                    })
                    .eq('id', doc.id);
            }
        }
        // Delay para evitar bloqueio da API
        await new Promise(r => setTimeout(r, 100));
    }

    console.log('Varredura e correção concluídas!');
}

fixAllZeradas();
