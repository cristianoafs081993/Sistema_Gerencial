const url = 'https://mnqhwyrzhgykjlyyqodd.supabase.co/functions/v1/verificar-conformidade';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzk4NjIsImV4cCI6MjA4NTg1NTg2Mn0.g9h5nF0l8yKG-yjQRI8i_mq084IzKTrH64F2FpreVIg';

const payload = {
  texto: 'Considerando a extrema urgência, o contrato será de caráter emergencial e terá a duração de 3 anos.'
};

console.log("Enviando request para Edge Function...");
try {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
      console.error('HTTP Error:', res.status, await res.text());
  } else {
      const data = await res.json();
      console.log(JSON.stringify(data, null, 2));
  }
} catch (err) {
  console.error('Error:', err);
}
