const fs = require('fs');

async function searchProcess(num) {
    const rawNum = num.replace(/\D/g, ''); // digits only
    const formattedNum = num;
    
    console.log(`Testing formatted: ${formattedNum} & raw: ${rawNum}`);
    
    // Try formatted
    let url = `https://suap.ifrn.edu.br/processo_eletronico/consulta_publica/?numero_protocolo=${encodeURIComponent(formattedNum)}`;
    let res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    let html = await res.text();
    console.log(`Formatted status: ${res.status}, length: ${html.length}`);
    fs.writeFileSync(`output/proc_${rawNum}_formatted.html`, html);
    
    // Try raw digits
    url = `https://suap.ifrn.edu.br/processo_eletronico/consulta_publica/?numero_protocolo=${rawNum}`;
    res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    html = await res.text();
    console.log(`Raw status: ${res.status}, length: ${html.length}`);
    fs.writeFileSync(`output/proc_${rawNum}_raw.html`, html);
    
    // Check if results table or links exist in response
    const links = html.match(/href="([^"]*visualizar[^"]*)"/gi) || html.match(/href="([^"]*processo[^"]*)"/gi) || [];
    console.log("Links found in raw query:", links);
}

searchProcess("23035.001610.2025-95");
