(function () {
  'use strict';

  const SIAGES_ORIGIN = 'https://www.siages.com.br';
  const ROOT_ID = 'siages-comprasnet-etp';
  const OVERLAY_ID = 'siages-comprasnet-etp-overlay';
  const FRAME_ID = 'siages-comprasnet-etp-frame';
  const READY_TYPE = 'siages:comprasnet-etp-ready';
  const CONTEXT_TYPE = 'siages:comprasnet-etp-context';
  const REQUEST_TYPE = 'siages:comprasnet-etp-request';
  const RESULT_TYPE = 'siages:comprasnet-etp-result';
  const CLOSE_TYPE = 'siages:comprasnet-etp-close';

  const FIELD_DEFINITIONS = [
    { id: 'necessidade', title: 'Descrição da necessidade' },
    { id: 'requisitos', title: 'Descrição dos Requisitos da Contratação' },
    { id: 'mercado', title: 'Levantamento de Mercado' },
    { id: 'solucao', title: 'Descrição da solução como um todo' },
    { id: 'quantitativos', title: 'Estimativa das Quantidades a serem Contratadas' },
    { id: 'estimativa_valor', title: 'Estimativa do Valor da Contratação' },
    { id: 'parcelamento', title: 'Justificativa para o Parcelamento ou não da Solução' },
    { id: 'correlatas', title: 'Contratações Correlatas e/ou Interdependentes' },
    { id: 'planejamento', title: 'Alinhamento entre a Contratação e o Planejamento' },
    { id: 'resultados', title: 'Benefícios a serem alcançados com a contratação' },
    { id: 'providencias', title: 'Providências a serem Adotadas' },
    { id: 'ambiental', title: 'Possíveis Impactos Ambientais' },
    { id: 'conclusao', title: 'Declaração de Viabilidade' },
  ];

  let installed = false;
  let iframe = null;
  let overlay = null;
  let root = null;
  let openButton = null;
  let routeWatcherStarted = false;

  function normalize(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeProcessNumber(value) {
    return normalize(value).match(/\b\d{5}\.\d{6}(?:[./]\d{4})[-/]\d{2}\b/)?.[0] || '';
  }

  function isEtpRoute() {
    if (globalThis.__SIAGES_COMPRASNET_ETP_TEST__) return true;
    return location.hostname === 'cnetmobile.estaleiro.serpro.gov.br' &&
      location.pathname.includes('/comprasnet-artefatos-web/artefatos/edit/') &&
      new URLSearchParams(location.search).get('tipo')?.toUpperCase() === 'ETP';
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function isVisible(element) {
    if (!element || !element.isConnected) return false;
    for (let current = element; current && current !== document.documentElement; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    }
    return true;
  }

  function sendToFrame(type, payload) {
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ source: 'siages', type, version: 1, payload }, SIAGES_ORIGIN);
  }

  function isUnauthorized() {
    const bodyText = normalize(document.body?.innerText).toLowerCase();
    return bodyText.includes('acesso não autorizado') || bodyText.includes('acesso nao autorizado') ||
      bodyText.includes('sua sessão pode ter expirado') || bodyText.includes('sua sessao pode ter expirado') ||
      Array.from(document.querySelectorAll('button')).some((button) => normalize(button.textContent).toLowerCase() === 'efetuar login');
  }

  function assertEtpPage() {
    if (!isEtpRoute()) throw new Error('A página atual não é um ETP do Comprasnet.');
    if (isUnauthorized()) throw new Error('A sessão do Comprasnet expirou. Faça login novamente antes de continuar.');
  }

  function getThemeTokens() {
    const body = document.body;
    const primary = document.querySelector('button.br-button.primary, .br-button.primary') || document.querySelector('button');
    const secondary = document.querySelector('button.br-button.secondary, .br-button.secondary');
    const input = document.querySelector('input, textarea');
    const bodyStyle = getComputedStyle(body);
    const primaryStyle = primary ? getComputedStyle(primary) : bodyStyle;
    const secondaryStyle = secondary ? getComputedStyle(secondary) : bodyStyle;
    const inputStyle = input ? getComputedStyle(input) : bodyStyle;
    return {
      fontFamily: bodyStyle.fontFamily || '"Open Sans", Arial, sans-serif',
      fontSize: bodyStyle.fontSize || '14px',
      textColor: bodyStyle.color || '#333',
      mutedColor: inputStyle.color || '#666',
      surfaceColor: bodyStyle.backgroundColor && bodyStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' ? bodyStyle.backgroundColor : '#fff',
      backgroundColor: bodyStyle.backgroundColor && bodyStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' ? bodyStyle.backgroundColor : '#f5f5f5',
      borderColor: inputStyle.borderColor || '#888',
      primaryColor: primaryStyle.backgroundColor || '#1351b4',
      primaryTextColor: primaryStyle.color || '#fff',
      secondaryColor: secondaryStyle.backgroundColor || '#fff',
      secondaryTextColor: secondaryStyle.color || bodyStyle.color || '#333',
      focusColor: primaryStyle.outlineColor && primaryStyle.outlineColor !== 'invert' ? primaryStyle.outlineColor : '#1351b4',
      radius: primaryStyle.borderRadius || inputStyle.borderRadius || '4px',
    };
  }

  function currentSectionTitle() {
    const candidates = [
      document.querySelector('.btn-section'),
      document.querySelector('[aria-current="page"]'),
      document.querySelector('h1, h2, h3'),
    ].filter(Boolean);
    return normalize(candidates[0]?.textContent);
  }

  function findDefinitionByCurrentSection() {
    const title = currentSectionTitle().toLowerCase();
    return FIELD_DEFINITIONS.find((definition) => title.includes(definition.title.toLowerCase()) || definition.title.toLowerCase().includes(title));
  }

  function findSectionLink(definition) {
    const target = definition.title.toLowerCase();
    return Array.from(document.querySelectorAll('div.dropdown-item a, .dropdown-menu a, a, button'))
      .find((element) => normalize(element.textContent).toLowerCase() === target || normalize(element.textContent).toLowerCase().includes(target));
  }

  function readEditor() {
    const frame = document.querySelector('iframe.cke_wysiwyg_frame, iframe[id*="wysiwyg"], iframe.cke_wysiwyg_frame');
    const body = frame?.contentDocument?.body;
    const html = body?.innerHTML || '';
    const text = normalize(body?.textContent || '');
    return { html, text };
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  async function waitForEditor() {
    const started = Date.now();
    while (Date.now() - started < 8000) {
      assertEtpPage();
      const editor = readEditor();
      if (document.querySelector('iframe.cke_wysiwyg_frame, iframe[id*="wysiwyg"]')) return editor;
      await wait(150);
    }
    throw new Error('O editor de texto do Comprasnet não ficou disponível.');
  }

  async function navigateToSection(definition) {
    assertEtpPage();
    if (findDefinitionByCurrentSection()?.id === definition.id) return waitForEditor();
    const link = findSectionLink(definition);
    if (!link) throw new Error(`A seção “${definition.title}” não foi encontrada no menu do Comprasnet.`);
    link.click();
    const started = Date.now();
    while (Date.now() - started < 8000) {
      assertEtpPage();
      if (findDefinitionByCurrentSection()?.id === definition.id) return waitForEditor();
      await wait(150);
    }
    throw new Error(`Não foi possível abrir a seção “${definition.title}”.`);
  }

  async function collectFields(mode) {
    assertEtpPage();
    const current = findDefinitionByCurrentSection();
    if (mode === 'current') {
      if (!current) return [];
      const editor = await waitForEditor();
      return [{ id: current.id, title: current.title, existingHtml: editor.html, existingText: editor.text }];
    }

    const fields = [];
    for (const definition of FIELD_DEFINITIONS) {
      await navigateToSection(definition);
      const editor = await waitForEditor();
      fields.push({ id: definition.id, title: definition.title, existingHtml: editor.html, existingText: editor.text });
    }
    if (current) await navigateToSection(current);
    return fields;
  }

  function sanitizeHtml(value) {
    const documentFragment = new DOMParser().parseFromString(String(value || ''), 'text/html');
    documentFragment.querySelectorAll('script,style,iframe,object,embed,form,input,button,select,textarea').forEach((element) => element.remove());
    documentFragment.querySelectorAll('*').forEach((element) => {
      Array.from(element.attributes).forEach((attribute) => {
        if (attribute.name.toLowerCase().startsWith('on') || attribute.name.toLowerCase() === 'style') element.removeAttribute(attribute.name);
      });
    });
    return documentFragment.body.innerHTML;
  }

  function dispatchEditorEvents(target) {
    ['input', 'change', 'blur'].forEach((type) => target.dispatchEvent(new Event(type, { bubbles: true })));
  }

  function writeEditorHtml(html) {
    const safeHtml = sanitizeHtml(html);
    const frame = document.querySelector('iframe.cke_wysiwyg_frame, iframe[id*="wysiwyg"]');
    const body = frame?.contentDocument?.body;
    if (!body) throw new Error('O editor do Comprasnet não está disponível para edição.');

    const instances = window.CKEDITOR?.instances ? Object.values(window.CKEDITOR.instances) : [];
    const instance = instances.find((item) => typeof item.setData === 'function' && typeof item.updateElement === 'function');
    if (instance) {
      instance.setData(safeHtml);
      instance.updateElement();
      instance.fire?.('change');
    }

    body.innerHTML = safeHtml;
    dispatchEditorEvents(body);
    document.querySelectorAll('textarea').forEach((textarea) => {
      if (textarea.offsetParent === null || textarea.classList.contains('cke_source')) {
        textarea.value = safeHtml;
        dispatchEditorEvents(textarea);
      }
    });
    return safeHtml;
  }

  async function waitForAutosave(expectedHtml) {
    const expectedText = normalize(new DOMParser().parseFromString(expectedHtml, 'text/html').body.textContent);
    const started = Date.now();
    while (Date.now() - started < 7000) {
      assertEtpPage();
      const actual = readEditor();
      const statusText = normalize(document.body.innerText).toLowerCase();
      if (actual.text === expectedText && (statusText.includes('alterações foram salvas') || statusText.includes('alteracoes foram salvas') || statusText.includes('salvo automaticamente'))) return;
      await wait(250);
    }
    throw new Error('O Comprasnet não confirmou o salvamento automático da seção. Nenhuma ação de conclusão foi executada.');
  }

  async function applyFields(fields) {
    assertEtpPage();
    const original = findDefinitionByCurrentSection();
    const applied = [];
    try {
      for (const field of fields || []) {
        const definition = FIELD_DEFINITIONS.find((item) => item.id === field.id);
        if (!definition) continue;
        await navigateToSection(definition);
        const current = await waitForEditor();
        if (current.text && !field.replaceExisting) continue;
        const safeHtml = writeEditorHtml(field.html);
        await waitForAutosave(safeHtml);
        applied.push(field.id);
      }
      if (original) await navigateToSection(original);
      return applied;
    } catch (error) {
      if (original) {
        try { await navigateToSection(original); } catch { /* preserva a mensagem original */ }
      }
      throw new Error(`${error instanceof Error ? error.message : 'Falha ao aplicar o ETP'}${applied.length ? ` Seções aplicadas antes da falha: ${applied.join(', ')}.` : ''}`);
    }
  }

  async function buildContext(mode) {
    assertEtpPage();
    const current = findDefinitionByCurrentSection();
    const fields = await collectFields(mode);
    const processNumber = normalizeProcessNumber(document.body.innerText);
    let extensionSession;
    try {
      extensionSession = await globalThis.SiagesExtensionAuth?.getSession?.();
    } catch {
      extensionSession = null;
    }
    return {
      pageUrl: location.href,
      artifactId: location.pathname.match(/\/artefatos\/edit\/(\d+)/)?.[1],
      pageTitle: normalize(document.title) || 'Estudo Técnico Preliminar',
      processNumber,
      currentSectionId: current?.id,
      fields,
      theme: getThemeTokens(),
      ...(extensionSession ? { extensionSession } : {}),
    };
  }

  async function sendInitialContext() {
    try {
      const context = await buildContext('current');
      sendToFrame(CONTEXT_TYPE, context);
    } catch (error) {
      sendToFrame(RESULT_TYPE, { action: 'error', ok: false, message: error instanceof Error ? error.message : 'Não foi possível ler o ETP.' });
    }
  }

  async function handleRequest(payload) {
    try {
      if (payload?.action === 'snapshot') {
        const context = await buildContext(payload.mode === 'whole' ? 'whole' : 'current');
        const { theme, extensionSession, ...safeContext } = context;
        sendToFrame(RESULT_TYPE, { action: 'snapshot', ok: true, context: safeContext });
        return;
      }
      if (payload?.action === 'apply') {
        const applied = await applyFields(payload.fields);
        sendToFrame(RESULT_TYPE, { action: 'apply', ok: true, appliedFieldIds: applied, message: applied.length ? `Seções aplicadas: ${applied.join(', ')}.` : 'Nenhuma seção foi alterada: os campos já preenchidos foram preservados.' });
        return;
      }
      sendToFrame(RESULT_TYPE, { action: 'error', ok: false, message: 'A operação solicitada não é suportada.' });
    } catch (error) {
      sendToFrame(RESULT_TYPE, { action: 'error', ok: false, message: error instanceof Error ? error.message : 'A operação foi interrompida com segurança.', recoverable: true });
    }
  }

  function closeModal() {
    if (overlay) overlay.hidden = true;
  }

  function removeAssistant() {
    openButton?.remove();
    root?.remove();
    openButton = null;
    root = null;
    iframe = null;
    overlay = null;
    installed = false;
  }

  function placeOpenButton() {
    if (!openButton) return;
    const concludeCandidates = Array.from(document.querySelectorAll('button, .br-button'))
      .filter((element) => normalize(element.textContent).toLowerCase().includes('concluir etp'));
    const conclude = concludeCandidates.find(isVisible);
    if (conclude?.parentElement) {
      openButton.classList.remove('siages-comprasnet-etp-floating');
      conclude.parentElement.insertBefore(openButton, conclude);
      return;
    }

    const heading = Array.from(document.querySelectorAll('h1,h2,h3,[role="heading"]'))
      .find((element) => isVisible(element) && normalize(element.textContent).toLowerCase().includes('estudo técnico preliminar'));
    if (heading?.parentElement) {
      openButton.classList.remove('siages-comprasnet-etp-floating');
      heading.parentElement.appendChild(openButton);
      return;
    }

    openButton.classList.add('siages-comprasnet-etp-floating');
    if (!openButton.isConnected) document.body.appendChild(openButton);
  }

  function syncRoute() {
    if (!isEtpRoute()) {
      if (installed) removeAssistant();
      return;
    }
    if (!installed || !document.getElementById('siages-comprasnet-etp-open')) {
      if (installed) removeAssistant();
      install();
    }
    placeOpenButton();
  }

  function startRouteWatcher() {
    if (routeWatcherStarted) return;
    routeWatcherStarted = true;
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    window.setInterval(syncRoute, 700);
  }

  function openModal() {
    if (!overlay) return;
    overlay.hidden = false;
    iframe?.focus();
    void sendInitialContext();
  }

  function install() {
    if (installed || !isEtpRoute()) return;
    installed = true;
    root = createElement('div');
    root.id = ROOT_ID;

    openButton = createElement('button', 'br-button secondary', 'Escrever ETP com IA');
    openButton.id = 'siages-comprasnet-etp-open';
    openButton.type = 'button';
    openButton.setAttribute('aria-haspopup', 'dialog');
    openButton.setAttribute('aria-label', 'Escrever ETP com inteligência artificial');
    openButton.addEventListener('click', openModal);

    placeOpenButton();

    overlay = createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Assistente de redação do ETP');
    const modal = createElement('div');
    modal.id = 'siages-comprasnet-etp-modal';
    iframe = document.createElement('iframe');
    iframe.id = FRAME_ID;
    iframe.title = 'Assistente de redação do Estudo Técnico Preliminar';
    iframe.src = `${SIAGES_ORIGIN}/comprasnet-extensao/etp`;
    iframe.allow = 'clipboard-read; clipboard-write';
    modal.appendChild(iframe);
    overlay.appendChild(modal);
    root.appendChild(overlay);
    document.body.appendChild(root);

    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeModal(); });
    window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !overlay.hidden) closeModal(); });
    window.addEventListener('message', (event) => {
      if (event.origin !== SIAGES_ORIGIN || event.source !== iframe.contentWindow || event.data?.source !== 'siages' || event.data?.version !== 1) return;
      if (event.data.type === READY_TYPE) void sendInitialContext();
      if (event.data.type === REQUEST_TYPE) void handleRequest(event.data.payload);
      if (event.data.type === CLOSE_TYPE) closeModal();
    });
  }

  startRouteWatcher();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncRoute, { once: true });
  else syncRoute();
  if (globalThis.__SIAGES_COMPRASNET_ETP_TEST__) {
    globalThis.__siagesComprasnetEtp = { install, collectFields, getThemeTokens, closeModal };
  }
})();
