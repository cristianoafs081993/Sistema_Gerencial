export interface RastreabilidadePF {
  ppf_campus: string;
  data_solicitacao: string | null;
  tipo: string | null;
  mes_referencia: string | null;
  fonte_recurso: string | null;
  valor: number | null;
  finalidade: string | null;
  pfa_reitoria: string | null;
  data_aprovacao: string | null;
  pf_liberacao: string | null;
  data_liberacao: string | null;
  status: string | null;
}

export interface PFSolicitacao {
  numero_pf: string;
  ug_emitente: string;
  ug_favorecida: string;
  evento: string;
  acao: string;
  fonte_recurso: string;
  vinculacao: string;
  modalidade: string;
  mes_referencia: string;
  data_emissao: string;
  valor: number;
  finalidade: string;
}

export interface PFAprovacao {
  numero_pf: string;
  ug_emitente: string;
  evento: string;
  fonte_recurso: string;
  vinculacao: string;
  modalidade: string;
  data_emissao: string;
  valor: number;
  observacao: string;
  solicitacao_numero_pf: string; // Foreing key referencing pf_solicitacao.numero_pf
}

export interface PFLiberacao {
  numero_pf: string;
  ug_emitente: string;
  evento: string;
  fonte_recurso: string;
  vinculacao: string;
  modalidade: string;
  data_emissao: string;
  valor: number;
  observacao: string;
  aprovacao_numero_pf: string; // Foreign key referencing pf_aprovacao.numero_pf
}
