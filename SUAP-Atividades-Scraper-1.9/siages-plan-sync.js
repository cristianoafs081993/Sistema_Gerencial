(function requestBackendPlanSync() {
  if (window.top !== window) return;
  window.postMessage({
    source: 'siages-suap-extension',
    type: 'siages:suap-plan-sync-request',
    version: 1,
    payload: { planId: 8, scope: 'campus' },
  }, window.location.origin);
})();
