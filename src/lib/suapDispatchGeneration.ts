import type { SuapProcesso } from '@/types';

export type DispatchQueueItemStatus = 'pending' | 'copied' | 'cloned' | 'skipped' | 'error';
export type DespachoFinalidade = 'contrato' | 'projeto' | 'bolsa-sem-projeto' | 'auxilio-transporte' | 'pafe' | 'auxilio-moradia';

export type ManualDespachoFields = {
  finalidade: DespachoFinalidade;
  processo: string;
  favorecido: string;
  descricao: string;
  valor: string;
  empenho: string;
  projeto: string;
  edital: string;
  tipo: 'servico' | 'aquisicao';
};

export type DispatchQueueItem = {
  processId: string;
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
      parsed.items.some((item) => !item || typeof item.processId !== 'string' || typeof item.status !== 'string')
    ) {
      return null;
    }
    return {
      version: 1,
      currentIndex: Math.max(0, Math.min(parsed.currentIndex, Math.max(parsed.items.length - 1, 0))),
      items: parsed.items,
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
  return {
    finalidade: 'contrato',
    processo: processo.numProcesso || processo.suapId || '',
    favorecido: processo.beneficiario || '',
    descricao: processo.assunto || '',
    valor: processo.dadosCompletos?.val_nf || '',
    empenho: processo.dadosCompletos?.empenhos?.join(', ') || '',
    projeto: '',
    edital: '',
    tipo: 'servico',
  };
}

const esc = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] || character));

const required = (value: string, label: string) => value.trim() ? `<b>${esc(value)}</b>` : `<b>[${esc(label)}]</b>`;

export function buildManualDespachoHtml(fields: ManualDespachoFields) {
  const processo = required(fields.processo, 'numero do processo');
  const valor = required(fields.valor, 'valor da liquidacao');
  const empenho = required(fields.empenho.toUpperCase(), 'empenho');
  const favorecido = required(fields.favorecido.toUpperCase(), 'favorecido');
  const assunto = 'Autorizacao para Liquidacao da Despesa';

  let body = '';
  if (fields.finalidade === 'projeto') {
    body = `Considerando a regularidade da documentacao apresentada e a execucao das atividades pelo(s) bolsista(s) ${favorecido}, do projeto ${required(fields.projeto, 'nome do projeto')}, aprovado no Edital n. ${required(fields.edital, 'numero do edital')} (Processo n. ${processo}), <b>AUTORIZO</b> a liquidacao da despesa no valor de ${valor}, referente ao empenho ${empenho}.`;
  } else if (fields.finalidade === 'bolsa-sem-projeto') {
    body = `Considerando a regularidade da documentacao apresentada e a execucao das atividades pelo(s) bolsista(s) ${favorecido} (Processo n. ${processo}), <b>AUTORIZO</b> a liquidacao da despesa no valor de ${valor}, referente ao empenho ${empenho}.`;
  } else if (fields.finalidade === 'auxilio-transporte' || fields.finalidade === 'pafe' || fields.finalidade === 'auxilio-moradia') {
    const programa = fields.finalidade === 'auxilio-transporte'
      ? 'Programa de Auxilio Transporte'
      : fields.finalidade === 'pafe'
        ? 'Programa de Apoio a Formacao Estudantil (PAFE)'
        : 'Programa de Auxilio Moradia';
    body = `Considerando a regularidade dos documentos apresentados e o acompanhamento do ${programa} (Processo n. ${processo}), <b>AUTORIZO</b> a liquidacao da despesa no valor de ${valor}, referente ao empenho ${empenho}.`;
  } else {
    const reference = required(fields.descricao, fields.tipo === 'aquisicao' ? 'objeto da aquisicao' : 'objeto do servico');
    const action = fields.tipo === 'aquisicao' ? 'do fornecimento de' : 'da prestacao de servicos de';
    body = `Considerando a regularidade dos documentos apresentados e o ateste ${action} ${reference} (Processo n. ${processo}), <b>AUTORIZO</b> a liquidacao da despesa no valor de ${valor}, referente ao empenho ${empenho}, em favor de ${favorecido}.`;
  }

  return `<div style="font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; text-align: justify; color: black;"><div>A Coordenacao de Financas e Contratos do <i>Campus</i> Currais Novos</div><div style="font-weight: bold; margin-top: 30px;">Assunto: ${assunto}</div><div style="text-indent: 2.5cm; margin-top: 30px; margin-bottom: 25px;">${body}</div><div style="margin-top: 25px;">Na sequencia, encaminhe-se o processo a Direcao-Geral para analise e posterior autorizacao do pagamento.</div><div style="margin-top: 40px;">Atenciosamente,</div></div>`;
}
