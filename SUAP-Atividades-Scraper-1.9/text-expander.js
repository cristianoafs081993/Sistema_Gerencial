(function () {
  const STORAGE_KEY = 'siages-snippets';
  const DEFAULT_SNIPPETS = {
    '/ifrn': 'Instituto Federal de Educação, Ciência e Tecnologia do Rio Grande do Norte',
    '/cn': 'Currais Novos',
    '/lei14133': 'Lei nº 14.133, de 1º de abril de 2021 (Lei de Licitações e Contratos Administrativos)',
    '/atpub': 'Atenciosamente, servidor público do IFRN – Campus Currais Novos',
  };
  const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'email', 'tel', 'url']);
  let snippets = { ...DEFAULT_SNIPPETS };

  function normalizeSnippetKey(value) {
    const compact = String(value || '').trim().replace(/\s+/g, '');
    if (!compact) return '';
    return `${compact.startsWith('/') ? '' : '/'}${compact}`.toLowerCase();
  }

  function expandTextValue(value, cursor, dictionary = snippets) {
    if (typeof value !== 'string' || !Number.isInteger(cursor) || cursor < 0) return null;
    const before = value.slice(0, cursor);
    const match = before.match(/(\/[^\s/]+)(\s)$/u);
    if (!match) return null;
    const trigger = normalizeSnippetKey(match[1]);
    const expansion = dictionary[trigger];
    if (typeof expansion !== 'string' || !expansion) return null;
    const start = cursor - match[0].length;
    const inserted = `${expansion}${match[2]}`;
    return {
      value: `${value.slice(0, start)}${inserted}${value.slice(cursor)}`,
      cursor: start + inserted.length,
      trigger,
    };
  }

  function setNativeValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(element, value);
    else element.value = value;
  }

  function expandFormControl(element) {
    if (element.disabled || element.readOnly) return false;
    if (element instanceof HTMLInputElement && !TEXT_INPUT_TYPES.has((element.type || '').toLowerCase())) return false;
    const cursor = element.selectionStart;
    if (cursor == null) return false;
    const result = expandTextValue(element.value, cursor);
    if (!result) return false;
    setNativeValue(element, result.value);
    element.setSelectionRange(result.cursor, result.cursor);
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: snippets[result.trigger] }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function expandContentEditable(element) {
    if (!element.isContentEditable) return false;
    const selection = element.ownerDocument.defaultView?.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    if (!element.contains(range.startContainer) || range.startContainer.nodeType !== Node.TEXT_NODE) return false;
    const node = range.startContainer;
    const result = expandTextValue(node.textContent || '', range.startOffset);
    if (!result) return false;
    node.textContent = result.value;
    const nextRange = element.ownerDocument.createRange();
    nextRange.setStart(node, Math.min(result.cursor, node.textContent.length));
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: snippets[result.trigger] }));
    return true;
  }

  function handleInput(event) {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      expandFormControl(target);
      return;
    }
    if (target instanceof HTMLElement) {
      const editable = target.isContentEditable ? target : target.closest('[contenteditable="true"]');
      if (editable instanceof HTMLElement) expandContentEditable(editable);
    }
  }

  function loadSnippets() {
    if (!globalThis.chrome?.storage?.sync?.get) return;
    chrome.storage.sync.get(STORAGE_KEY, (stored) => {
      const value = stored?.[STORAGE_KEY];
      if (value && typeof value === 'object' && Object.keys(value).length) {
        snippets = value;
      } else {
        chrome.storage.sync.set({ [STORAGE_KEY]: snippets });
      }
    });
  }

  function handleStorageChange(changes, areaName) {
    if (areaName !== 'sync' || !changes?.[STORAGE_KEY]) return;
    const value = changes[STORAGE_KEY].newValue;
    snippets = value && typeof value === 'object' ? value : { ...DEFAULT_SNIPPETS };
  }

  document.addEventListener('input', handleInput, true);
  globalThis.chrome?.storage?.onChanged?.addListener(handleStorageChange);
  loadSnippets();

  window.__siagesTextExpander = {
    DEFAULT_SNIPPETS,
    STORAGE_KEY,
    normalizeSnippetKey,
    expandTextValue,
    expandFormControl,
    expandContentEditable,
    getSnippets: () => ({ ...snippets }),
    setSnippetsForTest: (value) => { snippets = { ...value }; },
  };
})();
