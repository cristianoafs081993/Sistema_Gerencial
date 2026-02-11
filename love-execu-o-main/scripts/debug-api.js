
const API_BASE = 'https://api.portaldatransparencia.gov.br/api-de-dados/despesas/documentos';
const UNIDADE_GESTORA = '158366';
const GESTAO = '26435';
const API_KEY = '931d4d57337bef94e775337c318342e9';

// Try a range of dates to find ANY data
const datesToTry = [
    '02/01/2026',
    '12/01/2026',
    '10/01/2025',
    '20/12/2025'
];

async function fetchDate(date) {
    const url = `${API_BASE}?unidadeGestora=${UNIDADE_GESTORA}&gestao=${GESTAO}&dataEmissao=${encodeURIComponent(date)}&fase=2&pagina=1`;
    // console.log(`Fetching: ${url}`);

    try {
        const response = await fetch(url, {
            headers: {
                'accept': '*/*',
                'chave-api-dados': API_KEY,
            },
        });

        if (!response.ok) {
            // console.log(`${date}: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            console.log(`FOUND DATA FOR ${date}!`);
            console.log('Sample item:', JSON.stringify(data[0], null, 2));
            console.log(`Type of "valor": ${typeof data[0].valor}`);
            console.log(`Value of "valor": "${data[0].valor}"`);
            return data[0];
        } else {
            // console.log(`${date}: Empty array`);
            return null;
        }
    } catch (e) {
        console.error(`${date}: Error ${e.message}`);
        return null;
    }
}

async function run() {
    console.log("Searching for data...");
    for (const date of datesToTry) {
        const result = await fetchDate(date);
        if (result) break;
    }
    console.log("Search complete.");
}

run();
