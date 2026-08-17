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
  const PREFERENCES_STORAGE_KEY = 'siages-comprasnet-etp-generation-preferences-v1';

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

  const PREFERENCE_OPTIONS = {
    length: ['curto', 'padrao', 'detalhado'],
    format: ['corrido', 'corrido_topicos', 'topicos'],
    emphases: ['tecnica', 'economica', 'operacional', 'sustentabilidade', 'competitividade'],
    sources: ['processo', 'anexos', 'conteudo_atual'],
    existingTextMode: ['complementar', 'melhorar', 'reescrever'],
  };
  const SECTION_CHECKLISTS = {
    necessidade: ['impacto_sem_contratar', 'publico_afetado', 'evidencias_problema'],
    requisitos: ['criterios_tecnicos', 'criterios_operacionais', 'requisitos_legais', 'criterios_aceitacao'],
    mercado: ['alternativas', 'comparacao_tecnico_economica', 'justificativa_escolha'],
    solucao: ['escopo_integrado', 'execucao_vigencia', 'resultados_esperados'],
    quantitativos: ['memoria_calculo', 'metodologia_estimativa', 'restricao_sem_numeros_inventados'],
    estimativa_valor: ['metodologia_pesquisa', 'fontes_consultadas', 'restricao_sem_valores_inventados'],
    parcelamento: ['viabilidade_tecnica', 'viabilidade_economica', 'competitividade'],
    correlatas: ['contratacoes_relacionadas', 'dependencias', 'inexistencia_confirmada'],
    planejamento: ['pca', 'planejamento_institucional', 'alinhamento_estrategico'],
    resultados: ['beneficios_publicos', 'eficiencia', 'indicadores_resultado'],
    providencias: ['equipe_fiscalizacao', 'capacitacao', 'adequacoes_previas'],
    ambiental: ['ciclo_vida', 'residuos_consumo', 'criterios_sustentabilidade'],
    conclusao: ['viabilidade', 'condicionantes', 'pendencias_remanescentes'],
  };
  const DEFAULT_PREFERENCES = {
    version: 1,
    length: 'padrao',
    paragraphCount: 3,
    itemCount: 5,
    format: 'corrido',
    emphases: ['tecnica', 'operacional'],
    sources: ['processo', 'anexos', 'conteudo_atual'],
    existingTextMode: 'complementar',
    sectionOverrides: {},
  };

  let installed = false;
  let iframe = null;
  let overlay = null;
  let root = null;
  let openButton = null;
  let returnFocusElement = null;
  let routeWatcherStarted = false;

  function normalize(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizePreferences(value) {
    const input = value && typeof value === 'object' ? value : {};
    const allowed = (key, fallback) => PREFERENCE_OPTIONS[key].includes(input[key]) ? input[key] : fallback;
    const allowedList = (key, fallback) => {
      const values = Array.isArray(input[key]) ? [...new Set(input[key].filter((item) => PREFERENCE_OPTIONS[key].includes(item)))] : [];
      return values.length ? values : fallback;
    };
    const clamp = (raw, min, max, fallback) => {
      const numeric = Number(raw);
      return Number.isFinite(numeric) ? Math.min(max, Math.max(min, Math.round(numeric))) : fallback;
    };
    const rawOverrides = input.sectionOverrides && typeof input.sectionOverrides === 'object' ? input.sectionOverrides : {};
    const sectionOverrides = {};
    FIELD_DEFINITIONS.forEach((definition) => {
      const checklist = Array.isArray(rawOverrides[definition.id]?.checklist)
        ? [...new Set(rawOverrides[definition.id].checklist.filter((item) => SECTION_CHECKLISTS[definition.id].includes(item)))] : [];
      if (checklist.length) sectionOverrides[definition.id] = { checklist };
    });
    return {
      version: 1,
      length: allowed('length', DEFAULT_PREFERENCES.length),
      paragraphCount: clamp(input.paragraphCount, 1, 8, DEFAULT_PREFERENCES.paragraphCount),
      itemCount: clamp(input.itemCount, 3, 12, DEFAULT_PREFERENCES.itemCount),
      format: allowed('format', DEFAULT_PREFERENCES.format),
      emphases: allowedList('emphases', DEFAULT_PREFERENCES.emphases),
      sources: allowedList('sources', DEFAULT_PREFERENCES.sources),
      existingTextMode: allowed('existingTextMode', DEFAULT_PREFERENCES.existingTextMode),
      sectionOverrides,
    };
  }

  function readPreferences() {
    const storage = globalThis.chrome?.storage?.sync;
    if (!storage?.get) return Promise.resolve(normalizePreferences(DEFAULT_PREFERENCES));
    return new Promise((resolve) => storage.get(PREFERENCES_STORAGE_KEY, (result) => resolve(normalizePreferences(result?.[PREFERENCES_STORAGE_KEY]))));
  }

  function savePreferences(value) {
    const preferences = normalizePreferences(value);
    const storage = globalThis.chrome?.storage?.sync;
    if (!storage?.set) return Promise.resolve(preferences);
    return new Promise((resolve, reject) => storage.set({ [PREFERENCES_STORAGE_KEY]: preferences }, () => {
      const error = globalThis.chrome?.runtime?.lastError;
      if (error) reject(new Error(error.message));
      else resolve(preferences);
    }));
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
      document.querySelector('.dropdown-item.active'),
      document.querySelector('.btn-section'),
      document.querySelector('[aria-current="page"]'),
      document.querySelector('h1, h2, h3'),
    ].filter((element) => element && isVisible(element));
    return normalize(candidates[0]?.textContent);
  }

  function findDefinitionByCurrentSection() {
    const title = currentSectionTitle().toLowerCase();
    return FIELD_DEFINITIONS.find((definition) => title.includes(definition.title.toLowerCase()) || definition.title.toLowerCase().includes(title));
  }

  function findSectionLink(definition) {
    const target = definition.title.toLowerCase();
    return Array.from(document.querySelectorAll('.dropdown-item, .dropdown-menu a, a, button'))
      .filter((element) => isVisible(element) && !element.classList.contains('criar-campo'))
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
    if (!Array.isArray(fields) || fields.length !== 1) throw new Error('A extensão aplica somente uma seção por vez. Avance manualmente no Comprasnet para aplicar outra seção.');
    const field = fields[0];
    const currentSection = findDefinitionByCurrentSection();
    if (!currentSection) throw new Error('Não foi possível identificar a seção aberta no Comprasnet. Atualize a página e tente novamente.');
    if (field.id !== currentSection.id) throw new Error(`A seção aberta é “${currentSection.title}”. Avance manualmente no Comprasnet antes de aplicar “${field.id}”.`);
    if (!FIELD_DEFINITIONS.some((definition) => definition.id === field.id)) throw new Error('A seção solicitada não é compatível com esta tela do Comprasnet.');

    const current = await waitForEditor();
    if (current.text && !field.replaceExisting) return [];
    const safeHtml = writeEditorHtml(field.html);
    await waitForAutosave(safeHtml);
    return [field.id];
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
      generationPreferences: await readPreferences(),
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
        sendToFrame(RESULT_TYPE, { action: 'apply', ok: true, appliedFieldIds: applied, message: applied.length ? 'Seção salva. O modal será fechado para que você avance manualmente no Comprasnet.' : 'Nenhuma seção foi alterada: o conteúdo existente foi preservado.' });
        return;
      }
      if (payload?.action === 'save-preferences') {
        const preferences = await savePreferences(payload.preferences);
        sendToFrame(RESULT_TYPE, { action: 'preferences', ok: true, preferences });
        return;
      }
      sendToFrame(RESULT_TYPE, { action: 'error', ok: false, message: 'A operação solicitada não é suportada.' });
    } catch (error) {
      sendToFrame(RESULT_TYPE, { action: 'error', ok: false, message: error instanceof Error ? error.message : 'A operação foi interrompida com segurança.', recoverable: true });
    }
  }

  function closeModal() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    const focusTarget = returnFocusElement?.isConnected ? returnFocusElement : openButton;
    if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
    returnFocusElement = null;
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
      const siblingButtons = Array.from(conclude.parentElement.querySelectorAll('button, .br-button'));
      const isSmall = siblingButtons.some((b) => b.classList.contains('small') || b.classList.contains('p-button-sm') || b.classList.contains('btn-sm')) || conclude.classList.contains('small');
      if (isSmall || siblingButtons.length > 0) {
        openButton.classList.add('small');
      }
      conclude.parentElement.insertBefore(openButton, conclude);
      return;
    }

    const heading = Array.from(document.querySelectorAll('h1,h2,h3,[role="heading"]'))
      .find((element) => isVisible(element) && normalize(element.textContent).toLowerCase().includes('estudo técnico preliminar'));
    if (heading?.parentElement) {
      openButton.classList.remove('siages-comprasnet-etp-floating');
      openButton.classList.add('small');
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
    returnFocusElement = document.activeElement instanceof HTMLElement ? document.activeElement : openButton;
    overlay.hidden = false;
    iframe?.focus();
    void sendInitialContext();
  }

  function install() {
    if (installed || !isEtpRoute()) return;
    installed = true;
    root = createElement('div');
    root.id = ROOT_ID;

    openButton = createElement('button', 'br-button secondary small', 'Escrever ETP com IA');
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
    globalThis.__siagesComprasnetEtp = { install, collectFields, applyFields, getThemeTokens, closeModal, readPreferences, savePreferences };
  }
})();
