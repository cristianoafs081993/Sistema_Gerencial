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
    upload: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    send: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    fastForward: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/></svg>',
    folder: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
    gitFork: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/><path d="M12 12v3"/></svg>',
    filePlus: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M12 12v6"/></svg>',
    bell: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    graduationCap: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>',
    user: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    sun: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
    moon: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
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

  // Process Actions & Shortcuts
  function getCurrentProcessId() {
    // 1. Direct match on pathname
    const directMatch = window.location.pathname.match(
      /\/(?:processo_eletronico\/(?:processo|visualizar_processo|documento_upload|adicionar_despacho|adicionar_documento_texto|solicitar_ciencia|processo\/(?:encaminhar|encaminhar_sem_despacho))|documento_eletronico\/(?:documento|visualizar_documento))\/(\d+)\/?/
    );
    if (directMatch && directMatch[1]) return directMatch[1];

    // 2. Query param
    const params = new URLSearchParams(window.location.search);
    const paramId = params.get('processo') || params.get('processo_id') || params.get('suapId') || params.get('id');
    if (paramId && /^\d+$/.test(paramId)) return paramId;

    // 3. Document links in DOM if on a related process page
    const processLink = document.querySelector('a[href*="/processo_eletronico/processo/"], a[href*="/processo_eletronico/visualizar_processo/"]');
    if (processLink) {
      const linkMatch = processLink.getAttribute('href')?.match(/\/processo_eletronico\/(?:processo|visualizar_processo)\/(\d+)\/?/);
      if (linkMatch && linkMatch[1]) return linkMatch[1];
    }

    // 4. Referrer if available
    if (document.referrer) {
      const refMatch = document.referrer.match(/\/processo_eletronico\/(?:processo|visualizar_processo)\/(\d+)\/?/);
      if (refMatch && refMatch[1]) return refMatch[1];
    }

    return null;
  }

  function getProcessActions(processId) {
    if (!processId) return [];
    return [
      {
        id: 'proc-upload',
        title: 'Fazer Upload de Documento',
        subtitle: `Anexar arquivo digitalizado ao processo #${processId}`,
        shortcuts: ['up', 'upload', 'doc', 'upld', 'anexar'],
        url: `/processo_eletronico/documento_upload/${processId}/`,
        icon: 'upload',
        color: '#0A7F70',
        badge: 'up',
      },
      {
        id: 'proc-encaminhar',
        title: 'Encaminhar Processo',
        subtitle: `Tramitar processo #${processId} com despacho`,
        shortcuts: ['enc', 'encaminhar', 'despacho', 'tramitar'],
        url: `/processo_eletronico/processo/encaminhar/${processId}/`,
        icon: 'send',
        color: '#2563eb',
        badge: 'enc',
      },
      {
        id: 'proc-encaminhar-sem-despacho',
        title: 'Encaminhar Sem Despacho',
        subtitle: `Tramitar processo #${processId} direto sem despacho`,
        shortcuts: ['encs', 'semdespacho', 'encsem', 'tramitarsem', 'sem'],
        url: `/processo_eletronico/processo/encaminhar_sem_despacho/${processId}/`,
        icon: 'fastForward',
        color: '#d97706',
        badge: 'encs',
      },
      {
        id: 'proc-capa',
        title: 'Ver Capa do Processo',
        subtitle: `Página principal e dados do processo #${processId}`,
        shortcuts: ['capa', 'proc', 'processo', 'home'],
        url: `/processo_eletronico/processo/${processId}/`,
        icon: 'folder',
        color: '#475569',
        badge: 'capa',
      },
      {
        id: 'proc-visualizar',
        title: 'Visualizar Árvore de Documentos',
        subtitle: `Ver todos os documentos e timeline do processo #${processId}`,
        shortcuts: ['vis', 'docs', 'arvore', 'timeline'],
        url: `/processo_eletronico/visualizar_processo/${processId}/`,
        icon: 'gitFork',
        color: '#7c3aed',
        badge: 'vis',
      },
      {
        id: 'proc-despacho',
        title: 'Adicionar Despacho / Documento',
        subtitle: `Criar novo documento no processo #${processId}`,
        shortcuts: ['desp', 'add', 'novo', 'texto'],
        url: `/processo_eletronico/adicionar_despacho/${processId}/`,
        icon: 'filePlus',
        color: '#059669',
        badge: 'desp',
      },
      {
        id: 'proc-ciencia',
        title: 'Solicitar Ciência',
        subtitle: `Notificar interessados sobre o processo #${processId}`,
        shortcuts: ['cie', 'ciencia', 'notificar'],
        url: `/processo_eletronico/solicitar_ciencia/${processId}/`,
        icon: 'bell',
        color: '#ea580c',
        badge: 'cie',
      },
    ];
  }

  function scoreProcessAction(act, rawQuery) {
    if (!rawQuery) return 100;
    const q = rawQuery.trim().toLowerCase();

    for (const shortcut of act.shortcuts) {
      const s = shortcut.toLowerCase();
      if (s === q) return 100000;
      if (s.startsWith(q)) return 50000;
    }

    const title = act.title.toLowerCase();
    const subtitle = act.subtitle.toLowerCase();
    if (title.startsWith(q)) return 30000;
    if (title.includes(q)) return 20000;
    if (subtitle.includes(q)) return 10000;

    return 0;
  }

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
      if (emp.saldo_rap_oficial != null && !Number.isNaN(Number(emp.saldo_rap_oficial))) {
        return Math.max(0, Number(emp.saldo_rap_oficial));
      }
      const rapInscrito = Number(emp.rap_inscrito || 0);
      const rapALiquidar = Number(emp.rap_a_liquidar || 0);
      const rapLiquidado = Number(emp.rap_liquidado || 0);
      const rapPago = Number(emp.rap_pago || 0);
      const base = rapInscrito > 0 ? rapInscrito : rapALiquidar;
      return Math.max(0, base - Math.max(rapLiquidado, rapPago));
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

    // 1. Termo genérico de busca
    if (q === 'contrato' || q === 'contratos' || q === 'ct') {
      score += 1000;
    }

    // 2. Número do contrato
    if (num === q) score += 20000;
    else if (num.startsWith(q)) score += 15000;
    else if (num.includes(q)) score += 10000;

    if (digits.length >= 1) {
      const cleanContratoNum = num.replace(/\/.*$/, '').replace(/^0+/, '');
      if (cleanContratoNum === digits) score += 18000;
      else if (cleanContratoNum.startsWith(digits)) score += 12000;
      else if (num.replace(/\D/g, '').includes(digits)) score += 6000;
    }

    // 3. Fornecedor
    if (forn) {
      if (forn.startsWith(q)) score += 5000;
      else if (forn.includes(q)) score += 3000;
      else if (words.length > 1 && words.every((w) => forn.includes(w))) score += 4000;
    }

    // 4. Objeto
    if (obj) {
      if (obj.includes(q)) score += 2000;
      else if (words.length > 1 && words.every((w) => obj.includes(w))) score += 2500;
    }

    // 5. Processo
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
        fetchFromSupabase('empenhos', 'select=id,numero,descricao,valor,natureza_despesa,plano_interno,favorecido_nome,favorecido_documento,valor_liquidado,valor_liquidado_oficial,valor_pago_oficial,valor_liquidado_a_pagar,status,tipo,rap_inscrito,rap_a_liquidar,rap_liquidado,rap_pago,saldo_rap_oficial,processo&order=numero.desc&limit=1500'),
        fetchFromSupabase('contratos_api', 'select=id,api_contrato_id,numero,fornecedor_nome,fornecedor_documento,unidade_codigo,unidade_nome,unidade_origem_codigo,unidade_origem_nome,objeto,processo,vigencia_inicio,vigencia_fim,vigencia_inicio_derivada,vigencia_fim_derivada,valor_global,valor_acumulado,situacao,situacao_derivada,campus_scope_reason,updated_at&situacao_derivada=eq.true&campus_scope_reason=in.(ug_campus,reitoria_com_empenho_campus,reitoria_com_fatura_campus)&order=numero.asc'),
        fetchFromSupabase('contratos', 'select=id,numero,contratada,objeto,processo,valor,data_inicio,data_termino,status'),
      ]);

      if (empenhosData.status === 'fulfilled') {
        empenhosCache = empenhosData.value || [];
      }

      const apiContratos = contratosApiData.status === 'fulfilled' ? (contratosApiData.value || []) : [];
      const localContratos = contratosLocaisData.status === 'fulfilled' ? (contratosLocaisData.value || []) : [];

      const contratosMap = new Map();
      for (const api of apiContratos) {
        if (api.situacao_derivada !== true) continue;
        if (api.campus_scope_reason && !['ug_campus', 'reitoria_com_empenho_campus', 'reitoria_com_fatura_campus'].includes(api.campus_scope_reason)) {
          continue;
        }

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

  const THEME_STORAGE_KEY = 'siages-palette-theme';
  let currentPaletteTheme = 'auto'; // 'auto' | 'light' | 'dark'

  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      currentPaletteTheme = savedTheme;
    }
  } catch (_) {}

  function getEffectiveTheme() {
    if (currentPaletteTheme === 'light' || currentPaletteTheme === 'dark') {
      return currentPaletteTheme;
    }
    if (
      document.body.classList.contains('theme-luna') ||
      document.documentElement.classList.contains('dark') ||
      document.body.classList.contains('dark') ||
      document.body.getAttribute('data-theme') === 'dark' ||
      window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
    return 'light';
  }

  function applyPaletteTheme(theme) {
    currentPaletteTheme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (_) {}

    const effective = getEffectiveTheme();
    if (overlayEl) {
      overlayEl.dataset.theme = effective;
    }
    if (detailOverlayEl) {
      detailOverlayEl.dataset.theme = effective;
    }

    const iconHtml = effective === 'dark' ? ICONS.sun : ICONS.moon;
    const titleText = effective === 'dark' ? 'Alternar para modo claro' : 'Alternar para modo escuro';

    const mainBtn = overlayEl?.querySelector('#suape-cp-theme-toggle');
    if (mainBtn) {
      mainBtn.innerHTML = iconHtml;
      mainBtn.title = titleText;
      mainBtn.setAttribute('aria-label', titleText);
    }
    const detailBtn = detailOverlayEl?.querySelector('#suape-cp-detail-theme-toggle');
    if (detailBtn) {
      detailBtn.innerHTML = iconHtml;
      detailBtn.title = titleText;
      detailBtn.setAttribute('aria-label', titleText);
    }
  }

  function togglePaletteTheme() {
    const current = getEffectiveTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    applyPaletteTheme(next);
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
            <input type="text" class="suape-cp-input" placeholder="Digite um comando, NE, contrato, fornecedor ou módulo..." autocomplete="off" spellcheck="false" autofocus />
            <button type="button" class="suape-cp-theme-btn" id="suape-cp-theme-toggle" title="Alternar tema claro/escuro" aria-label="Alternar tema claro/escuro"></button>
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
            <button type="button" class="suape-cp-chip suape-cp-chip-processo" data-scope="processo" id="suape-cp-chip-processo" style="display:none;">
              ${ICONS.folder}
              Processo
              <span class="suape-cp-chip-count count-teal" id="suape-cp-count-processo" style="display:none;">0</span>
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

    // Theme toggle events
    overlayEl.querySelector('#suape-cp-theme-toggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePaletteTheme();
      inputEl?.focus();
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
          <div class="suape-cp-detail-header-actions">
            <button type="button" class="suape-cp-theme-btn" id="suape-cp-detail-theme-toggle" title="Alternar tema claro/escuro" aria-label="Alternar tema claro/escuro"></button>
            <button type="button" class="suape-cp-detail-close" title="Fechar (Esc)">✕</button>
          </div>
        </div>
        <div class="suape-cp-detail-body"></div>
      </div>
    `;
    document.body.appendChild(detailOverlayEl);

    detailDialogEl = detailOverlayEl.querySelector('#suape-cp-detail-dialog');
    detailOverlayEl.querySelector('.suape-cp-detail-close').addEventListener('click', closeDetailModal);
    detailOverlayEl.querySelector('#suape-cp-detail-theme-toggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePaletteTheme();
    });
    detailOverlayEl.addEventListener('click', (e) => {
      if (e.target === detailOverlayEl) closeDetailModal();
    });

    applyPaletteTheme(currentPaletteTheme);
  }

  function updateProcessChip() {
    const procId = getCurrentProcessId();
    const chipProcesso = overlayEl?.querySelector('#suape-cp-chip-processo');
    if (chipProcesso) {
      chipProcesso.style.display = 'inline-flex';
      chipProcesso.innerHTML = `
        ${ICONS.folder}
        ${procId ? `Processo #${procId}` : 'Processos'}
        <span class="suape-cp-chip-count count-teal" id="suape-cp-count-processo" style="display:none;">0</span>
      `;
    }
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
        openResultDetail(currentResults[selectedIndex], e);
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

  function getSuapContractSearchUrl(query) {
    const urlParams = new URLSearchParams(window.location.search);
    const campi = urlParams.get('campi') || '3';
    const baseParams = new URLSearchParams();
    baseParams.set('campi', campi);
    if (query) {
      baseParams.set('q', query.trim());
    }
    baseParams.set('tab', 'tab_ativos');
    return `/admin/contratos/contrato/?${baseParams.toString()}`;
  }

  function getSuapProcessSearchUrl(query) {
    if (!query) return '/admin/processo_eletronico/processo/';
    const baseParams = new URLSearchParams();
    baseParams.set('q', query.trim());
    return `/admin/processo_eletronico/processo/?${baseParams.toString()}`;
  }

  function getSuapStudentUrl(query) {
    const q = (query || '').trim();
    if (/^\d+$/.test(q)) {
      return `/edu/aluno/${q}/`;
    }
    return `/edu/alunos/?q=${encodeURIComponent(q)}`;
  }

  function getSuapDocumentSearchUrl(query) {
    if (!query) return '/admin/documento_eletronico/documentotexto/?opcao=1';
    const baseParams = new URLSearchParams();
    baseParams.set('opcao', '1');
    baseParams.set('q', query.trim());
    return `/admin/documento_eletronico/documentotexto/?${baseParams.toString()}`;
  }

  // Search filter matching SIAGES logic
  function getFilteredResults() {
    const rawVal = (inputEl?.value || '').trim();
    let query = rawVal;
    let scope = activeScope;
    const currentProcId = getCurrentProcessId();

    // Detect prefix
    let isExplicitContractSearch = false;
    let isExplicitProcessSearch = false;
    let isExplicitStudentSearch = false;
    let isExplicitDocumentSearch = false;

    if (query.toLowerCase().startsWith('ne ') || query.toLowerCase().startsWith('empenho ') || query.toLowerCase().startsWith('ne:') || query.toLowerCase().startsWith('empenho:')) {
      query = rawVal.replace(/^(ne|empenho)[:\s]+/i, '').trim();
      scope = 'empenhos';
    } else if (
      query.toLowerCase().startsWith('contrato ') || query.toLowerCase().startsWith('contratos ') ||
      query.toLowerCase().startsWith('contrato:') || query.toLowerCase().startsWith('contratos:') ||
      query.toLowerCase().startsWith('con ') || query.toLowerCase().startsWith('con:') ||
      query.toLowerCase().startsWith('c ') || query.toLowerCase().startsWith('c:')
    ) {
      query = rawVal.replace(/^(contratos|contrato|con|c)[:\s]+/i, '').trim();
      scope = 'contratos';
      isExplicitContractSearch = true;
    } else if (
      query.toLowerCase().startsWith('processos ') || query.toLowerCase().startsWith('processo ') ||
      query.toLowerCase().startsWith('processos:') || query.toLowerCase().startsWith('processo:') ||
      query.toLowerCase().startsWith('proc ') || query.toLowerCase().startsWith('proc:') ||
      query.toLowerCase().startsWith('p ') || query.toLowerCase().startsWith('p:')
    ) {
      query = rawVal.replace(/^(processos|processo|proc|p)[:\s]+/i, '').trim();
      scope = 'processo';
      isExplicitProcessSearch = true;
    } else if (
      query.toLowerCase().startsWith('alunos ') || query.toLowerCase().startsWith('aluno ') ||
      query.toLowerCase().startsWith('alunos:') || query.toLowerCase().startsWith('aluno:') ||
      query.toLowerCase().startsWith('alu ') || query.toLowerCase().startsWith('alu:') ||
      query.toLowerCase().startsWith('matricula ') || query.toLowerCase().startsWith('matricula:') ||
      query.toLowerCase().startsWith('mat ') || query.toLowerCase().startsWith('mat:') ||
      query.toLowerCase().startsWith('a ') || query.toLowerCase().startsWith('a:')
    ) {
      query = rawVal.replace(/^(alunos|aluno|matricula|alu|mat|a)[:\s]+/i, '').trim();
      isExplicitStudentSearch = true;
    } else if (
      query.toLowerCase().startsWith('documentos ') || query.toLowerCase().startsWith('documento ') ||
      query.toLowerCase().startsWith('documentos:') || query.toLowerCase().startsWith('documento:') ||
      query.toLowerCase().startsWith('docto ') || query.toLowerCase().startsWith('docto:') ||
      query.toLowerCase().startsWith('doc ') || query.toLowerCase().startsWith('doc:') ||
      query.toLowerCase().startsWith('d ') || query.toLowerCase().startsWith('d:')
    ) {
      query = rawVal.replace(/^(documentos|documento|docto|doc|d)[:\s]+/i, '').trim();
      isExplicitDocumentSearch = true;
    } else if (query.toLowerCase().startsWith('tela ') || query.toLowerCase().startsWith('modulo ') || query.toLowerCase().startsWith('tela:') || query.toLowerCase().startsWith('modulo:')) {
      query = rawVal.replace(/^(tela|modulo)[:\s]+/i, '').trim();
      scope = 'screens';
    } else if (query.toLowerCase().startsWith('acao ') || query.toLowerCase().startsWith('atalho ') || query.toLowerCase().startsWith('acao:') || query.toLowerCase().startsWith('atalho:')) {
      query = rawVal.replace(/^(acao|atalho)[:\s]+/i, '').trim();
      scope = 'actions';
    }

    // Auto-detect format patterns
    if (/^\d{5}\.\d{6}\.\d{4}-\d{2}$/.test(query) || /^230\d{2}\./.test(query)) {
      isExplicitProcessSearch = true;
    } else if (/^20\d{10,14}$/.test(query) || /^\d{13,15}$/.test(query)) {
      isExplicitStudentSearch = true;
    }

    let matchingProcessActions = [];
    if (currentProcId && (scope === 'all' || scope === 'processo' || scope === 'actions')) {
      const allProcActions = getProcessActions(currentProcId);
      matchingProcessActions = allProcActions
        .map((act) => ({ act, score: scoreProcessAction(act, query) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.act);
    }

    let suapProcessSearchAction = null;
    if (query && (scope === 'all' || scope === 'processo' || isExplicitProcessSearch)) {
      const processUrl = getSuapProcessSearchUrl(query);
      suapProcessSearchAction = {
        id: 'suap-search-processo',
        title: `Buscar "${query}" no SUAP Processos`,
        subtitle: `Abrir consulta oficial de processos eletrônicos (${processUrl})`,
        url: processUrl,
        icon: 'search',
        color: '#0d9488',
        badge: 'suap',
      };
    }

    let suapStudentAction = null;
    if (query && (scope === 'all' || isExplicitStudentSearch)) {
      const studentUrl = getSuapStudentUrl(query);
      const isMatricula = /^\d+$/.test(query.trim());
      suapStudentAction = {
        id: 'suap-search-aluno',
        title: isMatricula ? `Abrir Aluno #${query}` : `Buscar Aluno "${query}" no SUAP`,
        subtitle: `Acessar registro acadêmico no SUAP (${studentUrl})`,
        url: studentUrl,
        icon: 'graduationCap',
        color: '#6366f1',
        badge: 'suap',
      };
    }

    let suapDocumentSearchAction = null;
    if (query && (scope === 'all' || isExplicitDocumentSearch)) {
      const docUrl = getSuapDocumentSearchUrl(query);
      suapDocumentSearchAction = {
        id: 'suap-search-documento',
        title: `Buscar "${query}" no SUAP Documentos`,
        subtitle: `Abrir consulta oficial de documentos eletrônicos (${docUrl})`,
        url: docUrl,
        icon: 'fileText',
        color: '#8b5cf6',
        badge: 'suap',
      };
    }

    let matchingEmpenhos = [];
    if ((scope === 'all' || scope === 'empenhos') && empenhosCache) {
      const withSaldo = empenhosCache.filter((emp) => calculateEmpenhoSaldo(emp) > 0);
      if (!query && scope === 'empenhos') {
        matchingEmpenhos = withSaldo.slice(0, 15);
      } else if (query) {
        matchingEmpenhos = withSaldo
          .map((emp) => ({ emp, score: scoreEmpenho(emp, query) }))
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((item) => item.emp)
          .slice(0, 10);
      }
    }

    let matchingContratos = [];
    if ((scope === 'all' || scope === 'contratos') && contratosCache) {
      if (!query && scope === 'contratos') {
        matchingContratos = contratosCache.slice(0, 15);
      } else if (query) {
        matchingContratos = contratosCache
          .map((cont) => ({ cont, score: scoreContrato(cont, query) }))
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((item) => item.cont)
          .slice(0, 8);
      }
    }

    let suapContractSearchAction = null;
    if (query && (scope === 'all' || scope === 'contratos')) {
      const contractUrl = getSuapContractSearchUrl(query);
      suapContractSearchAction = {
        id: 'suap-search-contratos',
        title: `Buscar "${query}" no SUAP Contratos`,
        subtitle: `Abrir consulta oficial de contratos ativos (${contractUrl})`,
        url: contractUrl,
        icon: 'search',
        color: '#2563eb',
        badge: 'suap',
      };
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

    return {
      matchingProcessActions,
      suapProcessSearchAction,
      isExplicitProcessSearch,
      suapStudentAction,
      isExplicitStudentSearch,
      suapDocumentSearchAction,
      isExplicitDocumentSearch,
      matchingEmpenhos,
      matchingContratos,
      suapContractSearchAction,
      isExplicitContractSearch,
      groupedScreens,
      matchingActions,
      query,
      currentProcId,
    };
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

    const {
      matchingProcessActions,
      suapProcessSearchAction,
      isExplicitProcessSearch,
      suapStudentAction,
      isExplicitStudentSearch,
      suapDocumentSearchAction,
      isExplicitDocumentSearch,
      matchingEmpenhos,
      matchingContratos,
      suapContractSearchAction,
      isExplicitContractSearch,
      groupedScreens,
      matchingActions,
      query,
      currentProcId,
    } = getFilteredResults();

    const hasHighPriorityShortcut = query && matchingProcessActions.some((p) => {
      const q = query.trim().toLowerCase();
      return p.shortcuts.some((s) => s.toLowerCase() === q || s.toLowerCase().startsWith(q)) || p.title.toLowerCase().startsWith(q);
    });

    currentResults = [];
    if (isExplicitStudentSearch && suapStudentAction) {
      currentResults.push({ type: 'suap_student_search', data: suapStudentAction });
    }
    if (isExplicitDocumentSearch && suapDocumentSearchAction) {
      currentResults.push({ type: 'suap_document_search', data: suapDocumentSearchAction });
    }
    if (isExplicitProcessSearch && suapProcessSearchAction) {
      currentResults.push({ type: 'suap_process_search', data: suapProcessSearchAction });
    }
    if (hasHighPriorityShortcut) {
      matchingProcessActions.forEach((p) => currentResults.push({ type: 'process_action', data: p, processId: currentProcId }));
    }
    matchingEmpenhos.forEach((e) => currentResults.push({ type: 'empenho', data: e }));

    // Contratos
    if (isExplicitContractSearch && suapContractSearchAction) {
      currentResults.push({ type: 'suap_contract_search', data: suapContractSearchAction });
    }
    matchingContratos.forEach((c) => currentResults.push({ type: 'contrato', data: c }));
    if (!isExplicitContractSearch && suapContractSearchAction && (matchingContratos.length > 0 || activeScope === 'contratos')) {
      currentResults.push({ type: 'suap_contract_search', data: suapContractSearchAction });
    }

    groupedScreens.forEach((g) => {
      g.screens.forEach((s) => currentResults.push({ type: 'screen', data: s, group: g }));
    });
    matchingActions.forEach((a) => currentResults.push({ type: 'action', data: a }));

    if (!hasHighPriorityShortcut && matchingProcessActions && matchingProcessActions.length > 0) {
      matchingProcessActions.forEach((p) => currentResults.push({ type: 'process_action', data: p, processId: currentProcId }));
    }
    if (!isExplicitProcessSearch && suapProcessSearchAction && ((matchingProcessActions && matchingProcessActions.length > 0) || activeScope === 'processo')) {
      currentResults.push({ type: 'suap_process_search', data: suapProcessSearchAction });
    }

    if (!isExplicitStudentSearch && suapStudentAction && (activeScope === 'all' || activeScope === 'actions')) {
      currentResults.push({ type: 'suap_student_search', data: suapStudentAction });
    }
    if (!isExplicitDocumentSearch && suapDocumentSearchAction && (activeScope === 'all' || activeScope === 'actions')) {
      currentResults.push({ type: 'suap_document_search', data: suapDocumentSearchAction });
    }

    // Update counts on scope chips
    const countAllEl = overlayEl?.querySelector('#suape-cp-count-all');
    const countProcEl = overlayEl?.querySelector('#suape-cp-count-processo');
    const countEmpEl = overlayEl?.querySelector('#suape-cp-count-empenhos');
    const countContEl = overlayEl?.querySelector('#suape-cp-count-contratos');

    if (countAllEl) {
      countAllEl.textContent = currentResults.length;
      countAllEl.style.display = query && currentResults.length > 0 ? 'inline-flex' : 'none';
    }
    if (countProcEl) {
      const showProcSearch = suapProcessSearchAction && (isExplicitProcessSearch || activeScope === 'processo' || (matchingProcessActions && matchingProcessActions.length > 0));
      const procTotal = (matchingProcessActions ? matchingProcessActions.length : 0) + (showProcSearch ? 1 : 0);
      countProcEl.textContent = procTotal;
      countProcEl.style.display = procTotal > 0 ? 'inline-flex' : 'none';
    }
    if (countEmpEl) {
      countEmpEl.textContent = matchingEmpenhos.length;
      countEmpEl.style.display = matchingEmpenhos.length > 0 ? 'inline-flex' : 'none';
    }
    if (countContEl) {
      const contTotal = matchingContratos.length + (suapContractSearchAction ? 1 : 0);
      countContEl.textContent = contTotal;
      countContEl.style.display = contTotal > 0 ? 'inline-flex' : 'none';
    }

    if (currentResults.length === 0) {
      listEl.innerHTML = `
        <div class="suape-cp-empty">
          <div class="suape-cp-empty-icon">
            ${ICONS.search}
          </div>
          <p class="suape-cp-empty-title">Nenhum resultado encontrado</p>
          <p class="suape-cp-empty-desc">Não encontramos correspondências para "<strong>${escapeHtml(query)}</strong>". Tente matrícula do aluno (ex: "alu 2009..."), documento (ex: "doc texto"), processo ou contrato.</p>
        </div>
      `;
      return;
    }

    let html = '';
    let globalIndex = 0;

    function renderStudentBlock() {
      if (!suapStudentAction) return '';
      let block = '';
      if (html.length > 0) {
        block += `<div class="suape-cp-divider"></div>`;
      }
      block += `
        <div class="suape-cp-group-header">
          <span class="suape-cp-group-title" style="color: #6366f1;">
            ${ICONS.graduationCap}
            Aluno / Ensino
          </span>
        </div>
      `;
      const isSel = globalIndex === selectedIndex;
      block += `
        <div class="suape-cp-item ${isSel ? 'suape-cp-item-selected' : ''}" data-index="${globalIndex}">
          <div class="suape-cp-item-icon" style="color: #6366f1; background: #6366f115;">
            ${ICONS.graduationCap}
          </div>
          <div class="suape-cp-item-body">
            <div class="suape-cp-item-title-row">
              <span class="suape-cp-item-title-text">${highlightMatch(suapStudentAction.title, query)}</span>
              <span class="suape-cp-badge badge-pago">SUAP Oficial</span>
            </div>
            <p class="suape-cp-item-subtitle">
              <span class="suape-cp-subtitle-main">${escapeHtml(suapStudentAction.subtitle)}</span>
            </p>
          </div>
          <span class="suape-cp-item-action-hint">Acessar ↵</span>
        </div>
      `;
      globalIndex++;
      return block;
    }

    function renderDocumentBlock() {
      if (!suapDocumentSearchAction) return '';
      let block = '';
      if (html.length > 0) {
        block += `<div class="suape-cp-divider"></div>`;
      }
      block += `
        <div class="suape-cp-group-header">
          <span class="suape-cp-group-title" style="color: #8b5cf6;">
            ${ICONS.fileText}
            Documentos Eletrônicos
          </span>
        </div>
      `;
      const isSel = globalIndex === selectedIndex;
      block += `
        <div class="suape-cp-item ${isSel ? 'suape-cp-item-selected' : ''}" data-index="${globalIndex}">
          <div class="suape-cp-item-icon" style="color: #8b5cf6; background: #8b5cf615;">
            ${ICONS.fileText}
          </div>
          <div class="suape-cp-item-body">
            <div class="suape-cp-item-title-row">
              <span class="suape-cp-item-title-text">${highlightMatch(suapDocumentSearchAction.title, query)}</span>
              <span class="suape-cp-badge badge-pago">SUAP Oficial</span>
            </div>
            <p class="suape-cp-item-subtitle">
              <span class="suape-cp-subtitle-main">${escapeHtml(suapDocumentSearchAction.subtitle)}</span>
            </p>
          </div>
          <span class="suape-cp-item-action-hint">Pesquisar ↵</span>
        </div>
      `;
      globalIndex++;
      return block;
    }

    function renderProcessActionsBlock() {
      const showProcSearch = suapProcessSearchAction && (isExplicitProcessSearch || activeScope === 'processo' || (matchingProcessActions && matchingProcessActions.length > 0));
      const totalCount = (matchingProcessActions ? matchingProcessActions.length : 0) + (showProcSearch ? 1 : 0);
      if (totalCount === 0) return '';

      let block = '';
      if (html.length > 0) {
        block += `<div class="suape-cp-divider"></div>`;
      }
      block += `
        <div class="suape-cp-group-header">
          <span class="suape-cp-group-title process-group">
            ${ICONS.folder}
            ${currentProcId ? `Ações do Processo #${escapeHtml(currentProcId)}` : 'Processos Eletrônicos'}
          </span>
          <span class="suape-cp-group-count">${totalCount} resultado(s)</span>
        </div>
      `;

      if (isExplicitProcessSearch && suapProcessSearchAction) {
        const isSel = globalIndex === selectedIndex;
        block += `
          <div class="suape-cp-item ${isSel ? 'suape-cp-item-selected' : ''}" data-index="${globalIndex}">
            <div class="suape-cp-item-icon" style="color: #0d9488; background: #0d948815;">
              ${ICONS.search}
            </div>
            <div class="suape-cp-item-body">
              <div class="suape-cp-item-title-row">
                <span class="suape-cp-item-title-text">${highlightMatch(suapProcessSearchAction.title, query)}</span>
                <span class="suape-cp-badge badge-pago">SUAP Oficial</span>
              </div>
              <p class="suape-cp-item-subtitle">
                <span class="suape-cp-subtitle-main">${escapeHtml(suapProcessSearchAction.subtitle)}</span>
              </p>
            </div>
            <span class="suape-cp-item-action-hint">Pesquisar ↵</span>
          </div>
        `;
        globalIndex++;
      }

      if (matchingProcessActions) {
        matchingProcessActions.forEach((act) => {
          const isSel = globalIndex === selectedIndex;
          const actIconSvg = ICONS[act.icon] || ICONS.folder;

          block += `
            <div class="suape-cp-item suape-cp-process-item ${isSel ? 'suape-cp-item-selected' : ''}" data-index="${globalIndex}">
              <div class="suape-cp-item-icon" style="color: ${act.color}; background: ${act.color}15;">
                ${actIconSvg}
              </div>
              <div class="suape-cp-item-body">
                <div class="suape-cp-item-title-row">
                  <span class="suape-cp-item-title-text">${highlightMatch(act.title, query)}</span>
                  ${act.badge ? `<kbd class="suape-cp-kbd suape-cp-kbd-shortcut">${escapeHtml(act.badge)}</kbd>` : ''}
                </div>
                <p class="suape-cp-item-subtitle">
                  <span class="suape-cp-subtitle-main">${highlightMatch(act.subtitle, query)}</span>
                </p>
              </div>
              <div class="suape-cp-item-meta">
                <span class="suape-cp-item-meta-label">Atalho</span>
                <span class="suape-cp-item-meta-value"><kbd class="suape-cp-kbd">${escapeHtml(act.shortcuts[0])}</kbd></span>
              </div>
              <span class="suape-cp-item-action-hint">Abrir ↵</span>
            </div>
          `;
          globalIndex++;
        });
      }

      if (!isExplicitProcessSearch && showProcSearch) {
        const isSel = globalIndex === selectedIndex;
        block += `
          <div class="suape-cp-item ${isSel ? 'suape-cp-item-selected' : ''}" data-index="${globalIndex}">
            <div class="suape-cp-item-icon" style="color: #0d9488; background: #0d948815;">
              ${ICONS.search}
            </div>
            <div class="suape-cp-item-body">
              <div class="suape-cp-item-title-row">
                <span class="suape-cp-item-title-text">${highlightMatch(suapProcessSearchAction.title, query)}</span>
                <span class="suape-cp-badge badge-pago">SUAP Oficial</span>
              </div>
              <p class="suape-cp-item-subtitle">
                <span class="suape-cp-subtitle-main">${escapeHtml(suapProcessSearchAction.subtitle)}</span>
              </p>
            </div>
            <span class="suape-cp-item-action-hint">Pesquisar ↵</span>
          </div>
        `;
        globalIndex++;
      }

      return block;
    }

    // Se houver busca explícita de aluno ou documento, exibe no topo
    if (isExplicitStudentSearch) {
      html += renderStudentBlock();
    }
    if (isExplicitDocumentSearch) {
      html += renderDocumentBlock();
    }

    // Se houver atalho digitado de alta prioridade ou busca explícita de processo, exibe primeiro
    if (isExplicitProcessSearch || hasHighPriorityShortcut) {
      html += renderProcessActionsBlock();
    }

    // 1. EMPENHOS ENCONTRADOS (Quando pesquisando)
    if (matchingEmpenhos.length > 0) {
      if (html.length > 0) {
        html += `<div class="suape-cp-divider"></div>`;
      }

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

        html += `
          <div class="suape-cp-item ${isSel ? 'suape-cp-item-selected' : ''}" data-index="${globalIndex}">
            <div class="suape-cp-item-icon empenho-icon">
              ${ICONS.receipt}
            </div>
            <div class="suape-cp-item-body">
              <div class="suape-cp-item-title-row">
                <span class="suape-cp-item-title">${highlightMatch(emp.numero, query)}</span>
                ${emp.tipo === 'rap' ? '<span class="suape-cp-badge badge-rap">RAP</span>' : ''}
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
    const showSuapSearch = suapContractSearchAction && (matchingContratos.length > 0 || activeScope === 'contratos' || isExplicitContractSearch);
    if (matchingContratos.length > 0 || showSuapSearch) {
      if (html.length > 0) {
        html += `<div class="suape-cp-divider"></div>`;
      }

      html += `
        <div class="suape-cp-group-header">
          <span class="suape-cp-group-title contrato-group">
            ${ICONS.fileStack}
            Contratos
          </span>
          <span class="suape-cp-group-count">${matchingContratos.length + (showSuapSearch ? 1 : 0)} resultado(s)</span>
        </div>
      `;

      if (isExplicitContractSearch && suapContractSearchAction) {
        const isSel = globalIndex === selectedIndex;
        html += `
          <div class="suape-cp-item ${isSel ? 'suape-cp-item-selected item-selected-blue' : ''}" data-index="${globalIndex}">
            <div class="suape-cp-item-icon contrato-icon">
              ${ICONS.search}
            </div>
            <div class="suape-cp-item-body">
              <div class="suape-cp-item-title-row">
                <span class="suape-cp-item-title-text">${highlightMatch(suapContractSearchAction.title, query)}</span>
                <span class="suape-cp-badge badge-pago">SUAP Oficial</span>
              </div>
              <p class="suape-cp-item-subtitle">
                <span class="suape-cp-subtitle-main">${escapeHtml(suapContractSearchAction.subtitle)}</span>
              </p>
            </div>
            <span class="suape-cp-item-action-hint hint-blue">Pesquisar ↵</span>
          </div>
        `;
        globalIndex++;
      }

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

      if (!isExplicitContractSearch && showSuapSearch) {
        const isSel = globalIndex === selectedIndex;
        html += `
          <div class="suape-cp-item ${isSel ? 'suape-cp-item-selected item-selected-blue' : ''}" data-index="${globalIndex}">
            <div class="suape-cp-item-icon contrato-icon">
              ${ICONS.search}
            </div>
            <div class="suape-cp-item-body">
              <div class="suape-cp-item-title-row">
                <span class="suape-cp-item-title-text">${highlightMatch(suapContractSearchAction.title, query)}</span>
                <span class="suape-cp-badge badge-pago">SUAP Oficial</span>
              </div>
              <p class="suape-cp-item-subtitle">
                <span class="suape-cp-subtitle-main">${escapeHtml(suapContractSearchAction.subtitle)}</span>
              </p>
            </div>
            <span class="suape-cp-item-action-hint hint-blue">Pesquisar ↵</span>
          </div>
        `;
        globalIndex++;
      }
    }

    // 3. MÓDULOS AGRUPADOS (ORÇAMENTÁRIO, FINANCEIRO, etc.)
    if (groupedScreens.length > 0) {
      groupedScreens.forEach((group) => {
        if (html.length > 0) {
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
      if (html.length > 0) {
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

    // 5. AÇÕES DO PROCESSO / PESQUISA DE PROCESSOS (quando não for prioridade de atalho/pesquisa explícita, aparece no final)
    if (!isExplicitProcessSearch && !hasHighPriorityShortcut) {
      html += renderProcessActionsBlock();
    }

    // 6. ALUNO / DOCUMENTOS (quando busca geral)
    if (!isExplicitStudentSearch && suapStudentAction && (activeScope === 'all' || activeScope === 'actions')) {
      html += renderStudentBlock();
    }
    if (!isExplicitDocumentSearch && suapDocumentSearchAction && (activeScope === 'all' || activeScope === 'actions')) {
      html += renderDocumentBlock();
    }

    listEl.innerHTML = html;

    // Attach click and hover events
    listEl.querySelectorAll('.suape-cp-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        const idx = Number(item.dataset.index);
        if (currentResults[idx]) openResultDetail(currentResults[idx], e);
      });
      item.addEventListener('mouseenter', () => {
        selectedIndex = Number(item.dataset.index);
        updateSelectedVisual();
      });
    });
  }

  // Open Results Detail or Navigate
  async function openResultDetail(result, e) {
    if (
      result.type === 'process_action' ||
      result.type === 'suap_contract_search' ||
      result.type === 'suap_process_search' ||
      result.type === 'suap_student_search' ||
      result.type === 'suap_document_search'
    ) {
      const url = result.data.url;
      closePalette();
      if (e && (e.ctrlKey || e.metaKey)) {
        window.open(url, '_blank');
      } else {
        window.location.href = url;
      }
      return;
    }
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
    applyPaletteTheme(currentPaletteTheme);
    updateProcessChip();
    overlayEl.classList.add('suape-cp-visible');
    inputEl.value = '';
    const procId = getCurrentProcessId();
    if (procId) {
      inputEl.placeholder = 'Digite um atalho (ex: up, enc, encs), NE, contrato ou módulo...';
    } else {
      inputEl.placeholder = 'Digite um comando, NE, contrato, fornecedor ou módulo...';
    }
    selectedIndex = 0;
    renderResults();
    loadData(false);

    // Garantir foco imediato e em frames subsequentes
    inputEl.focus();
    requestAnimationFrame(() => {
      inputEl.focus();
      inputEl.select();
    });
    setTimeout(() => {
      if (document.activeElement !== inputEl && overlayEl?.classList.contains('suape-cp-visible')) {
        inputEl.focus();
      }
    }, 20);
    setTimeout(() => {
      if (document.activeElement !== inputEl && overlayEl?.classList.contains('suape-cp-visible')) {
        inputEl.focus();
      }
    }, 80);
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

  // Global keydown listener com fase de captura para precedência imediata
  document.addEventListener(
    'keydown',
    (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) {
        e.preventDefault();
        e.stopPropagation();
        togglePalette();
      } else if (e.key === 'Escape') {
        if (detailOverlayEl?.classList.contains('suape-cp-visible')) {
          e.preventDefault();
          closeDetailModal();
        } else if (overlayEl?.classList.contains('suape-cp-visible')) {
          e.preventDefault();
          closePalette();
        }
      }
    },
    true
  );

  // Pre-load data on idle
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => loadData(false));
  } else {
    setTimeout(() => loadData(false), 2000);
  }
})();
