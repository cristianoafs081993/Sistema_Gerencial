export type FreightResult = {
  status: 'free' | 'captured' | 'pending';
  total: number | null;
  cep: string;
  text: string;
};

export type CaptureResult = {
  imageUrl: string;
  freight: FreightResult;
};
const SCRAPER_URL = import.meta.env.VITE_MARKET_SEARCH_URL || 'https://scraper.siages.com.br';
const SCRAPER_TOKEN = import.meta.env.VITE_MARKET_SEARCH_TOKEN || '';

export const marketSearchService = {
  async search(query: string, providers: string[]): Promise<MarketSearchResult[]> {
    const response = await fetch(`${SCRAPER_URL}/search`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(SCRAPER_TOKEN ? { 'Authorization': `Bearer ${SCRAPER_TOKEN}` } : {})
      },
      body: JSON.stringify({ query, providers }),
    });
    if (!response.ok) {
      throw new Error(`Erro ao conectar ao buscador de mercado (${response.status}). Certifique-se de que o serviço de pesquisa está online.`);
    }
    const data = await response.json();
    return (data.results || []) as MarketSearchResult[];
  },

  async capture(url: string, cep?: string): Promise<CaptureResult> {
    // 1. Busca o screenshot (e frete se Amazon + CEP) do scraper
    const scraperResponse = await fetch(`${SCRAPER_URL}/capture`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(SCRAPER_TOKEN ? { 'Authorization': `Bearer ${SCRAPER_TOKEN}` } : {})
      },
      body: JSON.stringify({ url, cep: cep || '' }),
    });

    if (!scraperResponse.ok) {
      throw new Error(`Erro ao conectar ao capturador de evidências (${scraperResponse.status}). Certifique-se de que o serviço de pesquisa está online.`);
    }

    const data = await scraperResponse.json();
    const base64Data: string = data.screenshot;
    if (!base64Data) {
      throw new Error('Não foi possível obter o print da evidência.');
    }

    // 2. Converte Base64 → Blob → upload para Supabase Storage
    const base64Content = base64Data.replace(/^data:image\/png;base64,/, '');
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });

    const fileName = `evidencias/${crypto.randomUUID()}.png`;
    const { error: uploadError } = await supabase.storage
      .from('price-research-evidence')
      .upload(fileName, blob, { contentType: 'image/png', upsert: false });

    if (uploadError) {
      console.error('[capture] Supabase upload error:', uploadError);
      throw new Error(`Erro ao salvar a evidência no armazenamento: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('price-research-evidence')
      .getPublicUrl(fileName);

    if (!publicUrlData?.publicUrl) {
      throw new Error('Não foi possível obter a URL pública da evidência.');
    }

    return {
      imageUrl: publicUrlData.publicUrl,
      freight: (data.freight as FreightResult) ?? { status: 'pending', total: null, cep: cep || '', text: 'Frete não disponível.' },
    };
  },
};


