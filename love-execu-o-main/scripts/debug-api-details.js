
const API_BASE = 'https://api.portaldatransparencia.gov.br/api-de-dados/despesas/documentos';
const API_KEY = '931d4d57337bef94e775337c318342e9';
const DOC_ID = '158366264352026NS000017';

async function fetchDetails() {
    const url = `${API_BASE}/${DOC_ID}`;
    console.log(`Fetching details: ${url}`);

    try {
        const response = await fetch(url, {
            headers: {
                'accept': '*/*',
                'chave-api-dados': API_KEY,
            },
        });

        if (!response.ok) {
            console.log(`Error: ${response.status} ${response.statusText}`);
            return;
        }

        const data = await response.json();
        console.log('Details:', JSON.stringify(data, null, 2));

    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

fetchDetails();
