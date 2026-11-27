/**
 * Preferências do servidor para o que a extensão preenche no SUAP.
 *
 * Ficam em chrome.storage.sync (acompanham a conta Google do Chrome) e são lidas por:
 * - command-palette.js: atalhos de encaminhamento ("encdg 498930"), de upload ("up 498930")
 *   e de documento ("despliq"), que clona um documento modelo do SUAP com assunto e texto;
 * - process-document.js: textos do modelo do despacho de liquidação enviados ao SIAGES
 *   e blocos ocultos da aba "Resumo" do painel do processo;
 * - popup.js: submenus de "Modelos e preenchimentos".
 *
 * Valores ausentes ou inválidos voltam ao padrão; o encaminhamento à DG/CN e o upload de liquidação
 * ("up") são os atalhos iniciais. Um atalho vale para uma só lista: não se repete entre as três.
 */
(function (scope) {
  'use strict';

  const STORAGE_KEY = 'siages-user-preferences';
  const VERSION = 1;
  const MAX_FORWARD_SHORTCUTS = 15;
  const MAX_UPLOAD_SHORTCUTS = 15;
  const MAX_DOCUMENT_SHORTCUTS = 15;
  // chrome.storage.sync aceita até 8 KB por item.
  const MAX_STORED_BYTES = 8000;
  const SHORTCUT_PATTERN = /^[a-z]{2,15}$/;

  // Atalhos nativos de processo e prefixos de busca da paleta: não podem ser reaproveitados.
  // "up" é o atalho inicial da lista de uploads e pode ser renomeado ou excluído.
  const RESERVED_SHORTCUTS = Object.freeze([
    'upload', 'doc', 'upld', 'anexar',
    'enc', 'encaminhar', 'despacho', 'tramitar',
    'encs', 'semdespacho', 'encsem', 'tramitarsem', 'sem',
    'capa', 'proc', 'processo', 'processos', 'home',
    'vis', 'docs', 'arvore', 'timeline',
    'desp', 'add', 'novo', 'texto',
    'cie', 'ciencia', 'notificar',
    'ne', 'empenho', 'condh', 'con', 'contrato', 'contratos',
    'alu', 'aluno', 'alunos', 'mat', 'matricula',
    'docto', 'documento', 'documentos', 'tela', 'modulo', 'acao', 'atalho',
  ]);

  const DEFAULT_FORWARD_SHORTCUT = Object.freeze({
    shortcut: 'encdg',
    title: 'Encaminhar à DG para Autorização de Pagamento',
    despacho: 'Ao Diretor geral para autorização de pagamento',
    campus: Object.freeze({ id: '3', text: 'CN' }),
    setor: Object.freeze({ id: '841', text: 'DG/CN' }),
    papel: 'ASSISTENTE EM ADMINISTRACAO',
  });

  // UASG do campus vinculado em "Sua conta" → sigla do campus no SUAP. O encdg inicial vai para a
  // Direção-Geral desse campus (setor DG/<sigla>). A Reitoria não tem DG e fica sem destino automático.
  const CAMPUS_SIGLA_BY_UASG = Object.freeze({
    '158366': 'CN', '158371': 'AP', '158370': 'CA', '154839': 'CANG', '154838': 'CM',
    '158367': 'IP', '158373': 'JC', '158887': 'LAJ', '158375': 'MC', '158365': 'MO',
    '158369': 'CNAT', '152711': 'CH', '158368': 'ZN', '152757': 'NC', '158882': 'PAAS',
    '152756': 'PAR', '158374': 'PF', '158372': 'SC', '154582': 'SGA', '158897': 'SM',
    '154840': 'SPP', '158896': 'TOU', '158898': 'UMZ',
  });

  const DEFAULT_UPLOAD = Object.freeze({
    tipoConferencia: 'Cópia Simples',
    tipoDocumento: 'Liquidação',
    assunto: 'Liquidação',
  });

  const DEFAULT_UPLOAD_SHORTCUT = Object.freeze({
    shortcut: 'up',
    title: 'Upload de liquidação',
    ...DEFAULT_UPLOAD,
  });

  // Atalho de documento: clona no SUAP o documento modelo (ID do documento) e preenche assunto e texto.
  const DOCUMENT_TEXT_MAX = 3000;

  // Em branco, o SIAGES usa o texto padrão. {campus} vira o nome do campus vinculado à conta.
  const DESPACHO_FIELDS = Object.freeze({
    destinatario: { multiline: false, max: 300 },
    assunto: { multiline: false, max: 200 },
    encaminhamento: { multiline: true, max: 1500 },
    fecho: { multiline: true, max: 300 },
  });

  // Modelos do despacho de liquidação gerado pelo SIAGES, um por finalidade. O texto padrão é o mesmo de
  // src/lib/despachoModelo.ts (DESPACHO_TEMPLATE_DEFAULTS; um teste compara). A preferência guarda só o que
  // o servidor mudou, em despachoModelos[finalidade][campo].
  const DESPACHO_TEMPLATE_FIELDS = Object.freeze({
    destinatario: { multiline: false, max: 300 },
    assunto: { multiline: false, max: 200 },
    corpo: { multiline: true, max: 2000 },
    encaminhamento: { multiline: true, max: 1500 },
    fecho: { multiline: true, max: 300 },
  });

  const DESPACHO_VARIABLES = Object.freeze([
    Object.freeze({ name: 'processo', description: 'Número do processo' }),
    Object.freeze({ name: 'favorecido', description: 'Favorecido (em maiúsculas)' }),
    Object.freeze({ name: 'valor', description: 'Valor da liquidação' }),
    Object.freeze({ name: 'empenho', description: 'Empenho(s)' }),
    Object.freeze({ name: 'objeto', description: 'Objeto do serviço ou da aquisição' }),
    Object.freeze({ name: 'contrato', description: 'Número do contrato' }),
    Object.freeze({ name: 'projeto', description: 'Nome do projeto' }),
    Object.freeze({ name: 'edital', description: 'Número do edital' }),
    Object.freeze({ name: 'campus', description: 'Campus vinculado à conta' }),
  ]);

  const DESPACHO_COMMON_DEFAULTS = Object.freeze({
    destinatario: 'À Coordenação de Finanças e Contratos do Campus {campus}',
    assunto: 'Autorização para a Liquidação da Despesa',
    encaminhamento: 'Na sequência, encaminhe-se o processo à Direção-Geral para análise e posterior autorização do pagamento, em conformidade com o cronograma e a disponibilidade orçamentária desta unidade.',
    fecho: 'Atenciosamente,',
  });

  const auxilioCorpo = (programa) =>
    `Considerando a regularidade dos documentos apresentados e o acompanhamento do ${programa}[[ (Processo nº {processo})]], **AUTORIZO** a liquidação da despesa no valor de {valor}, referente ao empenho {empenho}.`;

  const DESPACHO_MODELOS = Object.freeze([
    Object.freeze({ id: 'servico', code: 'servico', label: 'Serviço', corpo: 'Considerando a regularidade da documentação apresentada e o ateste da prestação de serviços de {objeto}[[, referente ao contrato {contrato}]], no âmbito do Campus {campus}[[ (Processo nº {processo})]], **AUTORIZO** a liquidação da despesa no valor de {valor}, referente ao empenho {empenho}, em favor de {favorecido}.' }),
    Object.freeze({ id: 'aquisicao', code: 'aquisicao', label: 'Aquisição', corpo: 'Considerando a regularidade da documentação apresentada e o ateste do fornecimento de {objeto}[[, referente ao contrato {contrato}]], no âmbito do Campus {campus}[[ (Processo nº {processo})]], **AUTORIZO** a liquidação da despesa no valor de {valor}, referente ao empenho {empenho}, em favor de {favorecido}.' }),
    Object.freeze({ id: 'projeto', code: 'projeto', label: 'Projeto (bolsas)', corpo: 'Considerando a regularidade da documentação apresentada e o ateste da execução das atividades pelo(s) bolsista(s) {favorecido}, no âmbito do projeto "{projeto}", aprovado no Edital nº {edital}[[ (Processo nº {processo})]], **AUTORIZO** a liquidação da despesa no valor de {valor}, referente ao empenho {empenho}.' }),
    Object.freeze({ id: 'bolsa-sem-projeto', code: 'bolsa', label: 'Bolsa sem projeto', corpo: 'Considerando a regularidade da documentação apresentada e o ateste da execução das atividades pelo(s) bolsista(s) {favorecido}[[ (Processo nº {processo})]], **AUTORIZO** a liquidação da despesa no valor de {valor}, referente ao empenho {empenho}.' }),
    Object.freeze({ id: 'auxilio-transporte', code: 'transporte', label: 'Auxílio-transporte', corpo: auxilioCorpo('Programa de Auxílio-Transporte') }),
    Object.freeze({ id: 'pafe', code: 'pafe', label: 'PAFE', corpo: auxilioCorpo('Programa de Apoio à Formação Estudantil (PAFE)') }),
    Object.freeze({ id: 'auxilio-moradia', code: 'moradia', label: 'Auxílio-moradia', corpo: auxilioCorpo('Programa de Auxílio-Moradia') }),
  ]);
  const DESPACHO_MODELO_IDS = DESPACHO_MODELOS.map((modelo) => modelo.id);

  const DESPACHO_PLACEHOLDERS = Object.freeze({
    destinatario: 'À Coordenação de Finanças e Contratos do Campus {campus}',
    assunto: 'Autorização para a Liquidação da Despesa',
    encaminhamento: 'Na sequência, encaminhe-se o processo à Direção-Geral para análise e posterior autorização do pagamento, em conformidade com o cronograma e a disponibilidade orçamentária desta unidade.',
    fecho: 'Atenciosamente,',
  });

  // Blocos da aba "Resumo" do painel SIAGES nas páginas de processo do SUAP (process-document.js).
  // A preferência guarda só os ocultos: um bloco novo aparece por padrão.
  const SUMMARY_BLOCKS = Object.freeze([
    Object.freeze({ id: 'beneficiario', label: 'Beneficiário', description: 'Nome e CPF/CNPJ' }),
    Object.freeze({ id: 'rps-nps', label: 'RPs / NPs', description: 'Documentos hábeis do beneficiário' }),
    Object.freeze({ id: 'documento-pagamento', label: 'Documento e pagamento', description: 'Valor, NS, contrato e notas fiscais' }),
    Object.freeze({ id: 'dados-bancarios', label: 'Dados bancários', description: 'Banco, agência e conta' }),
    Object.freeze({ id: 'retencoes-empenhos', label: 'Retenções e empenhos', description: 'Tributos retidos e empenhos' }),
    Object.freeze({ id: 'conclusao', label: 'Conclusão', description: 'NS registrada e análise, após a conclusão' }),
    Object.freeze({ id: 'caminho-processo', label: 'Caminho do processo', description: 'Etapas do mapeamento e etapa atual' }),
    Object.freeze({ id: 'lista-credores', label: 'Lista de credores', description: 'Situação da LC do processo' }),
  ]);
  const SUMMARY_BLOCK_IDS = SUMMARY_BLOCKS.map((block) => block.id);

  const singleLine = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const multiLine = (value, max) => String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);

  function normalizeShortcut(value) {
    return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
  }

  function normalizeOption(value) {
    const id = singleLine(value?.id, 20);
    if (!/^\d+$/.test(id)) return null;
    return { id, text: singleLine(value?.text, 200) || id };
  }

  function normalizeTemplateId(value) {
    const id = singleLine(value, 20);
    return /^\d+$/.test(id) ? id : '';
  }

  function normalizeForwardShortcut(raw) {
    return {
      shortcut: normalizeShortcut(raw?.shortcut),
      title: singleLine(raw?.title, 120),
      despacho: multiLine(raw?.despacho, 2000),
      campus: normalizeOption(raw?.campus),
      setor: normalizeOption(raw?.setor),
      papel: singleLine(raw?.papel, 120),
    };
  }

  function normalizeUploadShortcut(raw) {
    return {
      shortcut: normalizeShortcut(raw?.shortcut),
      title: singleLine(raw?.title, 120),
      tipoConferencia: singleLine(raw?.tipoConferencia, 120),
      tipoDocumento: singleLine(raw?.tipoDocumento, 120),
      assunto: singleLine(raw?.assunto, 120),
    };
  }

  function normalizeDocumentShortcut(raw) {
    return {
      shortcut: normalizeShortcut(raw?.shortcut),
      title: singleLine(raw?.title, 120),
      templateId: normalizeTemplateId(raw?.templateId),
      assunto: singleLine(raw?.assunto, 200),
      texto: multiLine(raw?.texto, DOCUMENT_TEXT_MAX),
    };
  }

  // Regras do atalho comuns às três listas; others traz os atalhos de todas as listas, menos o editado.
  function validateShortcutName(item, others) {
    if (!SHORTCUT_PATTERN.test(item?.shortcut || '')) return 'O atalho deve ter de 2 a 15 letras, sem números, acentos ou espaços.';
    if (RESERVED_SHORTCUTS.includes(item.shortcut)) return `"${item.shortcut}" já é um comando da paleta. Escolha outro atalho.`;
    if (others.some((other) => other.shortcut === item.shortcut)) return `O atalho "${item.shortcut}" já está em uso.`;
    return '';
  }

  /** Mensagem de erro em português, ou '' quando o atalho é válido diante dos demais. */
  function validateForwardShortcut(item, others = []) {
    const nameError = validateShortcutName(item, others);
    if (nameError) return nameError;
    if (!item.campus) return 'Escolha o campus de destino na lista do SUAP.';
    if (!item.setor) return 'Escolha o setor de destino na lista do SUAP.';
    return '';
  }

  function validateUploadShortcut(item, others = []) {
    const nameError = validateShortcutName(item, others);
    if (nameError) return nameError;
    if (!item.tipoDocumento) return 'Informe o tipo de documento do upload.';
    return '';
  }

  function validateDocumentShortcut(item, others = []) {
    const nameError = validateShortcutName(item, others);
    if (nameError) return nameError;
    if (!item.templateId) return 'Informe o ID do documento modelo no SUAP (só números).';
    if (!item.assunto) return 'Informe o assunto do documento.';
    return '';
  }

  function forwardTitle(item) {
    return item?.title || `Encaminhar para ${item?.setor?.text || 'o setor configurado'}`;
  }

  function uploadTitle(item) {
    return item?.title || `Upload: ${item?.tipoDocumento || 'documento'}`;
  }

  function documentTitle(item) {
    return item?.title || `Documento: ${item?.assunto || 'modelo do SUAP'}`;
  }

  /** Atalhos configurados nas três listas, com a lista de origem e a posição. */
  function allShortcuts(preferences) {
    const prefs = preferences || {};
    return [
      ...(prefs.forwardShortcuts || []).map((item, index) => ({ shortcut: item.shortcut, kind: 'forward', index })),
      ...(prefs.uploadShortcuts || []).map((item, index) => ({ shortcut: item.shortcut, kind: 'upload', index })),
      ...(prefs.documentShortcuts || []).map((item, index) => ({ shortcut: item.shortcut, kind: 'document', index })),
    ];
  }

  /** Texto do modelo em HTML simples para o editor do SUAP: um parágrafo por bloco, quebras viram <br>. */
  function documentContentHtml(text) {
    const escape = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return multiLine(text, DOCUMENT_TEXT_MAX)
      .split(/\n{2,}/)
      .filter(Boolean)
      .map((paragraph) => `<p>${escape(paragraph).split('\n').join('<br>')}</p>`)
      .join('');
  }

  function cloneDefaultForward() {
    return normalizeForwardShortcut(DEFAULT_FORWARD_SHORTCUT);
  }

  function campusSiglaForUasg(uasg) {
    return CAMPUS_SIGLA_BY_UASG[String(uasg ?? '').trim()] || '';
  }

  /** encdg ainda como veio de fábrica (nome e despacho padrão, destino na DG de algum campus). */
  function isCampusDefaultForward(item) {
    return item?.shortcut === DEFAULT_FORWARD_SHORTCUT.shortcut
      && item.title === DEFAULT_FORWARD_SHORTCUT.title
      && item.despacho === DEFAULT_FORWARD_SHORTCUT.despacho
      && Boolean(item.campus?.text)
      && item.setor?.text === `DG/${item.campus.text}`;
  }

  /** encdg padrão com campus e setor (IDs do SUAP) da DG do campus configurado. */
  function campusDefaultForward(campus, setor) {
    return normalizeForwardShortcut({ ...DEFAULT_FORWARD_SHORTCUT, campus, setor });
  }

  function cloneDefaultUpload() {
    return normalizeUploadShortcut(DEFAULT_UPLOAD_SHORTCUT);
  }

  // Lê uma lista descartando itens inválidos ou com atalho já usado em qualquer lista lida antes.
  function normalizeList(list, max, normalizeItem, validate, taken) {
    const result = [];
    for (const entry of list) {
      if (result.length >= max) break;
      const item = normalizeItem(entry);
      if (!validate(item, taken)) {
        result.push(item);
        taken.push(item);
      }
    }
    return result;
  }

  function normalize(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const taken = [];
    const forwardShortcuts = normalizeList(
      Array.isArray(source.forwardShortcuts) ? source.forwardShortcuts : [DEFAULT_FORWARD_SHORTCUT],
      MAX_FORWARD_SHORTCUTS, normalizeForwardShortcut, validateForwardShortcut, taken,
    );

    // Sem a lista, o upload único da versão anterior ("upload") vira o atalho "up".
    const legacyUpload = Object.fromEntries(Object.entries(DEFAULT_UPLOAD)
      .map(([key, fallback]) => [key, singleLine(source.upload?.[key], 120) || fallback]));
    const uploadShortcuts = normalizeList(
      Array.isArray(source.uploadShortcuts) ? source.uploadShortcuts : [{ ...DEFAULT_UPLOAD_SHORTCUT, ...legacyUpload }],
      MAX_UPLOAD_SHORTCUTS, normalizeUploadShortcut, validateUploadShortcut, taken,
    );
    const documentShortcuts = normalizeList(
      Array.isArray(source.documentShortcuts) ? source.documentShortcuts : [],
      MAX_DOCUMENT_SHORTCUTS, normalizeDocumentShortcut, validateDocumentShortcut, taken,
    );

    // Upload padrão (primeiro da lista): usado por "upload"/"doc" na paleta e pelo Alt + clique no processo.
    const first = uploadShortcuts[0];
    const upload = first
      ? { tipoConferencia: first.tipoConferencia, tipoDocumento: first.tipoDocumento, assunto: first.assunto }
      : { ...DEFAULT_UPLOAD };

    const despacho = {};
    for (const [key, rule] of Object.entries(DESPACHO_FIELDS)) {
      const value = source.despacho?.[key];
      despacho[key] = rule.multiline ? multiLine(value, rule.max) : singleLine(value, rule.max);
    }

    const despachoModelos = {};
    for (const modelo of DESPACHO_MODELOS) {
      const custom = normalizeDespachoTemplate(source.despachoModelos?.[modelo.id], modelo.id, despacho);
      if (Object.keys(custom).length) despachoModelos[modelo.id] = custom;
    }

    const hiddenSummaryBlocks = Array.isArray(source.hiddenSummaryBlocks)
      ? SUMMARY_BLOCK_IDS.filter((id) => source.hiddenSummaryBlocks.includes(id))
      : [];

    return { version: VERSION, forwardShortcuts, uploadShortcuts, documentShortcuts, upload, despacho, despachoModelos, hiddenSummaryBlocks };
  }

  const templateText = (value, rule) => (rule.multiline ? multiLine(value, rule.max) : singleLine(value, rule.max));

  /** Texto padrão do modelo: corpo da finalidade e partes comuns (ou o texto comum do formato anterior). */
  function defaultDespachoTemplate(finalidade, legacyCommon = {}) {
    const modelo = DESPACHO_MODELOS.find((item) => item.id === finalidade) || DESPACHO_MODELOS[0];
    return {
      destinatario: legacyCommon.destinatario || DESPACHO_COMMON_DEFAULTS.destinatario,
      assunto: legacyCommon.assunto || DESPACHO_COMMON_DEFAULTS.assunto,
      corpo: modelo.corpo,
      encaminhamento: legacyCommon.encaminhamento || DESPACHO_COMMON_DEFAULTS.encaminhamento,
      fecho: legacyCommon.fecho || DESPACHO_COMMON_DEFAULTS.fecho,
    };
  }

  // Só os campos que diferem do texto padrão (campo vazio volta ao padrão).
  function normalizeDespachoTemplate(raw, finalidade, legacyCommon) {
    const base = defaultDespachoTemplate(finalidade, legacyCommon);
    const custom = {};
    if (!raw || typeof raw !== 'object') return custom;
    for (const [field, rule] of Object.entries(DESPACHO_TEMPLATE_FIELDS)) {
      const text = templateText(raw[field], rule);
      if (text && text !== base[field]) custom[field] = text;
    }
    return custom;
  }

  /** Texto completo do modelo da finalidade, como o servidor vê e edita no popup. */
  function despachoTemplate(preferences, finalidade) {
    const prefs = normalize(preferences);
    return { ...defaultDespachoTemplate(finalidade, prefs.despacho), ...(prefs.despachoModelos[finalidade] || {}) };
  }

  function isDespachoCustomized(preferences, finalidade) {
    const prefs = normalize(preferences);
    return Boolean(prefs.despachoModelos[finalidade]) || Object.values(prefs.despacho).some(Boolean);
  }

  /** O que vai ao SIAGES: textos comuns do formato anterior e modelos por finalidade; null sem personalização. */
  function despachoModelo(preferences) {
    const prefs = normalize(preferences);
    const custom = Object.fromEntries(Object.entries(prefs.despacho).filter(([, value]) => value));
    if (Object.keys(prefs.despachoModelos).length) custom.modelos = prefs.despachoModelos;
    return Object.keys(custom).length ? custom : null;
  }

  function storedBytes(value) {
    const json = JSON.stringify(value);
    return STORAGE_KEY.length + (typeof TextEncoder === 'function' ? new TextEncoder().encode(json).length : json.length * 2);
  }

  async function load(storage) {
    if (!storage?.get) return normalize(null);
    try {
      const stored = await storage.get(STORAGE_KEY);
      return normalize(stored?.[STORAGE_KEY]);
    } catch (_) {
      return normalize(null);
    }
  }

  async function save(preferences, storage) {
    if (!storage?.set) throw new Error('O armazenamento da extensão não está disponível.');
    const next = normalize(preferences);
    if (storedBytes(next) > MAX_STORED_BYTES) {
      throw new Error('Os modelos passaram do limite de 8 KB do Chrome. Encurte os textos ou remova atalhos.');
    }
    await storage.set({ [STORAGE_KEY]: next });
    return next;
  }

  scope.SiagesUserPreferences = Object.freeze({
    STORAGE_KEY,
    MAX_FORWARD_SHORTCUTS,
    MAX_UPLOAD_SHORTCUTS,
    MAX_DOCUMENT_SHORTCUTS,
    RESERVED_SHORTCUTS,
    DEFAULT_UPLOAD,
    DESPACHO_PLACEHOLDERS,
    DESPACHO_MODELOS,
    DESPACHO_MODELO_IDS,
    DESPACHO_TEMPLATE_FIELDS,
    DESPACHO_VARIABLES,
    SUMMARY_BLOCKS,
    normalize,
    normalizeShortcut,
    normalizeForwardShortcut,
    normalizeUploadShortcut,
    normalizeDocumentShortcut,
    validateForwardShortcut,
    validateUploadShortcut,
    validateDocumentShortcut,
    forwardTitle,
    uploadTitle,
    documentTitle,
    allShortcuts,
    documentContentHtml,
    cloneDefaultForward,
    cloneDefaultUpload,
    campusSiglaForUasg,
    isCampusDefaultForward,
    campusDefaultForward,
    despachoModelo,
    despachoTemplate,
    defaultDespachoTemplate,
    isDespachoCustomized,
    load,
    save,
  });
})(globalThis);
