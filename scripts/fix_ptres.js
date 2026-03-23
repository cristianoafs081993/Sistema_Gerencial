
async function fixPTRES() {
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/atividades?select=id,origem_recurso,plano_interno`;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const response = await fetch(url, { headers });
  const data = await response.json();

  if (!Array.isArray(data)) {
    console.error('Failed to fetch', data);
    return;
  }

  const parsePTRES = (text) => {
    if (!text) return null;
    const match = text.match(/\b\d{6}\b/);
    return match ? match[0] : null;
  };

  let fixedCount = 0;
  for (const item of data) {
    const updates = {};
    
    // Check origem_recurso
    const fixedOrigem = parsePTRES(item.origem_recurso);
    if (fixedOrigem && fixedOrigem !== item.origem_recurso) {
      updates.origem_recurso = fixedOrigem;
    }

    // Check plano_interno
    const fixedPlano = parsePTRES(item.plano_interno);
    if (fixedPlano && fixedPlano !== item.plano_interno) {
      updates.plano_interno = fixedPlano;
    }

    if (Object.keys(updates).length > 0) {
      console.log(`Fixing ${item.id}:`, updates);
      await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/atividades?id=eq.${item.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates)
      });
      fixedCount++;
    }
  }
  
  console.log(`Done! Fixed ${fixedCount} records.`);
}

fixPTRES().catch(console.error);
