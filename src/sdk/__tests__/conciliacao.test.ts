import { describe, expect, it, vi } from 'vitest';
import { ConciliacaoModule } from '../conciliacao';

describe('GovFlow Core SDK - ConciliacaoModule', () => {
  it('deve conciliar com precisão o caso do PTRES 231798 identificando descompasso com o SUAP e saldo SIAFI positivo', async () => {
    // Simula os dados reais encontrados no banco para o PTRES 231798
    const mockAtividades = [
      { id: '1', atividade: 'Capacitação Docente', valor_total: 15000, saldo_disponivel: 15000, plano_interno: 'CAPACITA' },
      { id: '2', atividade: 'Insumos Laboratório', valor_total: 41226.53, saldo_disponivel: 0, plano_interno: 'LABS' },
      { id: '3', atividade: 'Interseccionalidades', valor_total: 837.50, saldo_disponivel: 837.50, plano_interno: 'INTERSEC' },
      // Note: No PI L21B3P19ENN não há atividade cadastrada (0,00)
    ]; // Total Planejado: 15000 + 41226.53 + 837.50 = 57.064,03

    const mockDescentralizacoes = [
      { id: 'nc1', nota_credito: '2026NC000018', operacao_tipo: 'DESCENTRALIZACAO DE CREDITO', plano_interno: 'L21B3P19ENN', valor: 1000 },
      { id: 'nc2', nota_credito: '2026NC000001', operacao_tipo: 'DESCENTRALIZACAO DE CREDITO', plano_interno: 'LABS', valor: 41226.53 },
      { id: 'nc3', nota_credito: '2026NC000002', operacao_tipo: 'DESCENTRALIZACAO DE CREDITO', plano_interno: 'CAPACITA', valor: 15000 },
      { id: 'nc4', nota_credito: '2026NC000003', operacao_tipo: 'DESCENTRALIZACAO DE CREDITO', plano_interno: 'INTERSEC', valor: 837.50 },
    ]; // Total Descentralizado Líquido: 58.064,03

    const mockEmpenhos = [
      { id: 'ne1', numero: '2026NE000072', descricao: 'Aquisição de Livros', valor: 1000, status: 'pendente', tipo: 'exercicio', plano_interno: 'L21B3P19ENN' },
      { id: 'ne2', numero: '2026NE000010', descricao: 'Insumos', valor: 41226.53, status: 'pendente', tipo: 'exercicio', plano_interno: 'LABS' },
      { id: 'ne3', numero: '2026NE000020', descricao: 'Cursos', valor: 15000, status: 'pendente', tipo: 'exercicio', plano_interno: 'CAPACITA' },
      // Note: INTERSEC tem 0 empenhado (saldo livre 837.50)
    ]; // Total Empenhado: 1000 + 41226.53 + 15000 = 57.226,53

    const mockClient: any = {
      from: (table: string) => {
        return {
          select: () => ({
            eq: () => {
              if (table === 'atividades') return Promise.resolve({ data: mockAtividades, error: null });
              if (table === 'descentralizacoes') return Promise.resolve({ data: mockDescentralizacoes, error: null });
              if (table === 'empenhos') return Promise.resolve({ data: mockEmpenhos, error: null });
              return Promise.resolve({ data: [], error: null });
            },
          }),
        };
      },
    };

    const conciliacao = new ConciliacaoModule(mockClient);
    const resultado = await conciliacao.conciliarPtresCompleto('231798');

    // 1. Verificação do Resumo Geral
    expect(resultado.ptres).toBe('231798');
    expect(resultado.resumoGeral.planejadoSuap).toBe(57064.03);
    expect(resultado.resumoGeral.descentralizadoSiafi).toBe(58064.03);
    expect(resultado.resumoGeral.empenhadoSiafi).toBe(57226.53);

    // Saldo do SUAP: 57.064,03 - 57.226,53 = -162,50
    expect(resultado.resumoGeral.saldoPlanejamentoSuap).toBe(-162.50);

    // Saldo Real no SIAFI: 58.064,03 - 57.226,53 = +837,50 (saldo POSITIVO)
    expect(resultado.resumoGeral.saldoRealSiafi).toBe(837.50);

    // Situação Geral deve ser classificada como descompasso com o SUAP, NÃO como déficit orçamentário
    expect(resultado.resumoGeral.situacaoGeral).toBe('DESCOMPASSO_COM_SUAP');

    // 2. Verificação do Plano Interno sem Atividade Planejada
    const piSemPlanejamento = resultado.planosInternos.find((p) => p.planoInterno === 'L21B3P19ENN');
    expect(piSemPlanejamento).toBeDefined();
    expect(piSemPlanejamento?.planejadoSuap).toBe(0);
    expect(piSemPlanejamento?.empenhadoSiafi).toBe(1000);
    expect(piSemPlanejamento?.saldoSuap).toBe(-1000);
    expect(piSemPlanejamento?.saldoRealSiafi).toBe(0); // 1000 descentralizado - 1000 empenhado
    expect(piSemPlanejamento?.status).toBe('sem_planejamento');

    // 3. Verificação de empenhos listados na divergência
    expect(resultado.empenhosSemAtividadePlanejada.length).toBeGreaterThan(0);
    expect(resultado.empenhosSemAtividadePlanejada[0].numero).toBe('2026NE000072');

    // 4. Diagnóstico textual e recomendações
    expect(resultado.diagnosticoTextual).toContain('NÃO possui déficit contábil no SIAFI');
    expect(resultado.diagnosticoTextual).toContain('POSITIVO em R$ 837,50');
    expect(resultado.recomendacoes.length).toBeGreaterThan(0);
  });
});
