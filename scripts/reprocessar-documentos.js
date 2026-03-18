
import { createClient } from '@supabase/supabase-js';
import https from 'https';

const supabaseUrl = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI3OTg2MiwiZXhwIjoyMDg1ODU1ODYyfQ.lylmodjOxHBtiIb81tKna3kVTebyOqE-1mxhzD0smT0';
const API_KEY = '931d4d57337bef94e775337c318342e9';
const HOST = 'api.portaldatransparencia.gov.br';

const supabase = createClient(supabaseUrl, supabaseKey);

function httpsGet(path) {
    return new Promise((resolve) => {
        https.get({
            hostname: HOST,
            path: path,
            headers: { 'chave-api-dados': API_KEY, 'accept': '*/*' }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
                } else { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

function parseCurrency(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    const cleaned = value.replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.').trim();
    return parseFloat(cleaned) || 0;
}

async function runBackfill() {
    console.log('Iniciando reprocessamento de documentos com valor zerado...');

    // Buscar TODOS os documentos com valor 0 (sem filtro de data)
    const { data: docs, error } = await supabase
        .from('transparencia_documentos')
        .select('*')
        .eq('valor', 0);

    if (error) {
        console.error('Erro ao buscar documentos:', error);
        return;
    }

    console.log(`Encontrados ${docs.length} documentos para atualizar.`);

    const empenhosAfetados = new Set();
    let corrigidos = 0;
    let semValor = 0;

    for (const doc of docs) {
        process.stdout.write(`Processando ${doc.documento_resumido || doc.documento}... `);

        // Delay para evitar rate limit
        await new Promise(r => setTimeout(r, 150));

        // Tentativa 1: empenhos-impactados
        const fase = doc.fase === 'Liquidação' ? 2 : 3;
        const impacto = await httpsGet(`/api-de-dados/despesas/empenhos-impactados?codigoDocumento=${doc.documento}&fase=${fase}&pagina=1`);

        let valorReal = 0;
        let vLiq = 0;
        let vPag = 0;
        let empenhoDoc = doc.empenho_documento;

        if (impacto && Array.isArray(impacto) && impacto.length > 0) {
            vLiq = impacto.reduce((sum, item) => sum + parseCurrency(item.valorLiquidado), 0);
            vPag = impacto.reduce((sum, item) => sum + parseCurrency(item.valorRestoPago), 0);
            valorReal = vLiq > 0 ? vLiq : vPag;
            if (!empenhoDoc && impacto[0].empenhoResumido) {
                empenhoDoc = impacto[0].empenhoResumido;
            }
        }

        // Tentativa 2: Detalhe individual do documento (resolve Restos a Pagar)
        if (valorReal === 0) {
            await new Promise(r => setTimeout(r, 150));
            const detalhe = await httpsGet(`/api-de-dados/despesas/documentos/${doc.documento}`);
            if (detalhe && detalhe.valor) {
                const detailVal = parseCurrency(detalhe.valor);
                if (detailVal > 0) {
                    valorReal = detailVal;
                    console.log(`(via detalhe) `);
                }
            }
        }

        if (valorReal > 0) {
            const { error: updateErr } = await supabase
                .from('transparencia_documentos')
                .update({
                    valor: valorReal,
                    valorLiquidado: vLiq > 0 ? vLiq : valorReal,
                    valorRestoPago: vPag,
                    empenho_documento: empenhoDoc
                })
                .eq('id', doc.id);

            if (!updateErr) {
                console.log(`SUCESSO: R$ ${valorReal}`);
                corrigidos++;
                if (empenhoDoc) empenhosAfetados.add(empenhoDoc);
            } else {
                console.log('ERRO UPDATE:', updateErr.message);
            }
        } else {
            semValor++;
            console.log('VALOR CONTINUA 0 (nenhum endpoint retornou valor)');
        }
    }

    // Recalcular saldos dos empenhos afetados
    if (empenhosAfetados.size > 0) {
        console.log(`\nRecalculando saldos de ${empenhosAfetados.size} empenhos afetados...`);
        for (const numEmpenho of empenhosAfetados) {
            const { data: allDocs } = await supabase
                .from('transparencia_documentos')
                .select('valor, valorLiquidado, valorRestoPago, fase')
                .eq('empenho_documento', numEmpenho);

            if (!allDocs) continue;

            const totalLiquidado = allDocs
                .filter(d => d.fase === 'Liquidação')
                .reduce((sum, item) => sum + (Number(item.valorLiquidado) || Number(item.valor) || 0), 0);

            const totalPago = allDocs
                .filter(d => d.fase === 'Pagamento')
                .reduce((sum, item) => sum + (Number(item.valorRestoPago) || Number(item.valor) || 0), 0);

            const { data: emp } = await supabase.from('empenhos').select('id, valor').eq('numero', numEmpenho).single();

            if (emp) {
                let status = 'pendente';
                if (totalLiquidado > 0) status = 'liquidado';
                if (totalPago >= emp.valor && emp.valor > 0) status = 'pago';

                await supabase.from('empenhos').update({
                    valor_liquidado: totalLiquidado,
                    status: status
                }).eq('id', emp.id);
                console.log(`  Empenho ${numEmpenho}: Liq=${totalLiquidado}, Status=${status}`);
            }
        }
    }

    console.log(`\nProcesso concluído! Corrigidos: ${corrigidos}, Sem valor: ${semValor}`);
}

runBackfill();
