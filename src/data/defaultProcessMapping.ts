import type { ProcessMappingRecord } from '@/types/processMapping';

const createdAt = '2026-08-21T12:00:00.000Z';

export const DEFAULT_PROCESS_MAPPING: ProcessMappingRecord = {
  id: 'liquidacao-pagamento-nota-fiscal',
  title: 'Liquidação e pagamento de nota fiscal',
  code: 'PROC-FIN-001',
  description: 'Fluxo de conferência, liquidação e pagamento de despesas de contratos no SUAP.',
  category: 'Financeiro',
  version: '1.0',
  createdAt,
  updatedAt: createdAt,
  owner: 'COFINC/CN',
  publicationStatus: 'published',
  tags: ['SUAP', 'liquidação', 'pagamento', 'contratos'],
  lanes: [
    { id: 'lane-origin', name: 'Unidade requisitante', color: '#2563eb', order: 0, height: 180 },
    { id: 'lane-diad', name: 'DIAD/CN · Contratos', color: '#7c3aed', order: 1, height: 180 },
    { id: 'lane-cofinc', name: 'COFINC/CN · Financeiro', color: '#059669', order: 2, height: 180 },
    { id: 'lane-authorizer', name: 'Ordenador de despesa', color: '#d97706', order: 3, height: 180 },
  ],
  nodes: [
    {
      id: 'start', code: 'INÍCIO', title: 'Processo recebido', description: 'O processo chega à unidade responsável pelo tratamento financeiro.', type: 'start',
      laneId: 'lane-origin', position: { x: 28, y: 66 }, width: 64, height: 64, responsible: 'SUAP', color: '#0f766e',
    },
    {
      id: 'step-1', code: '1', title: 'Receber e conferir os documentos', description: 'Verificar nota fiscal, atesto, contrato, empenho e demais documentos exigidos para a liquidação.', type: 'task',
      laneId: 'lane-origin', position: { x: 138, y: 42 }, width: 220, height: 112, responsible: 'Unidade requisitante', slaDays: 2, color: '#2563eb',
      outputDocuments: ['Processo instruído'], checklist: [{ id: 'check-1-a', text: 'Nota fiscal anexada e legível', done: false, required: true }, { id: 'check-1-b', text: 'Atesto do fiscal ou responsável', done: false, required: true }],
      systemName: 'SUAP', systemUrl: 'https://suap.ifrn.edu.br/',
    },
    {
      id: 'step-2', code: '2', title: 'Validar documentação fiscal', description: 'Conferir regularidade formal, dados bancários, retenções e compatibilidade com o contrato.', type: 'task',
      laneId: 'lane-diad', position: { x: 420, y: 222 }, width: 220, height: 112, responsible: 'DIAD/CN', slaDays: 3, color: '#7c3aed',
      inputDocuments: ['Processo instruído'], outputDocuments: ['Documentação validada'], legalBasis: 'Lei nº 14.133/2021 e contrato vigente',
      systemName: 'SUAP · Processo', systemUrl: 'https://suap.ifrn.edu.br/',
    },
    {
      id: 'gateway-1', code: 'GW1', title: 'Documentação completa?', description: 'Decisão de negócio: seguir para liquidação ou devolver para complementação.', type: 'gateway', gatewayType: 'exclusive',
      laneId: 'lane-diad', position: { x: 704, y: 240 }, width: 76, height: 76, responsible: 'DIAD/CN', color: '#7c3aed',
    },
    {
      id: 'step-3', code: '3', title: 'Solicitar complementação', description: 'Registrar a pendência no processo e devolver à unidade responsável para correção.', type: 'task',
      laneId: 'lane-origin', position: { x: 890, y: 42 }, width: 220, height: 112, responsible: 'Unidade requisitante', slaDays: 3, color: '#2563eb',
      outputDocuments: ['Pendência registrada'], flowRole: 'exception',
    },
    {
      id: 'step-4', code: '4', title: 'Registrar a liquidação', description: 'Lançar a liquidação no sistema oficial e vincular os documentos fiscais ao processo.', type: 'task',
      laneId: 'lane-cofinc', position: { x: 890, y: 402 }, width: 220, height: 112, responsible: 'COFINC/CN', slaDays: 2, color: '#059669',
      inputDocuments: ['Documentação validada'], outputDocuments: ['Liquidação registrada'],
      systemName: 'SIAFI / SIASG', systemUrl: 'https://www.gov.br/compras/pt-br/sistemas/',
      templateName: 'Roteiro de liquidação', templateUrl: 'https://www.gov.br/compras/pt-br/',
    },
    {
      id: 'step-5', code: '5', title: 'Autorizar pagamento', description: 'Submeter a despesa à autoridade competente e registrar a autorização.', type: 'task',
      laneId: 'lane-authorizer', position: { x: 1180, y: 582 }, width: 220, height: 112, responsible: 'Ordenador de despesa', slaDays: 2, color: '#d97706',
      inputDocuments: ['Liquidação registrada'], outputDocuments: ['Pagamento autorizado'], legalBasis: 'Lei nº 4.320/1964',
    },
    {
      id: 'step-6', code: '6', title: 'Programar e efetivar pagamento', description: 'Conferir disponibilidade, transmitir a ordem bancária e registrar a conclusão no processo.', type: 'task',
      laneId: 'lane-cofinc', position: { x: 1470, y: 402 }, width: 220, height: 112, responsible: 'COFINC/CN', slaDays: 2, color: '#059669',
      inputDocuments: ['Pagamento autorizado'], outputDocuments: ['Ordem bancária registrada'],
      systemName: 'SIAFI', systemUrl: 'https://www.gov.br/tesouronacional/pt-br/siafi/',
    },
    {
      id: 'end', code: 'FIM', title: 'Processo concluído', description: 'Pagamento registrado e processo pronto para arquivamento ou acompanhamento contratual.', type: 'end',
      laneId: 'lane-cofinc', position: { x: 1770, y: 426 }, width: 64, height: 64, responsible: 'COFINC/CN', color: '#0f766e',
    },
  ],
  edges: [
    { id: 'edge-start-1', source: 'start', target: 'step-1' },
    { id: 'edge-1-2', source: 'step-1', target: 'step-2' },
    { id: 'edge-2-gw', source: 'step-2', target: 'gateway-1' },
    { id: 'edge-gw-3', source: 'gateway-1', target: 'step-3', label: 'Não', condition: 'Falta documento', style: 'dashed' },
    { id: 'edge-3-2', source: 'step-3', target: 'step-2', label: 'Reprocessar', style: 'dashed' },
    { id: 'edge-gw-4', source: 'gateway-1', target: 'step-4', label: 'Sim', condition: 'Tudo conferido' },
    { id: 'edge-4-5', source: 'step-4', target: 'step-5' },
    { id: 'edge-5-6', source: 'step-5', target: 'step-6' },
    { id: 'edge-6-end', source: 'step-6', target: 'end' },
  ],
};

export const DEFAULT_BOLSA_PROCESS_MAPPING: ProcessMappingRecord = {
  id: 'liquidacao-pagamento-bolsas',
  title: 'Liquidação e pagamento de bolsas de ensino, pesquisa ou extensão',
  code: 'PROC-FIN-002',
  description: 'Fluxo de instrução, liquidação e pagamento de bolsas no SUAP.',
  category: 'Financeiro',
  version: '1.0',
  createdAt,
  updatedAt: createdAt,
  owner: 'COFINC/CN',
  publicationStatus: 'published',
  tags: ['SUAP', 'liquidação', 'pagamento', 'bolsas', 'ensino', 'pesquisa', 'extensão'],
  lanes: [
    { id: 'lane-coordenador', name: 'Coordenador do Projeto', color: '#2563eb', order: 0, height: 180 },
    { id: 'lane-coordenacao', name: 'Coordenação responsável pelo projeto · COPEIN, COEX ou DIAC', color: '#7c3aed', order: 1, height: 180 },
    { id: 'lane-diad-bolsas', name: 'DIAD', color: '#0891b2', order: 2, height: 180 },
    { id: 'lane-cofinc-bolsas', name: 'COFINC', color: '#059669', order: 3, height: 180 },
    { id: 'lane-dg', name: 'DG · Direção-Geral', color: '#d97706', order: 4, height: 180 },
  ],
  nodes: [
    {
      id: 'start', code: 'INÍCIO', title: 'Processo iniciado', description: 'O processo de pagamento de bolsa é aberto e preparado para instrução.', type: 'start',
      laneId: 'lane-coordenador', position: { x: 28, y: 66 }, width: 64, height: 64, responsible: 'Coordenador do Projeto', color: '#0f766e',
    },
    {
      id: 'bolsa-step-1', code: '1', title: 'Anexar documentação da bolsa', description: 'Reunir e anexar ao processo os documentos necessários ao pagamento da bolsa.', type: 'task',
      laneId: 'lane-coordenador', position: { x: 138, y: 42 }, width: 220, height: 112, responsible: 'Coordenador do Projeto', slaDays: 2, color: '#2563eb',
      outputDocuments: ['Processo com documentação da bolsa anexada'], systemName: 'SUAP · Processo', systemUrl: 'https://suap.ifrn.edu.br/',
    },
    {
      id: 'bolsa-step-2', code: '2', title: 'Analisar documentação e encaminhar à DIAD', description: 'Analisar a documentação da bolsa e encaminhar o processo à DIAD para autorização da liquidação.', type: 'task',
      laneId: 'lane-coordenacao', position: { x: 420, y: 222 }, width: 220, height: 112, responsible: 'Coordenação responsável pelo projeto', routingAliases: ['COPEIN', 'COEX', 'DIAC'], slaDays: 3, color: '#7c3aed',
      inputDocuments: ['Processo com documentação da bolsa anexada'], outputDocuments: ['Documentação analisada'], systemName: 'SUAP · Processo', systemUrl: 'https://suap.ifrn.edu.br/',
    },
    {
      id: 'bolsa-gateway-documentacao', code: 'GW1', title: 'Documentação completa?', description: 'Decisão sobre a completude da documentação antes da autorização da liquidação.', type: 'gateway', gatewayType: 'exclusive',
      laneId: 'lane-coordenacao', position: { x: 704, y: 240 }, width: 76, height: 76, responsible: 'Coordenação responsável pelo projeto', routingAliases: ['COPEIN', 'COEX', 'DIAC'], color: '#7c3aed',
    },
    {
      id: 'bolsa-step-complementacao', code: '2A', title: 'Solicitar complementação documental', description: 'Devolver o processo ao Coordenador do Projeto para complementar a documentação pendente.', type: 'task',
      laneId: 'lane-coordenador', position: { x: 890, y: 42 }, width: 220, height: 112, responsible: 'Coordenador do Projeto', flowRole: 'exception', slaDays: 3, color: '#2563eb',
      inputDocuments: ['Pendência documental'], outputDocuments: ['Documentação complementada'],
    },
    {
      id: 'bolsa-step-3', code: '3', title: 'Autorizar a liquidação e encaminhar à COFINC', description: 'Autorizar a liquidação da bolsa e encaminhar o processo à COFINC.', type: 'task',
      laneId: 'lane-diad-bolsas', position: { x: 890, y: 402 }, width: 220, height: 112, responsible: 'DIAD', routingAliases: ['DIAD'], slaDays: 2, color: '#0891b2',
      inputDocuments: ['Documentação analisada'], outputDocuments: ['Liquidação autorizada'], systemName: 'SUAP · Processo', systemUrl: 'https://suap.ifrn.edu.br/',
    },
    {
      id: 'bolsa-step-4', code: '4', title: 'Registrar a liquidação e encaminhar à DG', description: 'Registrar a liquidação da bolsa e encaminhar o processo à DG para autorização do pagamento.', type: 'task',
      laneId: 'lane-cofinc-bolsas', position: { x: 1180, y: 582 }, width: 220, height: 112, responsible: 'COFINC', routingAliases: ['COFINC'], slaDays: 2, color: '#059669',
      inputDocuments: ['Liquidação autorizada'], outputDocuments: ['Liquidação registrada'], systemName: 'SIAFI', systemUrl: 'https://www.gov.br/tesouronacional/pt-br/siafi/',
    },
    {
      id: 'bolsa-step-5', code: '5', title: 'Autorizar o pagamento e encaminhar à COFINC', description: 'Autorizar o pagamento da bolsa e devolver o processo à COFINC para execução.', type: 'task',
      laneId: 'lane-dg', position: { x: 1470, y: 762 }, width: 220, height: 112, responsible: 'DG · Direção-Geral', routingAliases: ['DG'], slaDays: 2, color: '#d97706',
      inputDocuments: ['Liquidação registrada'], outputDocuments: ['Pagamento autorizado'],
    },
    {
      id: 'bolsa-step-6', code: '6', title: 'Realizar o pagamento e concluir o processo', description: 'Realizar o pagamento da bolsa, registrar a conclusão e finalizar o processo.', type: 'task',
      laneId: 'lane-cofinc-bolsas', position: { x: 1760, y: 582 }, width: 220, height: 112, responsible: 'COFINC', routingAliases: ['COFINC'], slaDays: 2, color: '#059669',
      inputDocuments: ['Pagamento autorizado'], outputDocuments: ['Pagamento realizado'], systemName: 'SIAFI', systemUrl: 'https://www.gov.br/tesouronacional/pt-br/siafi/',
    },
    {
      id: 'end', code: 'FIM', title: 'Processo concluído', description: 'O pagamento da bolsa foi realizado e registrado.', type: 'end',
      laneId: 'lane-cofinc-bolsas', position: { x: 2050, y: 606 }, width: 64, height: 64, responsible: 'COFINC', color: '#0f766e',
    },
  ],
  edges: [
    { id: 'bolsa-edge-start-1', source: 'start', target: 'bolsa-step-1' },
    { id: 'bolsa-edge-1-2', source: 'bolsa-step-1', target: 'bolsa-step-2' },
    { id: 'bolsa-edge-2-gateway', source: 'bolsa-step-2', target: 'bolsa-gateway-documentacao' },
    { id: 'bolsa-edge-gateway-complementacao', source: 'bolsa-gateway-documentacao', target: 'bolsa-step-complementacao', label: 'Não', condition: 'Documentação pendente', style: 'dashed' },
    { id: 'bolsa-edge-complementacao-2', source: 'bolsa-step-complementacao', target: 'bolsa-step-2', label: 'Reanalisar', style: 'dashed' },
    { id: 'bolsa-edge-gateway-3', source: 'bolsa-gateway-documentacao', target: 'bolsa-step-3', label: 'Sim', condition: 'Documentação completa' },
    { id: 'bolsa-edge-3-4', source: 'bolsa-step-3', target: 'bolsa-step-4' },
    { id: 'bolsa-edge-4-5', source: 'bolsa-step-4', target: 'bolsa-step-5' },
    { id: 'bolsa-edge-5-6', source: 'bolsa-step-5', target: 'bolsa-step-6' },
    { id: 'bolsa-edge-6-end', source: 'bolsa-step-6', target: 'end' },
  ],
};

export const DEFAULT_PROCESS_MAPPINGS = [DEFAULT_PROCESS_MAPPING, DEFAULT_BOLSA_PROCESS_MAPPING];
