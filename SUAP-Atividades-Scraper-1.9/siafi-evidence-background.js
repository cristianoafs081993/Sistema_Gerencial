(function () {
  'use strict';
  let lastCapture = 0;
  let queue = Promise.resolve();
  async function capture(sender) {
    const source = new URL(sender.url || '');
    if (source.origin !== 'https://siafi.tesouro.gov.br' || sender.frameId !== 0 || !sender.tab?.id) throw new Error('Captura permitida somente na aba SIAFI.');
    const [tab] = await chrome.tabs.query({ active: true, windowId: sender.tab.windowId });
    if (tab?.id !== sender.tab.id) throw new Error('Mantenha a aba SIAFI selecionada durante a captura.');
    const wait = Math.max(0, 600 - (Date.now() - lastCapture));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    // Check again after rate limiting so another tab is never captured by mistake.
    const [current] = await chrome.tabs.query({ active: true, windowId: sender.tab.windowId });
    if (current?.id !== sender.tab.id) throw new Error('A aba ativa mudou. Repita a captura no SIAFI.');
    lastCapture = Date.now();
    return chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.source !== 'siages-siafi-evidence' || message.type !== 'capture') return undefined;
    const job = queue.then(() => capture(sender));
    queue = job.catch(() => {});
    void job.then(dataUrl => respond({ ok: true, dataUrl })).catch(error => respond({ ok: false, error: error.message }));
    return true;
  });
})();
