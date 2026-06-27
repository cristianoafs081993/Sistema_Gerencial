import { supabase } from '@/lib/supabase';

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
    // 1. Busca o screenshot como Base64 do scraper local
    const scraperResponse = await fetch('http://localhost:8787/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!scraperResponse.ok) {
      throw new Error(`Erro ao conectar ao capturador de evidências (${scraperResponse.status}). Certifique-se de que o serviço local está em execução.`);
    }

    const data = await scraperResponse.json();
    const base64Data: string = data.screenshot;
    if (!base64Data) {
      throw new Error('Não foi possível obter o print da evidência.');
    }

    // 2. Converte o Base64 para Blob/File para fazer upload no Supabase Storage
    const base64Content = base64Data.replace(/^data:image\/png;base64,/, '');
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });

    // 3. Faz upload para o bucket "evidencias" no Supabase Storage
    const fileName = `evidencias/${crypto.randomUUID()}.png`;
    const { error: uploadError } = await supabase.storage
      .from('price-research-evidence')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      console.error('[capture] Supabase upload error:', uploadError);
      throw new Error(`Erro ao salvar a evidência no armazenamento: ${uploadError.message}`);
    }

    // 4. Retorna a URL pública da imagem
    const { data: publicUrlData } = supabase.storage
      .from('price-research-evidence')
      .getPublicUrl(fileName);

    if (!publicUrlData?.publicUrl) {
      throw new Error('Não foi possível obter a URL pública da evidência.');
    }

    return publicUrlData.publicUrl;
  },
};

