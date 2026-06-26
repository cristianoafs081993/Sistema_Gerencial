export type MarketSearchResult = {
  title: string;
  link: string;
  displayLink: string;
  snippet: string;
  thumbnailLink?: string;
  price: string;
  provider: string;
};

export const marketSearchService = {
  async search(query: string, providers: string[]): Promise<MarketSearchResult[]> {
    const response = await fetch('http://localhost:8787/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        providers,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao conectar ao buscador de mercado (${response.status}). Certifique-se de que o serviço local está em execução.`);
    }

    const data = await response.json();
    return (data.results || []) as MarketSearchResult[];
  },

  async capture(url: string): Promise<string> {
    const response = await fetch('http://localhost:8787/capture', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao conectar ao capturador de evidências (${response.status}). Certifique-se de que o serviço local está em execução.`);
    }

    const data = await response.json();
    if (!data.screenshot) {
      throw new Error('Não foi possível obter o print da evidência.');
    }
    return data.screenshot;
  },
};
