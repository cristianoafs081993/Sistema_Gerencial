/**
 * Suape - Menu de Colagem Inteligente de Processos (Alt + V)
 * 
 * Permite escolher e colar dados extraídos de processos abertos no SUAP
 * com suporte a múltiplos processos simultâneos (Processo 1, depois Processo 2...)
 * e filtro estrito (apenas campos com dados válidos identificados).
 */
(function () {
  if (window.__suapeProcessPastePickerLoaded) return;
  window.__suapeProcessPastePickerLoaded = true;

  const OVERLAY_ID = 'suape-paste-overlay';
  const MODAL_ID = 'suape-paste-modal';
  const STORAGE_ACTIVE_KEY = 'suape_active_processes';
  const STORAGE_RECENT_KEY = 'suape_recent_processes';

  let overlayEl = null;
  let searchInputEl = null;
  let listContainerEl = null;
  let activeInputElement = null;
  let activeSelectionStart = null;
  let activeSelectionEnd = null;

  let currentProcesses = [];
  let flatItems = [];
  let selectedIndex = 0;
  let filterQuery = '';

  function cleanText(val) {
    if (val == null) return '';
    return String(val).replace(/\s+/g, ' ').trim();
  }

  function isValidValue(val) {
    if (val == null) return false;
    const clean = cleanText(val);
    return clean !== '' &&
      clean !== '-' &&
      clean !== 'null' &&
      clean !== 'undefined' &&
      clean !== 'NaN' &&
      clean !== '[object Object]';
  }

  function isMonospaceCategory(category, label) {
    const l = (label || '').toLowerCase();
    const c = (category || '').toLowerCase();
    return c === 'identificacao' ||
      c === 'bancario' ||
      c === 'empenhos' ||
      l.includes('processo') ||
      l.includes('cpf') ||
      l.includes('cnpj') ||
      l.includes('suap') ||
      l.includes('id') ||
      l.includes('chave') ||
      l.includes('ns') ||
      l.includes('agência') ||
      l.includes('agencia') ||
      l.includes('conta') ||
      l.includes('empenho') ||
      l.includes('nota fiscal') ||
      l.includes('contrato');
  }

  /**
   * Extrai apenas os campos válidos e preenchidos de um processo
   */
  function extractIdentifiedFields(processData) {
    if (!processData) return [];
    const fields = [];
    const seen = new Set();

    const add = (id, label, value, category) => {
      if (!isValidValue(value)) return;
      const clean = cleanText(value);
      const dedupeKey = `${label}:${clean}`.toLowerCase();
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);

      fields.push({
        id,
        label,
        value: clean,
        category: category || 'Geral',
        mono: isMonospaceCategory(category, label),
      });
    };

    const p = processData.process || processData;
    const full = p.dadosCompletos || {};
    const bank = full.dados_bancarios || {};
    const taxes = full.retencoes_tributarias || {};
    const workflow = full.workflow || {};

    // 1. Identificação básica
    add('num_processo', 'Processo', p.numProcesso || processData.processNumber, 'Identificação');
    add('suap_id', 'SUAP ID', p.suapId || processData.suapId, 'Identificação');
    add('caixa', 'Caixa', p.caixa, 'Identificação');

    // 2. Beneficiário / Favorecido
    add('beneficiario', 'Beneficiário / Nome', p.beneficiario, 'Beneficiário');
    add('cpf_cnpj', 'CPF / CNPJ', p.cpfCnpj, 'Beneficiário');
    add('assunto', 'Assunto', p.assunto, 'Beneficiário');

    // 3. Documento e pagamento
    add('valor_total', 'Valor Total', full.val_nf || p.valor, 'Pagamento');
    add('ns_numero', 'Número da NS', workflow.nsNumero || full.ns_numero, 'Pagamento');
    add('contrato', 'Contrato', p.contrato || full.contrato_numero, 'Pagamento');

    // Notas Fiscais
    const invoices = (Array.isArray(full.notas_fiscais) ? full.notas_fiscais : [])
      .filter((inv) => inv && typeof inv === 'object' && (isValidValue(inv.numero) || isValidValue(inv.data_emissao) || isValidValue(inv.valor)));
    const hasMultipleInvoices = invoices.length > 1;
    invoices.forEach((inv, i) => {
      const suffix = hasMultipleInvoices ? ` ${i + 1}` : '';
      add(`nf_num_${i + 1}`, `Nota Fiscal${suffix}`, inv.numero, 'Nota Fiscal');
      add(`nf_data_${i + 1}`, `Emissão NF${suffix}`, inv.data_emissao, 'Nota Fiscal');
      add(`nf_valor_${i + 1}`, `Valor NF${suffix}`, inv.valor, 'Nota Fiscal');
      add(`nf_chave_${i + 1}`, `Chave NF${suffix}`, inv.chave_acesso, 'Nota Fiscal');
    });

    // 4. Dados bancários
    add('banco', 'Banco', bank.banco, 'Bancário');
    add('agencia', 'Agência', bank.agencia, 'Bancário');
    add('conta', 'Conta', bank.conta, 'Bancário');
    add('chave_pix', 'Chave PIX', bank.chave_pix || bank.pix, 'Bancário');
    add('tipo_chave_pix', 'Tipo Chave PIX', bank.tipo_chave_pix, 'Bancário');

    // 5. Empenhos
    const rawEmpenhos = full.empenhos;
    const empenhosList = [];
    if (Array.isArray(rawEmpenhos)) {
      rawEmpenhos.forEach((item) => {
        if (typeof item === 'string' && isValidValue(item)) empenhosList.push(cleanText(item));
        else if (item && typeof item === 'object') {
          const num = item.numero || item.numero_empenho || item.empenho || item.ne;
          if (isValidValue(num)) empenhosList.push(cleanText(num));
        }
      });
    } else if (typeof rawEmpenhos === 'string' && isValidValue(rawEmpenhos)) {
      const matches = rawEmpenhos.match(/\d{4}\s*NE\s*\d{6}/gi);
      if (matches) matches.forEach((m) => empenhosList.push(cleanText(m)));
      else empenhosList.push(cleanText(rawEmpenhos));
    }
    const uniqueEmpenhos = Array.from(new Set(empenhosList));
    uniqueEmpenhos.forEach((emp, i) => {
      add(`empenho_${i + 1}`, `Empenho ${i + 1}`, emp, 'Empenhos');
    });
    if (uniqueEmpenhos.length > 1) {
      add('empenhos_todos', 'Todos os Empenhos', uniqueEmpenhos.join(', '), 'Empenhos');
    }

    // 6. Retenções tributárias
    if (taxes.optante_simples_nacional) {
      add('simples_nacional', 'Regime Tributário', 'Optante pelo Simples Nacional', 'Tributos');
    }
    add('ret_iss', 'ISS', taxes.iss, 'Tributos');
    add('ret_inss', 'INSS', taxes.inss, 'Tributos');
    add('ret_ir', 'IR', taxes.ir, 'Tributos');
    add('ret_csll', 'CSLL', taxes.csll, 'Tributos');
    add('ret_cofins', 'COFINS', taxes.cofins, 'Tributos');
    add('ret_pis', 'PIS/PASEP', taxes.pis_pasep, 'Tributos');

    // 7. Conclusão / Despacho
    if (workflow.concluido) {
      add('workflow_ns', 'NS Registrada', workflow.nsNumero || full.ns_numero, 'Conclusão');
      add('workflow_concluido_em', 'Concluído em', workflow.concluidoEm, 'Conclusão');
      add('workflow_concluido_por', 'Concluído por', workflow.concluidoPor, 'Conclusão');
      add('workflow_resumo', 'Resumo Análise', workflow.analiseLiquidacao?.resumo, 'Conclusão');
    }

    // Se houver campos pré-extraídos no registro do processo
    if (Array.isArray(processData.fields)) {
      processData.fields.forEach((f) => {
        if (f && isValidValue(f.value)) {
          add(f.id || f.label, f.label, f.value, f.category);
        }
      });
    }

    return fields;
  }

  /**
   * Obtém os processos abertos no SUAP
   */
  async function fetchActiveProcesses() {
    return new Promise((resolve) => {
      let resolved = false;
      const onDone = (list) => {
        if (resolved) return;
        resolved = true;
        // Se estivermos em uma página de processo no SUAP, garante que o processo da página atual está presente
        const inPage = getInPageFallbackProcess();
        if (inPage.length > 0) {
          const pageProc = inPage[0];
          const exists = list.some((p) => p.suapId === pageProc.suapId || (p.processNumber && p.processNumber === pageProc.processNumber));
          if (!exists) {
            list.unshift(pageProc);
          } else {
            // Enriquece o processo existente com campos do DOM se faltavam
            const target = list.find((p) => p.suapId === pageProc.suapId || (p.processNumber && p.processNumber === pageProc.processNumber));
            if (target && pageProc.fields && pageProc.fields.length > 0) {
              target.fields = target.fields || [];
              pageProc.fields.forEach((f) => {
                if (!target.fields.some((tf) => tf.label === f.label)) target.fields.push(f);
              });
            }
          }
        }
        resolve(list);
      };

      if (!globalThis.chrome?.runtime?.sendMessage) {
        return void getLocalFallbackProcesses().then(onDone);
      }

      const timeout = setTimeout(() => {
        void getLocalFallbackProcesses().then(onDone);
      }, 800);

      try {
        chrome.runtime.sendMessage(
          { source: 'suape-process-registry', type: 'get-active-processes' },
          (response) => {
            clearTimeout(timeout);
            if (response?.ok && Array.isArray(response.processes) && response.processes.length > 0) {
              onDone(response.processes);
            } else {
              void getLocalFallbackProcesses().then(onDone);
            }
          }
        );
      } catch {
        clearTimeout(timeout);
        void getLocalFallbackProcesses().then(onDone);
      }
    });
  }

  async function getLocalFallbackProcesses() {
    return new Promise((resolve) => {
      const storage = globalThis.chrome?.storage?.local;
      const inPage = getInPageFallbackProcess();

      if (!storage?.get) {
        return resolve(inPage);
      }

      storage.get(null, (allStored) => {
        const activeMap = allStored?.[STORAGE_ACTIVE_KEY] || {};
        const recentList = allStored?.[STORAGE_RECENT_KEY] || [];
        const processList = Object.values(activeMap);

        // Busca também em siages-process-state:*
        for (const [key, val] of Object.entries(allStored || {})) {
          if (key.startsWith('siages-process-state:') && val && typeof val === 'object') {
            const suapId = val.suapId;
            const proc = val.snapshot?.process;
            const fallback = val.snapshot?.fallback;
            const procNum = proc?.numProcesso || fallback?.processNumber;

            const existing = processList.find((p) => p.suapId === suapId);
            if (existing) {
              if (!existing.process && proc) existing.process = proc;
            } else if (suapId || procNum) {
              processList.push({
                suapId: suapId || '',
                processNumber: procNum || `Processo #${suapId}`,
                process: proc || null,
                fields: [],
                updatedAt: Date.now() - 5000,
                activeAt: Date.now() - 5000,
              });
            }
          }
        }

        if (processList.length > 0) {
          processList.sort((a, b) => (b.activeAt || b.updatedAt || 0) - (a.activeAt || a.updatedAt || 0));
          return resolve(processList);
        }

        if (Array.isArray(recentList) && recentList.length > 0) {
          return resolve(recentList);
        }

        resolve(inPage);
      });
    });
  }

  function getInPageFallbackProcess() {
    // Se estiver em uma página do SUAP com processo aberto
    const numProcessoMatch = document.body?.innerText?.match(/\b\d{5}\.\d{6}(?:[./])\d{4}-\d{2}\b/);
    const numProcesso = numProcessoMatch ? numProcessoMatch[0] : '';
    const suapIdMatch = location.pathname.match(/\/processo_eletronico\/(?:processo|visualizar_processo)\/(\d+)\/?/);
    const suapId = suapIdMatch ? suapIdMatch[1] : '';

    if (!numProcesso && !suapId) return [];

    const fields = [];
    const addField = (label, val, cat = 'Processo') => {
      if (isValidValue(val) && !fields.some((f) => f.label === label)) {
        fields.push({ label, value: cleanText(val), category: cat });
      }
    };

    if (numProcesso) addField('Processo', numProcesso, 'Identificação');
    if (suapId) addField('SUAP ID', suapId, 'Identificação');

    // 1. Lê linhas renderizadas pelo toolkit lateral .suape-data-row
    document.querySelectorAll('.suape-data-row').forEach((row) => {
      const label = cleanText(row.firstElementChild?.textContent);
      const val = cleanText(row.querySelector('.suape-data-value')?.textContent);
      if (label && isValidValue(val)) {
        addField(label, val, 'Processo');
      }
    });

    // 2. Lê de sessionStorage se houver estado persistido pela extensão
    if (globalThis.sessionStorage) {
      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith('siages-process-state:')) {
            const raw = sessionStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed?.snapshot?.process) {
                return [{
                  suapId: parsed.suapId || suapId,
                  processNumber: parsed.snapshot.process.numProcesso || numProcesso,
                  process: parsed.snapshot.process,
                  fields,
                }];
              }
            }
          }
        }
      } catch {
        // Ignora
      }
    }

    // 3. Lê textos da página nativa do SUAP procurando Interessado, CPF/CNPJ, Assunto
    const elements = document.querySelectorAll('tr, dl, .field, .form-row, p, div');
    elements.forEach((el) => {
      const text = cleanText(el.textContent);
      if (!text || text.length > 300) return;

      if (/(?:interessad[oa]s?|favorecid[oa]|fornecedor)\s*[:：]\s*([^\n\r]+)/i.test(text)) {
        const m = text.match(/(?:interessad[oa]s?|favorecid[oa]|fornecedor)\s*[:：]\s*([^\n\r]+)/i);
        const val = cleanText(m?.[1]).replace(/\s*(?:tipo|setor|data|assunto|status|cpf|cnpj).*$/i, '');
        if (val && val.length > 2 && val.length < 120) addField('Beneficiário / Nome', val, 'Beneficiário');
      }

      const cpfMatch = text.match(/(?:cpf|cnpj)\s*[:：]?\s*(\d{2,3}\.?\d{3}\.?\d{3}(?:[/-]\d{2,4})?-\d{2})/i) ||
                       text.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
      if (cpfMatch) {
        addField('CPF / CNPJ', cpfMatch[1] || cpfMatch[0], 'Beneficiário');
      }

      if (/assunto\s*[:：]\s*([^\n\r]+)/i.test(text)) {
        const m = text.match(/assunto\s*[:：]\s*([^\n\r]+)/i);
        const val = cleanText(m?.[1]).replace(/\s*(?:interessado|setor|data|status|tipo).*$/i, '');
        if (val && val.length > 3 && val.length < 250) addField('Assunto', val, 'Beneficiário');
      }

      if (/caixa\s*[:：]\s*([^\n\r]+)/i.test(text)) {
        const m = text.match(/caixa\s*[:：]\s*([^\n\r]+)/i);
        if (m?.[1]) addField('Caixa', cleanText(m[1]).substring(0, 60), 'Identificação');
      }
    });

    return [{
      suapId: suapId || 'SUAP',
      processNumber: numProcesso || (suapId ? `Processo #${suapId}` : 'Processo Atual'),
      process: {
        numProcesso,
        suapId,
      },
      fields,
    }];
  }

  /**
   * Insere o texto no campo de formulário ou contenteditable
   */
  function pasteValueIntoActiveField(text) {
    const el = activeInputElement;
    if (!el) return false;

    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.focus();
      const start = activeSelectionStart != null ? activeSelectionStart : (el.selectionStart ?? el.value.length);
      const end = activeSelectionEnd != null ? activeSelectionEnd : (el.selectionEnd ?? el.value.length);
      const current = el.value;
      const next = current.slice(0, start) + text + current.slice(end);

      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(el, next);
      else el.value = next;

      const newCursor = start + text.length;
      try {
        el.setSelectionRange(newCursor, newCursor);
      } catch {
        // Alguns tipos de input (ex: email/number) não suportam setSelectionRange
      }

      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    if (el.isContentEditable || el.closest?.('[contenteditable="true"]')) {
      const editable = el.isContentEditable ? el : el.closest('[contenteditable="true"]');
      editable.focus();
      try {
        document.execCommand('insertText', false, text);
        return true;
      } catch {
        // Fallback para inserção de nó de texto
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(text));
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Copia o texto para o clipboard
   */
  async function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fallback
      }
    }
    if (typeof document.execCommand === 'function') {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.pointerEvents = 'none';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      ta.remove();
      return ok;
    }
    return false;
  }

  function showToast(message) {
    const existing = document.querySelector('.suape-paste-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'suape-paste-toast';
    toast.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.25s, transform 0.25s';
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, 10px)';
      setTimeout(() => toast.remove(), 250);
    }, 2000);
  }

  /**
   * Seleciona e cola o item atual
   */
  async function chooseItem(item) {
    if (!item || !item.value) return;

    const pasted = pasteValueIntoActiveField(item.value);
    closePicker();
    await copyToClipboard(item.value);

    if (pasted) {
      showToast(`Colado: <strong>${escapeHtml(item.value)}</strong>`);
    } else {
      showToast(`Copiado para a área de transferência: <strong>${escapeHtml(item.value)}</strong>`);
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Renderiza a lista de grupos e itens de processos
   */
  function renderList() {
    if (!listContainerEl) return;
    listContainerEl.innerHTML = '';
    flatItems = [];

    const query = filterQuery.toLowerCase().trim();

    // Filtra processos e seus campos
    const processGroups = [];
    currentProcesses.forEach((proc, procIndex) => {
      const fields = extractIdentifiedFields(proc);
      const filteredFields = fields.filter((f) => {
        if (!query) return true;
        return f.label.toLowerCase().includes(query) ||
          f.value.toLowerCase().includes(query) ||
          f.category.toLowerCase().includes(query);
      });

      if (filteredFields.length > 0) {
        const procNumber = proc.processNumber || proc.process?.numProcesso || `Processo ${procIndex + 1}`;
        const suapId = proc.suapId || proc.process?.suapId || '';
        processGroups.push({
          processNumber: procNumber,
          suapId,
          fields: filteredFields,
          index: procIndex + 1,
        });
      }
    });

    if (processGroups.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'suape-paste-empty';
      if (currentProcesses.length === 0) {
        emptyEl.innerHTML = `
          <div class="suape-paste-empty-title">Nenhum processo identificado</div>
          <div class="suape-paste-empty-desc">Abra uma página de processo no SUAP para que os dados sejam detectados e disponibilizados automaticamente.</div>
        `;
      } else {
        emptyEl.innerHTML = `
          <div class="suape-paste-empty-title">Nenhum dado encontrado para "${escapeHtml(filterQuery)}"</div>
          <div class="suape-paste-empty-desc">Tente buscar por outro termo como número de processo, CPF, valor ou banco.</div>
        `;
      }
      listContainerEl.appendChild(emptyEl);
      updateFooterCount(0);
      return;
    }

    // Renderiza cada processo: "Primeiro todas as informações de um, depois do outro."
    processGroups.forEach((group) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'suape-paste-group';

      // Cabeçalho do processo
      const headerEl = document.createElement('div');
      headerEl.className = 'suape-paste-group-header';
      headerEl.innerHTML = `
        <div class="suape-paste-group-info">
          <span class="suape-paste-group-index">PROCESSO ${group.index}</span>
          <span class="suape-paste-group-title">${escapeHtml(group.processNumber)}</span>
          ${group.suapId ? `<span class="suape-paste-group-suapid">SUAP #${escapeHtml(group.suapId)}</span>` : ''}
        </div>
        <span class="suape-paste-group-status">${group.fields.length} itens identificados</span>
      `;
      groupEl.appendChild(headerEl);

      // Itens do processo
      group.fields.forEach((field) => {
        const itemIndex = flatItems.length;
        flatItems.push(field);

        const itemEl = document.createElement('div');
        itemEl.className = `suape-paste-item${itemIndex === selectedIndex ? ' suape-paste-selected' : ''}`;
        itemEl.dataset.index = String(itemIndex);

        itemEl.innerHTML = `
          <div class="suape-paste-item-content">
            <div class="suape-paste-item-label-wrap">
              <span class="suape-paste-item-label" title="${escapeHtml(field.label)}">${escapeHtml(field.label)}</span>
              <span class="suape-paste-item-category">${escapeHtml(field.category)}</span>
            </div>
            <div class="suape-paste-item-value-wrap">
              <span class="suape-paste-item-value${field.mono ? ' suape-paste-mono' : ''}" title="${escapeHtml(field.value)}">${escapeHtml(field.value)}</span>
            </div>
          </div>
          <div class="suape-paste-item-actions">
            <span class="suape-paste-enter-hint">Colar ↵</span>
            <button type="button" class="suape-paste-copy-only-btn" title="Copiar apenas (sem colar)" aria-label="Copiar apenas">⧉</button>
          </div>
        `;

        itemEl.addEventListener('click', (e) => {
          if (e.target.closest('.suape-paste-copy-only-btn')) {
            e.stopPropagation();
            void copyToClipboard(field.value);
            showToast(`Copiado: <strong>${escapeHtml(field.value)}</strong>`);
            return;
          }
          void chooseItem(field);
        });

        itemEl.addEventListener('mouseenter', () => {
          setSelectedIndex(itemIndex, false);
        });

        groupEl.appendChild(itemEl);
      });

      listContainerEl.appendChild(groupEl);
    });

    if (selectedIndex >= flatItems.length) {
      selectedIndex = Math.max(0, flatItems.length - 1);
    }
    updateSelectedHighlight();
    updateFooterCount(flatItems.length);
  }

  function setSelectedIndex(newIndex, scroll = true) {
    if (flatItems.length === 0) {
      selectedIndex = 0;
      return;
    }
    selectedIndex = Math.max(0, Math.min(newIndex, flatItems.length - 1));
    updateSelectedHighlight();

    if (scroll && listContainerEl) {
      const activeEl = listContainerEl.querySelector(`.suape-paste-item[data-index="${selectedIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function updateSelectedHighlight() {
    if (!listContainerEl) return;
    const items = listContainerEl.querySelectorAll('.suape-paste-item');
    items.forEach((el) => {
      const idx = Number(el.dataset.index);
      if (idx === selectedIndex) {
        el.classList.add('suape-paste-selected');
      } else {
        el.classList.remove('suape-paste-selected');
      }
    });
  }

  function updateFooterCount(count) {
    const countEl = overlayEl?.querySelector('.suape-paste-footer-count');
    if (countEl) {
      countEl.textContent = count === 1 ? '1 dado disponível' : `${count} dados disponíveis`;
    }
  }

  /**
   * Abre o modal flutuante de colagem rápida (Alt + V)
   */
  async function openPicker() {
    if (overlayEl) return;

    // Salva o elemento com foco atual para restaurar e inserir o texto
    activeInputElement = document.activeElement;
    if (activeInputElement instanceof HTMLInputElement || activeInputElement instanceof HTMLTextAreaElement) {
      activeSelectionStart = activeInputElement.selectionStart;
      activeSelectionEnd = activeInputElement.selectionEnd;
    } else {
      activeSelectionStart = null;
      activeSelectionEnd = null;
    }

    // Cria o overlay
    overlayEl = document.createElement('div');
    overlayEl.id = OVERLAY_ID;
    overlayEl.setAttribute('role', 'dialog');
    overlayEl.setAttribute('aria-modal', 'true');
    overlayEl.setAttribute('aria-label', 'Colar dados do processo');

    const modalEl = document.createElement('div');
    modalEl.id = MODAL_ID;

    // Header
    const headerEl = document.createElement('div');
    headerEl.className = 'suape-paste-header';
    headerEl.innerHTML = `
      <div class="suape-paste-header-title">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
        <span>Colar dados do processo</span>
        <span class="suape-paste-header-kbd">Alt + V</span>
      </div>
      <button type="button" class="suape-paste-close-btn" title="Fechar (Esc)" aria-label="Fechar">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    `;

    // Search input
    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'suape-paste-search-wrapper';
    searchWrapper.innerHTML = `
      <svg class="suape-paste-search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <input type="text" class="suape-paste-search-input" placeholder="Filtrar dados (ex: cnpj, valor, banco, empenho...)" autocomplete="off" spellcheck="false">
      <button type="button" class="suape-paste-search-clear" title="Limpar" hidden>✕</button>
    `;

    searchInputEl = searchWrapper.querySelector('.suape-paste-search-input');
    const searchClearBtn = searchWrapper.querySelector('.suape-paste-search-clear');

    searchInputEl.addEventListener('input', () => {
      filterQuery = searchInputEl.value;
      searchClearBtn.hidden = !filterQuery;
      selectedIndex = 0;
      renderList();
    });

    searchClearBtn.addEventListener('click', () => {
      searchInputEl.value = '';
      filterQuery = '';
      searchClearBtn.hidden = true;
      selectedIndex = 0;
      renderList();
      searchInputEl.focus();
    });

    // List container
    listContainerEl = document.createElement('div');
    listContainerEl.className = 'suape-paste-list';

    // Footer
    const footerEl = document.createElement('div');
    footerEl.className = 'suape-paste-footer';
    footerEl.innerHTML = `
      <div class="suape-paste-footer-shortcuts">
        <span><kbd>↑</kbd> <kbd>↓</kbd> navegar</span>
        <span><kbd>Enter</kbd> colar e copiar</span>
        <span><kbd>Esc</kbd> fechar</span>
      </div>
      <span class="suape-paste-footer-count">Carregando...</span>
    `;

    // Eventos do modal
    headerEl.querySelector('.suape-paste-close-btn').addEventListener('click', closePicker);
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) closePicker();
    });

    modalEl.append(headerEl, searchWrapper, listContainerEl, footerEl);
    overlayEl.appendChild(modalEl);
    document.body.appendChild(overlayEl);

    // Carrega os processos
    currentProcesses = await fetchActiveProcesses();
    selectedIndex = 0;
    filterQuery = '';
    renderList();

    // Foco imediato no campo de busca
    setTimeout(() => {
      searchInputEl?.focus();
    }, 20);
  }

  function closePicker() {
    if (!overlayEl) return;
    overlayEl.remove();
    overlayEl = null;
    searchInputEl = null;
    listContainerEl = null;

    // Restaura o foco no elemento anterior
    if (activeInputElement && typeof activeInputElement.focus === 'function') {
      try {
        activeInputElement.focus();
      } catch {
        // Elemento pode ter sido removido
      }
    }
  }

  function togglePicker() {
    if (overlayEl) closePicker();
    else void openPicker();
  }

  // Listener de teclado com fase de captura para precedência imediata
  document.addEventListener(
    'keydown',
    (e) => {
      // Atalho Alt + V (e não Ctrl/Meta para não conflitar com nada)
      const isAltV = e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'v' || e.key === 'V' || e.code === 'KeyV');

      if (isAltV) {
        e.preventDefault();
        e.stopPropagation();
        togglePicker();
        return;
      }

      // Se o modal estiver aberto, gerencia a navegação
      if (overlayEl) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          closePicker();
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(selectedIndex + 1, true);
          return;
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(selectedIndex - 1, true);
          return;
        }

        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          if (flatItems[selectedIndex]) {
            void chooseItem(flatItems[selectedIndex]);
          }
          return;
        }
      }
    },
    true
  );

  // Listener para acionamento via chrome.commands (se registrado no manifest)
  if (globalThis.chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.action === 'toggle-process-paste' || message?.action === 'open-process-paste') {
        togglePicker();
      }
    });
  }

  // Exporta utilitários para testes e depuração
  window.__suapeProcessPastePicker = {
    openPicker,
    closePicker,
    togglePicker,
    chooseItem,
    pasteValueIntoActiveField,
    extractIdentifiedFields,
    isValidValue,
    cleanText,
  };
})();
