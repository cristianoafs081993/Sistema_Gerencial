const fs = require('fs');

async function testProcess(processoNum) {
    console.log(`Testing process search for: ${processoNum}`);
    
    // Search process via public process endpoint
    const url = `https://suap.ifrn.edu.br/processo_eletronico/consulta_publica/?q=${encodeURIComponent(processoNum)}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await res.text();
    console.log(`Status for ${url}:`, res.status);
    console.log("HTML length:", html.length);
    
    // Extract any links to process details
    const matches = html.match(/href="([^"]*visualizar_processo[^"]*)"/gi) || html.match(/href="([^"]*processo[^"]*)"/gi) || [];
    console.log("Links found:", matches);
    
    fs.writeFileSync(`output/process_search_${processoNum.replace(/\./g, '_')}.html`, html);
}

async function main() {
    await testProcess("23035.001610.2025-95");
    await testProcess("23035.000066.2025-64");
}

main();
