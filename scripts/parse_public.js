const fs = require('fs');

async function run() {
    const res = await fetch("https://suap.ifrn.edu.br/contratos/contrato_publico/3474/", {
        headers: { "User-Agent": "Mozilla/5.0" }
    });
    const html = await res.text();
    if (!fs.existsSync('output')) fs.mkdirSync('output', { recursive: true });
    fs.writeFileSync('output/contrato_publico_3474.html', html);
    console.log("HTML length:", html.length);
    
    // Check sections, tables, links
    const matches = html.match(/<button[^>]*class="accordion-button[^"]*"[^>]*>([\s\S]*?)<\/button>/g);
    if (matches) {
        console.log("Accordion Buttons:");
        matches.forEach(m => {
            console.log(" -", m.replace(/<[^>]+>/g, '').trim());
        });
    }

    // Extract table rows
    const tableRegex = /<table[\s\S]*?<\/table>/g;
    let tMatch;
    let tIndex = 0;
    while ((tMatch = tableRegex.exec(html)) !== null) {
        tIndex++;
        console.log(`\n--- TABLE ${tIndex} ---`);
        const tableHtml = tMatch[0];
        const rows = tableHtml.match(/<tr[\s\S]*?<\/tr>/g) || [];
        rows.forEach((r, idx) => {
            const cells = (r.match(/<t[dh][\s\S]*?<\/t[dh]>/g) || []).map(c => c.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
            console.log(`Row ${idx+1}:`, cells.join(" | "));
        });
    }

    // Extract all links to processos
    const processLinks = [];
    const linkRegex = /href="([^"]*processo[^"]*)"/gi;
    let lMatch;
    while ((lMatch = linkRegex.exec(html)) !== null) {
        processLinks.push(lMatch[1]);
    }
    console.log("\nProcess Links found:", processLinks);
}

run();
