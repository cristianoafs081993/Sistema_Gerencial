// Pure, shared by the Edge Functions, web UI and regression tests.
export const CHECKLIST_VERSION = '2.0.0';
export const RULES_VERSION = '2026-10-14.2';
export type ChecklistStatus = 'divergente' | 'nao_verificavel' | 'conforme' | 'nao_aplicavel';
export type PaymentKind = 'fornecedor_pj' | 'estudantes' | 'indefinido';
export type Evidence = {
  fonte: 'processo' | 'siafi' | 'lista' | 'norma';
  sourceId: string;
  pagina?: number;
  caminho?: string;
  trecho: string;
  verificacao?: 'texto' | 'visual';
};
export type Calculation = {
  operacao: 'igualdade' | 'soma' | 'retencao';
  valores: string[];
  resultado: string;
  aliquota?: string;
  evidencias: Evidence[];
  parcelas?: {chave:string;valor:string;evidencias:Evidence[]}[];
};
export type ChecklistItem = {
  id: string;
  regraId: string;
  entidade: string;
  descricao: string;
  prioridade: number;
  status: ChecklistStatus;
  esperado: string;
  encontrado: string;
  diferenca?: string;
  observacao: string;
  acao: string;
  evidencias: Evidence[];
  calculo?: Calculation & { memoria: string; diferencaCentavos: number };
  evolucao?: 'resolvido' | 'persistente' | 'novo' | 'nao_verificavel';
};
export type Rule = { id: string; descricao: string; grupo: 'comum' | 'predoc' | 'fornecedor' | 'bolsa'; prioridade: number; monetaria?: boolean; normativa?: boolean };
const definitions: [string, Rule['grupo'], number, string, boolean?, boolean?][] = [
  ['C01','comum',1,'Processo, UG, exercício, DH e documentos de origem'],
  ['C02','comum',0,'Credor, beneficiários finais e banco intermediário'],
  ['C03','comum',1,'Notas completas, sem cópias duplicadas ou substituídas'],
  ['C04','comum',0,'Valor bruto autorizado, pagamentos parciais e glosas',true],
  ['C05','comum',0,'Composição do bruto: líquido, retenções e outras deduções',true],
  ['C06','comum',1,'Empenho, exercício, credor, classificações e saldo documentado'],
  ['C07','comum',1,'Emissão, competência, ateste, vencimento e pagamento'],
  ['C08','comum',1,'Histórico disponível e possíveis pagamentos duplicados'],
  ['P01','predoc',0,'Pré-docs necessários preenchidos e capturados'],
  ['P02','predoc',1,'Tipo de pagamento ou recolhimento e campos obrigatórios'],
  ['P03','predoc',0,'CPF/CNPJ, banco, agência, conta, dígito, PIX ou boleto'],
  ['P04','predoc',0,'Valor do pré-doc e líquido ou dedução correspondente',true],
  ['P05','predoc',1,'Lista vinculada e distinção entre LC e LX'],
  ['P06','predoc',0,'Recolhedor, contribuinte, UG, receita, referência e apuração'],
  ['F01','fornecedor',0,'CNPJ do estabelecimento, contrato, objeto e período'],
  ['F02','fornecedor',1,'Ateste, recebimento, medição e autorização'],
  ['F03','fornecedor',0,'Incidência ou dispensa de cada tributo',false,true],
  ['F04','fornecedor',0,'Comprovação e vigência do regime, isenção ou decisão',false,true],
  ['F05','fornecedor',0,'Bases de cálculo e exclusões documentadas por tributo',true,true],
  ['F06','fornecedor',0,'Alíquotas, cálculo, arredondamento e valores retidos',true,true],
  ['F07','fornecedor',0,'Natureza do fornecimento e código de receita',false,true],
  ['F08','fornecedor',0,'INSS: emissão, apuração, competência e exceções',false,true],
  ['F09','fornecedor',0,'Apuração e vencimento dos demais tributos',false,true],
  ['F10','fornecedor',0,'ISS: município, serviço, responsabilidade e recolhimento',false,true],
  ['B01','bolsa',1,'Programa, edital, competência e parcela autorizada'],
  ['B02','bolsa',0,'Estudantes ausentes, adicionais, duplicados e identificação'],
  ['B03','bolsa',0,'Valor individual autorizado e ajustes documentados',true],
  ['B04','bolsa',0,'Soma individual, total autorizado e DH',true],
  ['B05','bolsa',0,'Conta escolhida por estudante, banco, agência e dígito'],
  ['B06','bolsa',1,'Duplicidade por estudante, programa e competência'],
  ['B07','bolsa',1,'Vigência, limites, suspensão e elegibilidade documentada'],
  ['B08','bolsa',0,'Fundamento e tratamento tributário do benefício',false,true],
];
export const RULES: Rule[] = definitions.map(([id,grupo,prioridade,descricao,monetaria,normativa]) => ({id,grupo,prioridade,descricao,monetaria,normativa}));

// A historical reference is never sufficient to approve a current tax rule.
export const NORM_REFERENCES = [
  { id: 'in1234', titulo: 'IN RFB 1.234 — versão compilada', url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=37200&visao=compilado', status: 'referencia', regras: ['F03','F04','F05','F06','F07','F09'], orientacao: 'Validar dispositivo, anexo, vigência e enquadramento da operação. Não presumir alíquota ou dispensa.' },
  { id: 'reinf-faq', titulo: 'EFD-Reinf — perguntas e respostas RFB', url: 'https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/sped/efd-reinf/efdr/', status: 'referencia', regras: ['F08','F09'], orientacao: 'R-2010 e R-4020 possuem fatos e períodos distintos. Exceção judicial requer decisão. Não aplicar orientação para órgãos fora do SIAFI a órgão integrante.' },
  { id: 'lei9250-art26', titulo: 'Lei 9.250, art. 26', url: 'https://www.planalto.gov.br/ccivil_03/leis/l9250compilado.htm', status: 'referencia', regras: ['B08'], orientacao: 'Bolsa de estudo/pesquisa: verificar doação, ausência de vantagem ao doador e de contraprestação. Não generalizar a auxílios assistenciais.' },
  { id: 'ufmg-2024', titulo: 'Tabela Natureza de Rendimento × Código de Receita — DCF/UFMG, janeiro/2024', status: 'historica', regras: ['F07'], orientacao: 'Tabela fornecida pelo usuário, R-4020/PJ. A mesma receita não torna naturezas intercambiáveis. Exige confirmação de vigência.' },
  { id: 'coad-historico', titulo: 'Orientação COAD sobre retenções — material fornecido', status: 'historica', regras: ['F03','F04','F06'], orientacao: 'Contém referências antigas. Data de impressão não comprova vigência. Não ativar alíquotas automaticamente.' },
];
export const HISTORICAL_NATURE_REVENUE: Record<string,string> = {
  '17001':'6147','17002':'6147','17003':'6147','17004':'6147','17009':'6147',
  '17010':'9060','17011':'9060','17012':'9060','17013':'8739','17014':'8739','17015':'8739','17016':'8739',
  '17017':'8767','17018':'8767','17019':'8767','17020':'8767','17021':'8767','17022':'8767',
  '17023':'6175','17024':'8850','17025':'8863','17026':'6188','17027':'6188',
  '17028':'6190','17029':'6190','17030':'6190','17031':'6190','17032':'6190','17033':'6190',
  '17034':'6190','17035':'6190','17036':'6190','17037':'6190','17038':'8863','17040':'6147',
  '17041':'6190','17042':'6190','17043':'6147','17046':'6147','17047':'8767','17049':'6190','17050':'8863','17099':'6190',
};
export const obj = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
export const arr = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export const str = (value: unknown) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
export const normalized = (value: unknown) => str(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
export const digits = (value: unknown) => str(value).replace(/\D/g,'');
export const normalizeAccount = (value: unknown) => str(value).toUpperCase().replace(/[^0-9X]/g,'');
export const authorizedPdfPath = (path:unknown,userId:string) => typeof path==='string' && path.startsWith(`${userId}/`) &&
  !/[%\\?#:]/.test(path) && [...path].every(char=>char.charCodeAt(0)>=32&&char.charCodeAt(0)!==127) &&
  path.split('/').every(segment=>segment!=='.'&&segment!=='..'&&segment!=='') && /\.pdf$/i.test(path);
export const stableEntity = (value:unknown) => str(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toUpperCase()
  .replace(/(CPF|CNPJ):([0-9./-]+)/g,(_,tag,document)=>`${tag}:${digits(document)}`)
  .replace(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g,'$3-$2-$1').replace(/:TRIBUTO:(NENHUM|NONE|NULL)?$/,'');

/** Reject empty/ambiguous amounts; retain cents as integer, never Number rounding. */
function decimalUnits(value: unknown, places: number): bigint | null {
  let text = str(value).trim().replace(/^R\$\s*/,'').replace(/\s/g,'');
  if (!text) return null;
  if (text.includes(',')) {
    if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d+$/.test(text)) return null;
    text = text.replace(/\./g,'').replace(',','.');
  } else if (places === 2 && /^-?\d{1,3}(?:\.\d{3})+$/.test(text)) {
    // A Brazilian thousand grouping is not a three-place decimal amount.
    text = text.replace(/\./g,'');
  }
  const match = text.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match || (match[3]?.length || 0) > places) return null;
  const units = BigInt(match[2]) * 10n ** BigInt(places) + BigInt((match[3] || '').padEnd(places,'0'));
  return match[1] ? -units : units;
}
export function moneyCents(value: unknown): number | null {
  const units = decimalUnits(value,2);
  return units === null || units > BigInt(Number.MAX_SAFE_INTEGER) || units < BigInt(Number.MIN_SAFE_INTEGER) ? null : Number(units);
}
export const formatCents = (value: number) => `${value < 0 ? '-' : ''}${Math.floor(Math.abs(value)/100)},${String(Math.abs(value)%100).padStart(2,'0')}`;
function containsAmount(text:string,value:string,rate=false) {
  const pattern=rate ? /-?\d+(?:[.,]\d+)?/g : /-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2}|\.\d{1,2})?(?!\d)/g;
  const target=rate ? decimalUnits(value,6) : moneyCents(value);
  return target!==null && [...text.matchAll(pattern)].some(match=>(rate?decimalUnits(match[0],6):moneyCents(match[0]))===target);
}
export function computeCalculation(calculation: Calculation): { memoria: string; diferencaCentavos: number } | null {
  const inputs = calculation.valores.map(moneyCents), expected = moneyCents(calculation.resultado);
  if (expected === null || !inputs.length || inputs.some(x => x === null)) return null;
  const amounts = inputs as number[];
  let result: bigint;
  let memoria: string;
  if (calculation.operacao === 'retencao') {
    if (amounts.length !== 1 || amounts[0] < 0) return null;
    const rate = decimalUnits(str(calculation.aliquota).replace(/%$/,''),6);
    if (rate === null || rate < 0n || rate > 100000000n) return null;
    const numerator = BigInt(amounts[0]) * rate;
    result = (numerator + 50000000n) / 100000000n;
    if(result>BigInt(Number.MAX_SAFE_INTEGER))return null;
    memoria = `${formatCents(amounts[0])} × ${calculation.aliquota}% = ${formatCents(Number(result))}; informado: ${formatCents(expected)}`;
  } else {
    if (calculation.operacao === 'igualdade' && amounts.length !== 1) return null;
    result = amounts.reduce((sum,value) => sum + BigInt(value),0n);
    if(result>BigInt(Number.MAX_SAFE_INTEGER)||result<BigInt(Number.MIN_SAFE_INTEGER))return null;
    memoria = `${amounts.map(formatCents).join(' + ')} = ${formatCents(Number(result))}; informado: ${formatCents(expected)}`;
  }
  const difference = BigInt(expected) - result;
  if (difference > BigInt(Number.MAX_SAFE_INTEGER) || difference < BigInt(Number.MIN_SAFE_INTEGER)) return null;
  return { memoria, diferencaCentavos: Number(difference) };
}
export type SourceDescriptor = { id: string; titulo: string; documentoId?: string; paginas?: number; storagePath?: string; originalStoragePath?: string; sha256?: string; tipo?: string; conteudo?: string; paginasTexto?: string[] };
export function valueAtPath(root: unknown, path: string): unknown {
  if (!/^(?:[a-zA-Z0-9_]+)(?:\.[a-zA-Z0-9_]+)*$/.test(path)) return undefined;
  return path.split('.').reduce<unknown>((value,key) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
    return value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value,key) ? (value as Record<string,unknown>)[key] : undefined;
  },root);
}
export function captureEvidenceCatalog(capture:unknown) {
  const entries:{ref:string;caminho:string;label:string;valor:unknown}[]=[];
  const add=(caminho:string,label:string,valor:unknown)=>{
    if(str(valor))entries.push({ref:`S${String(entries.length+1).padStart(4,'0')}`,caminho,label,valor});
  };
  for(const [key,value] of Object.entries(obj(obj(capture).document)))add(`document.${key}`,key,value);
  for(const group of ['sections','predocs'])for(const [index,value] of arr(obj(capture)[group]).entries()) {
    const section=obj(value);
    for(const [fieldIndex,value] of arr(section.fields).entries()) {
      const field=obj(value);add(`${group}.${index}.fields.${fieldIndex}.value`,str(field.label),field.value);
    }
    for(const [tableIndex,value] of arr(section.tables).entries()) {
      const table=obj(value);
      for(const [rowIndex,row] of arr(table.rows).entries())for(const [cellIndex,cell] of arr(row).entries()) {
        add(`${group}.${index}.tables.${tableIndex}.rows.${rowIndex}.${cellIndex}.text`,str(arr(table.headers)[cellIndex]),obj(cell).text);
      }
    }
  }
  return entries;
}
export function validEvidence(value: unknown, capture: unknown, sources: SourceDescriptor[], lists: unknown): Evidence | null {
  const e = obj(value), fonte = e.fonte==='captura'?'siafi':str(e.fonte), sourceId = str(e.sourceId), trecho = str(e.trecho).trim();
  if (!trecho || trecho.length > 4000 || !sourceId) return null;
  const reference=fonte==='siafi'&&str(e.ref)?captureEvidenceCatalog(capture).find(entry=>entry.ref===e.ref):null;
  if(fonte==='siafi'&&str(e.ref)&&!reference)return null;
  const caminho = (reference?.caminho || str(e.caminho)).replace(/\[(\d+)\]/g,'.$1').replace(fonte==='siafi'?/^captura\./:/^listas\./,'');
  if (fonte === 'siafi' || fonte === 'lista') {
    const root = fonte === 'siafi' ? capture : lists;
    const canonicalId=fonte==='siafi'?str(obj(capture).captureId):str(obj(arr(lists)[Number(caminho.split('.')[0])]).id);
    if (!canonicalId) return null;
    const actual = valueAtPath(root,caminho);
    const field = caminho.endsWith('.value') ? obj(valueAtPath(root,caminho.replace(/\.value$/,''))) : {};
    const actualText=normalized(actual),quoted=normalized(trecho);
    const labelled=normalized(`${str(field.label)}: ${str(actual)}`),withoutColon=normalized(`${str(field.label)} ${str(actual)}`);
    if (actual === undefined || actual === null || !str(actual) || !(actualText.includes(quoted) || labelled===quoted || withoutColon===quoted)) return null;
    return { fonte, sourceId:canonicalId, caminho, trecho };
  }
  if (fonte === 'processo') {
    const source = sources.find(s => s.id === sourceId), pagina = Number(e.pagina);
    if (!source || !Number.isInteger(pagina) || pagina < 1 || !source.paginas || pagina > source.paginas) return null;
    const text=source.paginasTexto?.[pagina-1];
    if(text?.trim() && !normalized(text).includes(normalized(trecho)))return null;
    return { fonte, sourceId, pagina, trecho, verificacao:text?.trim()?'texto':'visual' };
  }
  // A link alone does not prove which legal provision applies. Official legal
  // documents supplied as PDFs are addressed as 'processo' evidence as well.
  if (fonte === 'norma' && sources.some(s => s.id === sourceId && s.tipo === 'norma_oficial' && s.conteudo && normalized(s.conteudo).includes(normalized(trecho))) && caminho && trecho.length >= 20) {
    return { fonte, sourceId, caminho, trecho };
  }
  return null;
}
export const captureProcessNumber = (capture: unknown) => {
  const sections=arr(obj(capture).sections);
  const basic=sections.filter(section=>['basic','dados-basicos','dados_basicos','dadosbasicos','basicos'].includes(normalized(obj(section).key)) || normalized(obj(section).title).includes('dados basicos'));
  const fields = (basic.length?basic:sections).flatMap(section => arr(obj(section).fields));
  const values = fields.filter(field => /^(numero (do )?)?processo$/.test(normalized(obj(field).label).replace(/[:*]/g,'').trim())).map(field => str(obj(field).value));
  const matches = values.map(value => value.match(/\d{5}\.\d{6}\.\d{4}-\d{2}/)?.[0]).filter(Boolean);
  return [...new Set(matches)].length === 1 ? matches[0]! : '';
};
export function assertCapture(value: unknown) {
  const capture = obj(value), source = obj(capture.source);
  if (capture.schemaVersion !== '1.0.0' || !/^[a-zA-Z0-9-]{6,100}$/.test(str(capture.captureId)) || !['complete','partial'].includes(str(capture.status)) || !arr(capture.sections).length) throw new Error('Captura SIAFI inválida ou incompleta. Execute print novamente.');
  // Source was exported as an origin/path, never a token-bearing URL.
  const url = str(source.url || source.origin || capture.source);
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Origem da captura inválida.'); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'siafi.tesouro.gov.br' || parsed.username || parsed.password || parsed.search) throw new Error('Origem da captura inválida.');
  if (!captureProcessNumber(capture)) throw new Error('Não foi possível identificar um único número de processo nos Dados Básicos.');
  if (JSON.stringify(capture).length > 6 * 1024 * 1024) throw new Error('A captura excede o limite de 6 MB.');
  return capture;
}
export function classifyPayment(processo: unknown): PaymentKind {
  const p = obj(processo), data = obj(p.dados_completos);
  const text = normalized(`${p.assunto || ''} ${data.assunto || ''}`);
  if (/bolsa|bolsista|auxilio estudantil|assistencia estudantil|monitoria|pafe/.test(text)) return 'estudantes';
  return digits(p.cpf_cnpj || data.cpf_cnpj).length === 14 ? 'fornecedor_pj' : 'indefinido';
}
export function selectInvoices(capture: unknown, invoices: unknown[]) {
  const content = arr(obj(capture).sections).map(section => {
    const s = obj(section);
    return `${arr(s.fields).filter(field => /nota|origem|documento|observacao/.test(normalized(obj(field).label))).map(field => str(obj(field).value)).join(' ')} ${arr(s.tables).map(table => JSON.stringify(obj(table).rows)).join(' ')}`;
  }).join(' ');
  const distinct = invoices.map(obj).filter((invoice,index,all) => !all.slice(0,index).some(i => i.numero === invoice.numero && i.data_emissao === invoice.data_emissao && i.valor === invoice.valor));
  const matched = distinct.filter(invoice => {
    const number = str(invoice.numero).trim();
    return number && new RegExp(`(^|[^0-9A-Za-z])${number.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}($|[^0-9A-Za-z])`).test(content);
  });
  return { invoices: distinct, selected: matched.map(invoice => distinct.indexOf(invoice)), ambiguous: !matched.length && distinct.length > 0 };
}
const statusRank: Record<ChecklistStatus,number> = {divergente:0,nao_verificavel:1,conforme:2,nao_aplicavel:3};
const mandatoryRules=new Set(['C01','C02','C04','C05','C06','C07','C08','P01','P02','P03','P04','F01','F02','B01','B02','B03','B04','B05','B06','B07','B08']);

// Count recipients independently of amounts. A correct total can conceal an
// omitted student or a different student with the same individual amount.
export function studentRosterChecks(raw: unknown, context: {capture:unknown;sources:SourceDescriptor[];lists:unknown}) {
  const roster=obj(obj(raw).conferenciaEstudantes);
  const readStudents=(values:unknown)=>arr(values).map(value=>{
    const row=obj(value);
    const verified=arr(row.evidencias).map(e=>validEvidence(e,context.capture,context.sources,context.lists))
      .filter((e):e is Evidence=>!!e && e.fonte==='processo' && e.verificacao==='texto');
    const citedCpfs=[...new Set(verified.flatMap(e=>[...e.trecho.matchAll(/(?<!\d)(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})(?!\d)/g)].map(match=>digits(match[0]))))];
    // The literal PDF citation is authoritative if the model mistypes digits.
    const supplied=digits(row.cpf),cpf=citedCpfs.includes(supplied)?supplied:citedCpfs.length===1?citedCpfs[0]:'';
    const evidence=verified.filter(e=>cpf && digits(e.trecho).includes(cpf));
    return {cpf,nome:str(row.nome),evidence};
  }).filter(row=>row.cpf.length===11 && row.evidence.length>0);
  const authorized=readStudents(roster.autorizados);
  const scopeEvidence=arr(roster.evidenciasEscopo).map(e=>validEvidence(e,context.capture,context.sources,context.lists))
    .filter((e):e is Evidence=>!!e && e.fonte==='processo' && e.verificacao==='texto');
  const expected=new Map(authorized.map(row=>[row.cpf,row]));
  // An explicit, unique authorized headcount on the cited scope pages also
  // establishes completeness. It must match the verified CPF inventory.
  const scopePages=[...new Set(scopeEvidence.map(e=>`${e.sourceId}:${e.pagina}`))];
  const documentedCounts=scopePages.flatMap(key=>{
    const evidence=scopeEvidence.find(e=>`${e.sourceId}:${e.pagina}`===key)!;
    const text=normalized(context.sources.find(source=>source.id===evidence.sourceId)?.paginasTexto?.[evidence.pagina!-1]);
    return [...text.matchAll(/\bquantidade autorizada\s*:\s*(\d+)\b/g)].map(match=>({count:Number(match[1]),evidence:{...evidence,trecho:match[0]}}));
  });
  const headcountComplete=documentedCounts.length===1 && documentedCounts[0].count===expected.size;
  const expectedComplete=roster.escopoConfirmado===true && (roster.listaCompleta===true || headcountComplete) && expected.size>0 && scopeEvidence.length>0 &&
    (!documentedCounts.length || headcountComplete) &&
    (headcountComplete || authorized.length===arr(roster.autorizados).length);
  const actual=new Map<string,{nome:string;evidence:Evidence[];count:number}>();
  const paymentSections=arr(obj(context.capture).sections).map((value,index)=>({section:obj(value),index}))
    .filter(({section})=>/dados[-_ ](?:de[-_ ])?pagamento|dados de pagamento/.test(normalized(section.key || section.title)));
  let recognized=false,incomplete=false;
  const cpfFrom=(value:unknown)=>str(value).trim().match(/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/)?.[0];
  for(const {section,index} of paymentSections) {
    if(section.status!=='captured')incomplete=true;
    for(const [tableIndex,value] of arr(section.tables).entries()) {
      const table=obj(value),headers=arr(table.headers).map(normalized);
      if(/deduc|tribut|recolh|retenc/.test(normalized(table.id)+' '+headers.join(' ')))continue;
      const cpfIndex=headers.findIndex(header=>/cpf|favorecido|beneficiario/.test(header) && !/nome|conta|valor/.test(header));
      if(cpfIndex<0)continue;
      recognized=true;
      const nameIndex=headers.findIndex(header=>/nome/.test(header));
      for(const [rowIndex,value] of arr(table.rows).entries()) {
        const cells=arr(value),text=str(obj(cells[cpfIndex]).text).trim();
        if(!text && cells.every(cell=>!str(obj(cell).text).trim()))continue;
        if(/^total\b/i.test(text))continue;
        let cpf=digits(cpfFrom(text));
        let evidence:Evidence|null=null,nome=str(obj(cells[nameIndex]).text);
        if(cpf.length!==11) {
          const predocIndex=arr(obj(context.capture).predocs).findIndex(value=>{
            const predoc=obj(value);
            return predoc.id===`${str(table.id)}:${rowIndex}:btnPredoc` && predoc.status==='captured' && /dados[-_ ](?:de[-_ ])?pagamento/.test(normalized(predoc.sectionKey));
          });
          if(predocIndex>=0) {
            const fields=arr(obj(arr(obj(context.capture).predocs)[predocIndex]).fields).map(obj);
            const fieldIndex=fields.findIndex(field=>/:codFavorecido_output$/.test(str(field.id)) || normalized(field.label)==='favorecido');
            if(fieldIndex>=0) {
              cpf=digits(cpfFrom(fields[fieldIndex].value));
              evidence=validEvidence({fonte:'siafi',sourceId:obj(context.capture).captureId,caminho:`predocs.${predocIndex}.fields.${fieldIndex}.value`,trecho:str(fields[fieldIndex].value)},context.capture,context.sources,context.lists);
              nome=str(fields.find(field=>/:nomeFavorecido$/.test(str(field.id)))?.value);
            }
          }
        }
        // Bank intermediaries, masked CPFs and opaque RB/LX references do not
        // establish the complete list of final student recipients.
        if(cpf.length!==11) {incomplete=true;continue;}
        evidence ||= validEvidence({fonte:'siafi',sourceId:obj(context.capture).captureId,
          caminho:`sections.${index}.tables.${tableIndex}.rows.${rowIndex}.${cpfIndex}.text`,trecho:text},context.capture,context.sources,context.lists);
        if(!evidence) {incomplete=true;continue;}
        const previous=actual.get(cpf);
        actual.set(cpf,{nome,evidence:[...(previous?.evidence || []),evidence],count:(previous?.count || 0)+1});
      }
    }
  }
  const deductionOnlyPartial=obj(context.capture).status==='partial' && arr(obj(context.capture).warnings).length>0 &&
    arr(obj(context.capture).warnings).every(warning=>normalized(warning)==='aba nao disponivel: deducoes');
  const actualComplete=recognized && !incomplete && (obj(context.capture).status==='complete' || deductionOnlyPartial);
  const request=obj(roster.solicitacao),requestedRows=readStudents(request.alunos);
  const requested=new Map(requestedRows.map(row=>[row.cpf,row]));
  const requestScope=arr(request.evidenciasEscopo).map(e=>validEvidence(e,context.capture,context.sources,context.lists))
    .filter((e):e is Evidence=>!!e && e.fonte==='processo' && e.verificacao==='texto');
  const requestPages=[...new Set(requestScope.map(e=>`${e.sourceId}:${e.pagina}`))];
  const requestCounts=requestPages.flatMap(key=>{
    const evidence=requestScope.find(e=>`${e.sourceId}:${e.pagina}`===key)!;
    const text=normalized(context.sources.find(source=>source.id===evidence.sourceId)?.paginasTexto?.[evidence.pagina!-1]);
    return [...text.matchAll(/\bquantidade solicitada\s*:\s*(\d+)\b/g)].map(match=>({count:Number(match[1]),evidence:{...evidence,trecho:match[0]}}));
  });
  const quantity=requestCounts.length===1?requestCounts[0].count:Number(request.quantidade);
  const quantityEvidence=[...requestCounts.map(value=>value.evidence),...arr(request.evidenciasQuantidade).map(e=>validEvidence(e,context.capture,context.sources,context.lists))
    .filter((e):e is Evidence=>!!e && e.fonte==='processo' && e.verificacao==='texto' && new RegExp(`(?<![\\d.,])${quantity}(?!\\d|[.,]\\d)`).test(e.trecho))
  ];
  const explicitQuantity=Number.isSafeInteger(quantity) && quantity>0 && quantityEvidence.length>0;
  const requestScopeKnown=request.escopoConfirmado===true && requestScope.length>0 && requestCounts.length<=1;
  const requestedComplete=requestScopeKnown && request.listaCompleta===true && requested.size>0 &&
    requestedRows.length===arr(request.alunos).length && (!explicitQuantity || quantity===requested.size);
  const requestedCount=requestScopeKnown ? explicitQuantity?quantity:requestedComplete?requested.size:null : null;
  const authorizedCount=roster.escopoConfirmado===true && scopeEvidence.length>0 ?
    documentedCounts.length===1?documentedCounts[0].count:expectedComplete?expected.size:null : null;
  const baseline=requestedComplete?requested:expected;
  const missing=[...baseline.keys()].filter(cpf=>!actual.has(cpf));
  const additional=[...actual.keys()].filter(cpf=>!baseline.has(cpf));
  const repeated=[...actual.keys()].filter(cpf=>actual.get(cpf)!.count>1);
  const complete=requestedComplete && expectedComplete && actualComplete;
  const evidence=[...requestScope,...quantityEvidence,...requestedRows.flatMap(row=>row.evidence),...scopeEvidence,...documentedCounts.map(value=>value.evidence),...authorized.flatMap(row=>row.evidence),...actual.values()].flatMap(value=>'evidence' in value?value.evidence:[value]);
  const rule=RULES.find(rule=>rule.id==='B02')!;
  const item=(entity:string,status:ChecklistStatus,esperado:string,encontrado:string,acao:string,evidencias:Evidence[]):ChecklistItem=>({
    id:`B02:${entity}`,regraId:'B02',entidade:entity,descricao:rule.descricao,prioridade:0,status,esperado,encontrado,acao,evidencias,
    observacao:complete?'Comparação da solicitação original, autorização do gestor e liquidação para a mesma competência/parcela.':
      'Conferência em três etapas: a autorização pode conter erro. Falta comprovar parte das quantidades/relações solicitada, autorizada e liquidada. Banco ou lista de trabalho não identifica sozinho os alunos liquidados.',
  });
  const different=(left:Map<string,unknown>,right:Map<string,unknown>)=>left.size!==right.size || [...left.keys()].some(cpf=>!right.has(cpf));
  const requestAuthMismatch=requestedCount!==null && authorizedCount!==null && requestedCount!==authorizedCount || requestedComplete && expectedComplete && different(requested,expected);
  const requestActualMismatch=requestedCount!==null && actualComplete && requestedCount!==actual.size || requestedComplete && actualComplete && different(requested,actual);
  const authActualMismatch=authorizedCount!==null && actualComplete && authorizedCount!==actual.size || expectedComplete && actualComplete && different(expected,actual);
  const items=[item('GERAL',requestAuthMismatch||requestActualMismatch||authActualMismatch||actualComplete&&repeated.length>0?'divergente':complete?'conforme':'nao_verificavel',
    `Solicitação: ${requestedCount ?? 'quantidade não comprovada'} aluno(s); autorização: ${authorizedCount ?? 'quantidade não comprovada'} aluno(s)`,
    `Liquidação: ${actualComplete?actual.size:'quantidade não comprovada'} aluno(s); ausentes identificados: ${missing.length}; adicionais: ${additional.length}; repetidos: ${repeated.length}`,
    requestAuthMismatch?'Solicite ao gestor conferir e corrigir a autorização frente ao pedido original antes de ajustar a liquidação.':complete?'Confira os alunos ausentes, adicionais e repetidos antes de registrar o DH.':'Complete a solicitação, autorização e captura dos destinatários finais para esta competência/parcela.',evidence)];
  for(const [entity,left,right,mismatch,known] of [
    ['SOLICITACAO_AUTORIZACAO',requestedCount,authorizedCount,requestAuthMismatch,requestedCount!==null&&authorizedCount!==null],
    ['SOLICITACAO_LIQUIDACAO',requestedCount,actualComplete?actual.size:null,requestActualMismatch,requestedCount!==null&&actualComplete],
    ['AUTORIZACAO_LIQUIDACAO',authorizedCount,actualComplete?actual.size:null,authActualMismatch,authorizedCount!==null&&actualComplete],
  ] as const) {
    items.push(item(entity,mismatch?'divergente':known?'conforme':'nao_verificavel',`Quantidade de alunos: ${left ?? 'não comprovada'}`,`Quantidade de alunos: ${right ?? 'não comprovada'}`,
      entity==='SOLICITACAO_AUTORIZACAO'?'Confira a autorização do gestor contra a solicitação original; eventual exclusão ou alteração precisa estar documentada.':'Confira a relação de alunos e eventuais exclusões/parcelas justificadas antes de registrar.',evidence));
  }
  for(const cpf of new Set([...requested.keys(),...expected.keys(),...actual.keys()])) {
    const wanted=baseline.get(cpf),found=actual.get(cpf),authorizedStudent=expected.get(cpf);
    const status:ChecklistStatus=complete?(!wanted||!found||found.count>1||requested.has(cpf)!==expected.has(cpf)?'divergente':'conforme'):'nao_verificavel';
    items.push(item(`CPF:${cpf}:COBERTURA`,status,wanted?`${wanted.nome || 'Aluno'} — CPF ${cpf}: ${requestedComplete?'solicitado':'autorizado; solicitação não comprovada'}`:`CPF ${cpf}: não consta na solicitação completa desta liquidação`,
      found?`${found.nome || 'Aluno'} — CPF ${cpf}: ${found.count} ocorrência(s) capturada(s)`:`CPF ${cpf}: não localizado entre os destinatários capturados`,
      !complete?'Confirme a solicitação, autorização e relação completa dos destinatários.':requested.has(cpf)&&!authorizedStudent?'Aluno solicitado ausente da autorização: peça ao gestor a correção ou justificativa antes de incluí-lo no DH.':!found?'Confira a inclusão do aluno solicitado e autorizado que foi esquecido, seu valor e pré-doc.':!wanted?'Aluno incluído a mais: confira a solicitação e a autorização desta competência/parcela.':found.count>1?'Confira se as ocorrências são parcelas distintas autorizadas ou duplicação.':'Identificação conferida; confira também valor individual e conta.',
      [...(wanted?.evidence || []),...(authorizedStudent?.evidence || []),...(found?.evidence || []),...requestScope,...scopeEvidence]));
  }
  return {items,cpfs:[...new Set([...requested.keys(),...expected.keys(),...actual.keys()])]};
}
export const sortChecklist = (items: ChecklistItem[]) => [...items].sort((a,b) => statusRank[a.status]-statusRank[b.status] || a.prioridade-b.prioridade || a.id.localeCompare(b.id));
export function compareChecklists(items: ChecklistItem[], previous: ChecklistItem[]) {
  const old = new Map(previous.map(item => [item.id,item]));
  const compared = items.map(item => {
    const before = old.get(item.id);
    const evolucao = item.status === 'nao_verificavel' ? 'nao_verificavel' : item.status === 'divergente' ? before?.status === 'divergente' ? 'persistente' : 'novo' : before?.status === 'divergente' && item.status === 'conforme' ? 'resolvido' : undefined;
    return { ...item, ...(evolucao ? {evolucao} : {}) } as ChecklistItem;
  });
  for (const missing of previous.filter(before=>before.status==='divergente' && !items.some(item=>item.id===before.id))) {
    compared.push({...missing,status:'nao_verificavel',encontrado:'Lançamento não identificado na nova análise',observacao:'O item divergente anterior não foi identificado novamente. Isso não comprova correção.',acao:'Confira o lançamento e a cobertura da nova captura.',evidencias:[],calculo:undefined,diferenca:undefined,evolucao:'nao_verificavel'});
  }
  return compared;
}
export function finalizeChecklist(raw: unknown, context: { capture: unknown; sources: SourceDescriptor[]; lists: unknown; kind: PaymentKind; previous?: ChecklistItem[]; selectedInvoices?:unknown[] }) {
  const candidateItems = arr(obj(raw).checklist), result: ChecklistItem[] = [];
  for (const rule of RULES) {
    const applicable = !(rule.grupo === 'fornecedor' && context.kind === 'estudantes' || rule.grupo === 'bolsa' && context.kind === 'fornecedor_pj');
    const candidates = applicable ? candidateItems.filter(item => obj(item).regraId === rule.id) : [];
    for (const candidate of candidates.length ? candidates : [{}]) {
      const r = obj(candidate);
      const invoice = context.selectedInvoices?.length===1 ? obj(context.selectedInvoices[0]) : null;
      const entity = rule.id==='C04' && invoice && candidates.length<=1 ? stableEntity(`NF:${invoice.numero}:${invoice.data_emissao}`) : ['C01','C05','B04'].includes(rule.id)&&candidates.length<=1 ? 'GERAL' : stableEntity(r.entidade).slice(0,250) || 'GERAL';
      const item: ChecklistItem = {
        id: `${rule.id}:${entity}`, regraId: rule.id, entidade: entity, descricao: rule.descricao, prioridade: rule.prioridade,
        status: applicable ? ['conforme','divergente','nao_aplicavel'].includes(str(r.status)) ? r.status as ChecklistStatus : 'nao_verificavel' : 'nao_aplicavel',
        esperado: str(r.esperado), encontrado: str(r.encontrado), observacao: str(r.observacao) || (applicable ? 'A IA não apresentou evidência suficiente para esta verificação.' : 'Regra de outro tipo de pagamento.'),
        acao: str(r.acao) || (applicable ? 'Conferir os documentos e completar as evidências.' : ''),
        evidencias: arr(r.evidencias).map(e => validEvidence(e,context.capture,context.sources,context.lists)).filter((e): e is Evidence => !!e),
      };
      const sides = new Set(item.evidencias.map(e => e.fonte));
      if (applicable && ['conforme','divergente'].includes(item.status) && (!sides.has('siafi') || !sides.has('processo'))) {
        item.status = 'nao_verificavel'; item.observacao = 'Falta evidência válida de um dos lados da comparação. ' + item.observacao;
      }
      if (applicable && rule.normativa && !item.evidencias.some(e => e.fonte === 'norma')) {
        item.status = 'nao_verificavel'; item.observacao = 'Enquadramento e vigência normativa precisam de referência oficial específica. ' + item.observacao;
      }
      if(applicable && ['conforme','divergente'].includes(item.status) && item.evidencias.some(e=>e.verificacao==='visual')) {
        item.status='nao_verificavel';item.observacao='Citação visual sem texto verificável no PDF; confira a página indicada. '+item.observacao;
      }
      if (applicable && item.status === 'nao_aplicavel' && (!str(r.observacao) || !sides.has('processo'))) item.status = 'nao_verificavel';
      if(applicable && item.status==='nao_aplicavel' && mandatoryRules.has(rule.id)) {
        item.status='nao_verificavel';item.observacao='Esta conferência é obrigatória para o pagamento selecionado; ausência de dados não a torna inaplicável. '+item.observacao;
      }
      if (applicable && rule.monetaria && ['conforme','divergente'].includes(item.status)) {
        const c = obj(r.calculo);
        const evidence = arr(c.evidencias).length ? arr(c.evidencias).map(e => validEvidence(e,context.capture,context.sources,context.lists)).filter((e): e is Evidence => !!e) : item.evidencias;
        const parcelas=arr(c.parcelas).map(value=>{const p=obj(value);return {chave:stableEntity(p.chave),valor:str(p.valor),evidencias:arr(p.evidencias).length ? arr(p.evidencias).map(e=>validEvidence(e,context.capture,context.sources,context.lists)).filter((e):e is Evidence=>!!e) : evidence};});
        const calculation = { operacao: str(c.operacao), valores: arr(c.valores).map(str), resultado: str(c.resultado), aliquota: str(c.aliquota), evidencias: evidence, ...(parcelas.length?{parcelas}:{}) } as Calculation;
        const computed = ['igualdade','soma','retencao'].includes(calculation.operacao) ? computeCalculation(calculation) : null;
        const allAmountsSourced = [...calculation.valores,calculation.resultado].every(value => evidence.some(e => containsAmount(e.trecho,value))) &&
          (calculation.operacao!=='retencao' || evidence.some(e=>containsAmount(e.trecho,calculation.aliquota!,true)));
        const expectedSide=calculation.operacao!=='igualdade' && rule.id!=='B04' || calculation.valores.every(value=>evidence.some(e=>e.fonte==='processo'&&containsAmount(e.trecho,value)));
        const actualSide=evidence.some(e=>e.fonte==='siafi'&&containsAmount(e.trecho,calculation.resultado));
        const ledgerValid=calculation.operacao!=='soma' || parcelas.length===calculation.valores.length && new Set(parcelas.map(p=>p.chave)).size===parcelas.length && parcelas.every((p,index)=>p.chave.length>3 && moneyCents(p.valor)===moneyCents(calculation.valores[index]) && p.evidencias.some(e=>containsAmount(e.trecho,p.valor)));
        const requiredOperation=!['C05','B04'].includes(rule.id)||calculation.operacao==='soma';
        if (!computed || !allAmountsSourced || !expectedSide || !actualSide || !ledgerValid || !requiredOperation || !evidence.some(e => e.fonte === 'siafi') || !evidence.some(e => e.fonte === 'processo')) {
          item.status = 'nao_verificavel'; item.observacao = 'Memória de cálculo ausente, ambígua, com parcelas repetidas ou sem origem dos valores. ' + item.observacao;
        } else {
          item.calculo = { ...calculation,...computed };
          item.diferenca = formatCents(computed.diferencaCentavos);
          // Arithmetic cannot be approved against a mismatch, but a matching
          // amount alone does not invalidate an independently evidenced error.
          if (computed.diferencaCentavos !== 0) item.status = 'divergente';
        }
      }
      if (applicable && ['C03','P01'].includes(rule.id) && obj(context.capture).status !== 'complete' && item.status === 'conforme') {
        item.status = 'nao_verificavel'; item.observacao = 'Captura parcial: a cobertura não foi comprovada.';
      }
      if (context.kind === 'indefinido' && ['F01','B01'].includes(rule.id)) { item.status = 'nao_verificavel'; item.observacao = 'O tipo de pagamento não foi identificado com segurança.'; }
      if (context.kind==='estudantes' && ['B02','B05','P05'].includes(rule.id) && item.status==='conforme' && !sides.has('lista')) {
        item.status='nao_verificavel';item.observacao='A lista vinculada não foi comprovada. '+item.observacao;
      }
      result.push(item);
    }
  }
  if (context.kind==='estudantes') {
    const coverage=studentRosterChecks(raw,context);
    // A model-wide B02 approval cannot substitute for the membership check.
    for(const item of result.filter(item=>item.regraId==='B02' && item.status==='conforme')) {
      item.status='nao_verificavel';item.observacao='A identificação depende da conferência completa por CPF. '+item.observacao;
    }
    const global=result.findIndex(item=>item.regraId==='B02' && item.entidade==='GERAL');
    if(global>=0)result.splice(global,1);
    result.push(...coverage.items);
    const listedCpfs=arr(context.lists).flatMap(list=>arr(obj(list).rows).map(row=>digits(obj(row).cpf || obj(row).favorecido_documento)));
    const cpfs=[...new Set([...coverage.cpfs,...listedCpfs].filter(cpf=>cpf.length===11))];
    for (const cpf of cpfs) for (const ruleId of ['B02','B03','B05']) {
      if (result.some(item=>item.regraId===ruleId && item.entidade.includes(cpf))) continue;
      const rule=RULES.find(rule=>rule.id===ruleId)!;
      result.push({id:`${ruleId}:CPF:${cpf}`,regraId:ruleId,entidade:`CPF:${cpf}`,descricao:rule.descricao,prioridade:rule.prioridade,status:'nao_verificavel',esperado:'Conferência individual com autorização documental',encontrado:'Item individual omitido pela IA',observacao:'A presença na lista não comprova conta ou valor autorizado.',acao:'Conferir este estudante nos documentos e na captura.',evidencias:[]});
    }
  }
  // Duplicate entity identifiers cannot be safely compared across runs.
  const duplicates = new Set(result.filter((item,index) => result.findIndex(other => other.id === item.id) !== index).map(item => item.id));
  const dedup = result.filter((item,index) => result.findIndex(other => other.id === item.id) === index).map(item => duplicates.has(item.id) ? {...item,status:'nao_verificavel' as ChecklistStatus,observacao:'A IA repetiu a identidade do lançamento; confira a seleção.'} : item);
  return sortChecklist(compareChecklists(dedup,context.previous || []));
}
export function checklistResult(items: ChecklistItem[], model: string) {
  const counts = {divergente:0,nao_verificavel:0,conforme:0,nao_aplicavel:0};
  items.forEach(item => counts[item.status]++);
  const statusGeral = counts.divergente ? 'error' : counts.nao_verificavel ? 'warning' : 'ok';
  return {
    schemaVersion: CHECKLIST_VERSION, regrasVersao: RULES_VERSION, statusGeral,
    resumo: `${counts.divergente} divergência(s), ${counts.nao_verificavel} pendência(s), ${counts.conforme} conforme(s).`,
    checklist: items, contadores: counts, modelo: model, analisadoEm: new Date().toISOString(),
    itens: items.filter(item => item.status !== 'nao_aplicavel').map(item => ({campo:`${item.regraId} — ${item.descricao}`,status:item.status === 'divergente' ? 'error' : item.status === 'conforme' ? 'ok' : 'warning',esperado:item.esperado,encontrado:item.encontrado,observacao:item.observacao})),
  };
}
