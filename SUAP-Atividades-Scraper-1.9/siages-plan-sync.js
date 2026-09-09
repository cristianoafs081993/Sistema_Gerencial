(function () {
  function requestBackendPlanSync(scope = 'campus') {
    if (window.top !== window) return;
    window.postMessage({
      source: 'siages-suap-extension',
      type: 'siages:suap-plan-sync-request',
      version: 1,
      payload: { planId: 8, scope },
    }, window.location.origin);
  }

  requestBackendPlanSync();

  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type === 'siages:suap-plan-sync-request') requestBackendPlanSync(message.scope === 'all' ? 'all' : 'campus');
    });
  }
})();
