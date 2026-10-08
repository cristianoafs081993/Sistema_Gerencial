(function (scope) {
  'use strict';
  const FORM = 'form_manterDocumentoHabil';
  const TABS = `${FORM}:abasDocHabil`;
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const normalize = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const visible = element => {
    if (!element || element.closest('[hidden]')) return false;
    for (let current = element; current; current = current.parentElement) {
      const style = current.ownerDocument.defaultView.getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  };
  const active = element => Boolean(element && (element.classList.contains('btn-aba-dh-selecionada') || element.getAttribute('aria-selected') === 'true'));
  const valueOf = element => {
    if (element.matches('input, textarea, select')) {
      if (['checkbox', 'radio'].includes(element.type)) return element.checked;
      if (element.tagName === 'SELECT') return Array.from(element.selectedOptions).map(option => clean(option.textContent)).join('; ');
      return element.value;
    }
    return clean(element.innerText ?? element.textContent);
  };
  function getTabs(doc) {
    return Array.from(doc.getElementById(TABS)?.querySelectorAll('input.btn-aba-dh, button.btn-aba-dh, [role="tab"]') || [])
      .filter(element => element.id.startsWith(`${FORM}:aba`))
      .map(element => ({ id: element.id, title: clean(element.value || element.textContent), active: active(element), available: !element.disabled || active(element),
        filled: /btn-aba-dh-(?:pendente|registrada|registrado)/.test(element.className) }));
  }
  function planTabs(doc) {
    const tabs = getTabs(doc);
    const rules = [
      { key: 'dados-basicos', match: /^dados basicos$/, required: true },
      { key: 'principal-orcamento', match: /^principal com orcamento$/, required: true },
      { key: 'deducoes', match: /^deduc/, required: false },
      { key: 'dados-pagamento', match: /^dados de pagamento$/, required: true },
    ];
    const planned = rules.map(rule => ({ ...rule, ...tabs.find(tab => rule.match.test(normalize(tab.title))) }));
    for (const rule of planned) if (rule.required && (!rule.id || !rule.available)) throw new Error(`A aba ${rule.key} não está disponível. Abra um DH preenchido.`);
    const extra = tabs.filter(tab => tab.filled && !planned.some(item => item.id === tab.id) && normalize(tab.title) !== 'resumo');
    planned.splice(planned.length - 1, 0, ...extra.map(tab => ({ ...tab, key: tab.id.split(':').pop(), required: false })));
    return planned;
  }
  function extract(root) {
    const doc = root.ownerDocument;
    const labels = Array.from(root.querySelectorAll('label')).filter(visible);
    const controls = Array.from(root.querySelectorAll('input, textarea, select')).filter(element => visible(element) &&
      !['hidden', 'password', 'button', 'submit', 'reset', 'image', 'file'].includes(element.type));
    const fields = controls.map(element => {
      const label = labels.find(item => item.htmlFor === element.id || (item.htmlFor && doc.getElementById(item.htmlFor)?.contains(element)));
      const group = element.closest('.unitGroup');
      return { id: element.id, label: clean(label?.textContent || element.getAttribute('aria-label') || group?.querySelector('label')?.textContent || element.id.split(':').pop()),
        value: valueOf(element), type: element.type || element.tagName.toLowerCase(), disabled: Boolean(element.disabled) };
    });
    for (const label of labels) {
      const id = label.htmlFor;
      let target = id && [id, `${id}_output`, `${id}_outputText`, `${id}_out`].map(candidate => doc.getElementById(candidate)).find(visible);
      if (!target) target = label.closest('.unitGroup')?.querySelector('.unitData');
      if (!target) target = label.closest('td')?.nextElementSibling?.querySelector('span');
      if (!target) target = label.nextElementSibling;
      if (!target || !root.contains(target) || !visible(target) || target.matches('input,textarea,select') || target.querySelector('input,textarea,select')) continue;
      fields.push({ id: target.id || id || '', label: clean(label.textContent), value: valueOf(target), type: 'text', disabled: true });
    }
    const tables = Array.from(root.querySelectorAll('table')).filter(table => visible(table) && table.querySelector('thead') && !/calendar/i.test(table.id))
      .map(table => ({ id: table.id, headers: Array.from(table.querySelectorAll('thead th,thead td')).map(cell => clean(cell.textContent)),
        rows: Array.from(table.querySelectorAll('tbody tr')).filter(row => row.closest('table') === table && visible(row))
          .map(row => Array.from(row.children).filter(cell => /^(TD|TH)$/.test(cell.tagName)).map(cell => ({
            text: clean(cell.innerText ?? cell.textContent), values: fields.filter(field => field.id && cell.contains(doc.getElementById(field.id))),
          }))) }));
    const text = Array.from(root.querySelectorAll('label, legend, .unitData, textarea, h1, h2, h3')).filter(visible)
      .map(element => clean(element.matches('textarea') ? element.value : element.textContent)).filter(Boolean).join('\n');
    return { capturedAt: new Date().toISOString(), fields, tables, text };
  }
  function documentIdentity(doc) {
    const read = ids => ids.map(id => doc.getElementById(`${FORM}:${id}`)).find(Boolean);
    return { ug: valueOf(read(['ugEmitente_output', 'ugEmitente']) || doc.createElement('span')),
      year: valueOf(read(['anoExercicioSiafi']) || doc.createElement('span')),
      type: valueOf(read(['codigoTipoDocHabil_outputText', 'codigoTipoDocHabil']) || doc.createElement('span')),
      number: valueOf(read(['numeroDocumentoHabil_outputText', 'numeroDocumentoHabil']) || doc.createElement('span')) };
  }
  function predocs(root) {
    return Array.from(root.querySelectorAll('[id$=":btnPredoc"]')).filter(visible).map(button => {
      const row = button.closest('tr');
      return { id: button.id, row: clean(row?.innerText ?? row?.textContent),
        filled: button.classList.contains('checked') || Boolean(row?.querySelector('[id$=":excluirPredoc_btn"]')) };
    });
  }
  function hasDeductions(root) {
    return Boolean(root.querySelector('.collapseBox, .linkParaSituacao, [id*="lista_Deduc"][id$=":btnPredoc"]') ||
      Array.from(root.querySelectorAll('table tbody tr')).some(row => row.querySelector('[id*="selecao"], [id$=":btnPredoc"]')));
  }
  function createRecord(identity, sourceUrl) {
    const source = new URL(sourceUrl);
    return { schemaVersion: '1.0.0', captureId: scope.crypto.randomUUID(), startedAt: new Date().toISOString(),
      source: `${source.origin}${source.pathname}`, document: identity, status: 'collecting',
      sections: [], predocs: [], warnings: [],
      purpose: 'Registro visual e dados preenchidos para conferência posterior. Não atesta registro, liquidação ou pagamento.',
      analysis: { status: 'not_requested', findings: [] } };
  }
  scope.SiagesSiafiEvidenceCore = { FORM, TABS, clean, normalize, visible, active, getTabs, planTabs, extract, documentIdentity, predocs, hasDeductions, createRecord };
})(globalThis);
