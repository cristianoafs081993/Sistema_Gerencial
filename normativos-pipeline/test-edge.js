const fetch = require('node-fetch'); // or use native fetch if Node >= 18

async function test() {
  const url = "https://mnqhwyrzhgykjlyyqodd.supabase.co/functions/v1/verificar-conformidade";
  const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzk4NjIsImV4cCI6MjA4NTg1NTg2Mn0.g9h5nF0l8yKG-yjQRI8i_mq084IzKTrH64F2FpreVIg";
  
  const payload = {
    texto: "Pretende-se realizar contratação de serviços de limpeza e conservação. A vigência será de 60 meses improrrogáveis. O edital exigirá vistoria técnica prévia obrigatória para todos os licitantes no mesmo dia e horário."
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
        console.error("HTTP Error:", res.status, await res.text());
        return;
    }

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
