import { supabase } from '@/lib/supabase';
import { SuapDadosCompletos, SuapProcesso, SuapNotaFiscal } from '@/types';

export interface ScrapedProcesso {
  suapId: string;
  numProcesso?: string;
  url: string;
}

export type SyncProgressCallback = (message: string) => void;

const PROCESS_NUMBER_REGEX = /\b\d{5}\.\d{6}\.\d{4}-\d{2}\b/;
const PROCESS_LINK_HREF_REGEX = /\/processo_eletronico\/processo\/\d+\/?/;
const CPF_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-\d{2}\b/g;
const CNPJ_REGEX = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-\d{2}\b/g;
const EMPENHO_REGEX = /\b20\d{2}NE\d{6}\b/gi;
const MONEY_REGEX = /R\$\s*([\d.]+,\d{2})/gi;
const MAX_PREFILL_IFRAMES = 4;

// Função auxiliar para chamar o proxy do SUAP
async function fetchViaProxy(
  path: string, 
  suapSessionId: string, 
  options: { method?: string; body?: any } = {}
) {
  const cleanPath = path.startsWith('https://suap.ifrn.edu.br')
    ? path.replace('https://suap.ifrn.edu.br', '')
    : path;

  const { data, error } = await supabase.functions.invoke('suap-proxy', {
    body: {
      path: cleanPath,
      method: options.method || 'GET',
      suapSessionId,
      body: options.body,
    },
  });

  if (error) {
    throw new Error(`Erro de rede no proxy: ${error.message}`);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

// Helpers de normalização e limpeza
function normalize(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function clean(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s:.-]+/, '')
    .replace(/[\s:.-]+$/, '');

  if (!cleaned) return null;
  const low = cleaned.toLowerCase();
  return low === '-' || low === 'null' || low === 'none' || low === 'nao extraido' ? null : cleaned;
}

function hasValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return Boolean(clean(value));
  if (Array.isArray(value)) return value.some(hasValue);
  if (typeof value === 'object') return Object.values(value).some(hasValue);
  return true;
}

function lines(text: string | null | undefined): string[] {
  return String(text || '').split(/\r?\n+/).map(clean).filter(Boolean) as string[];
}

function unique(values: Array<string | null | undefined> = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const cleaned = clean(value);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function mergeBank(existing: any, incoming: any) {
  const ext = existing && typeof existing === 'object' ? existing : {};
  const inc = incoming && typeof incoming === 'object' ? incoming : {};
  const merged = {
    banco: hasValue(ext.banco) ? ext.banco : inc.banco,
    agencia: hasValue(ext.agencia) ? ext.agencia : inc.agencia,
    conta: hasValue(ext.conta) ? ext.conta : inc.conta,
  };
  return hasValue(merged) ? merged : null;
}

function cleanupPrefill(prefill: any): any {
  if (!prefill || typeof prefill !== 'object') return null;
  const dc: any = {};
  const out: any = {};

  if (hasValue(prefill.num_processo)) out.num_processo = clean(prefill.num_processo);
  if (hasValue(prefill.beneficiario)) out.beneficiario = clean(prefill.beneficiario);
  if (hasValue(prefill.cpf_cnpj)) out.cpf_cnpj = clean(prefill.cpf_cnpj);
  if (hasValue(prefill.assunto)) out.assunto = clean(prefill.assunto);

  const dadosCompletos = prefill.dados_completos || {};
  if (hasValue(dadosCompletos.processo_numero)) dc.processo_numero = clean(dadosCompletos.processo_numero);
  if (hasValue(dadosCompletos.beneficiario)) dc.beneficiario = clean(dadosCompletos.beneficiario);
  if (hasValue(dadosCompletos.cpf_cnpj)) dc.cpf_cnpj = clean(dadosCompletos.cpf_cnpj);
  if (hasValue(dadosCompletos.assunto)) dc.assunto = clean(dadosCompletos.assunto);
  if (hasValue(dadosCompletos.contrato_numero)) dc.contrato_numero = clean(dadosCompletos.contrato_numero);
  if (hasValue(dadosCompletos.val_nf)) dc.val_nf = clean(dadosCompletos.val_nf);

  const notas = unique(dadosCompletos.notas_fiscais || []);
  const empenhos = unique(dadosCompletos.empenhos || []);
  const banco = mergeBank(null, dadosCompletos.dados_bancarios);

  if (notas.length) dc.notas_fiscais = notas.map(num => ({ numero: num }));
  if (empenhos.length) dc.empenhos = empenhos;
  if (banco) dc.dados_bancarios = banco;
  if (Object.keys(dc).length) out.dados_completos = dc;

  return Object.keys(out).length ? out : null;
}

function mergePrefill(basePrefill: any, incomingPrefill: any): any {
  const base = cleanupPrefill(basePrefill) || { dados_completos: {} };
  const incoming = cleanupPrefill(incomingPrefill);
  if (!incoming) return cleanupPrefill(base);

  const baseDc = base.dados_completos || {};
  const incDc = incoming.dados_completos || {};

  const mergedNotas = unique([
    ...(baseDc.notas_fiscais || []).map((n: any) => n.numero),
    ...(incDc.notas_fiscais || []).map((n: any) => n.numero)
  ]);

  return cleanupPrefill({
    num_processo: hasValue(base.num_processo) ? base.num_processo : incoming.num_processo,
    beneficiario: hasValue(base.beneficiario) ? base.beneficiario : incoming.beneficiario,
    cpf_cnpj: hasValue(base.cpf_cnpj) ? base.cpf_cnpj : incoming.cpf_cnpj,
    assunto: hasValue(base.assunto) ? base.assunto : incoming.assunto,
    dados_completos: {
      processo_numero: hasValue(baseDc.processo_numero) ? baseDc.processo_numero : incDc.processo_numero,
      beneficiario: hasValue(baseDc.beneficiario) ? baseDc.beneficiario : incDc.beneficiario,
      cpf_cnpj: hasValue(baseDc.cpf_cnpj) ? baseDc.cpf_cnpj : incDc.cpf_cnpj,
      assunto: hasValue(baseDc.assunto) ? baseDc.assunto : incDc.assunto,
      contrato_numero: hasValue(baseDc.contrato_numero) ? baseDc.contrato_numero : incDc.contrato_numero,
      val_nf: hasValue(baseDc.val_nf) ? baseDc.val_nf : incDc.val_nf,
      notas_fiscais: mergedNotas,
      empenhos: unique([...(baseDc.empenhos || []), ...(incDc.empenhos || [])]),
      dados_bancarios: mergeBank(baseDc.dados_bancarios, incDc.dados_bancarios),
    },
  });
}

// Regex Helpers
function extractProcessNumber(text: string): string | null {
  const match = String(text || '').match(PROCESS_NUMBER_REGEX);
  return match ? match[0] : null;
}

function extractLabeled(text: string, labels: string[], stops: string[]): string | null {
  const textLines = lines(text);
  const labelKeys = labels.map(l => normalize(l));
  const stopKeys = stops.map(s => normalize(s));

  for (let i = 0; i < textLines.length; i++) {
    const line = textLines[i];
    const key = normalize(line);
    const hit = labelKeys.find((label) => key === label || key.startsWith(`${label}:`) || key.startsWith(`${label} -`));
    if (!hit) continue;

    const direct = clean(line.replace(/^[^:]+:\s*/, ''));
    if (direct && normalize(direct) !== hit) return direct;

    const collected: string[] = [];
    for (let j = i + 1; j < textLines.length; j++) {
      const next = textLines[j];
      const nextKey = normalize(next);
      if (stopKeys.some((label) => nextKey === label || nextKey.startsWith(`${label}:`))) break;
      collected.push(next);
      if (collected.length >= 3) break;
    }
    return clean(collected.join(' '));
  }

  return null;
}

// Extrai CPF ou CNPJ
function extractCpfCnpj(text: string): string | null {
  const matches: Array<{ value: string; index: number }> = [];
  const cnpjMatches = String(text || '').matchAll(CNPJ_REGEX);
  for (const match of cnpjMatches) {
    if (match.index !== undefined) matches.push({ value: match[0], index: match.index });
  }
  const cpfMatches = String(text || '').matchAll(CPF_REGEX);
  for (const match of cpfMatches) {
    if (match.index !== undefined) matches.push({ value: match[0], index: match.index });
  }
  matches.sort((a, b) => a.index - b.index);
  return matches.length ? clean(matches[0].value) : null;
}

function extractEmpenhos(text: string): string[] {
  return unique(String(text || '').match(EMPENHO_REGEX) || []);
}

function extractContrato(text: string): string | null {
  const patterns = [
    /contrato(?:\s+administrativo)?\s*(?:n[ouº°.]*)?\s*[:#-]?\s*([0-9]{1,5}\/20\d{2})/i,
    /contrato(?:\s+administrativo)?\s*(?:n[ouº°.]*)?\s*[:#-]?\s*([a-z0-9.-]{3,20}\/20\d{2})/i,
    /referente\s+ao\s+contrato\s*([a-z0-9./-]{3,20})/i,
  ];
  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (match) return clean(match[1]);
  }
  return null;
}

function extractNotas(text: string): string[] {
  const values: string[] = [];
  const patterns = [
    /\b(?:danfe|nota fiscal(?: eletronica)?|nfs-e|nf(?:-e)?)\s*(?:n[ouº°.]*)?\s*[:#-]?\s*([a-z0-9./-]{3,30})/gi,
    /\bpagamento\s+da\s+nf\s*([a-z0-9./-]{3,30})/gi,
  ];
  for (const pattern of patterns) {
    const matches = String(text || '').matchAll(pattern);
    for (const match of matches) {
      if (/\d/.test(match[1])) values.push(match[1]);
    }
  }
  return unique(values);
}

function extractMoney(text: string): string | null {
  const preferred = ['valor liquido', 'valor da bolsa', 'valor da nota', 'liquidacao da despesa no valor', 'valor devido'];
  const textLines = lines(text);

  for (const line of textLines) {
    const key = normalize(line);
    if (!key.includes('r$')) continue;
    if (!preferred.some((item) => key.includes(item))) continue;
    const match = [...line.matchAll(MONEY_REGEX)][0];
    if (match) return clean(match[1]);
  }

  const generic = unique(
    textLines
      .filter((line) => normalize(line).includes('valor') && normalize(line).includes('r$'))
      .map((line) => [...line.matchAll(MONEY_REGEX)][0]?.[1])
      .filter(Boolean)
  );
  return generic.length === 1 ? generic[0] : null;
}

function extractBankData(text: string): any {
  const textLines = lines(text);
  const bank: any = {};

  for (let i = 0; i < textLines.length; i++) {
    const line = textLines[i];
    const key = normalize(line);

    const bankMatch = line.match(/\bbanco[:\s-]+(.+)$/i);
    if (bankMatch && !hasValue(bank.banco)) bank.banco = clean(bankMatch[1]);

    const agenciaMatch = line.match(/\bag(?:e|ê)ncia[:\s-]+([0-9x.-]{2,20})/i);
    if (agenciaMatch && !hasValue(bank.agencia)) bank.agencia = clean(agenciaMatch[1]);

    const contaMatch = line.match(/\bconta(?:\s+corrente)?[:\s-]+([0-9x./-]{3,30})/i);
    if (contaMatch && !hasValue(bank.conta)) bank.conta = clean(contaMatch[1]);

    if (!hasValue(bank.banco) && key.includes('dados banc')) {
      const prev = textLines[i - 1];
      if (prev && prev.length <= 40 && /[a-z]/i.test(prev)) bank.banco = clean(prev);
    }
  }

  return hasValue(bank) ? bank : null;
}

function extractPrefillFromText(text: string): any {
  const assunto = extractLabeled(
    text,
    ['tipo assunto', 'assunto'],
    ['interessados', 'interessado', 'situacao', 'situação', 'tramites', 'trâmites', 'nivel de acesso', 'nível de acesso', 'data setor de origem']
  );
  const beneficiario = extractLabeled(
    text,
    ['interessados', 'interessado'],
    ['situacao', 'situação', 'tramites', 'trâmites', 'nivel de acesso', 'nível de acesso', 'tipo assunto', 'assunto']
  );
  return cleanupPrefill({
    num_processo: extractProcessNumber(text),
    beneficiario,
    cpf_cnpj: extractCpfCnpj(text),
    assunto,
    dados_completos: {
      processo_numero: extractProcessNumber(text),
      beneficiario,
      cpf_cnpj: extractCpfCnpj(text),
      assunto,
      contrato_numero: extractContrato(text),
      notas_fiscais: extractNotas(text),
      val_nf: extractMoney(text),
      empenhos: extractEmpenhos(text),
      dados_bancarios: extractBankData(text),
    },
  });
}

function extractPrefillFromTitle(title: string): any {
  return cleanupPrefill({
    dados_completos: {
      contrato_numero: extractContrato(title),
      notas_fiscais: extractNotas(title),
      empenhos: extractEmpenhos(title),
    },
  });
}

function scoreCandidate(src: string, title: string, index: number): number {
  const key = normalize(title);
  let score = 0;
  if (src.includes('/visualizar_capa_processo/')) score += 200;
  if (src.includes('/conteudo_documento/')) score += 120;
  if (src.includes('/tramite/conteudo/')) score += 90;
  if (src.includes('/visualizar_documento_digitalizado/')) score -= 1000;
  if (key.includes('pagamento')) score += 60;
  if (key.includes('oficio')) score += 50;
  if (key.includes('despacho')) score += 40;
  if (key.includes('contrato')) score += 50;
  if (key.includes('liquidacao')) score += 50;
  if (key.includes('bolsa')) score += 40;
  score -= index;
  return score;
}

// Coleta dados determinísticos de iframes de documentos internos
async function collectDeterministicProcessData(
  proc: ScrapedProcesso,
  detailHtml: string,
  viewerHtml: string,
  suapSessionId: string,
  log: SyncProgressCallback
): Promise<any> {
  let prefill = cleanupPrefill({
    num_processo: proc.numProcesso,
    dados_completos: { processo_numero: proc.numProcesso },
  });

  prefill = mergePrefill(prefill, extractPrefillFromText(detailHtml));
  prefill = mergePrefill(prefill, extractPrefillFromText(viewerHtml));

  const parser = new DOMParser();
  const viewerDoc = parser.parseFromString(viewerHtml, 'text/html');
  const containers = Array.from(viewerDoc.querySelectorAll('#capa_processo, div.page-break, div.page-break-after'));
  
  for (const container of containers) {
    const title = clean(container.querySelector('h3')?.textContent);
    if (title) {
      prefill = mergePrefill(prefill, extractPrefillFromTitle(title));
    }
  }

  const candidates = containers
    .map((container, index) => {
      const iframe = container.querySelector('iframe[src]');
      const src = iframe?.getAttribute('src');
      if (!src || src.includes('/visualizar_documento_digitalizado/')) return null;
      const title = clean(container.querySelector('h3')?.textContent) || container.id || `doc_${index}`;
      return { 
        title, 
        src, 
        score: scoreCandidate(src, title, index) 
      };
    })
    .filter((c): c is { title: string; src: string; score: number } => !!c)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PREFILL_IFRAMES);

  if (candidates.length) {
    log(`[${proc.suapId}] Pré-extração determinística: analisando ${candidates.length} documento(s) leve(s)...`);
  }

  const fetched = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const response = await fetchViaProxy(candidate.src, suapSessionId);
        return { title: candidate.title, html: response.text || '' };
      } catch (error: any) {
        log(`[${proc.suapId}] Pré-extração: falha em ${candidate.title}: ${error.message}`);
        return null;
      }
    })
  );

  for (const block of fetched.filter(Boolean)) {
    if (block) {
      prefill = mergePrefill(prefill, extractPrefillFromTitle(block.title));
      prefill = mergePrefill(prefill, extractPrefillFromText(block.html));
    }
  }

  const cleaned = cleanupPrefill(prefill);
  return cleaned;
}

// Salva dados no banco local do Supabase
async function persistDeterministicPrefill(suapId: string, prefill: any, tenantId: string) {
  if (!cleanupPrefill(prefill)) return null;

  const { data: existing, error: fetchErr } = await supabase
    .from('processos')
    .select('id, dados_completos, beneficiario, cpf_cnpj, assunto, num_processo')
    .eq('tenant_id', tenantId)
    .eq('suap_id', suapId)
    .maybeSingle();

  if (fetchErr || !existing) {
    throw new Error(`Processo ${suapId} não encontrado no banco.`);
  }

  // Lógica de patch semelhante ao background
  const patch: any = {};
  const existingDc = existing.dados_completos || {};
  const nextDc = { ...existingDc };
  let dcChanged = false;

  const assignTopLevelIfMissing = (fieldName: string, incomingValue: any) => {
    if (!hasValue(incomingValue)) return;
    if (fieldName === 'num_processo') {
      if (existing[fieldName as keyof typeof existing] !== incomingValue) {
        patch[fieldName] = incomingValue;
      }
      return;
    }
    if (!hasValue(existing[fieldName as keyof typeof existing])) {
      patch[fieldName] = incomingValue;
    }
  };

  const assignDcIfMissing = (fieldName: string, incomingValue: any) => {
    if (!hasValue(incomingValue)) return;
    if (!hasValue(nextDc[fieldName])) {
      nextDc[fieldName] = incomingValue;
      dcChanged = true;
    }
  };

  assignTopLevelIfMissing('num_processo', prefill.num_processo);
  assignTopLevelIfMissing('beneficiario', prefill.beneficiario);
  assignTopLevelIfMissing('cpf_cnpj', prefill.cpf_cnpj);
  assignTopLevelIfMissing('assunto', prefill.assunto);

  assignDcIfMissing('processo_numero', prefill.num_processo);
  assignDcIfMissing('beneficiario', prefill.beneficiario);
  assignDcIfMissing('cpf_cnpj', prefill.cpf_cnpj);
  assignDcIfMissing('assunto', prefill.assunto);
  assignDcIfMissing('contrato_numero', prefill.dados_completos?.contrato_numero);
  assignDcIfMissing('val_nf', prefill.dados_completos?.val_nf);

  const mergedNotas = unique([
    ...(existingDc.notas_fiscais || []).map((n: any) => n.numero),
    ...(prefill.dados_completos?.notas_fiscais || []).map((n: any) => n.numero || n)
  ]).map(n => ({ numero: n }));

  if (mergedNotas.length > 0 && JSON.stringify(mergedNotas) !== JSON.stringify(existingDc.notas_fiscais || [])) {
    nextDc.notas_fiscais = mergedNotas;
    dcChanged = true;
  }

  const mergedEmpenhos = unique([
    ...(existingDc.empenhos || []),
    ...(prefill.dados_completos?.empenhos || [])
  ]);
  if (mergedEmpenhos.length > 0 && JSON.stringify(mergedEmpenhos) !== JSON.stringify(existingDc.empenhos || [])) {
    nextDc.empenhos = mergedEmpenhos;
    dcChanged = true;
  }

  const mergedBankData = mergeBank(existingDc.dados_bancarios, prefill.dados_completos?.dados_bancarios);
  if (mergedBankData && JSON.stringify(mergedBankData) !== JSON.stringify(existingDc.dados_bancarios || null)) {
    nextDc.dados_bancarios = mergedBankData;
    dcChanged = true;
  }

  if (dcChanged) {
    patch.dados_completos = nextDc;
  }

  if (Object.keys(patch).length === 0) {
    return {
      updated: false,
      validation: validateExtractedProcessRecord(existing),
    };
  }

  patch.updated_at = new Date().toISOString();

  const { data: updatedRows, error: updateErr } = await supabase
    .from('processos')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('suap_id', suapId)
    .select()
    .single();

  if (updateErr) {
    throw updateErr;
  }

  return {
    updated: true,
    validation: validateExtractedProcessRecord(updatedRows),
  };
}

function validateExtractedProcessRecord(record: any) {
  const dc = record?.dados_completos || {};
  const hasIdentity = [
    record?.beneficiario,
    record?.cpf_cnpj,
    record?.assunto,
    dc.beneficiario,
    dc.cpf_cnpj,
    dc.assunto,
  ].some(hasValue);

  const hasFinancialData = [
    dc.val_nf,
    dc.contrato_numero,
    dc.notas_fiscais,
    dc.empenhos,
    dc.dados_bancarios,
  ].some(hasValue);

  const missing = [];
  if (!hasValue(record?.num_processo) && !hasValue(dc.processo_numero)) missing.push('num_processo');
  if (!hasIdentity) missing.push('identificacao_basica');
  if (!hasFinancialData) missing.push('dados_financeiros');

  return {
    ok: missing.length === 0,
    missing,
  };
}

// Orquestra a geração e download do PDF no SUAP via polling Celery
async function downloadProcessPdf(
  proc: ScrapedProcesso,
  suapSessionId: string,
  log: SyncProgressCallback
): Promise<{ pdfBase64: string; deterministicData: any }> {
  const id = proc.suapId;

  log(`[${id}] Passo 1: Buscando página de detalhes do processo...`);
  const detailRes = await fetchViaProxy(`/processo_eletronico/processo/${id}/`, suapSessionId);
  const detailHtml = detailRes.text || '';

  const viewerMatch = detailHtml.match(new RegExp(`/processo_eletronico/visualizar_processo/${id}/`));
  if (!viewerMatch) {
    throw new Error(`Visualizador do processo não encontrado para o ID ${id}`);
  }

  const viewerUrl = viewerMatch[0];
  log(`[${id}] Passo 1 OK: Visualizador localizado.`);

  log(`[${id}] Passo 2: Buscando página do visualizador...`);
  const viewerRes = await fetchViaProxy(viewerUrl, suapSessionId);
  const viewerHtml = viewerRes.text || '';

  const triggerMatch = viewerHtml.match(/href="([^"]*\/processo_eletronico\/imprimir_processo_celery\/[^"]*)"/);
  if (!triggerMatch) {
    throw new Error(`Link de impressão/geração de PDF Celery não encontrado para o ID ${id}`);
  }

  const triggerPath = triggerMatch[1];
  log(`[${id}] Passo 2 OK: Trigger Celery localizado.`);

  // Iniciar extração determinística de documentos internos em paralelo
  const deterministicPromise = collectDeterministicProcessData(proc, detailHtml, viewerHtml, suapSessionId, log).catch((err) => {
    log(`[${id}] Pré-extração de metadados falhou: ${err.message}`);
    return null;
  });

  log(`[${id}] Passo 3: Disparando geração do PDF no Celery...`);
  const triggerRes = await fetchViaProxy(triggerPath, suapSessionId);
  const celeryHtml = triggerRes.text || '';

  const uuidMatch = celeryHtml.match(/process_progress\/[01]\/([a-f0-9-]+)\//);
  if (!uuidMatch) {
    throw new Error(`UUID do polling Celery não localizado na resposta do SUAP.`);
  }

  const uuid = uuidMatch[1];
  log(`[${id}] Passo 3 OK: UUID de Polling = ${uuid}`);

  const statusPath = `/djtools/process_progress/0/${uuid}/`;
  let finished = false;
  let maxPolls = 120; // 10 minutos limite (120 * 5s)

  log(`[${id}] Passo 4: Aguardando geração do PDF (polling Celery)...`);
  while (!finished && maxPolls > 0) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
      const pollRes = await fetchViaProxy(statusPath, suapSessionId);
      const textVal = pollRes.text || '';
      const parts = textVal.split('::');
      const pct = parts[0] || '?';
      const msg = parts[1] || '';
      const err = parts[4] || '';

      log(`[${id}] Poll [${121 - maxPolls}]: ${pct}% - ${msg || 'processando...'}`);
      
      if (msg && msg.toLowerCase().includes('sucesso')) {
        finished = true;
      } else if (err && err.trim()) {
        throw new Error(`Erro no Celery SUAP: ${err}`);
      }
    } catch (pollErr: any) {
      if (pollErr.message?.startsWith('Erro no Celery')) throw pollErr;
      log(`[${id}] Aviso no Polling: ${pollErr.message}`);
    }
    maxPolls--;
  }

  if (!finished) {
    throw new Error(`Tempo esgotado na geração do PDF para o processo ${id}`);
  }
  log(`[${id}] Passo 4 OK: PDF gerado com sucesso!`);

  log(`[${id}] Passo 5: Baixando PDF binário via proxy...`);
  const pdfDownloadPath = `/djtools/process_progress/1/${uuid}/`;
  const pdfRes = await fetchViaProxy(pdfDownloadPath, suapSessionId);

  if (!pdfRes.base64) {
    throw new Error('Falha ao obter PDF em formato Base64.');
  }

  log(`[${id}] Passo 5 OK: PDF baixado (${Math.round((pdfRes.base64.length * 3) / 4 / 1024)} KB)`);

  return {
    pdfBase64: pdfRes.base64,
    deterministicData: await deterministicPromise,
  };
}

// Portabilidade do scraping da página de listagem do SUAP
export const suapScraperService = {
  // Realiza o login institucional do SUAP e retorna o cookie sessionid
  async loginSuap(username: string, password: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('suap-proxy', {
      body: {
        action: 'login',
        username,
        password,
      },
    });

    if (error) {
      throw new Error(`Erro de rede no login: ${error.message}`);
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data.suapSessionId;
  },

  // Dado o HTML da caixa de processos, faz o parse e retorna a lista
  parseCaixaProcessos(html: string): ScrapedProcesso[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Verificar se caiu na tela de login do SUAP (sessão expirada)
    if (doc.querySelector('input[type="password"], form[action*="/accounts/login/"]')) {
      throw new Error('Sessão expirada ou não autenticada no SUAP. Por favor, conecte-se ao SUAP novamente.');
    }

    const links = Array.from(doc.querySelectorAll('a[href*="/processo_eletronico/processo/"]'));
    
    const processes: ScrapedProcesso[] = [];
    const seenIds = new Set<string>();

    for (const link of links) {
      const href = link.getAttribute('href') || '';
      if (!PROCESS_LINK_HREF_REGEX.test(href)) continue;
      
      // Extrair ID
      const match = href.match(/\/processo_eletronico\/processo\/(\d+)\//);
      const suapId = match ? match[1] : null;
      if (!suapId || seenIds.has(suapId)) continue;
      
      // Tentar pegar número do processo no contexto
      const container = link.closest('tr, li, article, .box, .media, .item');
      const candidates = [link.textContent, link.getAttribute('title'), container?.textContent];
      let numProcesso = undefined;
      for (const candidate of candidates) {
        const num = extractProcessNumber(candidate || '');
        if (num) {
          numProcesso = num;
          break;
        }
      }

      processes.push({
        suapId,
        numProcesso,
        url: `https://suap.ifrn.edu.br${href}`,
      });
      seenIds.add(suapId);
    }

    return processes;
  },

  // Busca o HTML da caixa de processos e faz o scraping
  async fetchAndScrapeCaixa(caixaUrl: string, suapSessionId: string): Promise<ScrapedProcesso[]> {
    const res = await fetchViaProxy(caixaUrl, suapSessionId);
    if (!res.text) {
      throw new Error('Resposta vazia da caixa de processos do SUAP');
    }
    return this.parseCaixaProcessos(res.text);
  },

  // Sincroniza a lista de processos básicos no Supabase (pendentes)
  async syncProcessListInSupabase(processes: ScrapedProcesso[], tenantId: string): Promise<any[]> {
    // 1. Obter processos já existentes
    const { data: existingList, error: selectErr } = await supabase
      .from('processos')
      .select('suap_id, status, beneficiario, cpf_cnpj, assunto, dados_completos')
      .eq('tenant_id', tenantId);

    if (selectErr) throw selectErr;

    const existingMap = new Map(existingList.map((p) => [p.suap_id, p]));
    const currentIds = new Set(processes.map((p) => p.suapId));
    const synced: any[] = [];

    // 2. Upsert os processos atuais
    for (const proc of processes) {
      const existing = existingMap.get(proc.suapId);
      
      if (existing) {
        const patch: any = { updated_at: new Date().toISOString() };
        if (proc.url) patch.url = proc.url;
        if (proc.numProcesso) patch.num_processo = proc.numProcesso;

        await supabase
          .from('processos')
          .update(patch)
          .eq('tenant_id', tenantId)
          .eq('suap_id', proc.suapId);

        // Verifica se já foi concluído/extraído com sucesso para evitar IA redundante
        const dc = existing.dados_completos || {};
        const hasIdentity = [existing.beneficiario, existing.cpf_cnpj, existing.assunto, dc.beneficiario, dc.cpf_cnpj, dc.assunto].some(hasValue);
        const hasFinancial = [dc.val_nf, dc.contrato_numero, dc.notas_fiscais, dc.empenhos, dc.dados_bancarios].some(hasValue);
        const alreadyExists = existing.status === 'concluido' || (existing.status === 'success' && hasIdentity && hasFinancial);

        synced.push({
          ...proc,
          already_exists: alreadyExists,
        });
      } else {
        const payload: any = {
          tenant_id: tenantId,
          suap_id: proc.suapId,
          url: proc.url,
          status: 'pending_extraction',
          updated_at: new Date().toISOString(),
        };
        if (proc.numProcesso) payload.num_processo = proc.numProcesso;

        await supabase.from('processos').insert(payload);
        synced.push({
          ...proc,
          already_exists: false,
        });
      }
    }

    // 3. Remover processos antigos que sumiram da caixa (stale)
    const staleIds = existingList
      .map((p) => p.suap_id)
      .filter((id) => !currentIds.has(id));

    if (staleIds.length > 0) {
      await supabase
        .from('processos')
        .delete()
        .eq('tenant_id', tenantId)
        .in('suap_id', staleIds);
    }

    return synced;
  },

  // Executa o enriquecimento de número do processo
  async enrichProcessNumber(proc: ScrapedProcesso, suapSessionId: string, log: SyncProgressCallback): Promise<string | null> {
    if (proc.numProcesso) return proc.numProcesso;
    log(`[${proc.suapId}] Obtendo número do processo...`);
    try {
      const res = await fetchViaProxy(`/processo_eletronico/processo/${proc.suapId}/`, suapSessionId);
      const doc = new DOMParser().parseFromString(res.text || '', 'text/html');
      const candidates = [
        doc.title, 
        doc.querySelector('.title-container h2')?.textContent, 
        doc.querySelector('#breadcrumbs')?.textContent, 
        doc.body?.textContent
      ];
      for (const candidate of candidates) {
        const num = extractProcessNumber(candidate || '');
        if (num) {
          log(`[${proc.suapId}] Número do processo identificado: ${num}`);
          return num;
        }
      }
    } catch (err: any) {
      log(`[${proc.suapId}] Falha ao buscar número do processo: ${err.message}`);
    }
    return null;
  },

  // Orquestra a importação e IA de um processo individual
  async processAndSyncSingle(
    proc: any,
    suapSessionId: string,
    tenantId: string,
    log: SyncProgressCallback
  ): Promise<boolean> {
    if (proc.already_exists) {
      log(`[${proc.suapId}] Já extraído com sucesso no banco. Pulando.`);
      return true;
    }

    // 1. Download do PDF e pre-extração determinística
    const { pdfBase64, deterministicData } = await downloadProcessPdf(proc, suapSessionId, log);

    // 2. Persistir a pré-extração determinística imediata
    if (deterministicData) {
      log(`[${proc.suapId}] Salvando metadados preliminares...`);
      await persistDeterministicPrefill(proc.suapId, deterministicData, tenantId);
    }

    // 3. Upload do PDF para o Storage do Supabase
    log(`[${proc.suapId}] Fazendo upload do PDF para o bucket suap-pdfs...`);
    
    // Converter base64 do proxy em Blob
    const byteChars = atob(pdfBase64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const storagePath = `${tenantId}/${proc.suapId}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from('suap-pdfs')
      .upload(storagePath, blob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadErr) {
      throw new Error(`Upload do PDF falhou: ${uploadErr.message}`);
    }

    // Atualizar referência no registro
    await supabase
      .from('processos')
      .update({
        pdf_url: storagePath,
        status: 'pdf_uploaded',
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('suap_id', proc.suapId);

    // 4. Disparar a Edge Function de extração por IA
    log(`[${proc.suapId}] Executando extração por Inteligência Artificial...`);
    const { data: aiRes, error: aiErr } = await supabase.functions.invoke('process-pdf', {
      body: { suap_id: proc.suapId },
    });

    if (aiErr) {
      throw new Error(`Extração por IA falhou: ${aiErr.message}`);
    }

    log(`[${proc.suapId}] Extração por IA finalizada.`);

    // 5. Se a IA deixou lacunas, aplicar prefill determinístico como reparo
    const { data: record } = await supabase
      .from('processos')
      .select('beneficiario, cpf_cnpj, assunto, dados_completos')
      .eq('tenant_id', tenantId)
      .eq('suap_id', proc.suapId)
      .single();

    const validation = validateExtractedProcessRecord(record);
    if (!validation.ok) {
      log(`[${proc.suapId}] Extração IA incompleta. Aplicando reparo determinístico...`);
      if (deterministicData) {
        const repairRes = await persistDeterministicPrefill(proc.suapId, deterministicData, tenantId);
        if (repairRes?.validation?.ok) {
          log(`[${proc.suapId}] Informações ausentes recuperadas com sucesso.`);
        }
      }
    }

    log(`[${proc.suapId}] Sincronização concluída com sucesso!`);
    return true;
  },

  // Descobre todas as caixas de processos disponíveis analisando o HTML principal da caixa do SUAP
  discoverCaixasProcessos(html: string): Array<{ nome: string; url: string }> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // O menu lateral de filtros/caixas do SUAP costuma usar links apontando para caixa_processos
    const links = Array.from(doc.querySelectorAll('a[href*="/processo_eletronico/caixa_processos/"]'));
    const caixasMap = new Map<string, string>(); // url -> nome
    
    // Caixa padrão (Recebidos)
    caixasMap.set('https://suap.ifrn.edu.br/processo_eletronico/caixa_processos/', 'Caixa de Entrada (Padrão)');

    for (const link of links) {
      const href = link.getAttribute('href') || '';
      let fullUrl = href;
      if (href.startsWith('/')) {
        fullUrl = `https://suap.ifrn.edu.br${href}`;
      } else if (!href.startsWith('http')) {
        fullUrl = `https://suap.ifrn.edu.br/processo_eletronico/caixa_processos/${href}`;
      }
      
      const nome = link.textContent?.trim().replace(/\s+/g, ' ') || '';
      // Limpar nomes vazios ou links repetitivos de paginação/filtros
      if (!nome || nome.includes('Anterior') || nome.includes('Próximo') || nome.match(/^\d+$/)) {
        continue;
      }
      
      // Ignorar parâmetros de paginação (?page=) que alteram a mesma caixa
      if (fullUrl.includes('page=')) continue;
      
      caixasMap.set(fullUrl, nome);
    }
    
    return Array.from(caixasMap.entries()).map(([url, nome]) => ({ nome, url }));
  },

  // CRUD de caixas de processos no banco de dados do Supabase
  async fetchCaixas(tenantId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('suap_caixas')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async addCaixa(tenantId: string, nome: string, url: string, syncAutomatica = true): Promise<any> {
    const { data, error } = await supabase
      .from('suap_caixas')
      .insert({
        tenant_id: tenantId,
        nome,
        url,
        sync_automatica: syncAutomatica,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteCaixa(caixaId: string, tenantId: string): Promise<void> {
    const { error } = await supabase
      .from('suap_caixas')
      .delete()
      .eq('id', caixaId)
      .eq('tenant_id', tenantId);

    if (error) throw error;
  },

  async toggleSyncAutomatica(caixaId: string, tenantId: string, enabled: boolean): Promise<any> {
    const { data, error } = await supabase
      .from('suap_caixas')
      .update({ sync_automatica: enabled, updated_at: new Date().toISOString() })
      .eq('id', caixaId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateLastSyncTime(caixaId: string, tenantId: string): Promise<void> {
    await supabase
      .from('suap_caixas')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', caixaId)
      .eq('tenant_id', tenantId);
  }
};
