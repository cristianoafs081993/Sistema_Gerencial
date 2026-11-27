/**
 * Modelos do despacho de liquidação que o servidor pode personalizar na extensão
 * (popup → "Modelos e preenchimentos" → "Modelos de documentos").
 *
 * Há um modelo por finalidade (serviço, aquisição, projeto, bolsa sem projeto e auxílios). Cada um tem
 * destinatário, assunto, corpo, encaminhamento e fecho, em texto com variáveis:
 * - `{campus}`, `{processo}`, `{favorecido}`, `{valor}`, `{empenho}`, `{objeto}`, `{contrato}`, `{projeto}`, `{edital}`;
 * - `**texto**` em negrito; `[[ ... ]]` some quando alguma variável do trecho está vazia.
 *
 * Campo não personalizado mantém o texto atual do SIAGES (`DESPACHO_TEMPLATE_DEFAULTS` reproduz esse texto
 * para o popup mostrar). Os campos soltos `destinatario`, `assunto`, `encaminhamento` e `fecho` são o formato
 * anterior da extensão e valem para todas as finalidades.
 */
export const DESPACHO_FINALIDADES = [
  'servico',
  'aquisicao',
  'projeto',
  'bolsa-sem-projeto',
  'auxilio-transporte',
  'pafe',
  'auxilio-moradia',
] as const;

export type DespachoFinalidadeModelo = (typeof DESPACHO_FINALIDADES)[number];

export const DESPACHO_TEMPLATE_FIELDS = ['destinatario', 'assunto', 'corpo', 'encaminhamento', 'fecho'] as const;

export type DespachoTemplateField = (typeof DESPACHO_TEMPLATE_FIELDS)[number];

export type DespachoTemplate = Partial<Record<DespachoTemplateField, string>>;

export type DespachoModelo = {
  campus?: string;
  destinatario?: string;
  assunto?: string;
  encaminhamento?: string;
  fecho?: string;
  modelos?: Partial<Record<DespachoFinalidadeModelo, DespachoTemplate>>;
};

export type DespachoModeloTexto = 'destinatario' | 'assunto' | 'encaminhamento' | 'fecho';

export const DESPACHO_VARIABLES = {
  campus: 'campus',
  processo: 'número do processo',
  favorecido: 'favorecido',
  valor: 'valor da liquidação',
  empenho: 'empenho',
  objeto: 'objeto',
  contrato: 'número do contrato',
  projeto: 'nome do projeto',
  edital: 'número do edital',
} as const;

export type DespachoVariable = keyof typeof DESPACHO_VARIABLES;

export type DespachoVariables = Partial<Record<DespachoVariable, string>>;

const COMMON_DEFAULTS = {
  destinatario: 'À Coordenação de Finanças e Contratos do Campus {campus}',
  assunto: 'Autorização para a Liquidação da Despesa',
  encaminhamento: 'Na sequência, encaminhe-se o processo à Direção-Geral para análise e posterior autorização do pagamento, em conformidade com o cronograma e a disponibilidade orçamentária desta unidade.',
  fecho: 'Atenciosamente,',
} as const;

const auxilio = (programa: string) =>
  `Considerando a regularidade dos documentos apresentados e o acompanhamento do ${programa}[[ (Processo nº {processo})]], **AUTORIZO** a liquidação da despesa no valor de {valor}, referente ao empenho {empenho}.`;

/** Texto atual do SIAGES em cada finalidade, com variáveis. A extensão mostra o mesmo texto (teste compara). */
export const DESPACHO_TEMPLATE_DEFAULTS: Record<DespachoFinalidadeModelo, Required<DespachoTemplate>> = {
  servico: {
    ...COMMON_DEFAULTS,
    corpo: 'Considerando a regularidade da documentação apresentada e o ateste da prestação de serviços de {objeto}[[, referente ao contrato {contrato}]], no âmbito do Campus {campus}[[ (Processo nº {processo})]], **AUTORIZO** a liquidação da despesa no valor de {valor}, referente ao empenho {empenho}, em favor de {favorecido}.',
  },
  aquisicao: {
    ...COMMON_DEFAULTS,
    corpo: 'Considerando a regularidade da documentação apresentada e o ateste do fornecimento de {objeto}[[, referente ao contrato {contrato}]], no âmbito do Campus {campus}[[ (Processo nº {processo})]], **AUTORIZO** a liquidação da despesa no valor de {valor}, referente ao empenho {empenho}, em favor de {favorecido}.',
  },
  projeto: {
    ...COMMON_DEFAULTS,
    corpo: 'Considerando a regularidade da documentação apresentada e o ateste da execução das atividades pelo(s) bolsista(s) {favorecido}, no âmbito do projeto "{projeto}", aprovado no Edital nº {edital}[[ (Processo nº {processo})]], **AUTORIZO** a liquidação da despesa no valor de {valor}, referente ao empenho {empenho}.',
  },
  'bolsa-sem-projeto': {
    ...COMMON_DEFAULTS,
    corpo: 'Considerando a regularidade da documentação apresentada e o ateste da execução das atividades pelo(s) bolsista(s) {favorecido}[[ (Processo nº {processo})]], **AUTORIZO** a liquidação da despesa no valor de {valor}, referente ao empenho {empenho}.',
  },
  'auxilio-transporte': { ...COMMON_DEFAULTS, corpo: auxilio('Programa de Auxílio-Transporte') },
  pafe: { ...COMMON_DEFAULTS, corpo: auxilio('Programa de Apoio à Formação Estudantil (PAFE)') },
  'auxilio-moradia': { ...COMMON_DEFAULTS, corpo: auxilio('Programa de Auxílio-Moradia') },
};

export const DEFAULT_DESPACHO_CAMPUS = 'Currais Novos';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function resolveDespachoCampus(modelo?: DespachoModelo) {
  return modelo?.campus?.trim() || DEFAULT_DESPACHO_CAMPUS;
}

/** Nome do campus pronto para entrar no HTML do despacho. */
export function despachoCampusHtml(modelo?: DespachoModelo) {
  return escapeHtml(resolveDespachoCampus(modelo));
}

const isKnownVariable = (name: string): name is DespachoVariable => Object.prototype.hasOwnProperty.call(DESPACHO_VARIABLES, name);

/**
 * Texto do modelo em HTML seguro. Trechos `[[ ]]` com variável vazia somem; "Campus" fica em itálico;
 * `**x**` vira negrito; variáveis entram em negrito (o campus, sem negrito) e, vazias, como `[rótulo]`.
 */
export function renderDespachoTemplate(text: string, variables: DespachoVariables) {
  const value = (name: DespachoVariable) => (variables[name] ?? '').trim();
  const withOptional = text.trim().replace(/\[\[([\s\S]*?)\]\]/g, (_match, inner: string) => {
    const names = Array.from(inner.matchAll(/\{(\w+)\}/g), (item) => item[1]).filter(isKnownVariable);
    return names.every((name) => value(name)) ? inner : '';
  });
  return escapeHtml(withOptional)
    .replace(/\bCampus\b/g, '<i>Campus</i>')
    .replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>')
    .replace(/\{(\w+)\}/g, (match, name: string) => {
      if (!isKnownVariable(name)) return match;
      if (name === 'campus') return escapeHtml(value('campus') || DEFAULT_DESPACHO_CAMPUS);
      const current = value(name);
      return current ? `<b>${escapeHtml(current)}</b>` : `<b>[${escapeHtml(DESPACHO_VARIABLES[name])}]</b>`;
    })
    .replace(/\r?\n/g, '<br>');
}

/** Formato anterior: texto do servidor com {campus}, "Campus" em itálico e quebras de linha. */
export function renderDespachoModeloText(value: string, campus: string) {
  return renderDespachoTemplate(value, { campus });
}

/** Texto personalizado pelo servidor para a finalidade (ou, fora do corpo, o texto comum do formato anterior). */
export function despachoTemplateText(
  modelo: DespachoModelo | undefined,
  finalidade: DespachoFinalidadeModelo,
  field: DespachoTemplateField,
) {
  const custom = modelo?.modelos?.[finalidade]?.[field]?.trim();
  if (custom) return custom;
  if (field === 'corpo') return undefined;
  return modelo?.[field]?.trim() || undefined;
}

/** HTML do campo personalizado ou, sem personalização, o trecho atual do SIAGES já em HTML. */
export function despachoFieldHtml(
  modelo: DespachoModelo | undefined,
  finalidade: DespachoFinalidadeModelo,
  field: DespachoTemplateField,
  variables: DespachoVariables,
  fallbackHtml: string,
) {
  const text = despachoTemplateText(modelo, finalidade, field);
  return text ? renderDespachoTemplate(text, { ...variables, campus: resolveDespachoCampus(modelo) }) : fallbackHtml;
}

/** Formato anterior (campos comuns a todas as finalidades). */
export function despachoModeloHtml(modelo: DespachoModelo | undefined, field: DespachoModeloTexto, fallbackHtml: string) {
  const value = modelo?.[field]?.trim();
  return value ? renderDespachoModeloText(value, resolveDespachoCampus(modelo)) : fallbackHtml;
}
