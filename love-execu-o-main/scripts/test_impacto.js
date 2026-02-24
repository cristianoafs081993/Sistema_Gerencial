
import https from 'https';

const API_KEY = '931d4d57337bef94e775337c318342e9';
const HOST = 'api.portaldatransparencia.gov.br';

function makeRequest(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: HOST,
            path: path,
            method: 'GET',
            headers: { 'chave-api-dados': API_KEY, 'accept': '*/*' }
        };
        console.log(`Requesting: ${path}`);
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject('Error parsing JSON');
                    }
                } else {
                    reject(`Status ${res.statusCode}: ${data}`);
                }
            });
        });
        req.on('error', e => reject(e.message));
        req.end();
    });
}

async function runTest() {
    try {
        // Try multiple dates until we find a document
        const dates = ['20/01/2026', '10/01/2026', '10/02/2025', '01/02/2025', '20/01/2025'];

        for (const date of dates) {
            console.log(`\nChecking documents for ${date}...`);
            try {
                // Check Liquidations (Fase 3)
                const docs = await makeRequest(`/api-de-dados/despesas/documentos?unidadeGestora=158366&dataEmissao=${date}&fase=3&pagina=1`);

                if (docs.length > 0) {
                    const doc = docs[0];
                    console.log(`\n[FOUND DOCUMENT] ${doc.documento} (${doc.dataEmissao})`);

                    // Check Empenho Impactado
                    console.log(`\nChecking impact for ${doc.documento} (Fase 3)...`);
                    const impacts = await makeRequest(`/api-de-dados/despesas/empenhos-impactados?codigoDocumento=${doc.documento}&fase=3&pagina=1`);

                    console.log('\n[IMPACT RESULT]');
                    console.log(JSON.stringify(impacts, null, 2));
                    return; // Stop after finding one
                } else {
                    console.log('No documents found.');
                }
            } catch (err) {
                console.log(`Error checking date ${date}: ${err}`);
            }
        }
        console.log('\nCould not find any documents in the checked dates.');

    } catch (error) {
        console.error('Test failed:', error);
    }
}

runTest();
