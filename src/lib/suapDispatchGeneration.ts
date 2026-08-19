import type { ResolvedDocumentContext } from '@/lib/documentGeneration';
import type { SuapProcesso } from '@/types';

export type DispatchQueueItemStatus = 'pending' | 'copied' | 'cloned' | 'skipped' | 'error';
export type DespachoFinalidade = 'servico' | 'aquisicao' | 'projeto' | 'bolsa-sem-projeto' | 'auxilio-transporte' | 'pafe' | 'auxilio-moradia';

export type ManualDespachoFields = {
  finalidade: DespachoFinalidade;
  processo: string;
  favorecido: string;
  descricao: string;
  valor: string;
  empenho: string;
  projeto: string;
  edital: string;
};

type LegacyManualDespachoFields = Omit<Partial<ManualDespachoFields>, 'finalidade'> & {
  finalidade?: DespachoFinalidade | 'contrato';
  tipo?: 'servico' | 'aquisicao';
};

export type DispatchQueueItem = {
  processId?: string;
  standalone?: boolean;
  status: DispatchQueueItemStatus;
  html?: string;
  manualFields?: ManualDespachoFields;
  error?: string;
};

export type DispatchQueueState = {
  version: 1;
  currentIndex: number;
  items: DispatchQueueItem[];
};

export const SUAP_DISPATCH_QUEUE_STORAGE_KEY = 'suap-dispatch-queue:v1';

export function createDispatchQueue(processos: SuapProcesso[]): DispatchQueueState {
  return {
    version: 1,
    currentIndex: 0,
    items: processos.map((processo) => ({ processId: processo.id, status: 'pending' })),
  };
}

export function createStandaloneDispatchQueue(initialFields: Partial<ManualDespachoFields> = {}): DispatchQueueState {
  return {
    version: 1,
    currentIndex: 0,
    items: [{ standalone: true, status: 'pending', manualFields: { ...createStandaloneManualDespachoFields(), ...initialFields } }],
  };
}

export function saveDispatchQueue(queue: DispatchQueueState) {
  sessionStorage.setItem(SUAP_DISPATCH_QUEUE_STORAGE_KEY, JSON.stringify(queue));
}

export function loadDispatchQueue(): DispatchQueueState | null {
  const raw = sessionStorage.getItem(SUAP_DISPATCH_QUEUE_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<DispatchQueueState>;
    if (
      parsed.version !== 1 ||
      !Number.isInteger(parsed.currentIndex) ||
      !Array.isArray(parsed.items) ||
      parsed.items.some((item) =>
        !item ||
        typeof item.status !== 'string' ||
        (!item.standalone && typeof item.processId !== 'string'),
      )
    ) {
      return null;
    }
    return {
      version: 1,
      currentIndex: Math.max(0, Math.min(parsed.currentIndex, Math.max(parsed.items.length - 1, 0))),
      items: parsed.items.map((item) => {
        const manualFields = migrateManualDespachoFields(item.manualFields);
        return manualFields ? { ...item, manualFields } : item;
      }),
    };
  } catch {
    return null;
  }
}

export function clearDispatchQueue() {
  sessionStorage.removeItem(SUAP_DISPATCH_QUEUE_STORAGE_KEY);
}

export function isAiAssistedDispatch(processo: SuapProcesso) {
  return processo.status === 'success' || processo.status === 'incomplete_extraction';
}

export function createManualDespachoFields(processo: SuapProcesso): ManualDespachoFields {
  const documentoFavorecido = processo.cpfCnpj || '';
  const tipoPessoa = documentoFavorecido.replace(/\D/g, '').length === 11 ? 'PF' : 'PJ';
  const finalidade = inferManualDespachoFinalidade({
    tipoPessoa,
    favorecido: processo.beneficiario,
    objeto: processo.assunto,
    projeto: undefined,
  });

  return {
    finalidade,
    processo: processo.numProcesso || processo.suapId || '',
    favorecido: processo.beneficiario || '',
    descricao: processo.assunto || '',
    valor: processo.dadosCompletos?.val_nf || '',
    empenho: processo.dadosCompletos?.empenhos?.join(', ') || '',
    projeto: finalidade === 'projeto' ? processo.assunto || '' : '',
    edital: '',
  };
}

export function createStandaloneManualDespachoFields(): ManualDespachoFields {
  return {
    finalidade: 'servico',
    processo: '',
    favorecido: '',
    descricao: '',
    valor: '',
    empenho: '',
    projeto: '',
    edital: '',
  };
}

const normalizeText = (value: string | undefined) => (value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const isAcquisitionObject = (value: string | undefined) => /\baquisi|material|equipamento|produto|fornecimento|compra\b/.test(normalizeText(value));

function migrateManualDespachoFields(fields: unknown): ManualDespachoFields | undefined {
  if (!fields || typeof fields !== 'object') return undefined;

  const legacyFields = fields as LegacyManualDespachoFields;
  if (legacyFields.finalidade !== 'contrato') {
    return legacyFields as ManualDespachoFields;
  }

  const { tipo, ...currentFields } = legacyFields;
  return {
    ...currentFields,
    finalidade: tipo === 'aquisicao' ? 'aquisicao' : 'servico',
  } as ManualDespachoFields;
}

const formatManualValue = (value: number | string | undefined) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }
  return typeof value === 'string' ? value : '';
};

export function inferManualDespachoFinalidade(context: Pick<ResolvedDocumentContext, 'tipoPessoa' | 'objeto' | 'projeto' | 'favorecido'>): DespachoFinalidade {
  const haystack = normalizeText(`${context.objeto || ''} ${context.projeto || ''}`);
  const isFolhaPagamento = Boolean(context.favorecido && /folha de pagamento/i.test(context.favorecido));

  if (/auxilio\s+transporte/.test(haystack)) return 'auxilio-transporte';
  if (/\bpafe\b|apoio\s+a\s+formacao\s+estudantil/.test(haystack)) return 'pafe';
  if (/auxilio\s+moradia/.test(haystack)) return 'auxilio-moradia';
  if (context.projeto || /\bprojet[oa]s?\b/.test(haystack)) return 'projeto';
  if (context.tipoPessoa === 'PF' || isFolhaPagamento || /\bbolsa\b|\bbolsista\b|\bauxilio\b/.test(haystack)) return 'bolsa-sem-projeto';
  return isAcquisitionObject(context.objeto) ? 'aquisicao' : 'servico';
}

export function createManualDespachoFieldsFromResolvedContext(context: ResolvedDocumentContext): ManualDespachoFields {
  const finalidade = inferManualDespachoFinalidade(context);
  return {
    finalidade,
    processo: context.processo || '',
    favorecido: context.favorecido || '',
    descricao: context.objeto || '',
    valor: formatManualValue(context.valor),
    empenho: context.empenho || '',
    projeto: context.projeto || (finalidade === 'projeto' ? context.objeto || '' : ''),
    edital: context.edital || '',
  };
}

const esc = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] || character));

const required = (value: string, label: string) => value.trim() ? `<b>${esc(value)}</b>` : `<b>[${esc(label)}]</b>`;

export function buildManualDespachoHtml(fields: ManualDespachoFields) {
  const processReference = fields.processo.trim() ? ` (Processo n. ${required(fields.processo, 'numero do processo')})` : '';
  const valor = required(fields.valor, 'valor da liquidacao');
  const empenho = required(fields.empenho.toUpperCase(), 'empenho');
  const favorecido = required(fields.favorecido.toUpperCase(), 'favorecido');
  const assunto = 'Autorizacao para Liquidacao da Despesa';

  let body = '';
  if (fields.finalidade === 'projeto') {
    body = `Considerando a regularidade da documentacao apresentada e a execucao das atividades pelo(s) bolsista(s) ${favorecido}, do projeto ${required(fields.projeto, 'nome do projeto')}, aprovado no Edital n. ${required(fields.edital, 'numero do edital')}${processReference}, <b>AUTORIZO</b> a liquidacao da despesa no valor de ${valor}, referente ao empenho ${empenho}.`;
  } else if (fields.finalidade === 'bolsa-sem-projeto') {
    body = `Considerando a regularidade da documentacao apresentada e a execucao das atividades pelo(s) bolsista(s) ${favorecido}${processReference}, <b>AUTORIZO</b> a liquidacao da despesa no valor de ${valor}, referente ao empenho ${empenho}.`;
  } else if (fields.finalidade === 'auxilio-transporte' || fields.finalidade === 'pafe' || fields.finalidade === 'auxilio-moradia') {
    const programa = fields.finalidade === 'auxilio-transporte'
      ? 'Programa de Auxilio Transporte'
      : fields.finalidade === 'pafe'
        ? 'Programa de Apoio a Formacao Estudantil (PAFE)'
        : 'Programa de Auxilio Moradia';
    body = `Considerando a regularidade dos documentos apresentados e o acompanhamento do ${programa}${processReference}, <b>AUTORIZO</b> a liquidacao da despesa no valor de ${valor}, referente ao empenho ${empenho}.`;
  } else if (fields.finalidade === 'aquisicao') {
    const objetoAdquirido = required(fields.descricao, 'objeto da aquisicao');
    const destino = `destinado a este <i>Campus</i> Currais Novos${fields.processo.trim() ? ` (Processo n&ordm; ${required(fields.processo, 'numero do processo')})` : ''}`;
    body = `Considerando a regularidade da documenta&ccedil;&atilde;o apresentada e o ateste do recebimento do objeto adquirido &mdash; ${objetoAdquirido} &mdash; ${destino}, <b>AUTORIZO</b> a liquida&ccedil;&atilde;o da despesa no valor de ${valor}, referente ao empenho ${empenho}, em favor de ${favorecido}.`;
  } else {
    const reference = required(fields.descricao, 'objeto do servico');
    body = `Considerando a regularidade dos documentos apresentados e o ateste da prestacao de servicos de ${reference}${processReference}, <b>AUTORIZO</b> a liquidacao da despesa no valor de ${valor}, referente ao empenho ${empenho}, em favor de ${favorecido}.`;
  }

  const nextStep = fields.processo.trim() ? 'Na sequencia, encaminhe-se o processo a Direcao-Geral para analise e posterior autorizacao do pagamento.' : 'Na sequencia, encaminhe-se o documento a Direcao-Geral para analise e posterior autorizacao do pagamento.';
  return `<div style="font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; text-align: justify; color: black;"><div>A Coordenacao de Financas e Contratos do <i>Campus</i> Currais Novos</div><div style="font-weight: bold; margin-top: 30px;">Assunto: ${assunto}</div><div style="text-indent: 2.5cm; margin-top: 30px; margin-bottom: 25px;">${body}</div><div style="margin-top: 25px;">${nextStep}</div><div style="margin-top: 40px;">Atenciosamente,</div></div>`;
}
