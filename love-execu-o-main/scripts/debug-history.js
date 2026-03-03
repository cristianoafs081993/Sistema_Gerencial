const API_BASE = 'https://api.portaldatransparencia.gov.br/api-de-dados/despesas/itens-de-empenho/historico';
const API_KEY = '931d4d57337bef94e775337c318342e9';
const DOC_ID = '158366264352025NE000035';

async function fetchHistory() {
    let allItems = [];
    try {
        for (let seq = 1; seq <= 10; seq++) {
            console.log(`Fetching seq ${seq}...`);
            const url = `${API_BASE}?codigoDocumento=${DOC_ID}&sequencial=${seq}&pagina=1`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'accept': '*/*',
                    'chave-api-dados': API_KEY
                }
            });

            if (!response.ok) {
                console.error(`Error fetching seq ${seq}: ${response.status} ${response.statusText}`);
                break;
            }

            let data;
            try {
                data = await response.json();
            } catch (e) {
                console.log(`Seq ${seq} has no JSON`);
                break;
            }

            if (!data || data.length === 0) {
                console.log(`Seq ${seq} returned empty. Stopping here.`);
                break; // If seq=1 is empty, there are no items. If seq=2 is empty, no more items.
            }

            console.log(`Seq ${seq} returned ${data.length} items`);
            allItems = allItems.concat(data);
        }

        console.log('Final History:');
        console.log(JSON.stringify(allItems, null, 2));

    } catch (error) {
        console.error('Fetch error:', error);
    }
}

fetchHistory();
