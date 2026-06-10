/// <reference lib="webworker" />

import { findCatalogSuggestionsDirect, type PriceCatalogType } from '@/lib/priceCatalog';

type CatalogMatchRequest = {
  id: number;
  description: string;
  catalogType: PriceCatalogType;
  limit: number;
};

self.addEventListener('message', async (event: MessageEvent<CatalogMatchRequest>) => {
  try {
    const suggestions = await findCatalogSuggestionsDirect(
      event.data.description,
      event.data.catalogType,
      event.data.limit,
    );
    self.postMessage({ id: event.data.id, suggestions });
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
