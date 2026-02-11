
const API_BASE = 'https://api.portaldatransparencia.gov.br/api-de-dados/despesas/documentos';
const UNIDADE_GESTORA = '158366';
const GESTAO = '26435';
const API_KEY = '931d4d57337bef94e775337c318342e9';

async function fetchDate(date, fase) {
    const url = `${API_BASE}?unidadeGestora=${UNIDADE_GESTORA}&gestao=${GESTAO}&dataEmissao=${encodeURIComponent(date)}&fase=${fase}&pagina=1`;
    console.log(`Fetching Fase ${fase}: ${url}`);

    try {
        const response = await fetch(url, {
            headers: {
                'accept': '*/*',
                'chave-api-dados': API_KEY,
            },
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            console.log(`FOUND DATA FOR ${date} FASE ${fase}!`);
            console.log('Sample item:', JSON.stringify(data[0], null, 2));
            console.log(`Value of "valor": "${data[0].valor}"`);
            return data[0];
        } else {
            return null;
        }
    } catch (e) {
        console.error(`${date}: Error ${e.message}`);
        return null;
    }
}

async function run() {
    // We found data for 12/01/2026 in fase 2. Let's try fase 3. 
    // And maybe other dates.
    await fetchDate('12/01/2026', 3);
    await fetchDate('12/01/2026', 2); // Confirm 2 is "-"
}

run();
