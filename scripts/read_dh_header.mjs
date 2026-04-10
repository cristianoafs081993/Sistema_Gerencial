
import fs from 'fs';
const content = fs.readFileSync('C:/Users/3128880/Desktop/Programação/IFRN/love-execu-o-main/love-execu-o-main/docs/Documentos Hábeis.csv', 'latin1');
console.log(content.split('\n')[0]);
