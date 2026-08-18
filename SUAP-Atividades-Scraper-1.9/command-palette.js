(function () {
  if (window.__suapeCommandPaletteLoaded) return;
  window.__suapeCommandPaletteLoaded = true;

  const SUPABASE_URL = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzk4NjIsImV4cCI6MjA4NTg1NTg2Mn0.g9h5nF0l8yKG-yjQRI8i_mq084IzKTrH64F2FpreVIg';
  const SIAGES_APP_URL = 'http://localhost:5173';

  let empenhosCache = null;
  let contratosCache = null;
  let isFetching = false;
  let activeScope = 'all'; // 'all' | 'empenhos' | 'contratos' | 'screens' | 'actions'
  let currentResults = [];
  let selectedIndex = 0;

  // DOM Elements
  let overlayEl = null;
  let dialogEl = null;
  let inputEl = null;
  let listEl = null;
  let detailOverlayEl = null;
  let detailDialogEl = null;

  // Lucide SVG Icons Map
  const ICONS = {
    search: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    receipt: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></svg>',
    fileStack: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7h-3a2 2 0 0 1-2-2V2"/><path d="M21 6v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l5 5Z"/><path d="M3 8v12a2 2 0 0 0 2 2h12"/></svg>',
    layoutDashboard: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>',
    sparkles: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>',
    landmark: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>',
    banknote: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>',
    scrollText: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/></svg>',
    zap: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    fileText: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    arrowDownRight: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 7 10 10"/><path d="M17 7v10H7"/></svg>',
    coins: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>',
    clipboardList: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>',
    shieldAlert: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    userCog: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="15" r="3"/><circle cx="9" cy="7" r="4"/><path d="M10 15H6a4 4 0 0 0-4 4v2"/><path d="m21.7 16.4-.9-.3"/><path d="m15.2 13.9-.9-.3"/><path d="m16.6 18.7.3-.9"/><path d="m19.1 12.2.3-.9"/><path d="m19.6 18.7-.4-.8"/><path d="m16.1 12.1-.4-.8"/><path d="m15.3 16.3.8-.4"/><path d="m21.8 13.8.8-.4"/></svg>',
    searchCheck: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 11 2 2 4-4"/><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    warehouse: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect width="12" height="12" x="6" y="10"/></svg>',
    settings2: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>',
    clock3: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16.5 12"/></svg>',
    folderSync: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v.5"/><path d="M12 10v4h4"/><path d="m12 14 1.535-1.605a5 5 0 0 1 8 1.5"/><path d="M22 22v-4h-4"/><path d="m22 18-1.535 1.605a5 5 0 0 1-8-1.5"/></svg>',
  };

  // Screen groups definition (Exact 1:1 match with SIAGES appScreenGroups)
  const appScreenGroups = [
    { id: 'orcamentario', name: 'Orçamentário', icon: 'landmark', sortOrder: 10 },
    { id: 'financeiro', name: 'Financeiro', icon: 'banknote', sortOrder: 20 },
    { id: 'contratos', name: 'Contratos', icon: 'fileStack', sortOrder: 30 },
    { id: 'licitacoes', name: 'Licitações', icon: 'scrollText', sortOrder: 35 },
    { id: 'energia', name: 'Energia', icon: 'zap', sortOrder: 37 },
    { id: 'operacoes', name: 'Operações', icon: 'warehouse', sortOrder: 38 },
    { id: 'documentos', name: 'Documentos', icon: 'fileText', sortOrder: 40 },
    { id: 'automacoes', name: 'Automações', icon: 'clock3', sortOrder: 50 },
    { id: 'administracao', name: 'Administração', icon: 'settings2', sortOrder: 90 },
  ];

  // Screen items definition (Exact 1:1 match with SIAGES appScreens)
  const appScreens = [
    { id: 'dashboard', groupId: 'orcamentario', name: 'Dashboard', path: '/', icon: 'layoutDashboard', sortOrder: 10 },
    { id: 'planejamento', groupId: 'orcamentario', name: 'Planejamento', path: '/planejamento', icon: 'fileText', sortOrder: 20 },
    { id: 'descentralizacoes', groupId: 'orcamentario', name: 'Descentralizações', path: '/descentralizacoes', icon: 'arrowDownRight', sortOrder: 30 },
    { id: 'credito-disponivel', groupId: 'orcamentario', name: 'Crédito disponível', path: '/credito-disponivel', icon: 'coins', sortOrder: 35 },
    { id: 'empenhos', groupId: 'orcamentario', name: 'Empenhos', path: '/empenhos', icon: 'receipt', sortOrder: 40 },

    { id: 'liquidacoes-pagamentos', groupId: 'financeiro', name: 'Liquidações', path: '/liquidacoes-pagamentos', icon: 'banknote', sortOrder: 10 },
    { id: 'financeiro', groupId: 'financeiro', name: 'Financeiro', path: '/financeiro', icon: 'clipboardList', sortOrder: 20 },
    { id: 'lc', groupId: 'financeiro', name: 'Lista de Credores', path: '/lc', icon: 'clipboardList', sortOrder: 30 },
    { id: 'retencoes-efd-reinf', groupId: 'financeiro', name: 'Retenções EFD-Reinf', path: '/retencoes-efd-reinf', icon: 'shieldAlert', sortOrder: 40 },
    { id: 'rastreabilidade-pfs', groupId: 'financeiro', name: 'Rastreabilidade de PFs', path: '/rastreabilidade-pfs', icon: 'clipboardList', sortOrder: 50 },

    { id: 'contratos', groupId: 'contratos', name: 'Contratos', path: '/contratos', icon: 'fileStack', sortOrder: 10 },
    { id: 'requisicao-compra', groupId: 'contratos', name: 'Requisição de Compra', path: '/requisicao-compra', icon: 'clipboardList', sortOrder: 20 },
    { id: 'cadastro-terceirizados', groupId: 'contratos', name: 'Cadastro de Terceirizados', path: '/cadastro-terceirizados', icon: 'userCog', sortOrder: 25 },

    { id: 'pesquisa-precos', groupId: 'licitacoes', name: 'Pesquisa de Preços', path: '/pesquisa-precos', icon: 'searchCheck', sortOrder: 5 },
    { id: 'licitacoes-pregoes', groupId: 'licitacoes', name: 'Pregões por UASG', path: '/licitacoes-pregoes', icon: 'scrollText', sortOrder: 10 },
    { id: 'atas-registro-precos', groupId: 'licitacoes', name: 'Atas e ARP', path: '/atas-registro-precos', icon: 'clipboardList', sortOrder: 20 },

    { id: 'energia-visao-geral', groupId: 'energia', name: 'Visão Geral', path: '/energia', icon: 'zap', sortOrder: 10 },
    { id: 'energia-contratos', groupId: 'energia', name: 'Contratos de Energia', path: '/energia/contratos', icon: 'zap', sortOrder: 50 },

    { id: 'almoxarifado', groupId: 'operacoes', name: 'Almoxarifado', path: '/almoxarifado', icon: 'warehouse', sortOrder: 10 },

    { id: 'gerador-documentos', groupId: 'documentos', name: 'Gerador de Documentos', path: '/gerador-documentos', icon: 'sparkles', sortOrder: 10 },
    { id: 'editor-documentos', groupId: 'documentos', name: 'Editor de Documentos', path: '/editor-documentos', icon: 'fileText', sortOrder: 20 },

    { id: 'economia-tempo', groupId: 'automacoes', name: 'Economia de Tempo', path: '/economia-tempo', icon: 'clock3', sortOrder: 10 },

    { id: 'importacao-dados', groupId: 'administracao', name: 'Importação de Dados', path: '/importacao-dados', icon: 'folderSync', sortOrder: 5 },
    { id: 'controle-usuarios', groupId: 'administracao', name: 'Controle de Usuários', path: '/controle-usuarios', icon: 'userCog', sortOrder: 10 },
  ];

  // Quick actions
  const systemActions = [
    {
      id: 'action-requisicao',
      title: 'Nova Requisição de Compra',
      subtitle: 'Criar solicitação de despesa por NE',
      keywords: 'compras pedido nova requisicao despesa',
      path: '/requisicao-compra',
      icon: 'clipboardList',
      color: '#2563eb',
    },
    {
      id: 'action-cotacao',
      title: 'Pesquisa de Preços',
      subtitle: 'Cotação oficial e cálculo estimativo',
      keywords: 'pesquisa precos cotacao orcamento estimativa',
      path: '/pesquisa-precos',
      icon: 'searchCheck',
      color: '#059669',
    },
    {
      id: 'action-importacao',
      title: 'Central de Importação de Arquivos',
      subtitle: 'Importar CSV, XLSX e dados orçamentários/financeiros',
      keywords: 'importar upload csv xlsx central dados arquivos',
      path: '/importacao-dados',
      icon: 'folderSync',
      color: '#0A7F70',
    },
  ];

  // Formatting helpers
  function formatCurrency(value) {
    const num = Number(value) || 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  }

  function formatNumber(value) {
    const num = Number(value) || 0;
    return new Intl.NumberFormat('pt-BR').format(num);
  }

  function formatDate(value) {
    if (!value) return '—';
    const raw = String(value).slice(0, 10);
    const parts = raw.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return raw;
  }

  function normalizeContratoNumero(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const match = raw.match(/(\d+)\s*\/\s*(\d{4})/);
    if (!match) return raw;
    return `${match[1].padStart(5, '0')}/${match[2]}`;
  }

  function calculateEmpenhoSaldo(emp) {
    if (emp.tipo === 'rap') {
      const rapInscrito = Number(emp.rap_inscrito || 0);
      const rapLiquidado = Number(emp.rap_liquidado || 0);
      const rapPago = Number(emp.rap_pago || 0);
      return Math.max(0, rapInscrito - Math.max(rapLiquidado, rapPago));
    }
    const valor = Number(emp.valor || 0);
    const liquidadoAPagar = Number(emp.valor_liquidado_a_pagar || 0);
    const pagoOficial = Number(emp.valor_pago_oficial || 0);
    const liquidado = Number(emp.valor_liquidado_oficial || emp.valor_liquidado || 0);
    const executed = (liquidadoAPagar > 0 || pagoOficial > 0) ? (liquidadoAPagar + pagoOficial) : liquidado;
    return Math.max(0, valor - executed);
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function highlightMatch(text, query) {
    if (!text) return '';
    const safeText = escapeHtml(text);
    if (!query || !query.trim()) return safeText;

    const clean = query.trim().toLowerCase();
    const lowerText = String(text).toLowerCase();
    const index = lowerText.indexOf(clean);

    if (index === -1) {
      const digitsOnly = clean.replace(/\D/g, '');
      if (digitsOnly.length >= 2) {
        const digitIdx = String(text).indexOf(digitsOnly);
        if (digitIdx !== -1) {
          const before = escapeHtml(String(text).slice(0, digitIdx));
          const match = escapeHtml(String(text).slice(digitIdx, digitIdx + digitsOnly.length));
          const after = escapeHtml(String(text).slice(digitIdx + digitsOnly.length));
          return `${before}<span class="suape-cp-highlight">${match}</span>${after}`;
        }
      }
      return safeText;
    }

    const before = escapeHtml(String(text).slice(0, index));
    const match = escapeHtml(String(text).slice(index, index + clean.length));
    const after = escapeHtml(String(text).slice(index + clean.length));
    return `${before}<span class="suape-cp-highlight">${match}</span>${after}`;
  }

  // Scoring for empenhos
  function scoreEmpenho(emp, rawQuery) {
    if (!rawQuery) return 0;
    const q = rawQuery.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    const words = q.split(/\s+/).filter(Boolean);

    const num = (emp.numero || '').toLowerCase();
    const fav = (emp.favorecido_nome || '').toLowerCase();
    const doc = (emp.favorecido_documento || '').replace(/\D/g, '');
    const proc = (emp.processo || '').toLowerCase();
    const pi = (emp.plano_interno || '').toLowerCase();
    const desc = (emp.descricao || '').toLowerCase();

    let score = 0;

    // 1. NE Number
    if (num === q) score += 20000;
    else if (num.startsWith(q)) score += 15000;
    else if (num.includes(q)) score += 10000;

    if (digits.length >= 1) {
      const numDigits = num.replace(/\D/g, '');
      const sequentialPart = num.replace(/^.*?ne0*/i, '');
      if (sequentialPart === digits) score += 18000;
      else if (sequentialPart.startsWith(digits)) score += 12000;
      else if (num.endsWith(digits)) score += 9000;
      else if (digits.length >= 3 && numDigits.includes(digits)) score += 5000;
    }

    // 2. PI
    if (pi) {
      if (pi === q) score += 8000;
      else if (pi.startsWith(q)) score += 6000;
      else if (pi.includes(q)) score += 3500;
    }

    // 3. Favorecido
    if (fav) {
      if (fav.startsWith(q)) score += 5000;
      else if (fav.includes(q)) score += 3000;
      else if (words.length > 1 && words.every((w) => fav.includes(w))) score += 4000;
    }

    // 4. Descrição
    if (desc) {
      if (desc.includes(q)) score += 2000;
      else if (words.length > 1 && words.every((w) => desc.includes(w))) score += 2500;
    }

    // 5. Processo
    if (proc && q.length >= 3 && proc.includes(q)) score += 1500;

    // 6. CPF/CNPJ (5+ digits)
    if (doc && digits.length >= 5 && doc.includes(digits)) score += 1000;

    return score;
  }

  // Scoring for contratos
  function scoreContrato(cont, rawQuery) {
    if (!rawQuery) return 0;
    const q = rawQuery.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    const words = q.split(/\s+/).filter(Boolean);

    const num = (cont.numero || '').toLowerCase();
    const forn = (cont.fornecedorNome || '').toLowerCase();
    const obj = (cont.objeto || '').toLowerCase();
    const proc = (cont.processo || '').toLowerCase();

    let score = 0;

    if (num === q) score += 20000;
    else if (num.startsWith(q)) score += 15000;
    else if (num.includes(q)) score += 10000;

    if (digits.length >= 1) {
      const cleanContratoNum = num.replace(/\/.*$/, '').replace(/^0+/, '');
      if (cleanContratoNum === digits) score += 18000;
      else if (cleanContratoNum.startsWith(digits)) score += 12000;
      else if (num.replace(/\D/g, '').includes(digits)) score += 6000;
    }

    if (forn) {
      if (forn.startsWith(q)) score += 5000;
      else if (forn.includes(q)) score += 3000;
      else if (words.length > 1 && words.every((w) => forn.includes(w))) score += 4000;
    }

    if (obj) {
      if (obj.includes(q)) score += 2000;
      else if (words.length > 1 && words.every((w) => obj.includes(w))) score += 2500;
    }

    if (proc && q.length >= 3 && proc.includes(q)) score += 1500;

    return score;
  }

  // Supabase Fetch Helper
  async function fetchFromSupabase(table, queryParams = '') {
    let token = SUPABASE_ANON_KEY;
    try {
      if (globalThis.SiagesExtensionAuth?.getSession) {
        const session = await globalThis.SiagesExtensionAuth.getSession();
        if (session?.accessToken) token = session.accessToken;
      }
    } catch (_) {}

    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${queryParams}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Erro ao consultar ${table}: ${response.statusText}`);
    }
    return response.json();
  }

  // Load Data
  async function loadData(force = false) {
    if (isFetching) return;
    if (!force && empenhosCache && contratosCache) return;

    isFetching = true;
    try {
      const [empenhosData, contratosApiData, contratosLocaisData] = await Promise.allSettled([
        fetchFromSupabase('empenhos', 'select=id,numero,descricao,valor,natureza_despesa,plano_interno,favorecido_nome,favorecido_documento,valor_liquidado,valor_liquidado_oficial,valor_pago_oficial,valor_liquidado_a_pagar,status,tipo,rap_inscrito,rap_liquidado,rap_pago,processo&order=numero.desc&limit=1500'),
        fetchFromSupabase('contratos_api', 'select=id,api_contrato_id,numero,fornecedor_nome,fornecedor_documento,unidade_codigo,unidade_nome,unidade_origem_codigo,unidade_origem_nome,objeto,processo,vigencia_inicio,vigencia_fim,vigencia_inicio_derivada,vigencia_fim_derivada,valor_global,valor_acumulado,situacao,situacao_derivada,updated_at&order=numero.asc'),
        fetchFromSupabase('contratos', 'select=id,numero,contratada,objeto,processo,valor,data_inicio,data_termino,status'),
      ]);

      if (empenhosData.status === 'fulfilled') {
        empenhosCache = empenhosData.value || [];
      }

      const apiContratos = contratosApiData.status === 'fulfilled' ? (contratosApiData.value || []) : [];
      const localContratos = contratosLocaisData.status === 'fulfilled' ? (contratosLocaisData.value || []) : [];

      const contratosMap = new Map();
      for (const api of apiContratos) {
        const isAtivo = api.situacao_derivada === true || (api.situacao_derivada === undefined && api.situacao === true);
        if (!isAtivo) continue;

        const norm = normalizeContratoNumero(api.numero) || api.numero;
        contratosMap.set(norm, {
          id: api.id,
          numero: api.numero,
          fornecedorNome: api.fornecedor_nome || '',
          fornecedorDocumento: api.fornecedor_documento || '',
          objeto: api.objeto || '',
          processo: api.processo || '',
          valor: Number(api.valor_acumulado || api.valor_global || 0),
          vigenciaInicio: api.vigencia_inicio_derivada || api.vigencia_inicio,
          vigenciaFim: api.vigencia_fim_derivada || api.vigencia_fim,
          unidadeNome: api.unidade_nome || 'IFRN',
          unidadeOrigemNome: api.unidade_origem_nome || null,
          status: 'Ativo',
          isApi: true,
          apiContrato: api,
        });
      }

      for (const loc of localContratos) {
        const statusNorm = (loc.status || '').trim().toLowerCase();
        if (['inativo', 'encerrado', 'concluido', 'concluído', 'rescindido', 'cancelado'].includes(statusNorm)) continue;

        const norm = normalizeContratoNumero(loc.numero) || loc.numero;
        if (contratosMap.has(norm)) {
          const existing = contratosMap.get(norm);
          if (!existing.fornecedorNome && loc.contratada) existing.fornecedorNome = loc.contratada;
          if (!existing.objeto && loc.objeto) existing.objeto = loc.objeto;
        } else {
          contratosMap.set(norm, {
            id: loc.id,
            numero: loc.numero,
            fornecedorNome: loc.contratada || '',
            fornecedorDocumento: '',
            objeto: loc.objeto || '',
            processo: loc.processo || '',
            valor: Number(loc.valor || 0),
            vigenciaInicio: loc.data_inicio,
            vigenciaFim: loc.data_termino,
            unidadeNome: 'IFRN',
            unidadeOrigemNome: null,
            status: loc.status || 'Ativo',
            isApi: false,
          });
        }
      }

      contratosCache = Array.from(contratosMap.values());
    } catch (e) {
      console.warn('Suape Command Palette: Erro ao carregar dados', e);
    } finally {
      isFetching = false;
      renderResults();
    }
  }

  // Create Palette DOM (Exact match with SIAGES UI)
  function createPaletteDOM() {
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'suape-cp-overlay';
    overlayEl.innerHTML = `
      <div id="suape-cp-dialog">
        <div class="suape-cp-header">
          <div class="suape-cp-search-box">
            <div class="suape-cp-search-icon-box">
              ${ICONS.search}
            </div>
            <input type="text" class="suape-cp-input" placeholder="Digite um comando, NE, contrato, fornecedor ou módulo..." autocomplete="off" spellcheck="false" />
            <span class="suape-cp-kbd">ESC</span>
          </div>
          <div class="suape-cp-chips">
            <button type="button" class="suape-cp-chip suape-cp-chip-active" data-scope="all">
              Todos
              <span class="suape-cp-chip-count" id="suape-cp-count-all" style="display:none;">0</span>
            </button>
            <button type="button" class="suape-cp-chip" data-scope="empenhos">
              ${ICONS.receipt}
              Empenhos
              <span class="suape-cp-chip-count count-emerald" id="suape-cp-count-empenhos" style="display:none;">0</span>
            </button>
            <button type="button" class="suape-cp-chip" data-scope="contratos">
              ${ICONS.fileStack}
              Contratos
              <span class="suape-cp-chip-count count-blue" id="suape-cp-count-contratos" style="display:none;">0</span>
            </button>
            <button type="button" class="suape-cp-chip" data-scope="screens">
              ${ICONS.layoutDashboard}
              Módulos
            </button>
            <button type="button" class="suape-cp-chip" data-scope="actions">
              ${ICONS.sparkles}
              Ações Rápidas
            </button>
          </div>
        </div>
        <div class="suape-cp-list"></div>
        <div class="suape-cp-footer">
          <div class="suape-cp-footer-left">
            <span><kbd class="suape-cp-key">↑</kbd> <kbd class="suape-cp-key">↓</kbd> Navegar</span>
            <span><kbd class="suape-cp-key">↵</kbd> Selecionar</span>
          </div>
          <div class="suape-cp-footer-right">
            <span>Sistema Gerencial</span>
            <span class="suape-cp-footer-dot">•</span>
            <kbd class="suape-cp-key suape-cp-key-accent">Ctrl + K</kbd>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlayEl);

    dialogEl = overlayEl.querySelector('#suape-cp-dialog');
    inputEl = overlayEl.querySelector('.suape-cp-input');
    listEl = overlayEl.querySelector('.suape-cp-list');

    // Scope chip events
    overlayEl.querySelectorAll('.suape-cp-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        overlayEl.querySelectorAll('.suape-cp-chip').forEach((c) => c.classList.remove('suape-cp-chip-active'));
        chip.classList.add('suape-cp-chip-active');
        activeScope = chip.dataset.scope || 'all';
        inputEl.focus();
        renderResults();
      });
    });

    // Input events
    inputEl.addEventListener('input', () => {
      selectedIndex = 0;
      renderResults();
    });

    inputEl.addEventListener('keydown', handleKeyNavigation);

    // Overlay click to close
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) closePalette();
    });

    // Create Details Modal DOM
    detailOverlayEl = document.createElement('div');
    detailOverlayEl.id = 'suape-cp-detail-overlay';
    detailOverlayEl.innerHTML = `
      <div id="suape-cp-detail-dialog">
        <div class="suape-cp-detail-header">
          <div class="suape-cp-detail-title-group">
            <h3 class="suape-cp-detail-title">Detalhes</h3>
          </div>
          <button type="button" class="suape-cp-detail-close" title="Fechar (Esc)">✕</button>
        </div>
        <div class="suape-cp-detail-body"></div>
      </div>
    `;
    document.body.appendChild(detailOverlayEl);

    detailDialogEl = detailOverlayEl.querySelector('#suape-cp-detail-dialog');
    detailOverlayEl.querySelector('.suape-cp-detail-close').addEventListener('click', closeDetailModal);
    detailOverlayEl.addEventListener('click', (e) => {
      if (e.target === detailOverlayEl) closeDetailModal();
    });
  }

  // Key navigation
  function handleKeyNavigation(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentResults.length > 0) {
        selectedIndex = (selectedIndex + 1) % currentResults.length;
        updateSelectedVisual();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentResults.length > 0) {
        selectedIndex = (selectedIndex - 1 + currentResults.length) % currentResults.length;
        updateSelectedVisual();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentResults[selectedIndex]) {
        openResultDetail(currentResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  }

  function updateSelectedVisual() {
    const items = listEl.querySelectorAll('.suape-cp-item');
    items.forEach((item, idx) => {
      if (idx === selectedIndex) {
        item.classList.add('suape-cp-item-selected');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('suape-cp-item-selected');
      }
    });
  }

  // Search filter matching SIAGES logic
  function getFilteredResults() {
    const rawVal = (inputEl?.value || '').trim();
    let query = rawVal;
    let scope = activeScope;

    // Detect prefix
    if (query.toLowerCase().startsWith('ne ') || query.toLowerCase().startsWith('empenho ') || query.toLowerCase().startsWith('ne:') || query.toLowerCase().startsWith('empenho:')) {
      query = rawVal.replace(/^(ne|empenho)[:\s]+/i, '').trim();
      scope = 'empenhos';
    } else if (query.toLowerCase().startsWith('contrato ') || query.toLowerCase().startsWith('contrato:')) {
      query = rawVal.replace(/^contrato[:\s]+/i, '').trim();
      scope = 'contratos';
    } else if (query.toLowerCase().startsWith('tela ') || query.toLowerCase().startsWith('modulo ') || query.toLowerCase().startsWith('tela:') || query.toLowerCase().startsWith('modulo:')) {
      query = rawVal.replace(/^(tela|modulo)[:\s]+/i, '').trim();
      scope = 'screens';
    } else if (query.toLowerCase().startsWith('acao ') || query.toLowerCase().startsWith('atalho ') || query.toLowerCase().startsWith('acao:') || query.toLowerCase().startsWith('atalho:')) {
      query = rawVal.replace(/^(acao|atalho)[:\s]+/i, '').trim();
      scope = 'actions';
    }

    let matchingEmpenhos = [];
    if (query && (scope === 'all' || scope === 'empenhos') && empenhosCache) {
      matchingEmpenhos = empenhosCache
        .map((emp) => ({ emp, score: scoreEmpenho(emp, query) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.emp)
        .slice(0, 10);
    }

    let matchingContratos = [];
    if (query && (scope === 'all' || scope === 'contratos') && contratosCache) {
      matchingContratos = contratosCache
        .map((cont) => ({ cont, score: scoreContrato(cont, query) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.cont)
        .slice(0, 8);
    }

    // Grouped screens
    let groupedScreens = [];
    if (scope === 'all' || scope === 'screens') {
      const qLower = query.toLowerCase();
      groupedScreens = appScreenGroups
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((group) => {
          const screens = appScreens
            .filter((s) => s.groupId === group.id)
            .filter((s) => {
              if (!qLower) return true;
              return s.name.toLowerCase().includes(qLower) || group.name.toLowerCase().includes(qLower);
            })
            .sort((a, b) => a.sortOrder - b.sortOrder);
          return { ...group, screens };
        })
        .filter((g) => g.screens.length > 0);
    }

    // Actions
    let matchingActions = [];
    if (scope === 'all' || scope === 'actions') {
      const qLower = query.toLowerCase();
      matchingActions = systemActions.filter((act) => {
        if (!qLower) return true;
        return act.title.toLowerCase().includes(qLower) || act.keywords.toLowerCase().includes(qLower) || act.subtitle.toLowerCase().includes(qLower);
      });
    }

    return { matchingEmpenhos, matchingContratos, groupedScreens, matchingActions, query };
  }

  // Render Results (Exact visual mirror of SIAGES)
  function renderResults() {
    if (!listEl) return;

    if (isFetching && !empenhosCache && !contratosCache) {
      listEl.innerHTML = `
        <div class="suape-cp-empty">
          <div class="suape-cp-spinner"></div>
          <p class="suape-cp-empty-title">Carregando dados...</p>
          <p class="suape-cp-empty-desc">Sincronizando dados com o SIAGES.</p>
        </div>
      `;
      currentResults = [];
      return;
    }

    const { matchingEmpenhos, matchingContratos, groupedScreens, matchingActions, query } = getFilteredResults();

    currentResults = [];
    matchingEmpenhos.forEach((e) => currentResults.push({ type: 'empenho', data: e }));
    matchingContratos.forEach((c) => currentResults.push({ type: 'contrato', data: c }));
    groupedScreens.forEach((g) => {
      g.screens.forEach((s) => currentResults.push({ type: 'screen', data: s, group: g }));
    });
    matchingActions.forEach((a) => currentResults.push({ type: 'action', data: a }));

    // Update counts on scope chips
    const countAllEl = overlayEl?.querySelector('#suape-cp-count-all');
    const countEmpEl = overlayEl?.querySelector('#suape-cp-count-empenhos');
    const countContEl = overlayEl?.querySelector('#suape-cp-count-contratos');

    if (countAllEl) {
      countAllEl.textContent = currentResults.length;
      countAllEl.style.display = query && currentResults.length > 0 ? 'inline-flex' : 'none';
    }
    if (countEmpEl) {
      countEmpEl.textContent = matchingEmpenhos.length;
      countEmpEl.style.display = matchingEmpenhos.length > 0 ? 'inline-flex' : 'none';
    }
    if (countContEl) {
      countContEl.textContent = matchingContratos.length;
      countContEl.style.display = matchingContratos.length > 0 ? 'inline-flex' : 'none';
    }

    if (currentResults.length === 0) {
      listEl.innerHTML = `
        <div class="suape-cp-empty">
          <div class="suape-cp-empty-icon">
            ${ICONS.search}
          </div>
          <p class="suape-cp-empty-title">Nenhum resultado encontrado</p>
          <p class="suape-cp-empty-desc">Não encontramos correspondências para "<strong>${escapeHtml(query)}</strong>". Tente o número da NE (ex: "32"), fornecedor ou módulo.</p>
        </div>
      `;
      return;
    }

    let html = '';
    let globalIndex = 0;

    // 1. EMPENHOS ENCONTRADOS (Quando pesquisando)
    if (matchingEmpenhos.length > 0) {
      html += `
        <div class="suape-cp-group-header">
          <span class="suape-cp-group-title empenho-group">
            ${ICONS.receipt}
            Empenhos Encontrados
          </span>
          <span class="suape-cp-group-count">${matchingEmpenhos.length} resultado(s)</span>
        </div>
      `;

      matchingEmpenhos.forEach((emp) => {
        const saldo = calculateEmpenhoSaldo(emp);
        const isSel = globalIndex === selectedIndex;
        const statusStr = (emp.status || 'pendente').toLowerCase();
        let statusBadgeClass = 'badge-pendente';
        if (statusStr === 'pago') statusBadgeClass = 'badge-pago';
        else if (statusStr === 'liquidado') statusBadgeClass = 'badge-liquidado';
        else if (statusStr === 'cancelado') statusBadgeClass = 'badge-cancelado';

        html += `
          <div class="suape-cp-item ${isSel ? 'suape-cp-item-selected' : ''}" data-index="${globalIndex}">
            <div class="suape-cp-item-icon empenho-icon">
              ${ICONS.receipt}
            </div>
            <div class="suape-cp-item-body">
              <div class="suape-cp-item-title-row">
                <span class="suape-cp-item-title">${highlightMatch(emp.numero, query)}</span>
                ${emp.tipo === 'rap' ? '<span class="suape-cp-badge badge-rap">RAP</span>' : ''}
                <span class="suape-cp-badge ${statusBadgeClass}">${escapeHtml(emp.status || 'Pendente')}</span>
              </div>
              <p class="suape-cp-item-subtitle">
                <span class="suape-cp-subtitle-main">${highlightMatch(emp.favorecido_nome || 'Favorecido não informado', query)}</span>
                ${emp.plano_interno ? `<span class="suape-cp-subtitle-extra">• PI: <span class="suape-cp-code">${highlightMatch(emp.plano_interno, query)}</span></span>` : ''}
              </p>
            </div>
            <div class="suape-cp-item-meta">
              <span class="suape-cp-item-meta-label">Saldo Disponível</span>
              <span class="suape-cp-item-meta-value value-saldo">${formatCurrency(saldo)}</span>
            </div>
            <span class="suape-cp-item-action-hint">Abrir ↵</span>
          </div>
        `;
        globalIndex++;
      });
    }

    // 2. CONTRATOS ATIVOS (Quando pesquisando)
    if (matchingContratos.length > 0) {
      if (matchingEmpenhos.length > 0) {
        html += `<div class="suape-cp-divider"></div>`;
      }

      html += `
        <div class="suape-cp-group-header">
          <span class="suape-cp-group-title contrato-group">
            ${ICONS.fileStack}
            Contratos Ativos
          </span>
          <span class="suape-cp-group-count">${matchingContratos.length} resultado(s)</span>
        </div>
      `;

      matchingContratos.forEach((cont) => {
        const isSel = globalIndex === selectedIndex;
        html += `
          <div class="suape-cp-item ${isSel ? 'suape-cp-item-selected item-selected-blue' : ''}" data-index="${globalIndex}">
            <div class="suape-cp-item-icon contrato-icon">
              ${ICONS.fileStack}
            </div>
            <div class="suape-cp-item-body">
              <div class="suape-cp-item-title-row">
                <span class="suape-cp-item-title-text">Contrato ${highlightMatch(cont.numero, query)}</span>
                <span class="suape-cp-badge badge-pago">Ativo</span>
              </div>
              <p class="suape-cp-item-subtitle">
                <span class="suape-cp-subtitle-main">${highlightMatch(cont.fornecedorNome || 'Fornecedor não informado', query)}</span>
                ${cont.objeto ? `<span class="suape-cp-subtitle-extra">• ${highlightMatch(cont.objeto, query)}</span>` : ''}
              </p>
            </div>
            <div class="suape-cp-item-meta">
              <span class="suape-cp-item-meta-label">Valor Global</span>
              <span class="suape-cp-item-meta-value value-dark">${formatCurrency(cont.valor)}</span>
            </div>
            <span class="suape-cp-item-action-hint hint-blue">Ver ↵</span>
          </div>
        `;
        globalIndex++;
      });
    }

    // 3. MÓDULOS AGRUPADOS (ORÇAMENTÁRIO, FINANCEIRO, etc.)
    if (groupedScreens.length > 0) {
      groupedScreens.forEach((group, gIdx) => {
        if (matchingEmpenhos.length > 0 || matchingContratos.length > 0 || gIdx > 0) {
          html += `<div class="suape-cp-divider"></div>`;
        }

        const groupIconSvg = ICONS[group.icon] || ICONS.fileText;

        html += `
          <div class="suape-cp-group-header">
            <span class="suape-cp-group-title">
              ${groupIconSvg}
              ${group.name}
            </span>
          </div>
        `;

        group.screens.forEach((screen) => {
          const isSel = globalIndex === selectedIndex;
          const screenIconSvg = ICONS[screen.icon] || groupIconSvg;

          html += `
            <div class="suape-cp-item suape-cp-screen-item ${isSel ? 'suape-cp-item-selected' : ''}" data-index="${globalIndex}">
              <div class="suape-cp-item-icon screen-icon">
                ${screenIconSvg}
              </div>
              <div class="suape-cp-item-body">
                <span class="suape-cp-screen-title">${highlightMatch(screen.name, query)}</span>
                <span class="suape-cp-group-tag">(${group.name})</span>
              </div>
              <span class="suape-cp-item-action-hint">Navegar ↵</span>
            </div>
          `;
          globalIndex++;
        });
      });
    }

    // 4. AÇÕES RÁPIDAS
    if (matchingActions.length > 0) {
      if (matchingEmpenhos.length > 0 || matchingContratos.length > 0 || groupedScreens.length > 0) {
        html += `<div class="suape-cp-divider"></div>`;
      }

      html += `
        <div class="suape-cp-group-header">
          <span class="suape-cp-group-title action-group">
            ${ICONS.sparkles}
            Ações Rápidas
          </span>
        </div>
      `;

      matchingActions.forEach((act) => {
        const isSel = globalIndex === selectedIndex;
        const actIconSvg = ICONS[act.icon] || ICONS.sparkles;

        html += `
          <div class="suape-cp-item ${isSel ? 'suape-cp-item-selected' : ''}" data-index="${globalIndex}">
            <div class="suape-cp-item-icon" style="color: ${act.color}; background: ${act.color}15;">
              ${actIconSvg}
            </div>
            <div class="suape-cp-item-body">
              <span class="suape-cp-screen-title">${highlightMatch(act.title, query)}</span>
              <span class="suape-cp-action-sub">${act.subtitle}</span>
            </div>
            <span class="suape-cp-item-action-hint">↵</span>
          </div>
        `;
        globalIndex++;
      });
    }

    listEl.innerHTML = html;

    // Attach click and hover events
    listEl.querySelectorAll('.suape-cp-item').forEach((item) => {
      item.addEventListener('click', () => {
        const idx = Number(item.dataset.index);
        if (currentResults[idx]) openResultDetail(currentResults[idx]);
      });
      item.addEventListener('mouseenter', () => {
        selectedIndex = Number(item.dataset.index);
        updateSelectedVisual();
      });
    });
  }

  // Open Results Detail or Navigate
  async function openResultDetail(result) {
    if (result.type === 'empenho') {
      openEmpenhoDetail(result.data);
    } else if (result.type === 'contrato') {
      openContratoDetail(result.data);
    } else if (result.type === 'screen' || result.type === 'action') {
      const url = `${SIAGES_APP_URL}${result.data.path}`;
      window.open(url, '_blank');
      closePalette();
    }
  }

  // Empenho Detail Modal
  function openEmpenhoDetail(emp) {
    const saldo = calculateEmpenhoSaldo(emp);
    const valorTotal = Number(emp.valor || 0);
    const liquidado = Number(emp.valor_liquidado_oficial || emp.valor_liquidado || 0);
    const pago = Number(emp.valor_pago_oficial || 0);

    const body = detailDialogEl.querySelector('.suape-cp-detail-body');
    detailDialogEl.querySelector('.suape-cp-detail-title').textContent = `Nota de Empenho: ${emp.numero}`;

    body.innerHTML = `
      <div class="suape-cp-metric-grid">
        <div class="suape-cp-metric-card">
          <p class="suape-cp-metric-label">Valor Empenhado</p>
          <p class="suape-cp-metric-value">${formatCurrency(valorTotal)}</p>
        </div>
        <div class="suape-cp-metric-card">
          <p class="suape-cp-metric-label">Valor Liquidado</p>
          <p class="suape-cp-metric-value">${formatCurrency(liquidado)}</p>
        </div>
        <div class="suape-cp-metric-card">
          <p class="suape-cp-metric-label">Valor Pago</p>
          <p class="suape-cp-metric-value">${formatCurrency(pago)}</p>
        </div>
        <div class="suape-cp-metric-card metric-highlight">
          <p class="suape-cp-metric-label">Saldo Disponível</p>
          <p class="suape-cp-metric-value">${formatCurrency(saldo)}</p>
        </div>
      </div>

      <div class="suape-cp-info-card">
        <div class="suape-cp-info-row">
          <span class="suape-cp-info-key">Favorecido:</span>
          <span class="suape-cp-info-val">${escapeHtml(emp.favorecido_nome) || '—'}</span>
        </div>
        ${emp.favorecido_documento ? `
          <div class="suape-cp-info-row">
            <span class="suape-cp-info-key">CPF / CNPJ:</span>
            <span class="suape-cp-info-val font-mono">${escapeHtml(emp.favorecido_documento)}</span>
          </div>
        ` : ''}
        ${emp.processo ? `
          <div class="suape-cp-info-row">
            <span class="suape-cp-info-key">Processo SUAP:</span>
            <span class="suape-cp-info-val font-mono">${escapeHtml(emp.processo)}</span>
          </div>
        ` : ''}
        ${emp.plano_interno ? `
          <div class="suape-cp-info-row">
            <span class="suape-cp-info-key">Plano Interno (PI):</span>
            <span class="suape-cp-info-val">${escapeHtml(emp.plano_interno)}</span>
          </div>
        ` : ''}
        ${emp.natureza_despesa ? `
          <div class="suape-cp-info-row">
            <span class="suape-cp-info-key">Natureza de Despesa:</span>
            <span class="suape-cp-info-val font-mono">${escapeHtml(emp.natureza_despesa)}</span>
          </div>
        ` : ''}
        <div class="suape-cp-info-row">
          <span class="suape-cp-info-key">Situação / Tipo:</span>
          <span class="suape-cp-info-val">${escapeHtml(emp.status) || 'Pendente'} ${emp.tipo === 'rap' ? '(RAP)' : ''}</span>
        </div>
        ${emp.descricao ? `
          <div class="suape-cp-info-row" style="flex-direction: column; align-items: flex-start;">
            <span class="suape-cp-info-key">Descrição:</span>
            <span class="suape-cp-info-val" style="text-align: left; margin-top: 4px;">${escapeHtml(emp.descricao)}</span>
          </div>
        ` : ''}
      </div>
    `;

    detailOverlayEl.classList.add('suape-cp-visible');
  }

  // Contrato Detail Modal
  async function openContratoDetail(cont) {
    const body = detailDialogEl.querySelector('.suape-cp-detail-body');
    detailDialogEl.querySelector('.suape-cp-detail-title').textContent = `Contrato ${cont.numero}`;

    body.innerHTML = `
      <div class="suape-cp-empty">
        <div class="suape-cp-spinner"></div>
        <p class="suape-cp-empty-title">Carregando detalhes do contrato...</p>
        <p class="suape-cp-empty-desc">Buscando faturas, empenhos e itens contratados.</p>
      </div>
    `;

    detailOverlayEl.classList.add('suape-cp-visible');

    let faturas = [];
    let itens = [];

    if (cont.isApi && cont.id) {
      try {
        const [faturasRes, itensRes] = await Promise.allSettled([
          fetchFromSupabase('contratos_api_faturas', `contrato_api_id=eq.${cont.id}&order=data_emissao.desc`),
          fetchFromSupabase('contratos_api_itens', `contrato_api_id=eq.${cont.id}&order=numero_item.asc`),
        ]);

        if (faturasRes.status === 'fulfilled') faturas = faturasRes.value || [];
        if (itensRes.status === 'fulfilled') itens = itensRes.value || [];
      } catch (err) {
        console.warn('Erro ao carregar detalhes extras do contrato', err);
      }
    }

    const valorTotal = Number(cont.valor || 0);
    const valorExecutado = faturas.reduce((acc, f) => acc + (Number(f.valor_liquidado || f.valor_bruto || 0)), 0);
    const saldo = Math.max(0, valorTotal - valorExecutado);

    body.innerHTML = `
      <div class="suape-cp-metric-grid">
        <div class="suape-cp-metric-card">
          <p class="suape-cp-metric-label">Valor Global / Acumulado</p>
          <p class="suape-cp-metric-value">${formatCurrency(valorTotal)}</p>
        </div>
        <div class="suape-cp-metric-card">
          <p class="suape-cp-metric-label">Valor Executado (Faturas)</p>
          <p class="suape-cp-metric-value">${formatCurrency(valorExecutado)}</p>
        </div>
        <div class="suape-cp-metric-card metric-highlight">
          <p class="suape-cp-metric-label">Saldo Contratual</p>
          <p class="suape-cp-metric-value">${formatCurrency(saldo)}</p>
        </div>
      </div>

      <div class="suape-cp-info-card">
        <div class="suape-cp-info-row">
          <span class="suape-cp-info-key">Fornecedor:</span>
          <span class="suape-cp-info-val">${escapeHtml(cont.fornecedorNome) || '—'}</span>
        </div>
        <div class="suape-cp-info-row">
          <span class="suape-cp-info-key">Vigência:</span>
          <span class="suape-cp-info-val">${formatDate(cont.vigenciaInicio)} até ${formatDate(cont.vigenciaFim)}</span>
        </div>
        ${cont.processo ? `
          <div class="suape-cp-info-row">
            <span class="suape-cp-info-key">Processo:</span>
            <span class="suape-cp-info-val font-mono">${escapeHtml(cont.processo)}</span>
          </div>
        ` : ''}
        ${cont.objeto ? `
          <div class="suape-cp-info-row" style="flex-direction: column; align-items: flex-start;">
            <span class="suape-cp-info-key">Objeto:</span>
            <span class="suape-cp-info-val" style="text-align: left; margin-top: 4px;">${escapeHtml(cont.objeto)}</span>
          </div>
        ` : ''}
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px; margin-bottom: 6px;">
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Detalhamento</span>
        <div class="suape-cp-tabs">
          <button type="button" class="suape-cp-tab-btn suape-cp-tab-active" data-tab="faturas">Faturas (${faturas.length})</button>
          <button type="button" class="suape-cp-tab-btn" data-tab="itens">Itens (${itens.length})</button>
        </div>
      </div>

      <div id="suape-cp-tab-faturas-content" style="display: flex; flex-direction: column; gap: 8px;">
        ${faturas.length > 0 ? faturas.map((f) => `
          <div class="suape-cp-entry-card">
            <div class="suape-cp-entry-top">
              <span class="suape-cp-entry-title">Fatura ${escapeHtml(f.numero_fatura || f.id)}</span>
              <span class="suape-cp-entry-value">${formatCurrency(f.valor_bruto || f.valor_liquidado || 0)}</span>
            </div>
            <p class="suape-cp-entry-desc">
              Emissão: ${formatDate(f.data_emissao)} • Situação: ${escapeHtml(f.situacao || 'Apropriado')}
              ${f.periodo_inicio ? ` • Período: ${formatDate(f.periodo_inicio)} a ${formatDate(f.periodo_fim)}` : ''}
            </p>
          </div>
        `).join('') : '<p class="suape-cp-empty-desc" style="text-align: center; padding: 12px;">Nenhuma fatura associada na API.</p>'}
      </div>

      <div id="suape-cp-tab-itens-content" style="display: none; flex-direction: column; gap: 8px;">
        ${itens.length > 0 ? itens.map((it) => `
          <div class="suape-cp-entry-card">
            <div class="suape-cp-entry-top">
              <span class="suape-cp-entry-title">Item ${escapeHtml(it.numero_item || '')} • ${escapeHtml(it.descricao || 'Item do Contrato')}</span>
              <span class="suape-cp-entry-value">${formatCurrency(it.valor_total || (Number(it.quantidade || 0) * Number(it.valor_unitario || 0)))}</span>
            </div>
            <p class="suape-cp-entry-desc">
              Qtd. ${formatNumber(it.quantidade)} | Unitário ${formatCurrency(it.valor_unitario || 0)}
            </p>
          </div>
        `).join('') : '<p class="suape-cp-empty-desc" style="text-align: center; padding: 12px;">Nenhum item discriminado na API.</p>'}
      </div>
    `;

    // Tab switcher events
    const tabFaturasBtn = body.querySelector('[data-tab="faturas"]');
    const tabItensBtn = body.querySelector('[data-tab="itens"]');
    const tabFaturasContent = body.querySelector('#suape-cp-tab-faturas-content');
    const tabItensContent = body.querySelector('#suape-cp-tab-itens-content');

    tabFaturasBtn?.addEventListener('click', () => {
      tabFaturasBtn.classList.add('suape-cp-tab-active');
      tabItensBtn?.classList.remove('suape-cp-tab-active');
      tabFaturasContent.style.display = 'flex';
      tabItensContent.style.display = 'none';
    });

    tabItensBtn?.addEventListener('click', () => {
      tabItensBtn.classList.add('suape-cp-tab-active');
      tabFaturasBtn?.classList.remove('suape-cp-tab-active');
      tabItensContent.style.display = 'flex';
      tabFaturasContent.style.display = 'none';
    });
  }

  function closeDetailModal() {
    if (detailOverlayEl) detailOverlayEl.classList.remove('suape-cp-visible');
  }

  function openPalette() {
    createPaletteDOM();
    overlayEl.classList.add('suape-cp-visible');
    inputEl.value = '';
    selectedIndex = 0;
    inputEl.focus();
    renderResults();
    loadData(false);
  }

  function closePalette() {
    if (overlayEl) overlayEl.classList.remove('suape-cp-visible');
    closeDetailModal();
  }

  function togglePalette() {
    if (overlayEl && overlayEl.classList.contains('suape-cp-visible')) {
      closePalette();
    } else {
      openPalette();
    }
  }

  // Global keydown listener
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      togglePalette();
    } else if (e.key === 'Escape') {
      if (detailOverlayEl?.classList.contains('suape-cp-visible')) {
        closeDetailModal();
      } else if (overlayEl?.classList.contains('suape-cp-visible')) {
        closePalette();
      }
    }
  });

  // Pre-load data on idle
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => loadData(false));
  } else {
    setTimeout(() => loadData(false), 2000);
  }
})();
