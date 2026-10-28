(function () {
  if (window.__siagesSiafiFavorecidos?.MESSAGE_VERSION === 4) return;
  window.__siagesSiafiFavorecidosLoaded = true;

  const MESSAGE_SOURCE = 'siages';
  const MESSAGE_TYPE = 'siafi:fill-favorecidos';
  // Listeners anteriores podem continuar na aba aberta; ignoram mensagens v4.
  const MESSAGE_VERSION = 4;
  const MAX_RECORDS_PER_BATCH = 10;
  const DEFAULT_TIMEOUT = 10000;
  // Menu que não abre nem mostra carregamento falha rápido; enquanto o SIAFI
  // consulta chaves Pix e domicílios (spinner/Carregando...), a espera é maior.
  const PIX_MENU_TIMEOUT = 4000;
  const PIX_LOADING_TIMEOUT = 20000;
  const ROW_SELECTOR = 'tbody tr';
  let filling = false;

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeCpf(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function parseCurrency(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    const raw = cleanText(value).replace(/^R\$\s*/i, '').replace(/\s/g, '');
    if (!raw) return NaN;
    const comma = raw.lastIndexOf(',');
    const dot = raw.lastIndexOf('.');
    const normalized = comma >= 0 && (dot < 0 || comma > dot)
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function formatCurrency(value) {
    return (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2).replace('.', ',');
  }

  function validateRecords(records) {
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('A lista selecionada não possui favorecidos.');
    }

    const normalized = [];
    const invalid = [];
    const seen = new Set();

    records.forEach((record, index) => {
      const cpf = normalizeCpf(record?.cpf);
      const valor = parseCurrency(record?.valor);
      if (cpf.length !== 11 || !Number.isFinite(valor) || valor <= 0 || seen.has(cpf)) {
        invalid.push(index + 1);
        return;
      }
      normalized.push({ cpf, valor });
      seen.add(cpf);
    });

    if (invalid.length) {
      throw new Error(`Registros inválidos nas posições: ${invalid.join(', ')}. Corrija o CPF, o valor e eventuais CPFs duplicados antes de tentar novamente.`);
    }

    return normalized;
  }

  function findTableContainer() {
    const customTables = Array.from(document.querySelectorAll('cpr-table-itens-lista'));
    const customTable = customTables.find((element) => element.querySelector('table'));
    if (customTable) return customTable;

    return Array.from(document.querySelectorAll('table')).find((table) => {
      const headers = Array.from(table.querySelectorAll('thead th')).map((header) => cleanText(header.textContent).toLowerCase());
      return headers.some((header) => header.includes('favorecido')) && headers.some((header) => header.includes('valor'));
    }) || null;
  }

  function findTable(container) {
    return container?.matches('table') ? container : container?.querySelector('table');
  }

  function findCpfInput(row) {
    return row.querySelector('input[maxlength="14"]:not([disabled])');
  }

  function findValueInput(row) {
    return row.querySelector('input[siaficurrency]:not([disabled])');
  }

  function getRows(container) {
    const table = findTable(container);
    return table ? Array.from(table.querySelectorAll(ROW_SELECTOR)) : [];
  }

  function isBlankRow(row) {
    const cpfInput = findCpfInput(row);
    const valueInput = findValueInput(row);
    return Boolean(cpfInput && valueInput && !cleanText(cpfInput.value) && !cleanText(valueInput.value));
  }

  function findBlankRow(container) {
    return getRows(container).find(isBlankRow) || null;
  }

  function findIncludeButton(container) {
    return Array.from(container.querySelectorAll('button')).find((button) =>
      cleanText(button.textContent).toLowerCase().includes('incluir favorecido'),
    ) || null;
  }

  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, value);
    else input.value = value;

    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  async function setCurrencyValue(input, value) {
    // SiafiCurrencyDirective.handleInput só atualiza o modelo no Chrome Android.
    // No desktop, handlePaste agenda updateFieldValue + onModelChange em 1 ms.
    // Alterar .value e emitir input/change/blur apenas muda o texto visível.
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, formatCurrency(value));
    else input.value = formatCurrency(value);
    input.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true, composed: true }));
    // Deixa a máscara atualizar o modelo e o Angular processar a mudança antes do blur/Confirmar.
    await wait(1);
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    input.blur();
    if (!input.isConnected || input.disabled || input.readOnly || !sameAmount(input.value, value)) {
      throw new Error('O SIAFI não manteve o valor após a colagem na máscara. A linha não foi confirmada.');
    }
  }

  function waitFor(predicate, timeout = DEFAULT_TIMEOUT) {
    return new Promise((resolve, reject) => {
      let observer, timer, poll;
      const finish = (result, error) => {
        observer?.disconnect();
        window.clearTimeout(timer);
        window.clearInterval(poll);
        if (error) reject(error); else resolve(result);
      };
      const check = () => {
        try { const result = predicate(); if (result) finish(result); }
        catch (error) { finish(null, error); }
      };
      observer = new MutationObserver(check);
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
      timer = window.setTimeout(() => finish(null), timeout);
      // Reserva para alterações apenas em propriedades, sem mutação de HTML.
      poll = window.setInterval(check, 100);
      check();
    });
  }

  async function ensureBlankRow(container) {
    const existing = findBlankRow(container);
    if (existing) return existing;

    const includeButton = findIncludeButton(container);
    if (!includeButton || includeButton.disabled) {
      throw new Error('Não encontrei o botão habilitado “Incluir Favorecido” no SIAFI.');
    }

    includeButton.click();
    const row = await waitFor(() => findBlankRow(container));
    if (!row) throw new Error('O SIAFI não criou uma nova linha de favorecido a tempo.');
    return row;
  }

  function columnIndex(container, label) {
    return Array.from(findTable(container)?.querySelectorAll('thead th') || [])
      .findIndex((header) => cleanText(header.textContent).toLowerCase().includes(label));
  }

  function rowCpf(row, container) {
    const input = findCpfInput(row);
    return normalizeCpf(input ? input.value : row.cells[columnIndex(container, 'favorecido')]?.textContent);
  }

  function matchingRow(container, cpf) {
    const rows = getRows(container).filter((row) => rowCpf(row, container) === cpf);
    if (rows.length > 1) throw new Error('Há mais de uma linha para o mesmo CPF. Revise a tabela antes de continuar.');
    return rows[0] || null;
  }

  function selectedPix(dropdown) {
    return cleanText(dropdown?.querySelector('.ui-dropdown-label')?.textContent
      || dropdown?.querySelector('[role="listbox"]')?.getAttribute('aria-label'));
  }

  function isPix(text) {
    return /^Chave\s*:\s*\S/i.test(cleanText(text));
  }

  function visible(element) {
    if (!element || element.closest('[hidden], [aria-hidden="true"]')) return false;
    for (let node = element; node instanceof Element; node = node.parentElement) {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  }

  async function selectPix(row) {
    // O seletor pertence à coluna Chave PIX/Domicílio Bancário desta linha.
    const dropdown = row.querySelector('p-dropdown');
    if (!dropdown) return 'Seletor de Pix não disponível';
    if (isPix(selectedPix(dropdown))) return null;
    const trigger = dropdown.querySelector('.ui-dropdown-trigger');
    if (!trigger || dropdown.querySelector('.ui-dropdown.ui-state-disabled')) return 'Seletor de Pix indisponível';
    const previousPanels = new Set(Array.from(document.querySelectorAll('.ui-dropdown-panel')).filter(visible));
    // carregarDomicilios é ligado a onFocus. Com o popup em foco, focus()
    // pode mudar activeElement sem entregar o evento à página do SIAFI.
    // Observe a entrega, não apenas activeElement, e evite consultas duplicadas.
    const focusInput = dropdown.querySelector('input[role="listbox"]');
    let focusDelivered = false;
    const onFocus = () => { focusDelivered = true; };
    focusInput?.addEventListener('focus', onFocus);
    try {
      if (focusInput) {
        if (document.activeElement === focusInput) focusInput.blur();
        focusInput.focus();
      }
      if (!dropdown.querySelector('[aria-expanded="true"]')) trigger.click();
      if (focusInput && !focusDelivered) {
        focusInput.dispatchEvent(new FocusEvent('focus', { composed: true }));
      }
    } finally {
      focusInput?.removeEventListener('focus', onFocus);
    }
    try {
      const findPanel = () => {
        const local = dropdown.querySelector('.ui-dropdown-panel');
        if (visible(local)) return local;
        const added = Array.from(document.querySelectorAll('.ui-dropdown-panel'))
          .filter((element) => visible(element) && !previousPanels.has(element));
        return added.length === 1 ? added[0] : null;
      };
      const loading = () => Boolean(dropdown.querySelector('.pi-spinner, .pi-spin'))
        || /^Carregando/i.test(selectedPix(dropdown));
      const loadedOptions = () => {
        // O Angular pode substituir o painel vazio após receber as chaves.
        // Nunca mantenha a referência do painel anterior durante a espera.
        const panel = findPanel();
        if (!panel || loading()) return null;
        const items = Array.from(panel.querySelectorAll('[role="option"], li.ui-dropdown-item'));
        return items.length ? items : null;
      };
      let options = await waitFor(() => loadedOptions() || (loading() && 'loading'), PIX_MENU_TIMEOUT);
      if (options === 'loading') {
        if (!await waitFor(() => !loading(), PIX_LOADING_TIMEOUT)) {
          throw new Error(`O SIAFI ficou mais de ${PIX_LOADING_TIMEOUT / 1000} segundos carregando as chaves Pix. O lote foi interrompido nesta linha, sem avançar. Aguarde o fim do carregamento e use “Concluir linhas abertas” para retomar.`);
        }
        options = await waitFor(loadedOptions, PIX_MENU_TIMEOUT);
      }
      if (!options) throw new Error(`O menu Pix não carregou em ${PIX_MENU_TIMEOUT / 1000} segundos. O lote foi interrompido nesta linha, sem avançar. Abra o seletor e use “Concluir linhas abertas” para retomar.`);
      const pix = options.filter((option) => visible(option) && isPix(option.textContent)
        && option.getAttribute('aria-disabled') !== 'true' && !option.classList.contains('ui-state-disabled'));
      if (pix.length !== 1) return pix.length ? 'Mais de uma chave Pix: selecione a desejada' : 'Sem Pix cadastrado';
      const label = cleanText(pix[0].textContent);
      pix[0].click();
      if (!await waitFor(() => selectedPix(row.querySelector('p-dropdown')) === label)) {
        throw new Error('O SIAFI não manteve a seleção da chave Pix.');
      }
      return null;
    } finally {
      if (dropdown.querySelector('[aria-expanded="true"]')) trigger.click();
    }
  }

  function sameAmount(value, expected) {
    const parsed = parseCurrency(value);
    return Number.isFinite(parsed) && Math.round(parsed * 100) === Math.round(expected * 100);
  }

  function confirmedRow(container, record) {
    const row = matchingRow(container, record.cpf);
    return row && !findCpfInput(row) && !findValueInput(row)
      && sameAmount(row.cells[columnIndex(container, 'valor')]?.textContent, record.valor);
  }

  async function fillSiafiBeneficiaries(records, mode = 'fill') {
    if (filling) throw new Error('Já existe um preenchimento em andamento nesta aba.');
    const normalizedRecords = validateRecords(records);
    if (mode !== 'fill' && mode !== 'resume') throw new Error('Modo de preenchimento inválido.');
    if (mode === 'fill' && normalizedRecords.length > MAX_RECORDS_PER_BATCH) {
      throw new Error(`O SIAFI aceita no máximo ${MAX_RECORDS_PER_BATCH} favorecidos por vez. Divida a lista em blocos antes de tentar novamente.`);
    }
    const container = findTableContainer();
    if (!container) {
      throw new Error('Não encontrei a tabela de favorecidos. Abra a transação de inclusão no SIAFI e tente novamente.');
    }

    // Concluir usa apenas CPFs visíveis e editáveis presentes na lista escolhida.
    const work = mode === 'resume' ? normalizedRecords.filter((record) => {
      const row = matchingRow(container, record.cpf);
      return row && findCpfInput(row) && findValueInput(row);
    }) : normalizedRecords;
    if (!work.length) throw new Error('Nenhuma linha aberta desta página corresponde à lista selecionada.');
    if (work.length > MAX_RECORDS_PER_BATCH) throw new Error('Conclua no máximo 10 favorecidos por vez.');
    const result = { ok: true, matched: true, inserted: 0, processed: 0, confirmed: 0, pending: [] };
    filling = true;
    try {
      for (const record of work) {
        if (confirmedRow(container, record)) {
          result.processed += 1;
          result.confirmed += 1;
          continue;
        }
        const existing = matchingRow(container, record.cpf);
        if (existing && (!findCpfInput(existing) || !findValueInput(existing))) {
          throw new Error('O CPF já está na tabela com outro valor ou sem campos editáveis. Revise a linha.');
        }
        const row = existing || await ensureBlankRow(container);
        const cpfInput = findCpfInput(row);
        const valueInput = findValueInput(row);
        if (!cpfInput || !valueInput) {
          throw new Error('A linha não possui os campos de CPF e valor esperados.');
        }

        if (!existing) {
          setInputValue(cpfInput, record.cpf);
          if (!await waitFor(() => {
            const nameColumn = columnIndex(container, 'nome');
            return row.querySelector('p-dropdown') && (nameColumn < 0 || cleanText(row.cells[nameColumn]?.textContent));
          })) {
            throw new Error('O SIAFI não carregou o credor e seu seletor de Pix a tempo.');
          }
        }
        await setCurrencyValue(valueInput, record.valor);

        if (normalizeCpf(cpfInput.value) !== record.cpf || !sameAmount(valueInput.value, record.valor)) {
          throw new Error('O SIAFI alterou o CPF ou o valor informado. A linha não foi confirmada.');
        }
        const pending = await selectPix(row);
        if (pending) {
          result.pending.push({ position: result.processed + 1, reason: pending });
        } else {
          const button = row.querySelector('button[ptooltip="Confirmar"]');
          if (!button || button.disabled || !visible(button)) throw new Error('O botão Confirmar da linha não está disponível.');
          if (normalizeCpf(findCpfInput(row)?.value) !== record.cpf
            || !sameAmount(findValueInput(row)?.value, record.valor)
            || !isPix(selectedPix(row.querySelector('p-dropdown')))) {
            throw new Error('A linha mudou durante o preenchimento. Revise antes de confirmar.');
          }
          button.click();
          if (!await waitFor(() => confirmedRow(container, record))) {
            throw new Error('Não foi possível verificar a confirmação da linha. Confira as mensagens do SIAFI antes de tentar novamente.');
          }
          result.confirmed += 1;
        }
        result.inserted += 1;
        result.processed += 1;
      }
      return result;
    } catch (error) {
      error.progress = result;
      throw error;
    } finally {
      filling = false;
    }
  }

  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.source !== MESSAGE_SOURCE || message?.type !== MESSAGE_TYPE || message?.version !== MESSAGE_VERSION) {
        return undefined;
      }

      void fillSiafiBeneficiaries(message.records, message.mode)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({
          matched: true, inserted: 0, processed: 0, confirmed: 0, pending: [],
          ...error.progress,
          ok: false,
          error: error instanceof Error ? error.message : 'Não foi possível preencher os favorecidos no SIAFI.',
        }));
      return true;
    });
  }

  window.__siagesSiafiFavorecidos = {
    MESSAGE_SOURCE,
    MESSAGE_TYPE,
    MESSAGE_VERSION,
    MAX_RECORDS_PER_BATCH,
    cleanText,
    normalizeCpf,
    parseCurrency,
    formatCurrency,
    validateRecords,
    findTableContainer,
    fillSiafiBeneficiaries,
  };
})();
