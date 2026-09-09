export type SuapPlanUnitKind = 'campus' | 'systemic';

export type SuapPlanUnit = {
  value: string;
  code: string;
  label: string;
  parentUasg: string;
  kind: SuapPlanUnitKind;
};

const SYSTEMIC_CODES = new Set([
  'AUDGE', 'CONTROL/RE', 'CORREG/RE', 'GABIN/RE', 'OUV/RE', 'PROAD/RE', 'PRODES/RE',
  'PROEN/RE', 'PROEX/RE', 'PROJU/RE', 'PROPI/RE', 'SECOL', 'DIAE/RE', 'DICI/RE',
  'DIGPE/RE', 'DINFRA/RE', 'DINT/RE', 'DITIC/RE',
]);

const UNIT_DEFINITIONS: Array<[string, string, string, string]> = [
  ['38', 'AUDGE', 'Auditoria Geral', '158155'],
  ['39', 'CONTROL/RE', 'Controladoria', '158155'],
  ['40', 'CORREG/RE', 'Corregedoria', '158155'],
  ['13', 'DG/AP', 'Apodi', '158371'],
  ['14', 'DG/CA', 'Caicó', '158370'],
  ['18', 'DG/CANG', 'Canguaretama', '154839'],
  ['30', 'DG/CH', 'Natal - Cidade Alta', '152711'],
  ['17', 'DG/CM', 'Ceará-Mirim', '154838'],
  ['19', 'DG/CN', 'Currais Novos', '158366'],
  ['33', 'DG/CNAT', 'Natal - Central', '158369'],
  ['36', 'DG/CTM', 'Polo de Inovação Currais Novos', '158366'],
  ['20', 'DG/IP', 'Ipanguaçu', '158367'],
  ['24', 'DG/JC', 'João Câmara', '158373'],
  ['25', 'DG/JUC', 'Jucurutu', '158366'],
  ['21', 'DG/LAJ', 'Lajes', '158155'],
  ['15', 'DG/MC', 'Mossoró', '158365'],
  ['23', 'DG/MO', 'Macau', '158375'],
  ['31', 'DG/NC', 'Nova Cruz', '152757'],
  ['29', 'DG/PAAS', 'Parelhas', '158366'],
  ['28', 'DG/PAR', 'Parnamirim', '152756'],
  ['16', 'DG/PF', 'Pau dos Ferros', '158374'],
  ['27', 'DG/SC', 'Santa Cruz', '158372'],
  ['26', 'DG/SGA', 'São Gonçalo do Amarante', '154582'],
  ['42', 'DG/SM', 'São Miguel', '158155'],
  ['22', 'DG/SPP', 'São Paulo do Potengi', '154840'],
  ['43', 'DG/TOU', 'Touros', '158155'],
  ['44', 'DG/UMZ', 'Umarizal', '158155'],
  ['12', 'DG/ZL', 'Natal - Zona Leste', '158155'],
  ['32', 'DG/ZN', 'Natal - Zona Norte', '158368'],
  ['34', 'GABIN/RE', 'Gabinete da Reitoria', '158155'],
  ['37', 'OUV/RE', 'Ouvidoria', '158155'],
  ['41', 'PROJU/RE', 'Procuradoria Jurídica', '158155'],
  ['7', 'DIAE/RE', 'Diretoria de Assuntos Estudantis', '158155'],
  ['9', 'DICI/RE', 'Diretoria de Comunicação Institucional', '158155'],
  ['6', 'DIGPE/RE', 'Diretoria de Gestão de Pessoas', '158155'],
  ['11', 'DINFRA/RE', 'Diretoria de Infraestrutura', '158155'],
  ['10', 'DINT/RE', 'Diretoria de Gestão de Tecnologia da Informação', '158155'],
  ['8', 'DITIC/RE', 'Diretoria de Tecnologia da Informação e Comunicação', '158155'],
  ['5', 'PROAD/RE', 'Pró-Reitoria de Administração', '158155'],
  ['4', 'PRODES/RE', 'Pró-Reitoria de Desenvolvimento Institucional', '158155'],
  ['2', 'PROEN/RE', 'Pró-Reitoria de Ensino', '158155'],
  ['3', 'PROEX/RE', 'Pró-Reitoria de Extensão', '158155'],
  ['1', 'PROPI/RE', 'Pró-Reitoria de Pesquisa, Pós-Graduação e Inovação', '158155'],
  ['35', 'SECOL', 'Secretaria de Colégios', '158155'],
];

export const DEFAULT_SUAP_PLAN_UNIT = '19';

export const SUAP_PLAN_UNITS: SuapPlanUnit[] = UNIT_DEFINITIONS
  .map(([value, code, label, parentUasg]) => ({
    value,
    code,
    label,
    parentUasg,
    kind: SYSTEMIC_CODES.has(code) ? 'systemic' : 'campus',
  }))
  .sort((left, right) => Number(left.value) - Number(right.value));

const SUAP_PLAN_UNIT_BY_VALUE = new Map(SUAP_PLAN_UNITS.map((unit) => [unit.value, unit]));

export function getSuapPlanUnit(value: string | number | null | undefined): SuapPlanUnit | null {
  return SUAP_PLAN_UNIT_BY_VALUE.get(String(value ?? '')) ?? null;
}

export function getSuapPlanUnitForCampus(campusUasg: string | null | undefined): SuapPlanUnit {
  return SUAP_PLAN_UNITS.find((unit) => unit.parentUasg === campusUasg && unit.kind === 'campus')
    ?? getSuapPlanUnit(DEFAULT_SUAP_PLAN_UNIT)!;
}

export function buildSuapPlanSourceUrl(unitValue: string | number = DEFAULT_SUAP_PLAN_UNIT): string {
  const unit = getSuapPlanUnit(unitValue);
  if (!unit) throw new Error(`Unidade SUAP inválida: ${unitValue}.`);
  if (unit.value === DEFAULT_SUAP_PLAN_UNIT) return 'https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/';
  return `https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/?unidade_gestora=${encodeURIComponent(unit.value)}`;
}

export function parseSuapPlanUnitFromSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'suap.ifrn.edu.br') return null;
    if (!/^\/plan_estrategico\/plano_concluido\/8\/?$/.test(url.pathname) || url.hash) return null;

    const entries = [...url.searchParams.entries()];
    if (entries.length === 0) return DEFAULT_SUAP_PLAN_UNIT;
    if (entries.length !== 1 || entries[0][0] !== 'unidade_gestora') return null;
    return getSuapPlanUnit(entries[0][1])?.value ?? null;
  } catch {
    return null;
  }
}
