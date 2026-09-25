(function () {
  const STORAGE_KEY = 'siages_process_mappings_v2';
  const EXTENSION_STORAGE_KEY = 'siages_custom_process_mappings';

  function syncMappingsToExtension() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && globalThis.chrome?.storage?.local) {
        globalThis.chrome.storage.local.set({ [EXTENSION_STORAGE_KEY]: parsed }, () => {
          if (globalThis.chrome.runtime.lastError) {
            // Silencioso em caso de contexto invalidado
          }
        });
      }
    } catch (_) {}
  }

  // Sincroniza na carga inicial da pagina
  syncMappingsToExtension();

  // Escuta alteracoes via storage event
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      syncMappingsToExtension();
    }
  });

  // Escuta evento customizado disparado pelo SIAGES quando o usuario salva no editor
  window.addEventListener('siages:process-mappings-updated', (event) => {
    try {
      const mappings = event?.detail;
      if (Array.isArray(mappings) && globalThis.chrome?.storage?.local) {
        globalThis.chrome.storage.local.set({ [EXTENSION_STORAGE_KEY]: mappings });
      } else {
        syncMappingsToExtension();
      }
    } catch (_) {
      syncMappingsToExtension();
    }
  });
})();
