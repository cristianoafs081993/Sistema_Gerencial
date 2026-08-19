import type { Atividade, Empenho } from '@/types';

/**
 * Normaliza strings para comparação textual:
 * Remove acentos, caracteres especiais, múltiplos espaços e converte para maiúsculas.
 */
export function normalizeMatchingText(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Extrai código de Plano Interno (11 caracteres alfanuméricos ou prefixo alfanumérico)
 */
export function extractPlanoInternoCode(value: string | undefined | null): string | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  const match = upper.match(/\b([A-Z0-9]{11})\b/);
  if (match) return match[1];
  const prefixMatch = upper.match(/^([A-Z0-9]{6,11})/);
  return prefixMatch ? prefixMatch[1] : null;
}

/**
 * Extrai números de processo contidos em uma string (ex: 23035.000591.2026-61 -> 23035000591202661)
 */
export function extractProcessNumbers(value: string | undefined | null): string[] {
  if (!value) return [];
  const matches = value.match(/\b\d{4,5}[.\s]?\d{5,6}[/.\s]?\d{4}[-.\s]?\d{2}\b/g);
  if (!matches) return [];
  return matches.map((p) => p.replace(/\D/g, ''));
}

/**
 * Extrai siglas entre parênteses ou padrões conhecidos (ex: "(PAFE)", "(PROFE)", "(NEABI)", "ProITEC")
 */
export function extractSiglas(value: string | undefined | null): string[] {
  if (!value) return [];
  const siglas: string[] = [];
  
  // Extrai siglas entre parênteses
  const parenMatches = value.match(/\(([^)]+)\)/g);
  if (parenMatches) {
    for (const m of parenMatches) {
      const clean = m.replace(/[()]/g, '').trim().toUpperCase();
      if (clean.length >= 2 && clean.length <= 15) {
        siglas.push(clean);
      }
    }
  }

  // Padrões específicos de siglas institucionais
  const knownSiglas = ['PAFE', 'PROFE', 'NEABI', 'NUGEDI', 'NAPNE', 'TAL', 'PROITEC', 'PROEJA', 'PNAE', 'PAA', 'SINAPI', 'CUSD'];
  const norm = normalizeMatchingText(value);
  for (const s of knownSiglas) {
    if (new RegExp(`\\b${s}\\b`).test(norm) && !siglas.includes(s)) {
      siglas.push(s);
    }
  }

  return siglas;
}

/**
 * Expressões-chave comuns em atividades e empenhos
 */
const DISTINCTIVE_PHRASES = [
  'AUXILIO TRANSPORTE',
  'AUXILIO MORADIA',
  'AUXILIOS EVENTUAIS',
  'ATIVIDADES EXTERNAS',
  'JOGOS ESTUDANTIS',
  'JOGOS INTERCAMPI',
  'REGULACAO DO USO DE APARELHOS ELETRONICOS',
  'USO DE APARELHOS ELETRONICOS',
  'PROJETOS DE EXTENSAO',
  'PROJETO DE EXTENSAO',
  'PROJETOS DE ENSINO',
  'PROJETO DE ENSINO',
  'BOLSAS DE ENSINO',
  'TUTORIA DE APRENDIZAGEM',
  'INTERNACIONALIZACAO',
  'DIARIAS PARA SERVIDORES',
  'PASSAGENS PARA SERVIDORES',
  'INSCRICOES EM ACOES DE DESENVOLVIMENTO',
  'LIMPEZA E CONSERVACAO',
  'MANUTENCAO PREDIAL',
  'VIGILANCIA',
  'ENERGIA ELETRICA',
  'DIRECAO VEICULAR',
  'COMBUSTIVEIS',
  'ALMOXARIFADO VIRTUAL',
  'MERENDA ESCOLAR',
  'ALIMENTACAO E NUTRICAO',
  'AUXILIO ALIMENTACAO',
  'GENEROS ALIMENTICIOS',
  'ARBITRAGEM',
  'AGUA MINERAL',
  'MANUTENCAO DE EQUIPAMENTOS DESPORTIVOS',
  'COLETA DE RESIDUOS',
  'EQUIPAMENTOS DO SETOR DE SAUDE',
  'SEGUROS PARA ALUNOS',
  'RECOLHIMENTO EM ATRASO DA EFD REINF',
  'LICENCIAMENTO ANUAL DOS VEICULOS',
  'TAXAS DE BOMBEIROS',
  'TAXA DE COLETA DE LIXO',
  'SUPRIMENTO DE FUNDOS',
  'COMITE DE ENSINO',
  'EDUCACAO E INTERSECCIONALIDADES',
  'GESTAO PEDAGOGICA E DESENVOLVIMENTO CURRICULAR',
  'SIMPOSIO DE EDUCACAO',
  'COLAB E COADESC',
  'ENCONTRO DE COMUNICADORES',
  'USINA ESCOLA',
  'LEITE BOVINO',
  'GAS LIQUEFEITO',
  'MEDALHAS PARA EVENTOS DESPORTIVOS',
];

/**
 * Calcula a pontuação de similaridade/compatibilidade entre um Empenho e uma Atividade
 */
export function calculateEmpenhoAtividadeMatchScore(emp: Empenho, atv: Atividade): number {
  // Vínculo explícito manual direto
  if (emp.atividadeId && emp.atividadeId === atv.id) {
    return 1000;
  }

  // Se ambos tiverem origemRecurso e forem diferentes, não pertencem ao mesmo contexto
  const empOrigem = emp.origemRecurso?.trim();
  const atvOrigem = atv.origemRecurso?.trim();
  if (empOrigem && atvOrigem && empOrigem !== atvOrigem) {
    return 0;
  }

  let score = 0;

  const empDescNorm = normalizeMatchingText(emp.descricao);
  const atvNomeNorm = normalizeMatchingText(atv.atividade);
  const atvDescNorm = normalizeMatchingText(atv.descricao);

  // Vínculo por número de processo
  const empProcesses = extractProcessNumbers([emp.processo, emp.descricao].filter(Boolean).join(' '));
  const atvProcesses = extractProcessNumbers([atv.processo, atv.descricao].filter(Boolean).join(' '));
  const hasMatchingProcess = empProcesses.length > 0 && atvProcesses.length > 0 &&
    empProcesses.some((ep) => atvProcesses.includes(ep));

  if (hasMatchingProcess) {
    score += 500;
  }

  // Plano Interno
  const empPiCode = extractPlanoInternoCode(emp.planoInterno);
  const atvPiCode = extractPlanoInternoCode(atv.planoInterno);
  if (empPiCode && atvPiCode) {
    if (empPiCode === atvPiCode) {
      score += 50;
    } else {
      score -= 100; // PIs diferentes na mesma origem têm menor probabilidade
    }
  }

  // Correspondência explícita do prefixo "ATIVIDADE ..." na descrição do empenho
  const atividadePrefixMatch = emp.descricao?.match(/ATIVIDADE\s*[:\-]?\s*([^,.;]+)/i);
  if (atividadePrefixMatch) {
    const rawAtvInEmp = normalizeMatchingText(atividadePrefixMatch[1]);
    if (rawAtvInEmp.length >= 5) {
      if (atvNomeNorm.includes(rawAtvInEmp) || rawAtvInEmp.includes(atvNomeNorm)) {
        score += 300;
      }
    }
  }

  // Siglas da atividade presentes na descrição do empenho
  const atvSiglas = extractSiglas(`${atv.atividade} ${atv.descricao}`);
  for (const sigla of atvSiglas) {
    const regex = new RegExp(`\\b${sigla}\\b`, 'i');
    if (regex.test(empDescNorm)) {
      score += 250;
    }
  }

  // Expressões-chave distintas
  for (const phrase of DISTINCTIVE_PHRASES) {
    const inAtv = atvNomeNorm.includes(phrase) || atvDescNorm.includes(phrase);
    const inEmp = empDescNorm.includes(phrase);
    if (inAtv && inEmp) {
      score += 200;
    }
  }

  // Correspondência direta do nome da atividade completo ou quase completo
  if (atvNomeNorm.length >= 10 && empDescNorm.includes(atvNomeNorm)) {
    score += 350;
  }

  return score;
}

export type AtividadeEmpenhoMatchSummary = {
  total: number;
  count: number;
  empenhos: Empenho[];
};

export type MatchEmpenhosResult = {
  empenhosPorAtividadeMap: Map<string, AtividadeEmpenhoMatchSummary>;
  unmatchedEmpenhos: Empenho[];
};

/**
 * Correlaciona empenhos às atividades da mesma origem com base em score multi-critério
 */
export function matchEmpenhosToAtividades(
  atividades: Atividade[],
  empenhos: Empenho[],
): MatchEmpenhosResult {
  const map = new Map<string, AtividadeEmpenhoMatchSummary>();
  const unmatchedEmpenhos: Empenho[] = [];

  // Inicializa mapa para todas as atividades
  atividades.forEach((atv) => {
    map.set(atv.id, { total: 0, count: 0, empenhos: [] });
  });

  // Filtra empenhos não cancelados
  const activeEmpenhos = empenhos.filter((e) => e.status !== 'cancelado');

  activeEmpenhos.forEach((emp) => {
    let bestAtividade: Atividade | null = null;
    let highestScore = 0;

    for (const atv of atividades) {
      const score = calculateEmpenhoAtividadeMatchScore(emp, atv);
      if (score > highestScore) {
        highestScore = score;
        bestAtividade = atv;
      }
    }

    // Threshold mínimo para considerar correspondência confiável
    if (bestAtividade && highestScore >= 100) {
      const current = map.get(bestAtividade.id) || { total: 0, count: 0, empenhos: [] };
      current.total += emp.valor || 0;
      current.count += 1;
      current.empenhos.push(emp);
      map.set(bestAtividade.id, current);
    } else {
      unmatchedEmpenhos.push(emp);
    }
  });

  return {
    empenhosPorAtividadeMap: map,
    unmatchedEmpenhos,
  };
}
