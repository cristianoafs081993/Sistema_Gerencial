const fs = require('fs');
const html = fs.readFileSync('output/contrato_publico_3474.html', 'utf-8');

const tables = html.match(/<table[\s\S]*?<\/table>/g);
const table3 = tables[2];

const rows = table3.match(/<tr[\s\S]*?<\/tr>/g) || [];

rows.slice(0, 5).forEach((r, idx) => {
    console.log(`\n=================== ROW ${idx} ===================`);
    console.log(r);
});
