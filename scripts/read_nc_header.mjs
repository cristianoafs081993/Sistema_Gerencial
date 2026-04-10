
import fs from 'fs';
const content = fs.readFileSync('docs/NC-ATUALIZADA.csv', 'latin1');
console.log(content.split('\n')[0]);
