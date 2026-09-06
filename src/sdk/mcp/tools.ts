import { GovFlowSdk, govflow } from '../index';

export interface McpToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Catálogo Oficial de Ferramentas MCP / Gemini Function Calling do GovFlow
 */
export const GOVFLOW_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'conciliar_saldo_ptres',
    description:
      'Realiza a conciliação trilateral forense de uma Origem de Recurso / PTRES cruzando Descentralizações (SIAFI), Atividades Planejadas (SUAP) e Empenhos Emitidos (SIAFI). Explica centavo por centavo a causa de saldos divergentes ou negativos no painel.',
    parameters: {
      type: 'object',
      properties: {
        ptres: {
          type: 'string',
          description: 'Código da Origem de Recurso / PTRES a ser auditado (ex: "231798" ou "198307").',
        },
      },
      required: ['ptres'],
    },
  },
  {
    name: 'consultar_painel_orcamentario',
    description:
      'Retorna os indicadores consolidados (KPIs) de execução orçamentária do campus: Total Planejado no SUAP, Total Empenhado, Total Liquidado, Total Pago, Valor a Descentralizar e percentuais de execução.',
    parameters: {
      type: 'object',
      properties: {
        ano: {
          type: 'integer',
          description: 'Ano do exercício orçamentário (ex: 2026).',
        },
        dimensao: {
          type: 'string',
          description: 'Filtrar por dimensão institucional (ex: "EN - Ensino", "AD - Administração").',
        },
        origemRecurso: {
          type: 'string',
          description: 'Filtrar por PTRES específico.',
        },
      },
    },
  },
  {
    name: 'consultar_ficha_empenho',
    description:
      'Consulta os detalhes completos, situação e valores de uma Nota de Empenho (NE) do exercício ou Restos a Pagar (RAP).',
    parameters: {
      type: 'object',
      properties: {
        numero: {
          type: 'string',
          description: 'Número do empenho (ex: "2026NE000072", "2025NE000331") ou ID do registro.',
        },
      },
      required: ['numero'],
    },
  },
  {
    name: 'pesquisar_empenhos',
    description:
      'Pesquisa empenhos por múltiplos critérios: termo de busca, credor/fornecedor, processo administrativo, PTRES ou status.',
    parameters: {
      type: 'object',
      properties: {
        termoBusca: {
          type: 'string',
          description: 'Texto para pesquisar no objeto, descrição ou número do empenho.',
        },
        ptres: {
          type: 'string',
          description: 'Filtrar por PTRES específico.',
        },
        favorecido: {
          type: 'string',
          description: 'Nome da empresa, pessoa física ou CNPJ/CPF do credor.',
        },
        status: {
          type: 'string',
          enum: ['pendente', 'liquidado', 'pago', 'cancelado', 'todos'],
          description: 'Situação da execução do empenho.',
        },
      },
    },
  },
  {
    name: 'consultar_extrato_descentralizacoes',
    description:
      'Consulta o extrato de Notas de Crédito (NCs) repassadas pela Reitoria ao campus para determinado PTRES ou Plano Interno, discriminando créditos recebidos, estornos/devoluções e crédito líquido disponível.',
    parameters: {
      type: 'object',
      properties: {
        ptres: {
          type: 'string',
          description: 'Código do PTRES (ex: "231798").',
        },
        planoInterno: {
          type: 'string',
          description: 'Plano Interno opcional para refinar o extrato (ex: "L21B3P19ENN").',
        },
      },
      required: ['ptres'],
    },
  },
  {
    name: 'consultar_ficha_contrato',
    description:
      'Retorna a ficha executiva de um contrato: empresa contratada, CNPJ, vigência, valores inicial e global, situação e saldo dos empenhos vinculados.',
    parameters: {
      type: 'object',
      properties: {
        numeroOuId: {
          type: 'string',
          description: 'Número do contrato (ex: "5/2024", "12/2025") ou ID do contrato.',
        },
      },
      required: ['numeroOuId'],
    },
  },
  {
    name: 'projetar_necessidade_contrato',
    description:
      'Projeta o gasto mensal e a necessidade orçamentária do contrato até o final do exercício (31 de dezembro) e até o fim da vigência, emitindo alerta caso o saldo atual de empenho seja insuficiente.',
    parameters: {
      type: 'object',
      properties: {
        contratoId: {
          type: 'string',
          description: 'Identificador único ou número do contrato.',
        },
        anoExercicio: {
          type: 'integer',
          description: 'Ano do exercício a projetar (padrão: ano corrente).',
        },
      },
      required: ['contratoId'],
    },
  },
  {
    name: 'conciliar_contrato_orcamento',
    description:
      'Cruza as obrigações e necessidades financeiras de um contrato com as fontes de recursos orçamentários (PTRES), verificando suficiência de crédito para suplementações.',
    parameters: {
      type: 'object',
      properties: {
        contratoId: {
          type: 'string',
          description: 'Identificador do contrato a conciliar com as dotações orçamentárias.',
        },
      },
      required: ['contratoId'],
    },
  },
  {
    name: 'rastrear_trilha_despesa',
    description:
      'Rastreia a trilha completa de auditoria de uma despesa: Atividade no SUAP -> Nota de Crédito SIAFI -> Nota de Empenho -> Contrato -> Faturas -> Liquidações.',
    parameters: {
      type: 'object',
      properties: {
        empenhoNumero: {
          type: 'string',
          description: 'Número da Nota de Empenho (ex: "2026NE000072").',
        },
      },
      required: ['empenhoNumero'],
    },
  },
  {
    name: 'auditar_inconsistencias_orcamentarias',
    description:
      'Realiza uma varredura preventiva de integridade orçamentária em todas as fontes do campus, apontando PTRES com planejamento negativo no SUAP ou déficit real no SIAFI.',
    parameters: {
      type: 'object',
      properties: {
        ano: {
          type: 'integer',
          description: 'Ano do exercício para auditoria.',
        },
      },
    },
  },
];

/**
 * Despachante universal de ferramentas MCP para o GovFlow Core SDK
 */
export async function dispatchMcpTool(
  toolName: string,
  args: Record<string, any> = {},
  sdkInstance: GovFlowSdk = govflow
): Promise<any> {
  switch (toolName) {
    case 'conciliar_saldo_ptres': {
      if (!args.ptres) throw new Error('Parâmetro "ptres" é obrigatório.');
      return await sdkInstance.conciliacao.conciliarPtresCompleto(String(args.ptres));
    }

    case 'consultar_painel_orcamentario': {
      return await sdkInstance.orcamento.getPainelExecucao({
        ano: args.ano,
        dimensao: args.dimensao,
        origemRecurso: args.origemRecurso,
      });
    }

    case 'consultar_ficha_empenho': {
      if (!args.numero) throw new Error('Parâmetro "numero" é obrigatório.');
      return await sdkInstance.empenhos.getEmpenhoDetalhado(String(args.numero));
    }

    case 'pesquisar_empenhos': {
      return await sdkInstance.empenhos.pesquisarEmpenhos({
        termoBusca: args.termoBusca,
        ptres: args.ptres,
        favorecido: args.favorecido,
        status: args.status,
        limit: args.limit || 50,
      });
    }

    case 'consultar_extrato_descentralizacoes': {
      if (!args.ptres) throw new Error('Parâmetro "ptres" é obrigatório.');
      return await sdkInstance.descentralizacoes.getExtratoNotasCredito(
        String(args.ptres),
        args.planoInterno ? String(args.planoInterno) : undefined
      );
    }

    case 'consultar_ficha_contrato': {
      if (!args.numeroOuId) throw new Error('Parâmetro "numeroOuId" é obrigatório.');
      return await sdkInstance.contratos.getFichaContrato(String(args.numeroOuId));
    }

    case 'projetar_necessidade_contrato': {
      if (!args.contratoId) throw new Error('Parâmetro "contratoId" é obrigatório.');
      return await sdkInstance.contratos.projetarExecucaoContratual(
        String(args.contratoId),
        args.anoExercicio
      );
    }

    case 'conciliar_contrato_orcamento': {
      if (!args.contratoId) throw new Error('Parâmetro "contratoId" é obrigatório.');
      return await sdkInstance.conciliacao.conciliarContratoComOrcamento(String(args.contratoId));
    }

    case 'rastrear_trilha_despesa': {
      if (!args.empenhoNumero) throw new Error('Parâmetro "empenhoNumero" é obrigatório.');
      return await sdkInstance.conciliacao.rastrearTrilhaDespesa(String(args.empenhoNumero));
    }

    case 'auditar_inconsistencias_orcamentarias': {
      return await sdkInstance.conciliacao.auditarSaudeOrcamentariaCampus(args.ano);
    }

    default:
      throw new Error(`Ferramenta MCP "${toolName}" não reconhecida.`);
  }
}
