import { describe, it, expect, vi } from 'vitest';

import {
  fetchDashboardMetrics,
  fetchEmpenhos,
  fetchContratos,
  fetchNotifications,
  fetchPregoes,
  fetchAtas,
  fetchOcorrencias,
  fetchEnergiaFaturas,
  fetchEnergiaSolar,
  fetchPortariaEventos,
  fetchPortariaParticipantes,
  toggleParticipanteCheckin,
  interleaveEvents,
  isOrigemRecursoIgnoradaNoEmpenhado,
  matchesPtres,
} from '../../mobile/src/services/api';
import type { NotificationItem } from '../../mobile/src/types';

describe('SIAGES Mobile - Serviços de Integração ao Backend (Dados Reais)', () => {
  it('deve identificar correspondência de PTRES / Origem de Recurso corretamente', () => {
    expect(matchesPtres('231796', '231796')).toBe(true);
    expect(matchesPtres('231796 - PROAD', '231796')).toBe(true);
    expect(matchesPtres('231796/2026', '231796')).toBe(true);
    expect(matchesPtres('231798', '231796')).toBe(false);
    expect(matchesPtres('231798', 'all')).toBe(true);
    expect(matchesPtres(null, 'all')).toBe(true);
    expect(matchesPtres(null, '231796')).toBe(false);
    expect(matchesPtres(undefined, '231796')).toBe(false);
  });

  it('deve identificar corretamente origens de recursos ignoradas no cálculo de empenhado descentralizado (ex: 230446)', () => {
    expect(isOrigemRecursoIgnoradaNoEmpenhado('230446')).toBe(true);
    expect(isOrigemRecursoIgnoradaNoEmpenhado('AD.20RL.230446.3')).toBe(true);
    expect(isOrigemRecursoIgnoradaNoEmpenhado('230446 - PNAE')).toBe(true);
    expect(isOrigemRecursoIgnoradaNoEmpenhado('231796')).toBe(false);
    expect(isOrigemRecursoIgnoradaNoEmpenhado('Tesouro')).toBe(false);
    expect(isOrigemRecursoIgnoradaNoEmpenhado(null)).toBe(false);
    expect(isOrigemRecursoIgnoradaNoEmpenhado(undefined)).toBe(false);
  });

  it(
    'deve buscar e agregar métricas do exercício 2026 com destaque para o Planejado',
    async () => {
      const metrics = await fetchDashboardMetrics('158366');

      expect(metrics).toBeDefined();
      expect(metrics.instituicao).toBe('IFRN');
      expect(metrics.campus).toBe('Campus Currais Novos');
      expect(metrics.exercicio).toBe('2026');
      expect(metrics.selectedPtres).toBe('all');
      expect(metrics.availablePtres?.length).toBeGreaterThan(5);
      expect(metrics.availablePtres?.some((p) => p.code === '231796')).toBe(true);

      // Validações do Planejado (Métrica Principal)
      expect(metrics.planejado).toBeGreaterThan(3000000);
      expect(metrics.totalAtividades).toBeGreaterThan(300);
      expect(metrics.percentualExecutadoNum).toBeGreaterThan(60);
      expect(metrics.aDescentralizar).toBe(metrics.planejado - metrics.descentralizado);

      // Validações orçamentárias exatas
      expect(metrics.empenhado).toBeGreaterThan(2000000);
      expect(metrics.descentralizado).toBeGreaterThan(2500000);
      expect(metrics.saldoDisponivel).toBe(metrics.descentralizado - metrics.empenhado);
      // Crédito disponível oficial importado do SIAFI (tela web de crédito disponível)
      expect(metrics.creditoDisponivel).toBeGreaterThan(100000);
      expect(metrics.percentualCreditoDisponivel).toBeDefined();
      expect(metrics.creditoDisponivel).toBeLessThan(metrics.descentralizado);
      expect(metrics.liquidado).toBeGreaterThan(1200000);
      expect(metrics.pago).toBeGreaterThan(1100000);
      expect(metrics.aPagar).toBe(metrics.liquidado - metrics.pago);
      expect(metrics.contratosAVencerCount).toBeGreaterThanOrEqual(1);

      expect(metrics.monthlyChart).toHaveLength(6);
    },
    20000
  );

  it('deve filtrar métricas do dashboard por PTRES específico (ex: 231796 - PROAD)', async () => {
    const metrics = await fetchDashboardMetrics('158366', '231796');

    expect(metrics.selectedPtres).toBe('231796');
    expect(metrics.planejado).toBe(2354779);
    expect(metrics.totalAtividades).toBe(200);
    expect(metrics.descentralizado).toBe(1758921);
    expect(metrics.empenhado).toBeGreaterThan(1600000);
    expect(metrics.liquidado).toBeGreaterThan(800000);
    expect(metrics.pago).toBeGreaterThan(800000);
    expect(metrics.aPagar).toBe(metrics.liquidado - metrics.pago);
    expect(metrics.aDescentralizar).toBe(metrics.planejado - metrics.descentralizado);
  }, 20000);

  it('deve buscar e mapear a lista de empenhos suportando tipo (exercício, rap e todos) sem cancelados', async () => {
    // Default busca todos (exercício + rap)
    const empenhosTodos = await fetchEmpenhos('158366');
    expect(empenhosTodos.length).toBeGreaterThan(0);
    expect(empenhosTodos.some((e) => e.tipo === 'exercicio')).toBe(true);
    expect(empenhosTodos.some((e) => e.tipo === 'rap')).toBe(true);

    const first = empenhosTodos[0];
    expect(first.id).toBeDefined();
    expect(first.name).toBeDefined();
    expect(first.value).toBeGreaterThanOrEqual(0);
    expect(['liquidar', 'pagar', 'pago']).toContain(first.status);
    expect(first.date).toBeDefined();
    expect(first.nd).toBeDefined();
    expect(['exercicio', 'rap']).toContain(first.tipo);

    // Filtro apenas exercício
    const empenhosExercicio = await fetchEmpenhos('158366', 'exercicio');
    expect(empenhosExercicio.length).toBeGreaterThan(0);
    expect(empenhosExercicio.every((e) => e.tipo === 'exercicio')).toBe(true);

    // Filtro apenas rap
    const empenhosRap = await fetchEmpenhos('158366', 'rap');
    expect(empenhosRap.length).toBeGreaterThan(0);
    expect(empenhosRap.every((e) => e.tipo === 'rap')).toBe(true);

    // Valida que o saldo atual oficial do RAP bate com a tela web e reflete o saldo oficial vigente
    const totalSaldoRap = empenhosRap.reduce((acc, curr) => acc + (curr.saldo ?? curr.value), 0);
    expect(Math.round(totalSaldoRap)).toBeGreaterThan(100000);
    const totalInscritoRap = empenhosRap.reduce((acc, curr) => acc + (curr.inscrito ?? 0), 0);
    expect(Math.round(totalInscritoRap)).toBe(1675954);
  }, 20000);

  it('deve buscar e mapear os contratos do campus com cálculo de vigência', async () => {
    const contratos = await fetchContratos('158366');

    expect(contratos.length).toBeGreaterThan(0);
    const first = contratos[0];
    expect(first.id).toBeDefined();
    expect(first.title).toBeDefined();
    expect(first.name).toBeDefined();
    expect(first.value).toBeGreaterThanOrEqual(0);
    expect(['shield', 'building', 'doc']).toContain(first.icon);
    expect(typeof first.warning).toBe('boolean');
    expect(first.remaining).toBeDefined();
  }, 20000);

  it('deve buscar notificações da plataforma web intercalando empenhos, descentralizações e requisições', async () => {
    const notifications = await fetchNotifications('158366');

    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications.length).toBeLessThanOrEqual(60);

    const types = new Set(notifications.map((n) => n.type));
    expect(types.has('empenho')).toBe(true);
    expect(types.has('descentralizacao')).toBe(true);
    expect(types.has('requisicao')).toBe(true);

    const empenhosCount = notifications.filter((n) => n.type === 'empenho').length;
    const descCount = notifications.filter((n) => n.type === 'descentralizacao').length;
    const reqCount = notifications.filter((n) => n.type === 'requisicao').length;
    expect(empenhosCount).toBeGreaterThan(0);
    expect(descCount).toBeGreaterThan(0);
    expect(reqCount).toBeGreaterThan(0);

    const first = notifications[0];
    expect(first.id).toBeDefined();
    expect(first.title).toBeDefined();
    expect(first.valor).toBeGreaterThanOrEqual(0);
    expect(first.date instanceof Date).toBe(true);
  }, 20000);

  it('deve intercalar eventos em rodízio respeitando o limite máximo', () => {
    const mockEmpenhos: NotificationItem[] = [
      { id: 'e1', type: 'empenho', date: new Date(), title: 'E1', subtitle: '', description: '', valor: 100 },
      { id: 'e2', type: 'empenho', date: new Date(), title: 'E2', subtitle: '', description: '', valor: 200 },
    ];
    const mockDesc: NotificationItem[] = [
      { id: 'd1', type: 'descentralizacao', date: new Date(), title: 'D1', subtitle: '', description: '', valor: 300 },
    ];
    const mockReq: NotificationItem[] = [
      { id: 'r1', type: 'requisicao', date: new Date(), title: 'R1', subtitle: '', description: '', valor: 400 },
    ];

    const result = interleaveEvents(mockEmpenhos, mockDesc, mockReq, 10);
    expect(result.map((item) => item.id)).toEqual(['r1', 'd1', 'e1', 'e2']);
  });

  it('deve buscar e mapear pregões eletrônicos integrados ao PNCP', async () => {
    const pregoes = await fetchPregoes('158366');

    expect(pregoes.length).toBeGreaterThan(0);
    const first = pregoes[0];
    expect(first.id).toBeDefined();
    expect(first.numero).toBeDefined();
    expect(first.objeto).toBeDefined();
    expect(first.modalidade).toBeDefined();
    expect(first.uasgCodigo).toBeDefined();
    expect(first.valor).toBeGreaterThanOrEqual(0);
    expect(['homologado', 'estimado']).toContain(first.tipoValor);
    expect(['Aberta', 'Futura', 'Encerrada', 'Em andamento']).toContain(first.statusProposta);
    expect(['green', 'blue', 'amber', 'muted']).toContain(first.badgeColor);
    expect(typeof first.srp).toBe('boolean');
  }, 20000);

  it('deve buscar e mapear atas de registro de preços com cálculo de vínculo e vigência', async () => {
    const atas = await fetchAtas('158366');

    expect(atas.length).toBeGreaterThan(0);
    const first = atas[0];
    expect(first.id).toBeDefined();
    expect(first.numeroAta).toBeDefined();
    expect(first.objeto).toBeDefined();
    expect(first.unidadeGerenciadoraCodigo).toBeDefined();
    expect(['gerenciadora', 'participante', 'aderente', 'outro']).toContain(first.vinculo);
    expect(['vigente', 'vencer', 'expirada']).toContain(first.statusVigencia);
    expect(typeof first.diasRestantes).toBe('number');
    expect(first.totalItens).toBeGreaterThanOrEqual(0);
    expect(first.totalAdesoes).toBeGreaterThanOrEqual(0);
  }, 20000);

  it('deve buscar e mapear ocorrências de manutenção do campus', async () => {
    const ocorrencias = await fetchOcorrencias();

    expect(ocorrencias.length).toBeGreaterThan(0);
    const first = ocorrencias[0];
    expect(first.id).toBeDefined();
    expect(first.ambienteNome).toBeDefined();
    expect(first.ambienteCodigo).toBeDefined();
    expect(['pendente', 'em_andamento', 'resolvido', 'arquivado']).toContain(first.status);
    expect(Array.isArray(first.problemas)).toBe(true);
    expect(first.data).toBeDefined();
    expect(typeof first.avaliacao).toBe('number');
  }, 20000);

  it('deve buscar e mapear faturas de consumo de energia (Cosern / Mercatto)', async () => {
    const faturas = await fetchEnergiaFaturas();

    expect(faturas.length).toBeGreaterThan(0);
    const first = faturas[0];
    expect(first.id).toBeDefined();
    expect(['cosern', 'mercatto']).toContain(first.fonte);
    expect(first.competencia).toBeDefined();
    expect(first.ano).toBeGreaterThanOrEqual(2020);
    expect(first.consumoKwh).toBeGreaterThanOrEqual(0);
    expect(first.valor).toBeGreaterThanOrEqual(0);
  }, 20000);

  it('deve buscar e mapear registros de geração de energia solar', async () => {
    const solar = await fetchEnergiaSolar();

    expect(solar.length).toBeGreaterThan(0);
    const first = solar[0];
    expect(first.id).toBeDefined();
    expect(first.ufvNome).toBeDefined();
    expect(first.energiaGeradaKwh).toBeGreaterThanOrEqual(0);
    expect(first.dataReferencia).toBeDefined();
  }, 20000);

  it('deve buscar e mapear eventos da portaria do campus com participantes', async () => {
    const eventos = await fetchPortariaEventos('158366');

    expect(eventos.length).toBeGreaterThan(0);
    const first = eventos[0];
    expect(first.id).toBeDefined();
    expect(first.titulo).toBeDefined();
    expect(first.local).toBeDefined();
    expect(first.dataInicio).toBeDefined();
    expect(typeof first.totalParticipantes).toBe('number');
    expect(typeof first.totalPresentes).toBe('number');
  }, 20000);

  it('deve buscar participantes de um evento e permitir check-in', async () => {
    const eventos = await fetchPortariaEventos('158366');
    expect(eventos.length).toBeGreaterThan(0);

    const eventoId = eventos[0].id;
    const participantes = await fetchPortariaParticipantes(eventoId);

    expect(Array.isArray(participantes)).toBe(true);
    if (participantes.length > 0) {
      const part = participantes[0];
      expect(part.id).toBeDefined();
      expect(part.nome).toBeDefined();
      expect(typeof part.presente).toBe('boolean');

      // Testar toggle de check-in
      const res = await toggleParticipanteCheckin(part.id, !part.presente);
      expect(typeof res).toBe('boolean');
    }
  }, 20000);
});



