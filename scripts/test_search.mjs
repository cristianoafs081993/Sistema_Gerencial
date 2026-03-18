import * as XLSX from 'xlsx';
import fs from 'fs';

async function searchInFile(filename) {
    const buf = fs.readFileSync(filename);
    const workbook = XLSX.read(buf, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    for (let i=0; i<raw.length; i++) {
        const row = raw[i];
        if (!row) continue;
        for (let j=0; j<row.length; j++) {
            const val = String(row[j]);
            if (val.includes('R$44.') || val.includes('R$7.')) {
                console.log(`Found in ${filename} at Row ${i}: `, val);
            }
        }
    }
}

searchInFile('docs/PFs.xlsx');
searchInFile('docs/PFs - liberação de recurso.xlsx');
