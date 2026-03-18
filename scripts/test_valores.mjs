import * as XLSX from 'xlsx';
import fs from 'fs';

export function cleanValor(v) {
  if (v === null || v === undefined || v === '') return 0.0;
  if (typeof v === 'number') return v;
  const str = String(v).replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0.0 : num;
}

async function test(filename, headerIndex) {
    const buf = fs.readFileSync(filename);
    const workbook = XLSX.read(buf, { cellDates: true, type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    const headers = raw[headerIndex];
    const data = raw.slice(headerIndex + 1);

    const df = data.map(row => {
        const obj = {};
        for(let i=0; i<headers.length; i++){
            obj[headers[i]] = row[i];
        }
        return obj;
    });

    console.log(`\n--- ${filename} ---`);
    for(let i=0; i<10; i++) {
        if (df[i] && df[i]['PF - Valor Linha']) {
             console.log(`Row ${i}: Raw=${df[i]['PF - Valor Linha']}  type=${typeof df[i]['PF - Valor Linha']}  clean=${cleanValor(df[i]['PF - Valor Linha'])}`);
        }
    }
}
test('docs/PFs.xlsx', 0);
test('docs/PFs - liberação de recurso.xlsx', 5);
