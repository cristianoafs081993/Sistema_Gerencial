import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI3OTg2MiwiZXhwIjoyMDg1ODU1ODYyfQ.lylmodjOxHBtiIb81tKna3kVTebyOqE-1mxhzD0smT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixFromOBs() {
    console.log('=== Correção de NS Zeradas via OBs ===\n');

    // 1. Buscar todas as NS zeradas
    const { data: zeroNS } = await supabase
        .from('transparencia_documentos')
        .select('id, documento_resumido, empenho_documento, favorecido_nome, data_emissao')
        .eq('fase', 'Liquidação')
        .eq('valor', 0);

    console.log(`Total NS zeradas: ${zeroNS.length}\n`);

    let corrigidas = 0;
    let semOB = 0;
    const empenhosAfetados = new Set();

    for (const ns of zeroNS) {
        // Quantas NS zeradas compartilham este empenho?
        const nsIrmas = zeroNS.filter(n => n.empenho_documento === ns.empenho_documento);

        // Buscar OBs do mesmo empenho com valor > 0
        const { data: obs } = await supabase
            .from('transparencia_documentos')
            .select('documento_resumido, valor, favorecido_nome, data_emissao')
            .eq('empenho_documento', ns.empenho_documento)
            .eq('fase', 'Pagamento')
            .gt('valor', 0)
            .order('data_emissao', { ascending: true });

        if (!obs || obs.length === 0) {
            semOB++;
            console.log(`${ns.documento_resumido}: SEM OB (empenho ${ns.empenho_documento}) - sem pagamento ainda`);
            continue;
        }

        let valorInferido = 0;

        if (nsIrmas.length === 1) {
            // CASO SIMPLES: Uma NS por empenho -> soma todos os OBs
            valorInferido = obs.reduce((sum, ob) => sum + Number(ob.valor), 0);
            console.log(`${ns.documento_resumido}: SIMPLES -> R$ ${valorInferido} (${obs.length} OBs)`);
        } else {
            // CASO MÚLTIPLO: Várias NS para mesmo empenho
            // Estratégia: OBs com data >= data da NS e < data da próxima NS
            const nsOrdenadas = [...nsIrmas].sort((a, b) =>
                new Date(a.data_emissao).getTime() - new Date(b.data_emissao).getTime()
            );

            const nsIndex = nsOrdenadas.findIndex(n => n.id === ns.id);
            const nsDataInicio = new Date(ns.data_emissao);
            const nsDataFim = nsIndex < nsOrdenadas.length - 1
                ? new Date(nsOrdenadas[nsIndex + 1].data_emissao)
                : new Date('2099-12-31');

            const obsNoPeriodo = obs.filter(ob => {
                const obDate = new Date(ob.data_emissao);
                return obDate >= nsDataInicio && obDate < nsDataFim;
            });

            if (obsNoPeriodo.length > 0) {
                valorInferido = obsNoPeriodo.reduce((sum, ob) => sum + Number(ob.valor), 0);
                console.log(`${ns.documento_resumido}: MÚLTIPLO idx${nsIndex} -> R$ ${valorInferido} (${obsNoPeriodo.length} OBs)`);
            } else {
                // Fallback: dividir igualmente
                const totalOBs = obs.reduce((sum, ob) => sum + Number(ob.valor), 0);
                valorInferido = totalOBs / nsIrmas.length;
                console.log(`${ns.documento_resumido}: DIVIDIDO -> R$ ${valorInferido} (${totalOBs}/${nsIrmas.length})`);
            }
        }

        if (valorInferido > 0) {
            const { error } = await supabase
                .from('transparencia_documentos')
                .update({
                    valor: valorInferido,
                    valorLiquidado: valorInferido,
                    updated_at: new Date()
                })
                .eq('id', ns.id);

            if (!error) {
                corrigidas++;
                empenhosAfetados.add(ns.empenho_documento);
            } else {
                console.log(`  ERRO: ${error.message}`);
            }
        }
    }

    // Recalcular saldos dos empenhos
    if (empenhosAfetados.size > 0) {
        console.log(`\n=== Recalculando ${empenhosAfetados.size} empenhos ===`);
        for (const numEmpenho of empenhosAfetados) {
            const { data: allDocs } = await supabase
                .from('transparencia_documentos')
                .select('valor, valorLiquidado, valorRestoPago, fase')
                .eq('empenho_documento', numEmpenho);

            if (!allDocs) continue;

            const totalLiquidado = allDocs
                .filter(d => d.fase === 'Liquidação')
                .reduce((sum, item) => sum + (Number(item.valorLiquidado) || Number(item.valor) || 0), 0);

            const { data: emp } = await supabase.from('empenhos').select('id, valor').eq('numero', numEmpenho).single();

            if (emp) {
                let status = 'pendente';
                if (totalLiquidado > 0) status = 'liquidado';

                await supabase.from('empenhos').update({
                    valor_liquidado: totalLiquidado,
                    status: status
                }).eq('id', emp.id);
                console.log(`  ${numEmpenho}: Liq=R$ ${totalLiquidado}, Status=${status}`);
            }
        }
    }

    console.log(`\n=== RESULTADO ===`);
    console.log(`Corrigidas: ${corrigidas}`);
    console.log(`Sem OB (pendente): ${semOB}`);
    console.log(`Total: ${zeroNS.length}`);
}

fixFromOBs();
