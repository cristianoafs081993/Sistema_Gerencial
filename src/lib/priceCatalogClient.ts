import {
  findCatalogSuggestionsDirect,
  type PriceCatalogSuggestion,
  type PriceCatalogType,
} from '@/lib/priceCatalog';

const pendingWorkerRequests = new Map<
  number,
  {
    resolve: (suggestions: PriceCatalogSuggestion[]) => void;
    reject: (error: Error) => void;
  }
>();
let matcherWorker: Worker | null = null;
let workerRequestId = 0;

function getMatcherWorker() {
  if (matcherWorker) return matcherWorker;
  matcherWorker = new Worker(new URL('./priceCatalog.worker.ts', import.meta.url), { type: 'module' });
  matcherWorker.addEventListener('message', (event: MessageEvent<{
    id: number;
    suggestions?: PriceCatalogSuggestion[];
    error?: string;
  }>) => {
    const pending = pendingWorkerRequests.get(event.data.id);
    if (!pending) return;
    pendingWorkerRequests.delete(event.data.id);
    if (event.data.error) pending.reject(new Error(event.data.error));
    else pending.resolve(event.data.suggestions ?? []);
  });
  matcherWorker.addEventListener('error', () => {
    for (const pending of pendingWorkerRequests.values()) {
      pending.reject(new Error('Falha ao processar o catálogo de materiais e serviços.'));
    }
    pendingWorkerRequests.clear();
    matcherWorker?.terminate();
    matcherWorker = null;
  });
  return matcherWorker;
}

export function findCatalogSuggestions(
  description: string,
  catalogType: PriceCatalogType,
  limit = 50,
) {
  if (typeof Worker === 'undefined') {
    return findCatalogSuggestionsDirect(description, catalogType, limit);
  }

  const id = ++workerRequestId;
  const worker = getMatcherWorker();
  return new Promise<PriceCatalogSuggestion[]>((resolve, reject) => {
    pendingWorkerRequests.set(id, { resolve, reject });
    worker.postMessage({ id, description, catalogType, limit });
  });
}
