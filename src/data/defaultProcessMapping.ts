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
      outputDocuments: ['Pendência registrada'],
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

export const DEFAULT_PROCESS_MAPPINGS = [DEFAULT_PROCESS_MAPPING];
