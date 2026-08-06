const fs = require('fs');
const html = fs.readFileSync('output/contrato_publico_3474.html', 'utf-8');

const tables = html.match(/<table[\s\S]*?<\/table>/g);
const table3 = tables[2]; // Medições da Parcela table

const rows = table3.match(/<tr[\s\S]*?<\/tr>/g) || [];

const result = [];

rows.forEach((r, idx) => {
    if (idx === 0) return; // Skip header row
    
    // Parcela number
    const numMatch = r.match(/<td>#(\d+)<\/td>/);
    const parcelaNum = numMatch ? parseInt(numMatch[1]) : idx;
    
    // Período Previsto & Valor Previsto
    const tds = r.match(/<td>([\s\S]*?)<\/td>/g) || [];
    const periodoPrevisto = tds[1] ? tds[1].replace(/<[^>]+>/g, '').trim() : '';
    const valorPrevisto = tds[2] ? tds[2].replace(/<[^>]+>/g, '').trim() : '';

    // Medição details (<dl> elements)
    const dtDdRegex = /<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/gi;
    let match;
    const details = {};
    while ((match = dtDdRegex.exec(r)) !== null) {
        const key = match[1].replace(/<[^>]+>/g, '').replace(':', '').trim();
        const val = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        details[key] = val;
    }

    result.push({
        parcela: `#${parcelaNum}`,
        periodoPrevisto,
        valorPrevisto,
        fiscal: details['Fiscal da Medição'] || '-',
        periodoExecutado: details['Período Executado'] || '-',
        valorExecutado: details['Valor Executado'] || '-',
        nf: details['Nº do Documento'] || details['Nº da Nota'] || '-',
        processo: details['Processo'] || '-',
        ocorrencia: details['Ocorrência'] || '-',
        providencia: details['Providência'] || '-'
    });
});

console.log(`Total parcelas parsed: ${result.length}`);
fs.writeFileSync('output/medicoes_table_complete.json', JSON.stringify(result, null, 2));

// Print markdown table
console.log("\n### Tabela de Medições (Parcelas) - Contrato 3474 (00153/2024)\n");
console.log("| Parcela | Nº NF / Doc. Fiscal | Valor Executado | Processo de Pagamento | Período Executado |");
console.log("|---|---|---|---|---|");
result.forEach(m => {
    console.log(`| ${m.parcela} | ${m.nf} | ${m.valorExecutado} | ${m.processo} | ${m.periodoExecutado} |`);
});
