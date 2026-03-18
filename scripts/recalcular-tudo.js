
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI3OTg2MiwiZXhwIjoyMDg1ODU1ODYyfQ.lylmodjOxHBtiIb81tKna3kVTebyOqE-1mxhzD0smT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixBalances() {
    console.log('Recalculando saldos de todos os empenhos...');
    const { data: empenhos } = await supabase.from('empenhos').select('id, numero, valor');

    for (const emp of empenhos) {
        const { data: docs } = await supabase
            .from('transparencia_documentos')
            .select('valor, valorLiquidado, valorRestoPago, fase')
            .eq('empenho_documento', emp.numero);

        if (!docs || docs.length === 0) continue;

        const totalLiquidado = docs
            .filter(d => d.fase === 'Liquidação')
            .reduce((sum, item) => sum + (item.valorLiquidado || item.valor || 0), 0);
        
        const totalPago = docs
            .filter(d => d.fase === 'Pagamento')
            .reduce((sum, item) => sum + (item.valorRestoPago || item.valor || 0), 0);

        let status = 'pendente';
        if (totalLiquidado > 0) status = 'liquidado';
        if (totalPago >= emp.valor && emp.valor > 0) status = 'pago';

        await supabase
            .from('empenhos')
            .update({
                valor_liquidado: totalLiquidado,
                status: status
            })
            .eq('id', emp.id);
            
        console.log(`Empenho ${emp.numero}: Liq=${totalLiquidado}, Status=${status}`);
    }
    console.log('Saldos atualizados!');
}

fixBalances();
