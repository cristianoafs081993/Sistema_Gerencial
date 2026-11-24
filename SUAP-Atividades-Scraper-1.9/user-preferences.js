/**
 * Preferências do servidor para o que a extensão preenche no SUAP.
 *
 * Ficam em chrome.storage.sync (acompanham a conta Google do Chrome) e são lidas por:
 * - command-palette.js: atalhos de encaminhamento ("encdg 498930") e valores do upload ("up 498930");
 * - process-document.js: textos do modelo do despacho de liquidação enviados ao SIAGES
 *   e blocos ocultos da aba "Resumo" do painel do processo;
 * - popup.js: seção "Modelos e atalhos".
 *
 * Valores ausentes ou inválidos voltam ao padrão; o encaminhamento à DG/CN é o atalho inicial.
 */
(function (scope) {
  'use strict';

  const STORAGE_KEY = 'siages-user-preferences';
  const VERSION = 1;
  const MAX_FORWARD_SHORTCUTS = 15;
  // chrome.storage.sync aceita até 8 KB por item.
  const MAX_STORED_BYTES = 8000;
  const SHORTCUT_PATTERN = /^[a-z]{2,15}$/;

  // Atalhos nativos de processo e prefixos de busca da paleta: não podem ser reaproveitados.
  const RESERVED_SHORTCUTS = Object.freeze([
    'up', 'upload', 'doc', 'upld', 'anexar',
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

  const DEFAULT_UPLOAD = Object.freeze({
    tipoConferencia: 'Cópia Simples',
    tipoDocumento: 'Liquidação',
    assunto: 'Liquidação',
  });

  // Em branco, o SIAGES usa o texto padrão. {campus} vira o nome do campus vinculado à conta.
  const DESPACHO_FIELDS = Object.freeze({
    destinatario: { multiline: false, max: 300 },
    assunto: { multiline: false, max: 200 },
    encaminhamento: { multiline: true, max: 1500 },
    fecho: { multiline: true, max: 300 },
  });

  const DESPACHO_PLACEHOLDERS = Object.freeze({
    destinatario: 'À Coordenação de Finanças e Contratos do Campus {campus}',
    assunto: 'Autorização para a Liquidação da Despesa',
    encaminhamento: 'Na sequência, encaminhe-se o processo à Direção-Geral para análise e posterior autorização do pagamento, em conformidade com o cronograma e a disponibilidade orçamentária desta unidade.',
    fecho: 'Atenciosamente,',
  });

  // Blocos da aba "Resumo" do painel SIAGES nas páginas de processo do SUAP (process-document.js).
  // A preferência guarda só os ocultos: um bloco novo aparece por padrão.
  const SUMMARY_BLOCKS = Object.freeze([
    Object.freeze({ id: 'processo', label: 'Processo', description: 'Número do processo' }),
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

  /** Mensagem de erro em português, ou '' quando o atalho é válido diante dos demais. */
  function validateForwardShortcut(item, others = []) {
    if (!SHORTCUT_PATTERN.test(item?.shortcut || '')) return 'O atalho deve ter de 2 a 15 letras, sem números, acentos ou espaços.';
    if (RESERVED_SHORTCUTS.includes(item.shortcut)) return `"${item.shortcut}" já é um comando da paleta. Escolha outro atalho.`;
    if (others.some((other) => other.shortcut === item.shortcut)) return `O atalho "${item.shortcut}" já está em uso.`;
    if (!item.campus) return 'Informe o campus de destino (nome e ID no SUAP).';
    if (!item.setor) return 'Informe o setor de destino (nome e ID no SUAP).';
    return '';
  }

  function forwardTitle(item) {
    return item?.title || `Encaminhar para ${item?.setor?.text || 'o setor configurado'}`;
  }

  function cloneDefaultForward() {
    return normalizeForwardShortcut(DEFAULT_FORWARD_SHORTCUT);
  }

  function normalize(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const list = Array.isArray(source.forwardShortcuts) ? source.forwardShortcuts : [DEFAULT_FORWARD_SHORTCUT];
    const forwardShortcuts = [];
    for (const entry of list) {
      if (forwardShortcuts.length >= MAX_FORWARD_SHORTCUTS) break;
      const item = normalizeForwardShortcut(entry);
      if (!validateForwardShortcut(item, forwardShortcuts)) forwardShortcuts.push(item);
    }

    const upload = {};
    for (const [key, fallback] of Object.entries(DEFAULT_UPLOAD)) {
      upload[key] = singleLine(source.upload?.[key], 120) || fallback;
    }

    const despacho = {};
    for (const [key, rule] of Object.entries(DESPACHO_FIELDS)) {
      const value = source.despacho?.[key];
      despacho[key] = rule.multiline ? multiLine(value, rule.max) : singleLine(value, rule.max);
    }

    const hiddenSummaryBlocks = Array.isArray(source.hiddenSummaryBlocks)
      ? SUMMARY_BLOCK_IDS.filter((id) => source.hiddenSummaryBlocks.includes(id))
      : [];

    return { version: VERSION, forwardShortcuts, upload, despacho, hiddenSummaryBlocks };
  }

  /** Apenas os textos personalizados do despacho; null quando tudo segue o padrão do SIAGES. */
  function despachoModelo(preferences) {
    const despacho = normalize(preferences).despacho;
    const custom = Object.fromEntries(Object.entries(despacho).filter(([, value]) => value));
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
    RESERVED_SHORTCUTS,
    DEFAULT_UPLOAD,
    DESPACHO_PLACEHOLDERS,
    SUMMARY_BLOCKS,
    normalize,
    normalizeShortcut,
    normalizeForwardShortcut,
    validateForwardShortcut,
    forwardTitle,
    cloneDefaultForward,
    despachoModelo,
    load,
    save,
  });
})(globalThis);
