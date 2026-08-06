const fs = require('fs');
const html = fs.readFileSync('output/contrato_publico_3474.html', 'utf-8');

const tables = html.match(/<table[\s\S]*?<\/table>/g);
const table3 = tables[2]; // 3rd table

const rows = table3.match(/<tr[\s\S]*?<\/tr>/g) || [];

const parsedData = [];

rows.forEach((r, idx) => {
    if (idx === 0) return; // Header row
    
    // Extract fields
    const parcelMatch = r.match(/#(\d+)/);
    const parcela = parcelMatch ? parcelMatch[1] : `${idx}`;
    
    const periodoMatch = r.match(/(\d{2}\/\d{2}\/\d{4}\s+a\s+\d{2}\/\d{2}\/\d{4})/);
    const periodoExecutado = periodoMatch ? periodoMatch[1] : "";
    
    const nfMatch = r.match(/(?:Nº do Documento|Nota\/Documento Fiscal|Documento Fiscal|Nº da Nota\/Documento Fiscal|Nº da Nota):\s*([^\s<|]+)/i) ||
                    r.match(/Documento:\s*([^\s<|]+)/i);
    
    // Try regex for NF
    let nf = "";
    const nfRegex = /(?:Nº do Documento|Nota\/Documento Fiscal):\s*([^<|]+?)(?=\s+Ocorrência|\s+Processo|\s+Providência|\s+Empenhos|<|$)/i;
    const mNf = r.match(nfRegex);
    if (mNf) nf = mNf[1].trim();

    // Valor executado regex
    let valorExecutado = "";
    const mVal = r.match(/Valor Executado:\s*R\$\s*([\d\.,]+)/i);
    if (mVal) valorExecutado = "R$ " + mVal[1].trim();

    // Processo regex
    let processo = "";
    const mProc = r.match(/Processo:\s*([\d\.\/-]+)/i);
    if (mProc) processo = mProc[1].trim();

    // Extract links to process if any
    const links = [];
    const linkRegex = /href="([^"]*)"/gi;
    let lm;
    while ((lm = linkRegex.exec(r)) !== null) {
        links.push(lm[1]);
    }

    parsedData.push({
        parcela: `#${parcela}`,
        nf: nf || "-",
        valorExecutado: valorExecutado || "-",
        processo: processo || "-",
        links: links
    });
});

console.log(JSON.stringify(parsedData, null, 2));
fs.writeFileSync('output/parsed_medicoes.json', JSON.stringify(parsedData, null, 2));
