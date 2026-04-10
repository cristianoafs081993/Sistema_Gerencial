import fs from 'fs';

const filePath = 'docs/documentos hábeis csv/3 - Crédito DIsponível.csv';
const buffer = fs.readFileSync(filePath);

// Attempt UTF-16LE
const decoder = new TextDecoder('utf-16le');
const text = decoder.decode(buffer);

console.log('--- FIRST 5 LINES ---');
console.log(text.split(/\r?\n/).slice(0, 5).join('\n'));
console.log('--- HEADER ESCAPED ---');
console.log(JSON.stringify(text.split(/\r?\n/)[0]));
