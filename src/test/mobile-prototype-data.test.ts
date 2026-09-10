import { describe, it, expect } from 'vitest';
import {
  dashboardData,
  empenhosData,
  contratosData,
  pregoesData,
  atasData,
  formatBRL,
} from '../../mobile/src/constants/data';

describe('SIAGES Mobile - Regras de Negócio e Dados do Protótipo', () => {
  it('deve validar os totais da Visão Geral (Dashboard) com consistência orçamentária exata', () => {
    // Descentralizado - Empenhado = Saldo disponível
    const saldoCalculado = dashboardData.descentralizado - dashboardData.empenhado;
    expect(saldoCalculado).toBe(dashboardData.saldoDisponivel);
    expect(dashboardData.saldoDisponivel).toBe(1284560);

    // Empenhado % sobre descentralizado
    const pctEmpenhado = (dashboardData.empenhado / dashboardData.descentralizado) * 100;
    expect(pctEmpenhado.toFixed(1)).toBe('69.4');

    // A pagar = Liquidado - Pago
    const aPagarCalculado = dashboardData.liquidado - dashboardData.pago;
    expect(aPagarCalculado).toBe(dashboardData.aPagar);
    expect(dashboardData.aPagar).toBe(122500);

    // Pago % sobre liquidado
    const pctPago = (dashboardData.pago / dashboardData.liquidado) * 100;
    expect(pctPago.toFixed(1)).toBe('94.3');
  });

  it('deve formatar valores monetários em formato padrão Real brasileiro (BRL)', () => {
    const formatted = formatBRL(1284560);
    // Deve conter R$ e os separadores de milhar e centavos corretos
    expect(formatted).toContain('1.284.560,00');
  });

  it('deve filtrar empenhos por tipo (exercício / rap) e busca de texto corretamente', () => {
    // Amostra possui 4 empenhos
    expect(empenhosData).toHaveLength(4);

    // Filtrar por tipo 'exercicio'
    const exercicio = empenhosData.filter((e) => e.tipo === 'exercicio');
    expect(exercicio).toHaveLength(3);

    // Filtrar por tipo 'rap'
    const rap = empenhosData.filter((e) => e.tipo === 'rap');
    expect(rap).toHaveLength(1);
    expect(rap[0].id).toBe('2026NE000115');
    expect(rap[0].saldo).toBe(6320);
    expect(rap[0].inscrito).toBe(16320);
    expect(rap[0].paid).toBe(10000);

    // Filtrar por busca textual
    const buscaInformatica = empenhosData.filter(
      (e) =>
        e.name.toLowerCase().includes('tecno') ||
        e.desc.toLowerCase().includes('informática')
    );
    expect(buscaInformatica).toHaveLength(1);
    expect(buscaInformatica[0].id).toBe('2026NE000119');
  });

  it('deve filtrar contratos por alerta de vencimento (warning / a vencer)', () => {
    // Amostra possui 3 contratos
    expect(contratosData).toHaveLength(3);

    // Contratos a vencer (warning === true)
    const aVencer = contratosData.filter((c) => c.warning);
    expect(aVencer).toHaveLength(1);
    expect(aVencer[0].id).toBe('00018/2025');
    expect(aVencer[0].title).toBe('Vigilância patrimonial');
    expect(aVencer[0].remaining).toBe('Vence em 22 dias');

    // Contratos vigentes sem alerta
    const vigentesSemAlerta = contratosData.filter((c) => !c.warning);
    expect(vigentesSemAlerta).toHaveLength(2);
  });

  it('deve validar dados de pregões do protótipo e filtros por status e SRP', () => {
    expect(pregoesData.length).toBeGreaterThanOrEqual(3);

    // Validação de propriedades
    const first = pregoesData[0];
    expect(first.id).toBeDefined();
    expect(first.numero).toBeDefined();
    expect(first.objeto).toBeDefined();
    expect(first.valor).toBeGreaterThan(0);
    expect(['homologado', 'estimado']).toContain(first.tipoValor);
    expect(['Aberta', 'Futura', 'Encerrada', 'Em andamento']).toContain(first.statusProposta);

    // Filtro SRP
    const srpItems = pregoesData.filter((p) => p.srp);
    expect(srpItems.length).toBeGreaterThan(0);

    // Filtro por propostas abertas
    const abertos = pregoesData.filter((p) => p.statusProposta === 'Aberta');
    expect(abertos.length).toBeGreaterThan(0);
  });

  it('deve validar dados de atas do protótipo e filtros por vigência e vínculo com campus', () => {
    expect(atasData.length).toBeGreaterThanOrEqual(3);

    const first = atasData[0];
    expect(first.id).toBeDefined();
    expect(first.numeroAta).toBeDefined();
    expect(first.objeto).toBeDefined();
    expect(first.unidadeGerenciadoraCodigo).toBeDefined();
    expect(['gerenciadora', 'participante', 'aderente', 'outro']).toContain(first.vinculo);
    expect(['vigente', 'vencer', 'expirada']).toContain(first.statusVigencia);
    expect(typeof first.diasRestantes).toBe('number');
    expect(first.totalItens).toBeGreaterThan(0);

    // Filtro atas a vencer
    const aVencer = atasData.filter((a) => a.statusVigencia === 'vencer');
    expect(aVencer.length).toBeGreaterThanOrEqual(1);

    // Filtro vínculo participante ou gerenciadora
    const doCampus = atasData.filter((a) => a.vinculo === 'gerenciadora' || a.vinculo === 'participante');
    expect(doCampus.length).toBeGreaterThan(0);
  });
});
