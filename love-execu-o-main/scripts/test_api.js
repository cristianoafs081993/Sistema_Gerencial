
import https from 'https';

const API_KEY = '931d4d57337bef94e775337c318342e9';
const HOST = 'api.portaldatransparencia.gov.br';

const checkId = (id) => {
    const sequenceStr = id.toString().padStart(6, '0');
    const codigo = `158366264352026NE${sequenceStr}`;
    const options = {
        hostname: HOST,
        path: `/api-de-dados/despesas/documentos/${codigo}`,
        method: 'GET',
        headers: { 'chave-api-dados': API_KEY, 'accept': '*/*' }
    };

    // console.log(`Checking ${codigo}...`);
    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            if (res.statusCode === 200 && data.trim().length > 0) {
                console.log(`[FOUND] ${codigo} - Size: ${data.length}`);
            } else if (res.statusCode === 200 && data.trim().length === 0) {
                console.log(`[EMPTY] ${codigo}`);
            } else {
                console.log(`[${res.statusCode}] ${codigo}`);
            }
        });
    });
    req.on('error', e => console.error(e.message));
    req.end();
};

console.log('Probing dispersed Empenhos...');
const idsToProbe = [51, 100, 150, 200, 300, 400, 500, 1000, 2000, 900001];

idsToProbe.forEach(id => checkId(id));

