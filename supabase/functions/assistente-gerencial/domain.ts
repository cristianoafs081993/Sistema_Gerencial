export type AssistantIntent =
  | 'pesquisa_precos'
  | 'descentralizacoes'
  | 'contratos'
  | 'empenhos_execucao'
  | 'creditos_saldos'
  | 'pfs_conciliacao'
  | 'geral';

export type ContextSection = {
  label: string;
  rows: unknown[];
  count: number | null;
  warning?: string;
};

export type GerencialAnalysis = {
  intent: AssistantIntent;
  summary: Record<string, unknown>;
  evidence: Record<string, unknown>;
  limitations: string[];
};

type DescentralizacaoRow = {
  dimensao?: string | null;
  nota_credito?: string | null;
  operacao_tipo?: string | null;
  origem_recurso?: string | null;
  natureza_despesa?: string | null;
  plano_interno?: string | null;
  data_emissao?: string | null;
  descricao?: string | null;
  valor?: number | string | null;
};

type ContratoApiRow = {
  id?: string | null;
  numero?: string | null;
  fornecedor_nome?: string | null;
  unidade_codigo?: string | number | null;
  unidade_origem_codigo?: string | number | null;
  objeto?: string | null;
  processo?: string | null;
  vigencia_inicio_derivada?: string | null;
  vigencia_fim_derivada?: string | null;
  valor_global?: number | string | null;
  valor_acumulado?: number | string | null;
  situacao_derivada?: boolean | null;
  campus_scope_reason?: string | null;
};

type ContratoApiEmpenhoRow = {
  contrato_api_id?: string | null;
  numero?: string | null;
  unidade_gestora?: string | number | null;
  valor_empenhado?: number | string | null;
  valor_a_liquidar?: number | string | null;
  valor_liquidado?: number | string | null;
  valor_pago?: number | string | null;
  rp_inscrito?: number | string | null;
  rp_a_pagar?: number | string | null;
  raw_data?: Record<string, unknown> | null;
};

type ContratoApiFaturaRow = {
  contrato_api_id?: string | null;
  situacao?: string | null;
  valor_bruto?: number | string | null;
  valor_liquido?: number | string | null;
  data_emissao?: string | null;
  data_pagamento?: string | null;
};

type EmpenhoRow = {
  numero?: string | null;
  descricao?: string | null;
  valor?: number | string | null;
  tipo?: string | null;
  plano_interno?: string | null;
  origem_recurso?: string | null;
  natureza_despesa?: string | null;
  favorecido_nome?: string | null;
  valor_liquidado?: number | string | null;
  valor_liquidado_oficial?: number | string | null;
  valor_pago_oficial?: number | string | null;
  saldo_rap_oficial?: number | string | null;
  valor_liquidado_a_pagar?: number | string | null;
  rap_inscrito?: number | string | null;
  rap_a_liquidar?: number | string | null;
  rap_liquidado?: number | string | null;
  rap_pago?: number | string | null;
};

type CreditoDisponivelRow = {
  ptres?: string | null;
  metrica?: string | null;
  valor?: number | string | null;
  updated_at?: string | null;
};

const CAMPUS_UG = '158366';
const REITORIA_UG = '158155';

function normalizeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compactText(value: unknown, maxLength = 180) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}...`;
}

function asRows<T>(sections: ContextSection[], label: string) {
  return (sections.find((section) => section.label === label)?.rows || []) as T[];
}

function sectionCount(sections: ContextSection[], label: string) {
  const section = sections.find((item) => item.label === label);
  return section?.count ?? section?.rows.length ?? 0;
}

function addToMap(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) || 0) + value);
}

function sortedEntries(map: Map<string, number>, limit = 12) {
  return [...map.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((left, right) => Math.abs(right.total) - Math.abs(left.total))
    .slice(0, limit);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export type HistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export function isPriceResearchClarification(text: string): boolean {
  const norm = normalizeText(text);
  return (
    /pesquisa de pre[çc]o|cota[çc][ãa]o|in\s*65/.test(norm) &&
    (/esclare[çc]a|especifica[çc][ãa]o|detalh|muito gen[eé]ric|quais os requisitos|qual o formato|qual a configura[çc][ãa]o|qual o modelo|qual o tamanho|qual a capacidade/.test(norm) ||
     /\|\|\s*sugestoes\s*\|\|/i.test(text))
  );
}

export function detectAssistantIntent(message: string, history?: HistoryMessage[]): AssistantIntent {
  const text = normalizeText(message);

  if (
    /pesquis(a|ar|e|ando)\s+(de\s+)?pre[çc]o|cota[çc](ao|oes)|cotar|cesta\s+de\s+pre[çc]o|pesquisa\s+mercadol|catmat|catser|pesquisar\s+item|pesquise\s+o(s)?\s+pre[çc]o|pesquisar\s+os\s+pre[çc]os|pre[çc]o\s+de\s+referencia|mapa\s+comparativo|despacho\s+conclusivo\s+de\s+pre[çc]o|in\s*65\b/.test(text) ||
    /estim(ar|ativa)\s+(de\s+)?pre[çc]o|quanto\s+custa|qual\s+(o\s+)?valor\s+estimado|fazer\s+cota[çc]ao|mapa\s+de\s+pre[çc]o|pre[çc]o\s+de\s+mercado/.test(text) ||
    ((/pesquis(ar|e|a)/.test(text) || /cot(ar|e|acao)/.test(text)) && (/item|itens|monitor|cadeira|mesa|computador|notebook|servico|aquisicao|compra|edital|termo de referencia|\btr\b/.test(text)))
  ) {
    return 'pesquisa_precos';
  }

  // Se houver histórico e o assistente solicitou esclarecimento de pesquisa de preços, mantém a intenção
  if (history && history.length > 0) {
    const lastAssistant = [...history].reverse().find((h) => h.role === 'assistant');
    if (lastAssistant && isPriceResearchClarification(lastAssistant.content)) {
      return 'pesquisa_precos';
    }
  }

  if (/descentraliz|reitoria|ptres|plano interno|\bpi\b|nota de credito|\bnc\b/.test(text)) {
    return 'descentralizacoes';
  }

  if (/contrato|fornecedor|vigencia|fatura|comprasnet|terceiriz|mercatto|caern/.test(text)) {
    return 'contratos';
  }

  if (/credito disponivel|saldo disponivel|saldo por ptres|fonte/.test(text)) {
    return 'creditos_saldos';
  }

  if (/pf|programacao financeira|conciliacao|conciliar/.test(text)) {
    return 'pfs_conciliacao';
  }

  if (/empenho|liquid|pagamento|rap|restos a pagar|execucao/.test(text)) {
    return 'empenhos_execucao';
  }

  return 'geral';
}

export type ExtractedDemandItem = {
  itemNumber: string;
  description: string;
  detailedSpecification?: string;
  quantity: number;
  unit: string;
  catalogType: 'material' | 'service';
  suggestedCatalogCode?: string;
  usedSynonyms?: string[];
};

export type DemandClarityResult = {
  isClear: boolean;
  reason?: string;
  category?: string;
  missingAttributes?: string[];
  suggestedQuestions?: string[];
  quickOptions?: string[];
};

export function assessDemandClarity(demand: ExtractedDemandItem): DemandClarityResult {
  const desc = normalizeText(demand.description);
  const tokens = desc.split(/\s+/).filter((t) => t.length > 1);

  // Stop words comuns de compras públicas que não qualificam tecnicamente o item
  const genericWords = new Set([
    'de', 'do', 'da', 'para', 'com', 'sem', 'em', 'um', 'uma', 'uns', 'umas',
    'item', 'itens', 'material', 'materiais', 'equipamento', 'equipamentos', 'aparelho', 'aparelhos',
    'produto', 'produtos', 'aquisicao', 'compra', 'cotacao', 'preco', 'precos',
    'unidade', 'unidades', 'modelo', 'tipo', 'padrao', 'novo', 'novos',
    'fornecimento', 'servico', 'servicos', 'campus', 'ifrn', 'solicitacao',
  ]);
  const meaningfulTokens = tokens.filter((t) => !genericWords.has(t));
  const isVeryShort = meaningfulTokens.length <= 2;

  // 1. Informática / Computadores / Notebooks
  if (/computador|notebook|laptop|desktop|microcomputador|pc\b|servidor/.test(desc)) {
    const hasProcessor = /i[3579]|core|ryzen|xeon|intel|amd|m[1234]|ghz|octa|processador/.test(desc);
    const hasRam = /\b\d+\s*(gb|gigas?)\b|memoria|ram/.test(desc);
    const hasStorage = /ssd|nvme|hd|disco|armazenamento|512\s*gb|256\s*gb|1\s*tb/.test(desc);

    if (!hasProcessor && !hasRam && !hasStorage) {
      return {
        isClear: false,
        category: 'computadores',
        reason: `A demanda "${demand.description}" não informa processador, memória RAM ou armazenamento mínimo para compor cesta de preços homogênea conforme a IN 65/2021.`,
        missingAttributes: [
          'Formato (Notebook portátil, Desktop padrão, All-in-One ou Servidor)',
          'Processador (ex.: Intel Core i5/i7 ou AMD Ryzen)',
          'Memória RAM (ex.: 8GB, 16GB, 32GB)',
          'Armazenamento (ex.: SSD 256GB, 512GB)',
        ],
        suggestedQuestions: [
          'Qual o formato do equipamento: Computador Desktop, Notebook portátil ou Servidor?',
          'Qual a configuração mínima exigida (Processador i5/i7/Ryzen, Memória RAM de 8GB/16GB e SSD de 256GB/512GB)?',
          'Há necessidade de periféricos inclusos (Monitor com HDMI, teclado e mouse)?',
        ],
        quickOptions: [
          'Notebook Intel Core i5, 16GB RAM, SSD 512GB, tela 15.6" Full HD',
          'Desktop Intel Core i7, 16GB RAM, SSD 512GB com Monitor 24" Full HD',
          'Notebook básico Intel Core i3, 8GB RAM, SSD 256GB',
        ],
      };
    }
  }

  // 2. Monitores / Displays (excluindo notebooks e laptops cujo display é componente interno)
  if (!/notebook|laptop/.test(desc) && (/monitor|display\b/.test(desc) || /\btela\s*(led|lcd|interativa|gamer|de\s+v[ií]deo|para\s+pc)\b/.test(desc))) {
    const hasSize = /\b(19|21|22|23|24|27|29|32|34)\s*(pol|polegadas?|"|')\b/.test(desc);
    const hasResolution = /full\s*hd|4k|2k|qhd|1080p|resolucao|ips|hdmi|displayport/.test(desc);

    if (!hasSize && !hasResolution) {
      return {
        isClear: false,
        category: 'monitores',
        reason: `A descrição "${demand.description}" não informa o tamanho da tela ou resolução necessária.`,
        missingAttributes: ['Tamanho da tela em polegadas', 'Resolução (Full HD, 4K)', 'Conexões (HDMI, DisplayPort)'],
        suggestedQuestions: [
          'Qual o tamanho da tela desejado (ex.: 24 polegadas, 27 polegadas ou ultrawide)?',
          'Qual a resolução e portas de conexão exigidas (Full HD 1080p ou 4K, portas HDMI e DisplayPort)?',
          'É necessário suporte com ajuste ergonômico de altura?',
        ],
        quickOptions: [
          'Monitor 24 polegadas Full HD com porta HDMI e ajuste de altura',
          'Monitor 27 polegadas 4K IPS com portas HDMI e DisplayPort',
        ],
      };
    }
  }

  // 3. Cadeiras / Mobiliário
  if (/cadeira|poltrona|assento|longarina/.test(desc)) {
    const hasErgo = /ergonomica|nr\s*17|giratoria|bracos?|ajust|regul|operativa|presidente|diretor|fixa|espuma\s*injetada/.test(desc);

    if (!hasErgo && isVeryShort) {
      return {
        isClear: false,
        category: 'mobiliario',
        reason: `A descrição "${demand.description}" não indica o modelo ou requisitos ergonômicos da cadeira.`,
        missingAttributes: ['Modelo (operativa giratória, presidente, secretária ou fixa)', 'Padrão ergonômico NR-17 e braços reguláveis'],
        suggestedQuestions: [
          'Qual o modelo da cadeira: operativa giratória para escritório, presidente ou fixa para reunião/auditório?',
          'Exige conformidade ergonômica com a Norma Regulamentadora NR-17 (com ajuste a gás e braços reguláveis)?',
        ],
        quickOptions: [
          'Cadeira giratória operativa ergonômica padrão NR-17 com braços reguláveis e encosto em tela',
          'Cadeira presidente giratória ergonômica em couro sintético com braços',
          'Cadeira fixa interlocutor para reunião com estrutura metálica',
        ],
      };
    }
  }

  // 4. Climatização / Ar-Condicionado
  if (/ar[\s\-]*condicionad|climatizador|split|arcondicionado/.test(desc)) {
    const hasBtu = /\b(9000|12000|18000|24000|30000|36000|48000|60000)\s*(btus?|btu)?\b|\b\d+\s*mil\s*btus?\b/.test(desc);
    const hasTech = /inverter|hi\s*wall|piso\s*teto|cassete|220v/.test(desc);

    if (!hasBtu && !hasTech) {
      return {
        isClear: false,
        category: 'climatizacao',
        reason: `A descrição "${demand.description}" não informa a capacidade térmica (BTUs) do equipamento.`,
        missingAttributes: ['Capacidade térmica (BTUs)', 'Tecnologia Inverter ou Convencional', 'Voltagem (220V)'],
        suggestedQuestions: [
          'Qual a capacidade térmica em BTUs desejada (ex.: 9.000, 12.000, 18.000 ou 24.000 BTUs)?',
          'Requer tecnologia Inverter para maior eficiência energética?',
        ],
        quickOptions: [
          'Ar-condicionado Split Inverter 12.000 BTUs 220V ciclo frio',
          'Ar-condicionado Split Inverter 18.000 BTUs 220V ciclo frio',
          'Ar-condicionado Split Inverter 24.000 BTUs 220V ciclo frio',
        ],
      };
    }
  }

  // 5. Projetores / Datashow
  if (/projetor|datashow/.test(desc)) {
    const hasLumens = /lumens?|ansi|\b\d{4}\s*(lm|lumens?)\b/.test(desc);
    const hasRes = /full\s*hd|wxga|xga|laser|hdmi/.test(desc);

    if (!hasLumens && !hasRes) {
      return {
        isClear: false,
        category: 'audiovisual',
        reason: `A descrição "${demand.description}" não especifica a luminosidade (lúmens) ou resolução do projetor.`,
        missingAttributes: ['Luminosidade em lúmens ANSI', 'Resolução (Full HD, WXGA)'],
        suggestedQuestions: [
          'Qual a luminosidade necessária em lúmens ANSI (ex.: 3.500, 4.000 ou 5.000 lúmens)?',
          'Qual a resolução exigida (Full HD 1080p ou WXGA)?',
        ],
        quickOptions: [
          'Projetor multimídia 4.000 ANSI lúmens Full HD com conexões HDMI',
          'Projetor multimídia 3.600 ANSI lúmens WXGA com HDMI',
        ],
      };
    }
  }

  // 6. Termos genéricos de material ou serviço com 1 ou 2 palavras sem especificadores técnicos
  const genericSingulars = [
    'papel', 'caneta', 'cabo', 'tinta', 'toner', 'mesa', 'impressora', 'reforma',
    'manutencao', 'limpeza', 'software', 'licenca', 'teclado', 'mouse', 'nobreak',
    'veiculo', 'carro', 'pneu', 'combustivel', 'uniforme', 'remedio', 'medicamento',
  ];

  if (isVeryShort && genericSingulars.some((g) => desc.includes(g))) {
    return {
      isClear: false,
      reason: `A descrição "${demand.description}" é muito resumida e requer especificações técnicas (dimensões, modelo, capacidade ou padrões normativos) para localização precisa no PNCP.`,
      missingAttributes: ['Modelo ou dimensões', 'Capacidade ou material', 'Padrão ou finalidade de uso'],
      suggestedQuestions: [
        `Poderia detalhar o modelo, medidas, capacidade ou marca de referência para "${demand.description}"?`,
        'Há alguma especificação técnica ou norma regulamentadora obrigatória para o item?',
      ],
      quickOptions: [
        `Especificar detalhes de ${demand.description}`,
        'Consultar opções mais comuns do catálogo CATMAT',
      ],
    };
  }

  return { isClear: true };
}

const OFFICIAL_SYNONYM_PATTERNS: Array<{ pattern: RegExp; synonyms: string[] }> = [
  {
    pattern: /\bnotebooks?\b/i,
    synonyms: ['computador portátil', 'laptop', 'microcomputador portátil'],
  },
  {
    pattern: /\bcomputador(es)?\b|\bdesktops?\b|\bmicrocomputador(es)?\b/i,
    synonyms: ['microcomputador desktop', 'estação de trabalho', 'computador all in one'],
  },
  {
    pattern: /\bmonitores?\b|\btelas?\b/i,
    synonyms: ['monitor de vídeo', 'display led', 'monitor para computador'],
  },
  {
    pattern: /\bprojetor(es)?\b|\bdatashow\b/i,
    synonyms: ['projetor multimídia', 'projetor de vídeo', 'datashow', 'aparelho de projeção'],
  },
  {
    pattern: /\bcadeiras?\b/i,
    synonyms: ['cadeira operativa giratória', 'poltrona giratória para escritório', 'cadeira ergonômica com braços'],
  },
  {
    pattern: /\bmesas?\b/i,
    synonyms: ['estação de trabalho', 'mesa de escritório', 'mesa operativa'],
  },
  {
    pattern: /\bar[\s\-]*condicionad(o|os)?\b|\bclimatizador(es)?\b/i,
    synonyms: ['condicionador de ar split', 'aparelho de climatização', 'condicionador de ar'],
  },
  {
    pattern: /\bcabos?\s+de\s+rede\b|\bcabos?\s+utp\b/i,
    synonyms: ['patch cord rj45', 'cabo utp cat6', 'cabo de rede par trançado'],
  },
  {
    pattern: /\bimpressoras?\b/i,
    synonyms: ['aparelho multifuncional laser', 'multifuncional laser', 'impressora laser'],
  },
  {
    pattern: /\bpapel\s+a4\b|\bsulfite\b/i,
    synonyms: ['papel sulfite a4 alcalino 75g', 'resma papel sulfite a4', 'papel a4 75g'],
  },
  {
    pattern: /\bcanetas?\b/i,
    synonyms: ['caneta esferográfica', 'caneta escrita média'],
  },
  {
    pattern: /\bteclados?\b/i,
    synonyms: ['teclado usb abnt2', 'teclado para microcomputador'],
  },
  {
    pattern: /\bmouses?\b/i,
    synonyms: ['dispositivo apontador óptico', 'mouse óptico usb'],
  },
  {
    pattern: /\bnobreaks?\b/i,
    synonyms: ['fonte de alimentação ininterrupta', 'ups'],
  },
  {
    pattern: /\bdisco\s+r[ií]gido\b|\bhd\s+externo\b/i,
    synonyms: ['unidade de estado sólido ssd', 'unidade de armazenamento externa', 'ssd'],
  },
];

export function getSynonymsForDemand(description: string, _catalogType: 'material' | 'service' = 'material'): string[] {
  const clean = description.trim();
  const synonyms: string[] = [];

  for (const entry of OFFICIAL_SYNONYM_PATTERNS) {
    if (entry.pattern.test(clean)) {
      for (const syn of entry.synonyms) {
        // Substitui o termo base na descrição original para manter qualificadores técnicos (ex.: "notebook i7 16gb" -> "computador portátil i7 16gb")
        const substituted = clean.replace(entry.pattern, syn).trim();
        if (substituted && substituted.toLowerCase() !== clean.toLowerCase() && !synonyms.includes(substituted)) {
          synonyms.push(substituted);
        }
        // Adiciona também a forma canônica do sinônimo
        if (!synonyms.includes(syn) && syn.toLowerCase() !== clean.toLowerCase()) {
          synonyms.push(syn);
        }
      }
    }
  }

  return synonyms.slice(0, 4);
}

export function mergeClarificationWithDemand(
  originalDemand: ExtractedDemandItem,
  clarificationText: string,
): ExtractedDemandItem {
  const cleanClarification = clarificationText.trim();
  const parsedClarification = parseSingleDemandText(cleanClarification, originalDemand.itemNumber);

  const baseDesc = normalizeText(originalDemand.description);
  const newDesc = normalizeText(cleanClarification);

  let mergedDesc = cleanClarification;
  if (!newDesc.includes(baseDesc) && !baseDesc.includes(newDesc)) {
    mergedDesc = `${originalDemand.description} ${cleanClarification}`;
  }

  return {
    ...originalDemand,
    description: mergedDesc.trim(),
    quantity: parsedClarification?.quantity && parsedClarification.quantity > 1 ? parsedClarification.quantity : originalDemand.quantity,
    unit: parsedClarification?.unit && parsedClarification.unit !== 'UN' ? parsedClarification.unit : originalDemand.unit,
  };
}

export function extractDemandItems(message: string): ExtractedDemandItem[] {
  const cleanMsg = message.trim();
  const items: ExtractedDemandItem[] = [];

  // Check for numbered list (e.g. "1) ... 2) ..." or "1. ... 2. ..." or "Item 1: ...")
  const numberedPattern = /(?:(?:^|\n|\s*)(?:item\s*)?(\d+)[\.\)\:\-]\s*)([^\n\d\.\)\:\-]+(?:(?!\n\s*(?:item\s*)?\d+[\.\)\:\-]).)*)/gis;
  const matches = [...cleanMsg.matchAll(numberedPattern)];

  if (matches.length >= 2) {
    matches.forEach((m, idx) => {
      const rawText = m[2].trim();
      if (!rawText || rawText.length < 3) return;
      const parsed = parseSingleDemandText(rawText, String(idx + 1));
      if (parsed) items.push(parsed);
    });
  }

  if (items.length > 0) return items;

  // Single item parsing
  const singleParsed = parseSingleDemandText(cleanMsg, '1');
  return singleParsed ? [singleParsed] : [{
    itemNumber: '1',
    description: cleanMsg.slice(0, 300),
    quantity: 1,
    unit: 'UN',
    catalogType: isServiceDescription(cleanMsg) ? 'service' : 'material',
  }];
}

function isServiceDescription(text: string): boolean {
  const norm = normalizeText(text);
  return /servico|manutencao|limpeza|vigilancia|consultoria|locacao|instalacao|treinamento|desenvolvimento/.test(norm);
}

function parseSingleDemandText(text: string, defaultNumber = '1'): ExtractedDemandItem | null {
  let cleaned = text
    .replace(/^(por\s+favor\s+)?(gostaria\s+de\s+)?(fazer\s+)?(uma\s+)?(pesquis(ar|e|ando|a)|cot(ar|e|ando|a[çc][ãa]o))\s+(de\s+|os?\s+)?(pre[çc]os?\s+)?(para|de|do|da)?\s*/i, '')
    .replace(/^(quanto\s+custa|qual\s+(o\s+)?valor\s+estimado\s+(de|para|do|da)?)\s*/i, '')
    .replace(/^aquisi[çc][ãa]o\s+(de|do|da)?\s*/i, '')
    .replace(/^preciso\s+(cotar|pesquisar|comprar|adquirir)\s+/i, '')
    .trim();

  // Extract quantity and unit: e.g. "50 unidades de monitores..." or "20 cadeiras..." or "qtd: 10..."
  let quantity = 1;
  let unit = 'UN';

  const qtyMatch = cleaned.match(/(?:(?:quantidade|qtd|quant\.?)\s*[:=]?\s*(\d+))|^(?:(\d+)\s*(unidades?|und?|un|caixas?|cx|pct|pacotes?|servi[çc]os?|meses|horas?|h)?\s*(?:de\s+)?)/i);
  if (qtyMatch) {
    const matchedQty = parseInt(qtyMatch[1] || qtyMatch[2] || '1', 10);
    if (!isNaN(matchedQty) && matchedQty > 0) {
      quantity = matchedQty;
    }
    const matchedUnit = qtyMatch[3]?.toUpperCase();
    if (matchedUnit) {
      if (matchedUnit.startsWith('UN')) unit = 'UN';
      else if (matchedUnit.startsWith('CX') || matchedUnit.startsWith('CAIXA')) unit = 'CX';
      else if (matchedUnit.startsWith('PCT') || matchedUnit.startsWith('PACOTE')) unit = 'PCT';
      else if (matchedUnit.startsWith('SERV')) unit = 'SERVIÇO';
      else if (matchedUnit.startsWith('H')) unit = 'HORA';
    }
    cleaned = cleaned.replace(qtyMatch[0], '').trim();
  }

  // Remove leading connectives
  cleaned = cleaned.replace(/^(de|do|da|para)\s+/i, '').trim();
  if (!cleaned) return null;

  return {
    itemNumber: defaultNumber,
    description: cleaned,
    quantity,
    unit,
    catalogType: isServiceDescription(cleaned) ? 'service' : 'material',
  };
}

export function calculateStatisticalSummary(
  prices: number[],
  method: 'median' | 'mean' | 'minimum' = 'median',
) {
  const valid = prices.filter((p) => typeof p === 'number' && Number.isFinite(p) && p > 0);
  if (valid.length === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      minimum: 0,
      maximum: 0,
      standardDeviation: 0,
      coefficientOfVariation: 0,
      estimatedUnitPrice: 0,
      method,
    };
  }

  const sorted = [...valid].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const meanVal = sorted.reduce((acc, p) => acc + p, 0) / sorted.length;
  
  const mid = Math.floor(sorted.length / 2);
  const medianVal = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const variance = sorted.reduce((acc, p) => acc + Math.pow(p - meanVal, 2), 0) / sorted.length;
  const stdDev = Math.sqrt(variance);
  const cv = meanVal > 0 ? (stdDev / meanVal) * 100 : 0;

  let estimated = medianVal;
  if (method === 'mean') estimated = meanVal;
  if (method === 'minimum') estimated = min;

  return {
    count: sorted.length,
    mean: Number(meanVal.toFixed(2)),
    median: Number(medianVal.toFixed(2)),
    minimum: Number(min.toFixed(2)),
    maximum: Number(max.toFixed(2)),
    standardDeviation: Number(stdDev.toFixed(2)),
    coefficientOfVariation: Number(cv.toFixed(2)),
    estimatedUnitPrice: Number(estimated.toFixed(2)),
    method,
  };
}

export function summarizeDescentralizacoes(rows: DescentralizacaoRow[]) {
  const byPtres = new Map<string, {
    ptres: string;
    total: number;
    count: number;
    byPi: Map<string, number>;
    byNatureza: Map<string, number>;
    byDimensao: Map<string, number>;
  }>();
  const byNatureza = new Map<string, number>();
  const byDimensao = new Map<string, number>();
  const notes = new Set<string>();
  let total = 0;
  let entradas = 0;
  let abatimentos = 0;
  let minDate = '';
  let maxDate = '';

  rows.forEach((row) => {
    const value = toNumber(row.valor);
    const ptres = compactText(row.origem_recurso || 'PTRES nao informado', 40);
    const pi = compactText(row.plano_interno || 'PI nao informado', 60);
    const natureza = compactText(row.natureza_despesa || 'Natureza nao informada', 80);
    const dimensao = compactText(row.dimensao || 'Dimensao nao informada', 80);
    const date = String(row.data_emissao || '').slice(0, 10);

    total += value;
    if (value >= 0) entradas += value;
    if (value < 0) abatimentos += value;
    if (row.nota_credito) notes.add(String(row.nota_credito));
    if (date && (!minDate || date < minDate)) minDate = date;
    if (date && (!maxDate || date > maxDate)) maxDate = date;

    if (!byPtres.has(ptres)) {
      byPtres.set(ptres, {
        ptres,
        total: 0,
        count: 0,
        byPi: new Map(),
        byNatureza: new Map(),
        byDimensao: new Map(),
      });
    }

    const bucket = byPtres.get(ptres)!;
    bucket.total += value;
    bucket.count += 1;
    addToMap(bucket.byPi, pi, value);
    addToMap(bucket.byNatureza, natureza, value);
    addToMap(bucket.byDimensao, dimensao, value);
    addToMap(byNatureza, natureza, value);
    addToMap(byDimensao, dimensao, value);
  });

  const ptresDetalhado = [...byPtres.values()]
    .map((bucket) => ({
      ptres: bucket.ptres,
      total: bucket.total,
      lancamentos: bucket.count,
      porPi: sortedEntries(bucket.byPi, 12).map((item) => ({ pi: item.label, total: item.total })),
      porNatureza: sortedEntries(bucket.byNatureza, 6),
      porDimensao: sortedEntries(bucket.byDimensao, 6),
    }))
    .sort((left, right) => Math.abs(right.total) - Math.abs(left.total));

  const principaisLancamentos = rows
    .map((row) => ({
      ptres: row.origem_recurso || null,
      pi: row.plano_interno || null,
      natureza: row.natureza_despesa || null,
      dimensao: row.dimensao || null,
      notaCredito: row.nota_credito || null,
      dataEmissao: row.data_emissao || null,
      descricao: compactText(row.descricao, 140),
      valor: toNumber(row.valor),
    }))
    .sort((left, right) => Math.abs(right.valor) - Math.abs(left.valor))
    .slice(0, 18);

  return {
    summary: {
      escopo: 'Dados de descentralizacoes disponiveis no sistema do IFRN Campus Currais Novos; a tabela nao possui coluna de campus destino.',
      totalDescentralizadoLiquido: total,
      totalEntradas: entradas,
      totalAbatimentos: abatimentos,
      quantidadeLancamentos: rows.length,
      quantidadeNotasCredito: notes.size,
      periodo: minDate || maxDate ? { inicio: minDate || null, fim: maxDate || null } : null,
      porPtres: ptresDetalhado.slice(0, 20),
      porNatureza: sortedEntries(byNatureza, 12),
      porDimensao: sortedEntries(byDimensao, 12),
    },
    evidence: {
      principaisLancamentos,
    },
    limitations: [
      'A tabela descentralizacoes nao identifica campus destino em campo separado; "Campus Currais Novos" foi tratado como o escopo natural dos dados do sistema.',
      'Valores negativos e operacoes de devolucao/anulacao foram abatidos do total liquido.',
    ],
  };
}

function isActiveContrato(row: ContratoApiRow) {
  return row.situacao_derivada === true;
}

function getUg(value: unknown) {
  return String(value ?? '').trim();
}

function isCampusContrato(row: ContratoApiRow) {
  return getUg(row.unidade_codigo) === CAMPUS_UG || getUg(row.unidade_origem_codigo) === CAMPUS_UG;
}

function isReitoriaContrato(row: ContratoApiRow) {
  return getUg(row.unidade_codigo) === REITORIA_UG || getUg(row.unidade_origem_codigo) === REITORIA_UG;
}

function hasCampusEvidence(row: ContratoApiRow, empenhos: ContratoApiEmpenhoRow[]) {
  if (isCampusContrato(row)) return true;
  if (compactText(row.campus_scope_reason)) return true;
  return empenhos.some((empenho) => getUg(empenho.unidade_gestora) === CAMPUS_UG);
}

function getEmpenhoSaldo(empenho: ContratoApiEmpenhoRow) {
  const rpInscrito = toNumber(empenho.rp_inscrito);
  const rpAPagar = toNumber(empenho.rp_a_pagar);
  const raw = isRecord(empenho.raw_data) ? empenho.raw_data : {};
  const rpALiquidar = toNumber(raw.rpaliquidar);
  const rpLiquidado = toNumber(raw.rpliquidado);
  const rpPago = toNumber(raw.rppago);
  const hasRap = rpInscrito > 0 || rpAPagar > 0 || rpALiquidar > 0 || rpLiquidado > 0 || rpPago > 0;

  if (hasRap) {
    if (empenho.rp_a_pagar !== null && empenho.rp_a_pagar !== undefined) return Math.max(0, rpAPagar);
    return Math.max(0, rpInscrito - rpLiquidado - rpPago);
  }

  return Math.max(0, toNumber(empenho.valor_a_liquidar));
}

export function summarizeContratos(
  contratos: ContratoApiRow[],
  empenhos: ContratoApiEmpenhoRow[],
  faturas: ContratoApiFaturaRow[] = [],
) {
  const empenhosByContrato = new Map<string, ContratoApiEmpenhoRow[]>();
  const faturasByContrato = new Map<string, ContratoApiFaturaRow[]>();

  empenhos.forEach((empenho) => {
    const id = String(empenho.contrato_api_id || '');
    if (!id) return;
    empenhosByContrato.set(id, [...(empenhosByContrato.get(id) || []), empenho]);
  });

  faturas.forEach((fatura) => {
    const id = String(fatura.contrato_api_id || '');
    if (!id) return;
    faturasByContrato.set(id, [...(faturasByContrato.get(id) || []), fatura]);
  });

  const today = new Date();
  const recentThreshold = new Date(today);
  recentThreshold.setDate(recentThreshold.getDate() - 90);
  const expiringThreshold = new Date(today);
  expiringThreshold.setDate(expiringThreshold.getDate() + 120);

  const active = contratos.filter(isActiveContrato);
  const activeWithCampusScope = active.filter((contrato) =>
    hasCampusEvidence(contrato, empenhosByContrato.get(String(contrato.id || '')) || []));

  const contractSummaries = activeWithCampusScope.map((contrato) => {
    const id = String(contrato.id || '');
    const contractEmpenhos = empenhosByContrato.get(id) || [];
    const contractFaturas = faturasByContrato.get(id) || [];
    const totals = contractEmpenhos.reduce(
      (acc, empenho) => {
        acc.empenhado += toNumber(empenho.valor_empenhado);
        acc.aLiquidar += toNumber(empenho.valor_a_liquidar);
        acc.liquidado += toNumber(empenho.valor_liquidado);
        acc.pago += toNumber(empenho.valor_pago);
        acc.rapInscrito += toNumber(empenho.rp_inscrito);
        acc.rapAPagar += toNumber(empenho.rp_a_pagar);
        acc.saldoAtual += getEmpenhoSaldo(empenho);
        return acc;
      },
      { empenhado: 0, aLiquidar: 0, liquidado: 0, pago: 0, rapInscrito: 0, rapAPagar: 0, saldoAtual: 0 },
    );
    const latestFaturaDate = contractFaturas
      .map((fatura) => String(fatura.data_pagamento || fatura.data_emissao || '').slice(0, 10))
      .filter(Boolean)
      .sort()
      .at(-1) || null;
    const fimVigencia = String(contrato.vigencia_fim_derivada || '').slice(0, 10) || null;
    const fimDate = fimVigencia ? new Date(`${fimVigencia}T00:00:00`) : null;
    const origem = isCampusContrato(contrato)
      ? 'Campus 158366'
      : isReitoriaContrato(contrato)
        ? 'Reitoria 158155 com evidencia do campus'
        : 'Origem nao classificada';

    return {
      id,
      numero: contrato.numero || null,
      fornecedor: contrato.fornecedor_nome || null,
      objeto: compactText(contrato.objeto, 220),
      processo: contrato.processo || null,
      origem,
      campusScopeReason: contrato.campus_scope_reason || null,
      vigenciaInicio: contrato.vigencia_inicio_derivada || null,
      vigenciaFim: fimVigencia,
      valorGlobal: toNumber(contrato.valor_global),
      valorAcumulado: toNumber(contrato.valor_acumulado),
      empenhos: contractEmpenhos.length,
      faturas: contractFaturas.length,
      ultimaFatura: latestFaturaDate,
      venceEmAte120Dias: Boolean(fimDate && fimDate >= today && fimDate <= expiringThreshold),
      semExecucaoRecente: Boolean(!latestFaturaDate || new Date(`${latestFaturaDate}T00:00:00`) < recentThreshold),
      ...totals,
    };
  });

  const sortDesc = (field: 'saldoAtual' | 'empenhado') =>
    [...contractSummaries].sort((left, right) => Number(right[field]) - Number(left[field])).slice(0, 12);

  const vencendo = contractSummaries
    .filter((item) => item.venceEmAte120Dias)
    .sort((left, right) => String(left.vigenciaFim || '').localeCompare(String(right.vigenciaFim || '')))
    .slice(0, 12);

  const semExecucaoRecente = contractSummaries
    .filter((item) => item.semExecucaoRecente)
    .sort((left, right) => Number(right.saldoAtual) - Number(left.saldoAtual))
    .slice(0, 12);

  const totals = contractSummaries.reduce(
    (acc, item) => {
      acc.empenhado += Number(item.empenhado);
      acc.saldoAtual += Number(item.saldoAtual);
      acc.liquidado += Number(item.liquidado);
      acc.pago += Number(item.pago);
      acc.rapAPagar += Number(item.rapAPagar);
      return acc;
    },
    { empenhado: 0, saldoAtual: 0, liquidado: 0, pago: 0, rapAPagar: 0 },
  );

  return {
    summary: {
      contratosTotalConsultados: contratos.length,
      contratosAtivos: active.length,
      contratosAtivosComEscopoCampus: activeWithCampusScope.length,
      contratosAtivosCampus: active.filter(isCampusContrato).length,
      contratosAtivosReitoriaComEvidenciaCampus: activeWithCampusScope.filter((item) => isReitoriaContrato(item)).length,
      totaisExecucao: totals,
      maioresSaldos: sortDesc('saldoAtual'),
      maioresEmpenhados: sortDesc('empenhado'),
      contratosVencendoEmAte120Dias: vencendo,
      contratosSemExecucaoRecente: semExecucaoRecente,
    },
    evidence: {
      contratosAvaliados: contractSummaries.slice(0, 30),
    },
    limitations: [
      'Contratos ativos foram filtrados por situacao_derivada = true.',
      'Contratos da Reitoria foram mantidos somente quando havia campus_scope_reason ou empenho da UG 158366.',
      faturas.length
        ? 'Execucao recente foi estimada pela data de emissao/pagamento das faturas sincronizadas.'
        : 'Execucao recente nao pode ser avaliada porque contratos_api_faturas nao retornou linhas.',
    ],
  };
}

export function summarizeEmpenhos(rows: EmpenhoRow[]) {
  const totals = rows.reduce(
    (acc, row) => {
      const valor = toNumber(row.valor);
      const liquidado = toNumber(row.valor_liquidado_oficial || row.valor_liquidado);
      const pago = toNumber(row.valor_pago_oficial);
      const rapSaldo = toNumber(row.saldo_rap_oficial);
      const saldo = normalizeText(row.tipo).includes('rap') ? rapSaldo : Math.max(0, valor - liquidado);
      acc.valor += valor;
      acc.liquidado += liquidado;
      acc.pago += pago;
      acc.saldo += saldo;
      return acc;
    },
    { valor: 0, liquidado: 0, pago: 0, saldo: 0 },
  );

  const maioresSaldos = rows
    .map((row) => {
      const valor = toNumber(row.valor);
      const liquidado = toNumber(row.valor_liquidado_oficial || row.valor_liquidado);
      const saldo = normalizeText(row.tipo).includes('rap')
        ? toNumber(row.saldo_rap_oficial)
        : Math.max(0, valor - liquidado);
      return {
        numero: row.numero || null,
        favorecido: row.favorecido_nome || null,
        descricao: compactText(row.descricao, 180),
        ptres: row.origem_recurso || null,
        pi: row.plano_interno || null,
        natureza: row.natureza_despesa || null,
        tipo: row.tipo || null,
        valor,
        liquidado,
        saldo,
      };
    })
    .sort((left, right) => right.saldo - left.saldo)
    .slice(0, 15);

  return {
    summary: {
      quantidadeEmpenhos: rows.length,
      totais: totals,
      maioresSaldos,
    },
    evidence: { maioresSaldos },
    limitations: ['Saldo de empenhos de exercicio foi calculado como valor menos liquidado quando nao havia campo de saldo dedicado.'],
  };
}

export function summarizeCreditos(rows: CreditoDisponivelRow[]) {
  const byPtres = new Map<string, number>();
  rows.forEach((row) => addToMap(byPtres, compactText(row.ptres || 'PTRES nao informado', 40), toNumber(row.valor)));
  const porPtres = sortedEntries(byPtres, 30).map((item) => ({ ptres: item.label, total: item.total }));
  return {
    summary: {
      quantidadeLinhas: rows.length,
      totalCreditoDisponivel: porPtres.reduce((acc, item) => acc + item.total, 0),
      porPtres,
    },
    evidence: { porPtres },
    limitations: ['Credito disponivel depende da ultima importacao registrada em creditos_disponiveis.'],
  };
}

export function summarizePfs(sections: ContextSection[]) {
  const rastreabilidade = asRows<Record<string, unknown>>(sections, 'vw_rastreabilidade_pf');
  const conciliacao = asRows<Record<string, unknown>>(sections, 'vw_conciliacao_diaria_pf');
  const totalPfs = rastreabilidade.reduce((acc, row) => acc + toNumber(row.valor), 0);
  const totalSaldoConciliacao = conciliacao.reduce((acc, row) => acc + toNumber(row.saldo), 0);

  return {
    summary: {
      rastreabilidadeLinhas: rastreabilidade.length,
      conciliacaoLinhas: conciliacao.length,
      totalPfs,
      totalSaldoConciliacao,
      principaisPfs: rastreabilidade.slice(0, 15),
      conciliacoesRecentes: conciliacao.slice(0, 15),
    },
    evidence: {
      principaisPfs: rastreabilidade.slice(0, 15),
      conciliacoesRecentes: conciliacao.slice(0, 15),
    },
    limitations: ['PFs e conciliacao dependem das views disponiveis para o usuario autenticado.'],
  };
}

export function buildGerencialAnalysis(message: string, sections: ContextSection[]): GerencialAnalysis {
  const intent = detectAssistantIntent(message);
  const descentralizacoes = summarizeDescentralizacoes(asRows<DescentralizacaoRow>(sections, 'descentralizacoes'));
  const contratos = summarizeContratos(
    asRows<ContratoApiRow>(sections, 'contratos_api'),
    asRows<ContratoApiEmpenhoRow>(sections, 'contratos_api_empenhos'),
    asRows<ContratoApiFaturaRow>(sections, 'contratos_api_faturas'),
  );
  const empenhos = summarizeEmpenhos(asRows<EmpenhoRow>(sections, 'empenhos'));
  const creditos = summarizeCreditos(asRows<CreditoDisponivelRow>(sections, 'creditos_disponiveis'));
  const pfs = summarizePfs(sections);

  if (intent === 'descentralizacoes') {
    return { intent, ...descentralizacoes };
  }
  if (intent === 'contratos') {
    return { intent, ...contratos };
  }
  if (intent === 'empenhos_execucao') {
    return { intent, ...empenhos };
  }
  if (intent === 'creditos_saldos') {
    return { intent, ...creditos };
  }
  if (intent === 'pfs_conciliacao') {
    return { intent, ...pfs };
  }

  return {
    intent,
    summary: {
      descentralizacoes: descentralizacoes.summary,
      contratos: contratos.summary,
      empenhos: empenhos.summary,
      creditos: creditos.summary,
      pfs: pfs.summary,
      totaisDisponiveis: {
        descentralizacoes: sectionCount(sections, 'descentralizacoes'),
        contratosApi: sectionCount(sections, 'contratos_api'),
        empenhos: sectionCount(sections, 'empenhos'),
        creditosDisponiveis: sectionCount(sections, 'creditos_disponiveis'),
      },
    },
    evidence: {
      descentralizacoes: descentralizacoes.evidence,
      contratos: contratos.evidence,
      empenhos: empenhos.evidence,
      creditos: creditos.evidence,
    },
    limitations: [
      ...descentralizacoes.limitations,
      ...contratos.limitations,
      ...empenhos.limitations,
      ...creditos.limitations,
      ...pfs.limitations,
    ],
  };
}

export function normalizeSectionSources(sections: ContextSection[]) {
  return sections.map((section) => ({
    label: section.label,
    totalAmostra: section.rows.length,
    totalDisponivel: section.count,
    warning: section.warning,
  }));
}

export function sanitizeUnknownRows(rows: unknown[]) {
  return rows.filter(isRecord);
}
