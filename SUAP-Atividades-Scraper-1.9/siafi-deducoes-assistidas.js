(function (scope) {
  'use strict';
  const FORM = 'form_manterDocumentoHabil';
  const digits = value => String(value || '').replace(/\D/g, '');
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
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
    const processo = digits(input.processo);
    if (processo.length !== 17) throw new Error('Informe o número completo do processo.');
    if (clean(input.fonte).length < 8) throw new Error('Informe a fonte do valor e das datas para conferência.');
    const observacao = doc.getElementById(`${FORM}:observacaoDeducao`);
    if (!observacao || !digits(observacao.value).includes(processo)) throw new Error('O processo não corresponde à observação da dedução aberta.');
    const panels = Array.from(doc.querySelectorAll('[id^="form_manterDocumentoHabil:listaDeducao:"][id$=":inputValorDeducao_input"]')).filter(el => !el.disabled && !el.readOnly);
    if (panels.length !== 1) throw new Error('Abra exatamente um item de dedução editável.');
    const prefix = panels[0].id.slice(0, -'inputValorDeducao_input'.length);
    const area = doc.getElementById(`${prefix}panelItemDeducao`);
    if (!area || !area.contains(panels[0])) throw new Error('Não foi possível identificar o item em edição.');
    const situation = clean(area?.innerText || area?.textContent);
    if (!/Situação:\s*DOB035\b/i.test(situation)) throw new Error('Esta primeira versão preenche apenas o item DOB035 aberto.');
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
    for (const [field, expected] of [[vencimento, values.vencimento], [pagamento, values.pagamento]]) {
      if (clean(field.value) && clean(field.value) !== expected) throw new Error('Já existe uma data diferente no item. Confira antes de continuar.');
    }
    if (clean(valor.value) && !/^0+(?:[.,]0+)?$/.test(clean(valor.value)) && !equalMoney(valor.value, values.valor)) throw new Error('Já existe um valor diferente no item. Confira antes de continuar.');
    return { values, fields: { vencimento, pagamento, valor }, processo, ug: expectedUg };
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
    for (const key of ['vencimento', 'pagamento', 'valor']) {
      const field = prepared.fields[key];
      if (!field.isConnected || field.disabled || field.readOnly) throw new Error('A tela mudou durante o preenchimento. Confira os campos.');
      setValue(field, prepared.values[key]);
      if (!(key === 'valor' ? equalMoney(field.value, prepared.values[key]) : clean(field.value) === prepared.values[key])) throw new Error(`O SIAFI não manteve o campo ${key}. Confira os campos já preenchidos.`);
    }
    return prepared.values;
  }
  function open() {
    if (document.getElementById('siages-deducao-assistida')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'siages-deducao-assistida';
    dialog.setAttribute('aria-label', 'Preencher dedução DOB035');
    dialog.style.cssText = 'padding:24px;border:1px solid #94a3b8;border-radius:10px;max-width:480px;width:90%;font:14px sans-serif;color:#172033';
    dialog.innerHTML = '<h2>Preencher dedução DOB035</h2><p>Informe os dados conferidos no processo. O item deve estar aberto no SIAFI.</p><form><label>Processo <input name="processo" required></label><label>UG pagadora <input name="ug" required></label><label>Vencimento <input name="vencimento" placeholder="DD/MM/AAAA" required></label><label>Pagamento <input name="pagamento" placeholder="DD/MM/AAAA" required></label><label>Trecho do termo (opcional) <textarea name="trecho"></textarea></label><button type="button" data-extract>Ler valor do trecho</button><label>Valor em reais <input name="valor" placeholder="0,00" required></label><label>Fonte dos dados <input name="fonte" placeholder="Documento e página" required></label><p role="status"></p><button type="submit">Preencher campos</button> <button type="button" data-close>Fechar</button></form>';
    for (const label of dialog.querySelectorAll('label')) label.style.cssText = 'display:grid;gap:4px;margin:10px 0';
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.remove());
    dialog.querySelector('[data-extract]').addEventListener('click', () => {
      const status = dialog.querySelector('[role="status"]');
      try {
        dialog.querySelector('[name="valor"]').value = extractContaVinculada(dialog.querySelector('[name="trecho"]').value);
        status.textContent = 'Valor encontrado no trecho. Confira a fonte e as datas.';
      } catch (error) { status.textContent = error.message; }
    });
    dialog.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      const status = dialog.querySelector('[role="status"]');
      try {
        const data = Object.fromEntries(new FormData(event.currentTarget));
        fill(document, data);
        status.textContent = 'Campos preenchidos. Confira os valores e o relacionamento no SIAFI.';
      } catch (error) { status.textContent = error.message; }
    });
    document.body.appendChild(dialog);
    dialog.showModal();
  }
  scope.SiagesDeducoesAssistidas = { validate, fill, open, extractContaVinculada };
})(globalThis);
