export const DEFAULT_IFRN_CAMPUS_UASG = '158366';

export type IfrnCampus = {
  codigo: string;
  nome: string;
  aliases?: string[];
};

export const IFRN_CAMPUSES: IfrnCampus[] = [
  { codigo: '152711', nome: 'Natal - Cidade Alta' },
  { codigo: '152756', nome: 'Parnamirim' },
  { codigo: '152757', nome: 'Nova Cruz' },
  { codigo: '154582', nome: 'São Gonçalo do Amarante' },
  { codigo: '154838', nome: 'Ceará-Mirim' },
  { codigo: '154839', nome: 'Canguaretama' },
  { codigo: '154840', nome: 'São Paulo do Potengi' },
  { codigo: '158155', nome: 'Reitoria', aliases: ['Lajes', 'Natal - Zona Leste (EAD)'] },
  { codigo: '158365', nome: 'Mossoró' },
  { codigo: DEFAULT_IFRN_CAMPUS_UASG, nome: 'Currais Novos', aliases: ['Jucurutu', 'Parelhas'] },
  { codigo: '158367', nome: 'Ipanguaçu' },
  { codigo: '158368', nome: 'Natal - Zona Norte' },
  { codigo: '158369', nome: 'Natal - Central' },
  { codigo: '158370', nome: 'Caicó' },
  { codigo: '158371', nome: 'Apodi' },
  { codigo: '158372', nome: 'Santa Cruz' },
  { codigo: '158373', nome: 'João Câmara' },
  { codigo: '158374', nome: 'Pau dos Ferros' },
  { codigo: '158375', nome: 'Macau' },
];

export function getIfrnCampus(codigo: string | null | undefined) {
  return IFRN_CAMPUSES.find((campus) => campus.codigo === codigo) ?? null;
}

export function isIfrnCampusUasg(codigo: string | null | undefined): codigo is string {
  return Boolean(codigo && IFRN_CAMPUSES.some((campus) => campus.codigo === codigo));
}
