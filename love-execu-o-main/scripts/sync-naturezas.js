
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI3OTg2MiwiZXhwIjoyMDg1ODU1ODYyfQ.lylmodjOxHBtiIb81tKna3kVTebyOqE-1mxhzD0smT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncNaturezas() {
    console.log('Iniciando sincronização de naturezas de despesa...');

    // 1. Buscar todas as naturezas de empenhos
    const { data: empenhos, error: e1 } = await supabase
        .from('empenhos')
        .select('natureza_despesa')
        .not('natureza_despesa', 'is', null)
        .neq('natureza_despesa', '');

    if (e1) console.error('Erro ao buscar empenhos:', e1);

    // 2. Buscar todas as naturezas de atividades
    const { data: atividades, error: e2 } = await supabase
        .from('atividades')
        .select('natureza_despesa')
        .not('natureza_despesa', 'is', null)
        .neq('natureza_despesa', '');

    if (e2) console.error('Erro ao buscar atividades:', e2);

    const allNatures = new Map();
    const mapNature = (n) => {
        if (!n || typeof n !== 'string') return null;
        const parts = n.split(' - ');
        const codigo = parts[0].trim();
        const nome = parts.length > 1 ? parts.slice(1).join(' - ').trim() : '';
        if (codigo) {
            return { codigo, nome };
        }
        return null;
    };

    if (empenhos) {
        empenhos.forEach(e => {
            const res = mapNature(e.natureza_despesa);
            if (res) allNatures.set(res.codigo, res);
        });
    }

    if (atividades) {
        atividades.forEach(a => {
            const res = mapNature(a.natureza_despesa);
            if (res) allNatures.set(res.codigo, res);
        });
    }

    console.log(`Encontradas ${allNatures.size} naturezas únicas.`);

    const naturesToUpsert = Array.from(allNatures.values());

    if (naturesToUpsert.length > 0) {
        const { error: e3 } = await supabase
            .from('naturezas_despesa')
            .upsert(naturesToUpsert, { onConflict: 'codigo' });

        if (e3) {
            console.error('Erro ao fazer upsert em naturezas_despesa:', e3);
        } else {
            console.log('Naturezas de despesa sincronizadas com sucesso.');
        }
    }

    // 3. Vincular IDs (FKs)
    console.log('Vinculando IDs (FKs) em empenhos e atividades...');

    const { data: nds, error: e4 } = await supabase
        .from('naturezas_despesa')
        .select('id, codigo');

    if (e4) {
        console.error('Erro ao buscar naturezas cadastradas:', e4);
        return;
    }

    for (const nd of nds) {
        // Update empenhos
        const { error: ue } = await supabase
            .from('empenhos')
            .update({ natureza_despesa_id: nd.id })
            .ilike('natureza_despesa', `${nd.codigo}%`)
            .is('natureza_despesa_id', null);
        
        if (ue) console.error(`Erro ao vincular empenho para ${nd.codigo}:`, ue);

        // Update atividades
        const { error: ua } = await supabase
            .from('atividades')
            .update({ natureza_despesa_id: nd.id })
            .ilike('natureza_despesa', `${nd.codigo}%`)
            .is('natureza_despesa_id', null);
        
        if (ua) console.error(`Erro ao vincular atividade para ${nd.codigo}:`, ua);
    }

    console.log('Vinculação concluída.');
}

syncNaturezas();
