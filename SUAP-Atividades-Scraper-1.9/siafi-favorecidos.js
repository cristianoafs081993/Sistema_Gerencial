(function () {
  if (window.__siagesSiafiFavorecidosLoaded) return;
  window.__siagesSiafiFavorecidosLoaded = true;

  const MESSAGE_SOURCE = 'siages';
  const MESSAGE_TYPE = 'siafi:fill-favorecidos';
  const MESSAGE_VERSION = 1;
  const MAX_RECORDS_PER_BATCH = 10;
  const DEFAULT_TIMEOUT = 10000;
  const ROW_SELECTOR = 'tbody tr';

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
    return String(Math.round((value + Number.EPSILON) * 100));
  }

  function validateRecords(records) {
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('A lista selecionada não possui favorecidos.');
    }

    const normalized = [];
    const invalid = [];

    records.forEach((record, index) => {
      const cpf = normalizeCpf(record?.cpf);
      const valor = parseCurrency(record?.valor);
      if (cpf.length !== 11 || !Number.isFinite(valor) || valor <= 0) {
        invalid.push(index + 1);
        return;
      }
      normalized.push({ cpf, valor });
    });

    if (invalid.length) {
      throw new Error(`Registros inválidos nas posições: ${invalid.join(', ')}. Corrija o CPF e o valor antes de tentar novamente.`);
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

  async function waitFor(predicate, timeout = DEFAULT_TIMEOUT) {
    const startedAt = Date.now();
    while (Date.now() - startedAt <= timeout) {
      const result = predicate();
      if (result) return result;
      await wait(100);
    }
    return null;
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

  async function fillSiafiBeneficiaries(records) {
    const normalizedRecords = validateRecords(records);
    if (normalizedRecords.length > MAX_RECORDS_PER_BATCH) {
      throw new Error(`O SIAFI aceita no máximo ${MAX_RECORDS_PER_BATCH} favorecidos por vez. Divida a lista em blocos antes de tentar novamente.`);
    }
    const container = findTableContainer();
    if (!container) {
      throw new Error('Não encontrei a tabela de favorecidos. Abra a transação de inclusão no SIAFI e tente novamente.');
    }

    let inserted = 0;
    for (const record of normalizedRecords) {
      const row = await ensureBlankRow(container);
      const cpfInput = findCpfInput(row);
      const valueInput = findValueInput(row);
      if (!cpfInput || !valueInput) {
        throw new Error(`A linha ${inserted + 1} não possui os campos de CPF e valor esperados.`);
      }

      setInputValue(cpfInput, record.cpf);
      setInputValue(valueInput, formatCurrency(record.valor));

      if (normalizeCpf(cpfInput.value) !== record.cpf || cleanText(valueInput.value) !== formatCurrency(record.valor)) {
        throw new Error(`Não foi possível confirmar o preenchimento da linha ${inserted + 1}.`);
      }

      inserted += 1;
      await wait(50);
    }

    return { ok: true, matched: true, inserted };
  }

  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.source !== MESSAGE_SOURCE || message?.type !== MESSAGE_TYPE || message?.version !== MESSAGE_VERSION) {
        return undefined;
      }

      void fillSiafiBeneficiaries(message.records)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({
          ok: false,
          matched: true,
          inserted: 0,
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
