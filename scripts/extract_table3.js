const fs = require('fs');
const html = fs.readFileSync('output/contrato_publico_3474.html', 'utf-8');

// Find Table 3
const tables = html.match(/<table[\s\S]*?<\/table>/g);
const table3 = tables[2]; // 3rd table (index 2)

console.log("Parsing Table 3 - Medições da Parcela...\n");

const rows = table3.match(/<tr[\s\S]*?<\/tr>/g) || [];

const medições = [];

rows.forEach((r, idx) => {
    // Get text of all cells
    const cells = (r.match(/<t[dh][\s\S]*?<\/t[dh]>/g) || []).map(c => c.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    const rowText = cells.join(" | ");
    
    // Extract specific fields using regex on the row HTML
    const numDocMatch = r.match(/Nº do Documento:\s*([^\s<]+)/i) || r.match(/Nota\/Documento Fiscal:\s*([^\s<]+)/i) || r.match(/Nº da Nota\/Documento Fiscal:\s*([^\s<]+)/i);
    const valorExecMatch = r.match(/Valor Executado:\s*R\$\s*([\d\.,]+)/i) || r.match(/R\$\s*([\d\.,]+)/);
    const processoMatch = r.match(/Processo:\s*([\d\.\/-]+)/i) || r.match(/(\d{5}\.\d{6}\.\d{4}-\d{2})/);
    
    // Also look for links inside row HTML
    const links = [];
    const linkRegex = /href="([^"]*)"/gi;
    let lm;
    while ((lm = linkRegex.exec(r)) !== null) {
        links.push(lm[1]);
    }

    console.log(`--- Row ${idx} ---`);
    console.log("Full text:", rowText);
    console.log("Links:", links);
});
