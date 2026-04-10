import { createClient } from "@supabase/supabase-js";
const url = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzk4NjIsImV4cCI6MjA4NTg1NTg2Mn0.g9h5nF0l8yKG-yjQRI8i_mq084IzKTrH64F2FpreVIg';
const supabase = createClient(url, key);

const payload = {
  texto: 'Considerando a extrema urgência, o contrato será de caráter emergencial e terá a duração de 3 anos.'
};

console.log("Gerando embedding localmente via API Gemini...");
const googleKey = process.env.GOOGLE_API_KEY; // run with GOOGLE_API_KEY=... node test_db.mjs

async function run() {
    const embedRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2-preview:embedContent?key=${googleKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text: payload.texto }] },
        outputDimensionality: 768
      }),
    });
    const embedData = await embedRes.json();
    const queryEmbedding = embedData.embedding.values;

    console.log("Buscando no Supabase com match_count = 50...");
    const { data: normativos, error } = await supabase.rpc("buscar_normativos", {
      query_embedding: queryEmbedding,
      match_count: 50,
    });
    
    console.log("Retornou:", normativos?.length, "chunks");
    for (let i = 0; i < normativos.length; i++) {
        const n = normativos[i];
        if (n.texto.includes("prazo máximo de 1 (um) ano")) {
             console.log(`\nACHOU a regra na posição [${i+1}] com similaridade ${n.similaridade}`);
             break;
        }
    }
}
run();
