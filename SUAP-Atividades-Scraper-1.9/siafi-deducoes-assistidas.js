(function (scope) {
  'use strict';
  const FORM = 'form_manterDocumentoHabil';
  const digits = value => String(value || '').replace(/\D/g, '');
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  function nationalHolidays(year) {
    const pad = value => String(value).padStart(2, '0');
    const fixed = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'];
    const a = year % 19; const b = Math.floor(year / 100); const c = year % 100;
    const d = Math.floor(b / 4); const e = b % 4; const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3); const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4); const k = c % 4; const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    const goodFriday = new Date(Date.UTC(year, month - 1, day - 2));
    return [...fixed.map(item => `${year}-${item}`), `${goodFriday.getUTCFullYear()}-${pad(goodFriday.getUTCMonth() + 1)}-${pad(goodFriday.getUTCDate())}`];
  }
  function priorBusinessDay20(reference = new Date(), holidays) {
    const source = reference instanceof Date ? reference : new Date(reference);
    if (Number.isNaN(source.getTime())) throw new Error('Data de referência inválida.');
    const target = new Date(Date.UTC(source.getFullYear(), source.getMonth() + 1, 20));
    const holidaySet = new Set([...nationalHolidays(target.getUTCFullYear()), ...(holidays || [])]);
    while (target.getUTCDay() === 0 || target.getUTCDay() === 6 || holidaySet.has(target.toISOString().slice(0, 10))) {
      target.setUTCDate(target.getUTCDate() - 1);
    }
    const pad = n => String(n).padStart(2, '0');
    return `${pad(target.getUTCDate())}/${pad(target.getUTCMonth() + 1)}/${target.getUTCFullYear()}`;
  }
  function date(value) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(clean(value));
    if (!m) throw new Error('Informe as datas no formato DD/MM/AAAA.');
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    if (d.getUTCFullYear() !== +m[3] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[1]) throw new Error('Data inválida.');
    return m[0];
  }
  function money(value) {
    const text = clean(value);
    if (!/^(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}$/.test(text)) throw new Error('Informe o valor em reais, com duas casas decimais.');
    const cents = BigInt(text.replace(/\./g, '').replace(',', ''));
    if (cents <= 0n || cents > 9999999999999999n) throw new Error('O valor deve ser positivo e caber no campo.');
    return `${cents / 100n},${String(cents % 100n).padStart(2, '0')}`;
  }
  function centsFrom(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.round(value * 100));
    let text = clean(value).replace(/^R\$\s*/i, '').replace(/\s/g, '');
    if (!text) return null;
    if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
    const amount = Number(text);
    return Number.isFinite(amount) ? BigInt(Math.round(amount * 100)) : null;
  }
  function moneyFromCents(cents) {
    const abs = cents < 0n ? -cents : cents;
    return `${cents < 0n ? '-' : ''}${abs / 100n},${String(abs % 100n).padStart(2, '0')}`;
  }
  function observationText(doc) {
    const node = doc.getElementById(`${FORM}:observacaoDeducao`);
    if (!node) return '';
    return clean([node.value, node.innerText, node.textContent].filter(Boolean).join(' '));
  }
  function referencedProcessNumbers(text) {
    const matches = String(text || '').match(/\b\d{5}[.\s]\d{6}[./]\d{4}[-/.]\d{2}\b|\b\d{17}\b/g) || [];
    return [...new Set(matches.map(digits).filter(value => value.length === 17))];
  }
  function isVisible(element) {
    if (!element || element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
    const view = element.ownerDocument?.defaultView;
    const style = view?.getComputedStyle?.(element);
    if (style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse') return false;
    const rootHasLayout = Boolean(element.ownerDocument?.documentElement?.getClientRects?.().length);
    return !rootHasLayout || Boolean(element.getClientRects?.().length);
  }
  function invoiceIdentity(invoice) {
    const number = clean(invoice?.numero).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      .replace(/^(?:DANFE|NFS?E?|NOTAFISCAL)+/, '').replace(/[^A-Z0-9]/g, '');
    if (number) return `numero:${number}`;
    const dateValue = clean(invoice?.data_emissao).replace(/\D/g, '');
    const valueCents = centsFrom(invoice?.valor);
    if (dateValue && valueCents !== null) return `data-valor:${dateValue}:${valueCents}`;
    return null;
  }
  function uniqueInvoices(process) {
    const invoices = Array.isArray(process.invoices) ? process.invoices : [];
    const unique = new Map();
    const unkeyed = [];
    for (const invoice of invoices) {
      const key = invoiceIdentity(invoice);
      if (!key) { unkeyed.push(invoice); continue; }
      const current = unique.get(key);
      if (!current) { unique.set(key, { ...invoice }); continue; }
      const previousCents = centsFrom(current.valor);
      const nextCents = centsFrom(invoice?.valor);
      if (previousCents === null && nextCents !== null) current.valor = invoice.valor;
      else if (previousCents !== null && nextCents !== null && previousCents !== nextCents) {
        current.valor = null;
        current.valorDivergente = true;
      }
      if (!current.numero && invoice?.numero) current.numero = invoice.numero;
      if (!current.data_emissao && invoice?.data_emissao) current.data_emissao = invoice.data_emissao;
    }
    return [...unique.values(), ...unkeyed];
  }
  function invoiceBase(process) {
    const invoices = uniqueInvoices(process);
    const invoiceCents = invoices.map(invoice => invoice.valorDivergente ? null : centsFrom(invoice?.valor));
    if (invoices.length) {
      if (invoiceCents.some(value => value === null)) return null;
      return invoiceCents.reduce((sum, value) => sum + value, 0n);
    }
    return centsFrom(process.invoiceValue);
  }
  function calculateDdf055(rateRecord, editableBase) {
    const base = centsFrom(editableBase);
    if (base === null || base <= 0n) throw new Error('Informe um valor bruto positivo para a nota fiscal.');
    const rateText = clean(rateRecord?.percentual_total).replace(',', '.');
    if (!/^\d{1,2}(?:\.\d{1,2})?$/.test(rateText)) throw new Error('A tabela não retornou uma alíquota percentual válida para este código.');
    const [whole, fraction = ''] = rateText.split('.');
    const basisPoints = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    if (basisPoints <= 0n || basisPoints > 10000n) throw new Error('A alíquota cadastrada está fora do intervalo esperado.');
    const cents = (base * basisPoints + 5000n) / 10000n;
    return { cents, rate: rateText, baseCents: base, source: rateRecord.documento_id || 'tabela de alíquotas SIAGES' };
  }
  async function lookupProcess(processNumber) {
    const runtime = scope.chrome?.runtime;
    if (!runtime?.sendMessage) throw new Error('A extensão não está conectada ao serviço de busca de processos.');
    const response = await new Promise((resolve, reject) => runtime.sendMessage({ source: 'siages-siafi-deduction', type: 'lookup-process', processNumber }, result => {
      if (runtime.lastError) reject(new Error(runtime.lastError.message || 'Falha ao consultar o processo.'));
      else if (!result?.ok) reject(new Error(result?.error || 'Processo não encontrado.'));
      else resolve(result.process);
    }));
    return response;
  }
  async function lookupDdf055Rate(code) {
    const runtime = scope.chrome?.runtime;
    if (!runtime?.sendMessage) throw new Error('A extensão não está conectada ao serviço de consulta de alíquotas.');
    return new Promise((resolve, reject) => runtime.sendMessage({ source: 'siages-siafi-deduction', type: 'lookup-ddf055-rate', code }, result => {
      if (runtime.lastError) reject(new Error(runtime.lastError.message || 'Falha ao consultar a alíquota.'));
      else if (!result?.ok) reject(new Error(result?.error || 'Não foi possível consultar a alíquota.'));
      else resolve(result.rate);
    }));
  }
  async function historicalCodes(cnpj) {
    const response = await fetch(scope.chrome.runtime.getURL('siafi-inventario-deducoes.json'));
    if (!response.ok) throw new Error('Não foi possível ler o inventário de códigos históricos.');
    const inventory = await response.json();
    const supplier = (inventory.credores || []).find(item => digits(item.credor) === digits(cnpj));
    if (!supplier) return { supplier: null, code: '', nature: '', pairSource: '' };
    const counts = new Map();
    for (const np of supplier.nps || []) for (const item of np.deducoes_observadas || []) {
      if (item.situacao !== 'DDF055' || !item.codigo_receita || !item.natureza) continue;
      const key = `${digits(item.codigo_receita)}/${digits(item.natureza)}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const pairs = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (!pairs.length || (pairs.length > 1 && pairs[0][1] === pairs[1][1])) return { supplier, code: '', nature: '', pairSource: '' };
    const [code, nature] = pairs[0][0].split('/');
    return { supplier, code, nature, pairSource: `${code}/${nature} observado em ${pairs[0][1]} NP(s) anteriores` };
  }
  function equalMoney(a, b) { try { return money(a) === money(b); } catch (_) { return false; } }
  function extractContaVinculada(text) {
    const source = clean(text);
    const pattern = /valor calculado para recolhimento na conta vinculada nesta medi[cç][aã]o\s*:\s*(?:R\$\s*)?((?:\d{1,3}(?:\.\d{3})*|\d+),\d{2})/gi;
    const matches = [...source.matchAll(pattern)].map(match => money(match[1]));
    const values = [...new Set(matches)];
    if (values.length !== 1) throw new Error('Não foi possível identificar um único valor explícito de conta vinculada no trecho.');
    return values[0];
  }
  function validate(doc, input) {
    const situationCode = clean(input.situacao || 'DOB035');
    if (!['DOB035', 'DDF055'].includes(situationCode)) throw new Error('Situação ainda não suportada.');
    const processo = digits(input.processo);
    if (processo.length !== 17) throw new Error('Informe o número completo do processo.');
    if (clean(input.fonte).length < 8) throw new Error('Informe a fonte do valor e das datas para conferência.');
    const observacao = observationText(doc);
    const observationProcesses = referencedProcessNumbers(observacao);
    const observationMatches = situationCode === 'DDF055' || (observationProcesses.length
      ? observationProcesses.includes(processo)
      : digits(observacao).includes(processo));
    if (situationCode !== 'DDF055' && observationProcesses.length && !observationMatches) throw new Error('O processo informado não corresponde ao processo exibido na observação da dedução aberta.');
    if (situationCode !== 'DDF055' && !observationMatches) throw new Error('Não encontrei esse processo na observação da dedução aberta.');
    const editableValues = Array.from(doc.querySelectorAll('[id^="form_manterDocumentoHabil:listaDeducao:"][id$=":inputValorDeducao_input"]'))
      .filter(el => !el.disabled && !el.readOnly && isVisible(el));
    const panels = editableValues.filter(el => {
      const candidatePrefix = el.id.slice(0, -'inputValorDeducao_input'.length);
      const candidateArea = doc.getElementById(`${candidatePrefix}panelItemDeducao`);
      const candidateText = clean(candidateArea?.innerText || candidateArea?.textContent);
      return isVisible(candidateArea) && new RegExp(`Situação:\\s*${situationCode}\\b`, 'i').test(candidateText);
    });
    if (panels.length !== 1) {
      if (!editableValues.length) throw new Error(`Não encontrei um item ${situationCode} visível e aberto para edição.`);
      if (!panels.length) throw new Error(`Abra um item ${situationCode} editável.`);
      throw new Error(`Deixe somente um item ${situationCode} aberto para edição.`);
    }
    const prefix = panels[0].id.slice(0, -'inputValorDeducao_input'.length);
    const area = doc.getElementById(`${prefix}panelItemDeducao`);
    if (!area || !area.contains(panels[0])) throw new Error('Não foi possível identificar o item em edição.');
    const find = suffix => {
      const node = doc.getElementById(prefix + suffix);
      if (!node || node.disabled || node.readOnly || node.tagName !== 'INPUT') throw new Error(`Campo indisponível: ${suffix}.`);
      return node;
    };
    const ug = find('inputUgPagadoraDeducao_input');
    const vencimento = find('dataVencimentoDeducao_calendarInputDate');
    const pagamento = find('dataPagamentoDeducao_calendarInputDate');
    const valor = panels[0];
    const expectedUg = digits(input.ug);
    if (expectedUg.length !== 6 || digits(ug.value) !== expectedUg) throw new Error('A UG pagadora informada não corresponde à UG do item.');
    const values = { vencimento: date(input.vencimento), pagamento: date(input.pagamento), valor: money(input.valor) };
    const fields = { vencimento, pagamento, valor };
    if (situationCode === 'DDF055') {
      fields.codigo = find('campoInscricaoA_deducao_input_darf_input');
      fields.natureza = find('campoInscricaoB_deducao_input_inscr_input');
      values.codigo = digits(input.codigo);
      values.natureza = digits(input.natureza);
      if (!/^\d{4}$/.test(values.codigo)) throw new Error('Informe o código DARF de quatro dígitos.');
      if (!/^1\d{4}$/.test(values.natureza)) throw new Error('Informe a natureza de rendimento no formato 1XXXX.');
      if (!input.processData || digits(input.processData.processNumber) !== processo) throw new Error('Busque no SIAGES os dados do mesmo processo antes de preencher o DDF055.');
    }
    for (const [field, expected] of [[vencimento, values.vencimento], [pagamento, values.pagamento]]) {
      if (clean(field.value) && clean(field.value) !== expected) throw new Error('Já existe uma data diferente no item. Confira antes de continuar.');
    }
    if (clean(valor.value) && !/^0+(?:[.,]0+)?$/.test(clean(valor.value)) && !equalMoney(valor.value, values.valor)) throw new Error('Já existe um valor diferente no item. Confira antes de continuar.');
    return { values, fields, processo, ug: expectedUg, situationCode, observationMatches };
  }
  function setValue(field, value) {
    const view = field.ownerDocument.defaultView;
    const setter = Object.getOwnPropertyDescriptor(view.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(field, value); else field.value = value;
    field.dispatchEvent(new view.Event('input', { bubbles: true }));
    field.dispatchEvent(new view.Event('change', { bubbles: true }));
    field.dispatchEvent(new view.Event('blur', { bubbles: true }));
  }
  function fill(doc, input) {
    const prepared = validate(doc, input);
    for (const key of Object.keys(prepared.fields)) {
      const field = prepared.fields[key];
      if (!field.isConnected || field.disabled || field.readOnly) throw new Error('A tela mudou durante o preenchimento. Confira os campos.');
      setValue(field, prepared.values[key]);
      const matches = key === 'valor' ? equalMoney(field.value, prepared.values[key]) : digits(field.value) === digits(prepared.values[key]);
      if (!matches) throw new Error(`O SIAFI não manteve o campo ${key}. Confira os campos já preenchidos.`);
    }
    return { ...prepared.values, observationMatches: prepared.observationMatches };
  }
  function creditorRowFields(doc, tableId) {
    const suffix = ':deducao_tabela_recolhimentos_recolhedor_input';
    return Array.from(doc.querySelectorAll(`input[id$="${suffix}"]`)).filter(field => field.id.startsWith(`${tableId}:`));
  }
  async function waitForCreditorRow(doc, tableId, timeoutMs = 10000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const fields = creditorRowFields(doc, tableId).filter(isVisible);
      if (fields.length) return fields;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('O SIAFI não abriu a linha de recolhedor após clicar em Incluir.');
  }
  async function fillSingleCreditor(doc, prepared, input) {
    if (input.singleCreditorConfirmed !== 'on') return 'A lista de recolhedores ficou sem alteração.';
    const processCnpj = digits(input.processData?.cnpj);
    const cnpj = digits(input.cnpj);
    if (!/^\d{14}$/.test(processCnpj) || cnpj !== processCnpj) throw new Error('Não consegui confirmar o CNPJ do emissor nos dados do processo. A lista não foi alterada.');
    const baseText = clean(input.valorNota);
    const baseCentsEntered = centsFrom(baseText);
    const revenueCents = centsFrom(input.valor);
    if (baseCentsEntered === null || baseCentsEntered <= 0n) throw new Error('Informe um valor bruto válido para a base da lista de recolhedores.');
    if (revenueCents === null || revenueCents <= 0n) throw new Error('Calcule primeiro o valor positivo da retenção DDF055.');
    const deductionPrefix = prepared.fields.valor.id.slice(0, -'inputValorDeducao_input'.length);
    const tableId = `${deductionPrefix}deducao_tabela_recolhimentos`;
    const table = doc.getElementById(tableId);
    if (!table) throw new Error('Não encontrei a tabela Lista de Recolhedores deste item DDF055.');
    let rowInputs = creditorRowFields(doc, tableId).filter(isVisible);
    if (rowInputs.length > 1) throw new Error('Há mais de uma linha de recolhedor em edição; a extensão não vai escolher uma automaticamente.');
    if (!rowInputs.length) {
      const bodyRows = table.querySelectorAll('tbody tr');
      if (bodyRows.length > 1) throw new Error('A lista já contém recolhedor(es); a extensão não vai acrescentar nem substituir outra linha.');
      const include = doc.getElementById(`${tableId}_painel_incluir`);
      if (!include || include.disabled) throw new Error('O botão Incluir da lista de recolhedores está indisponível.');
      include.click();
      rowInputs = await waitForCreditorRow(doc, tableId);
      if (rowInputs.length !== 1) throw new Error('O SIAFI abriu mais de uma linha de recolhedor; confira a lista manualmente.');
    }
    const recolhedor = rowInputs[0];
    const rowPrefix = recolhedor.id.slice(0, -'deducao_tabela_recolhimentos_recolhedor_input'.length);
    const rowFind = suffix => {
      const field = doc.getElementById(rowPrefix + suffix);
      if (!field || field.disabled || field.readOnly || field.tagName !== 'INPUT') throw new Error(`Campo da lista indisponível: ${suffix}.`);
      return field;
    };
    const base = rowFind('deducao_tabela_recolhimentos_base_calculo_input');
    const revenue = rowFind('deducao_tabela_recolhimentos_valor_recolhimento_input');
    const fine = rowFind('deducao_tabela_recolhimentos_multa_input');
    const interest = rowFind('deducao_tabela_recolhimentos_juros_input');
    const filledCnpj = digits(recolhedor.value);
    if (filledCnpj || centsFrom(base.value) > 0n || centsFrom(revenue.value) > 0n) {
      const alreadyMatches = filledCnpj === cnpj && centsFrom(base.value) === baseCentsEntered && centsFrom(revenue.value) === revenueCents;
      if (alreadyMatches) return 'A linha única já está preenchida com esse CNPJ, base e valor; não dupliquei.';
      throw new Error('A linha de recolhedor já tem dados diferentes; a extensão não vai sobrescrevê-los.');
    }
    const entries = [[recolhedor, cnpj, 'recolhedor'], [base, moneyFromCents(baseCentsEntered), 'base de cálculo'], [revenue, moneyFromCents(revenueCents), 'valor da receita'], [fine, '0,00', 'multa'], [interest, '0,00', 'juros']];
    for (const [field, value, label] of entries) {
      if (!field.isConnected || field.disabled || field.readOnly) throw new Error(`A tela mudou antes de preencher ${label}.`);
      setValue(field, value);
      const matches = label === 'recolhedor' ? digits(field.value) === cnpj : centsFrom(field.value) === centsFrom(value);
      if (!matches) throw new Error(`O SIAFI não manteve ${label} na linha. Confira a lista antes de continuar.`);
    }
    return 'Linha única preenchida com o CNPJ do processo, base bruta das notas e valor da retenção. Revise e use Confirmar da própria linha quando estiver correto.';
  }
  function open(situationCode = 'DOB035') {
    const existing = document.getElementById('siages-deducao-assistida');
    if (existing) {
      const content = existing.querySelector('[data-dialog-content]');
      if (content?.hidden) existing.querySelector('[data-minimize]')?.click();
      existing.focus();
      return;
    }
    if (!['DOB035', 'DDF055'].includes(situationCode)) throw new Error('Situação ainda não suportada.');
    const dialog = document.createElement('dialog');
    const defaultPaymentDate = situationCode === 'DDF055' ? priorBusinessDay20(new Date()) : '';
    let processData = null;
    dialog.id = 'siages-deducao-assistida';
    dialog.setAttribute('aria-label', `Preencher dedução ${situationCode}`);
    dialog.style.cssText = 'position:fixed;top:auto;right:16px;bottom:16px;left:auto;margin:0;padding:16px;border:1px solid #94a3b8;border-radius:10px;max-width:480px;width:min(480px,90vw);max-height:90vh;overflow:auto;font:14px sans-serif;color:#172033;z-index:2147483647;box-shadow:0 8px 32px #0004';
    const extra = situationCode === 'DDF055' ? '<button type="button" data-lookup>Buscar dados do processo no SIAGES</button><p data-process-summary></p><label>CNPJ do fornecedor <input name="cnpj" readonly></label><label>Valor bruto da(s) nota(s) fiscal(is) <input name="valorNota" inputmode="decimal" placeholder="Revise ou informe o valor correto" required></label><label>Código DARF <input name="codigo" placeholder="Sugestão do histórico" required></label><label>Natureza (1XXXX) <input name="natureza" placeholder="Sugestão do histórico" required></label><button type="button" data-calculate>Calcular retenção com valor informado</button><label><input type="checkbox" name="singleCreditorConfirmed"> Confirmo que há um único recolhedor e que ele coincide com o emissor da nota</label>' : '<label>Trecho do termo (opcional) <textarea name="trecho"></textarea></label><button type="button" data-extract>Ler valor do trecho</button>';
    dialog.innerHTML = `<header data-dialog-header style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px"><h2 style="font-size:16px;margin:0">Preencher dedução ${situationCode}</h2><button type="button" data-minimize aria-expanded="true">Minimizar</button></header><div data-dialog-content><p>Informe o NUP do processo. A extensão consulta os dados já extraídos no SIAGES, aplica a UG padrão da sua conta e prepara os campos para revisão. O DH não será registrado.</p><form><label>Processo SUAP (NUP) <input name="processo" placeholder="00000.000000.0000-00" required></label>${extra}<label>UG pagadora <input name="ug" required></label><label>Vencimento <input name="vencimento" placeholder="DD/MM/AAAA" value="${defaultPaymentDate}" required></label><label>Pagamento <input name="pagamento" placeholder="DD/MM/AAAA" value="${defaultPaymentDate}" required></label><label>Valor da retenção em reais <input name="valor" placeholder="0,00" required></label><label>Fonte dos dados <input name="fonte" placeholder="Preenchida pela busca do processo" required></label><p role="status"></p><button type="submit">Preencher campos</button> <button type="button" data-close>Fechar</button></form></div>`;
    for (const label of dialog.querySelectorAll('label')) label.style.cssText = 'display:grid;gap:4px;margin:10px 0';
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.remove());
    const content = dialog.querySelector('[data-dialog-content]');
    const minimize = dialog.querySelector('[data-minimize]');
    minimize.addEventListener('click', () => {
      content.hidden = !content.hidden;
      const minimized = content.hidden;
      minimize.textContent = minimized ? 'Restaurar' : 'Minimizar';
      minimize.setAttribute('aria-expanded', String(!minimized));
      dialog.style.width = minimized ? '260px' : 'min(480px,90vw)';
      dialog.style.padding = minimized ? '10px 12px' : '16px';
      dialog.style.maxHeight = minimized ? 'none' : '90vh';
    });
    const status = dialog.querySelector('[role="status"]');
    if (situationCode === 'DDF055') {
      const ug = dialog.querySelector('[name="ug"]');
      ug.value = '158366';
      ug.addEventListener('input', () => { ug.dataset.edited = 'true'; });
      if (scope.SiagesExtensionAuth?.getCampus) scope.SiagesExtensionAuth.getCampus().then(value => { if (!ug.dataset.edited) ug.value = value || '158366'; }).catch(() => { if (!ug.dataset.edited) ug.value = '158366'; });
      const processInput = dialog.querySelector('[name="processo"]');
      const codeInput = dialog.querySelector('[name="codigo"]');
      const calculateValue = async () => {
        if (!processData) throw new Error('Busque primeiro o processo SUAP.');
        const code = digits(codeInput.value);
        if (!/^\d{4}$/.test(code)) throw new Error('Informe um código DARF de quatro dígitos.');
        status.textContent = `Consultando a alíquota cadastrada para o código ${code}...`;
        const rateRecord = await lookupDdf055Rate(code);
        if (!processData || digits(processInput.value) !== digits(processData.processNumber)) throw new Error('O processo mudou durante o cálculo. Busque novamente.');
        const calculated = calculateDdf055(rateRecord, dialog.querySelector('[name="valorNota"]').value);
        dialog.querySelector('[name="valor"]').value = moneyFromCents(calculated.cents);
        status.textContent = `Calculado pela alíquota histórica ${calculated.rate}% do código ${code} (${calculated.source}). Revise a incidência e o valor antes de preencher.`;
      };
      codeInput.addEventListener('input', () => {
        dialog.querySelector('[name="valor"]').value = '';
        status.textContent = 'O código mudou. Calcule novamente para atualizar a retenção.';
      });
      dialog.querySelector('[name="valorNota"]').addEventListener('input', () => {
        dialog.querySelector('[name="valor"]').value = '';
        status.textContent = 'A base foi alterada. Recalcule a retenção para usar este valor.';
      });
      processInput.addEventListener('input', () => {
        processData = null;
        dialog.querySelector('[name="cnpj"]').value = '';
        dialog.querySelector('[name="valorNota"]').value = '';
        dialog.querySelector('[name="codigo"]').value = '';
        dialog.querySelector('[name="natureza"]').value = '';
        dialog.querySelector('[name="valor"]').value = '';
        dialog.querySelector('[name="fonte"]').value = '';
        dialog.querySelector('[data-process-summary]').textContent = '';
        status.textContent = 'O processo mudou. Busque novamente os dados antes de calcular ou preencher.';
      });
      dialog.querySelector('[data-lookup]').addEventListener('click', async () => {
        const processNumber = processInput.value;
        processData = null;
        status.textContent = 'Consultando os dados já extraídos do processo...';
        try {
          const result = await lookupProcess(processNumber);
          if (digits(processInput.value) !== digits(result.processNumber)) throw new Error('O número do processo mudou durante a consulta. Busque novamente.');
          processData = result;
          const observed = document.getElementById(`${FORM}:observacaoDeducao`)?.value || '';
          const cnpj = digits(processData.cnpj || (observed.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/) || [''])[0]);
          if (!cnpj) throw new Error('O processo foi localizado, mas não há CNPJ no banco nem na observação do SIAFI.');
          dialog.querySelector('[name="cnpj"]').value = cnpj;
          const historical = await historicalCodes(cnpj);
          if (historical.code) dialog.querySelector('[name="codigo"]').value = historical.code;
          if (historical.nature) dialog.querySelector('[name="natureza"]').value = historical.nature;
          const deduplicatedInvoices = uniqueInvoices(processData);
          const base = invoiceBase(processData);
          dialog.querySelector('[name="valorNota"]').value = base == null ? '' : moneyFromCents(base);
          const summary = dialog.querySelector('[data-process-summary]');
          const invoiceCount = deduplicatedInvoices.length;
          const duplicateCount = Math.max(0, (processData.invoices?.length || 0) - invoiceCount);
          const hasDivergentValues = deduplicatedInvoices.some(item => item.valorDivergente);
          const invoiceSource = invoiceCount ? `notas do processo${duplicateCount ? `, ${duplicateCount} repetição(ões) removida(s)` : ''}` : (processData.invoiceValue ? 'valor extraído do processo' : 'sem valor de nota extraído');
          summary.textContent = `${processData.supplier || historical.supplier?.nomes?.[0] || cnpj} · ${invoiceCount} nota(s) · Base (${invoiceSource}): ${base == null ? 'indisponível' : moneyFromCents(base)}${historical.pairSource ? ` · ${historical.pairSource}` : ' · sem par DDF055 único no histórico'}`;
          dialog.querySelector('[name="fonte"]').value = `SUAP ${processData.processNumber}; ${deduplicatedInvoices.map(item => item.numero).filter(Boolean).join(', ') || 'dados já extraídos'}`;
          status.textContent = hasDivergentValues
            ? 'Há valores divergentes para a mesma nota. Informe/revise o valor bruto manualmente antes de calcular.'
            : base == null
              ? 'Não há valor confiável da nota extraído deste processo. Informe o valor correto da nota; valores históricos de liquidação não são usados.'
            : processData.extractionStatus === 'incomplete'
              ? 'Dados parciais: confira as notas no processo antes do cálculo.'
              : 'Dados do processo carregados. Confira a fonte, CNPJ e códigos.';
          if (historical.code) {
            try { await calculateValue(); }
            catch (error) { status.textContent = `Processo carregado. Cálculo pendente: ${error.message}`; }
          }
        } catch (error) { processData = null; status.textContent = error.message; }
      });
      dialog.querySelector('[data-calculate]').addEventListener('click', () => {
        calculateValue().catch(error => { status.textContent = error.message; });
      });
    }
    dialog.querySelector('[data-extract]')?.addEventListener('click', () => {
      try {
        dialog.querySelector('[name="valor"]').value = extractContaVinculada(dialog.querySelector('[name="trecho"]').value);
        status.textContent = 'Valor encontrado no trecho. Confira a fonte e as datas.';
      } catch (error) { status.textContent = error.message; }
    });
    dialog.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault();
      try {
        const data = Object.fromEntries(new FormData(event.currentTarget));
        const result = fill(document, { ...data, processData, situacao: situationCode });
        let message = !result.observationMatches
          ? 'Campos preenchidos com o processo consultado no SIAGES. Não consegui confirmar o NUP pela observação do item; confira se este é o item correto antes de prosseguir.'
          : 'Campos preenchidos. Confira os valores e o relacionamento no SIAFI.';
        if (situationCode === 'DDF055') {
          try { message += ` ${await fillSingleCreditor(document, validate(document, { ...data, processData, situacao: situationCode }), { ...data, processData })}`; }
          catch (error) { message += ` Lista de recolhedores: ${error.message}`; }
        }
        status.textContent = message;
      } catch (error) { status.textContent = error.message; }
    });
    document.body.appendChild(dialog);
    try { dialog.show(); } catch (_) { dialog.showModal(); }
  }
  scope.SiagesDeducoesAssistidas = { validate, fill, open, extractContaVinculada, priorBusinessDay20 };
})(globalThis);
