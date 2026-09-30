// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  calcularDashboard,
  codigoPtresDaOrigem,
  montarOpcoesPtres,
  origemCorrespondeAoPtres,
  origemIgnoradaNoEmpenhado,
} from '../../mobile/src/lib/dashboardRules';
import { primeiroNome } from '../../mobile/src/lib/format';

const atividades = [
  { valor_total: 1000, origem_recurso: '231796 - PROAD' },
  { valor_total: 500, origem_recurso: '261941' },
];

const empenhos = [
  { valor: 600, valor_liquidado_oficial: 400, valor_pago_oficial: 300, data_empenho: '2026-01-15', origem_recurso: '231796 - PROAD' },
  { valor: 200, valor_liquidado: 100, valor_pago_oficial: 100, data_empenho: '2026-02-10', origem_recurso: '261941' },
  { valor: 999, valor_liquidado_oficial: 50, valor_pago_oficial: 0, data_empenho: '2026-02-20', origem_recurso: '230446 - PNAE' },
];

const descentralizacoes = [
  { valor: 700, origem_recurso: '231796 - PROAD' },
  { valor: 300, origem_recurso: '261941' },
  { valor: 5000, origem_recurso: '230446 - PNAE' },
];

describe('mobile — cálculo do dashboard', () => {
  it('soma planejado, empenhado, liquidado e pago com as razões do web', () => {
    const m = calcularDashboard({ atividades, empenhos, descentralizacoes, creditos: [], ateMes: 2 });

    expect(m.planejado).toBe(1500);
    expect(m.totalAtividades).toBe(2);
    expect(m.descentralizado).toBe(1000); // 230446 fica fora da soma global
    expect(m.empenhado).toBe(800); // idem
    expect(m.liquidado).toBe(550); // liquidado/pago somam todos os empenhos, como no web
    expect(m.pago).toBe(400);
    expect(m.aPagar).toBe(150);
    expect(m.aDescentralizar).toBe(500);
    expect(m.pctExecutado).toBe(53.3);
    expect(m.pctEmpenhadoDescentralizado).toBe(80);
    expect(m.pctLiquidadoDescentralizado).toBe(55);
    expect(m.pctLiquidadoEmpenhado).toBe(68.8);
    expect(m.pctPagoLiquidado).toBe(72.7);
  });

  it('usa o saldo oficial da conta como descentralizado (sem a origem 230446)', () => {
    const m = calcularDashboard({
      atividades,
      empenhos,
      descentralizacoes,
      contaSaldos: [
        { ptres: '231796', valor: 800 },
        { ptres: '261941', valor: 250 },
        { ptres: '230446', valor: 9999 },
      ],
      creditos: [],
    });

    expect(m.descentralizado).toBe(1050);
    expect(m.aDescentralizar).toBe(450);
  });

  it('filtra tudo pelo PTRES escolhido (inclusive o saldo da conta e a origem 230446)', () => {
    const entrada = { atividades, empenhos, descentralizacoes, creditos: [], contaSaldos: [{ ptres: '231796', valor: 800 }, { ptres: '230446', valor: 9999 }] };

    const proad = calcularDashboard({ ...entrada, ptres: '231796' });
    expect(proad).toMatchObject({ planejado: 1000, empenhado: 600, liquidado: 400, pago: 300, descentralizado: 800 });

    const pnae = calcularDashboard({ ...entrada, ptres: '230446' });
    expect(pnae.empenhado).toBe(999); // filtrando explicitamente, a origem ignorada volta a contar
    expect(pnae.descentralizado).toBe(9999);
  });

  it('monta a série mensal até o mês pedido, pela data do empenho', () => {
    const m = calcularDashboard({ atividades, empenhos, descentralizacoes, creditos: [], ateMes: 2 });

    expect(m.mensal.map((x) => x.mes)).toEqual(['Jan', 'Fev', 'Mar']);
    expect(m.mensal[0]).toEqual({ mes: 'Jan', empenhado: 600, liquidado: 400 });
    expect(m.mensal[1]).toEqual({ mes: 'Fev', empenhado: 1199, liquidado: 150 });
    expect(m.mensal[2]).toEqual({ mes: 'Mar', empenhado: 0, liquidado: 0 });
  });

  it('crédito disponível: oficial quando há relatório; senão descentralizado − empenhado', () => {
    const oficial = calcularDashboard({
      atividades,
      empenhos,
      descentralizacoes,
      creditos: [{ ptres: '231796', valor: 70 }, { ptres: '261941', valor: 30 }],
    });
    expect(oficial).toMatchObject({ creditoDisponivel: 100, creditoOficial: true });

    const calculado = calcularDashboard({ atividades, empenhos, descentralizacoes, creditos: [] });
    expect(calculado).toMatchObject({ creditoDisponivel: 200, creditoOficial: false });
  });

  it('sem dados retorna zeros e marca semDados — nunca valores inventados', () => {
    const m = calcularDashboard({ atividades: [], empenhos: [], descentralizacoes: [], creditos: [] });

    expect(m.semDados).toBe(true);
    expect(m).toMatchObject({ planejado: 0, descentralizado: 0, empenhado: 0, liquidado: 0, pago: 0, pctExecutado: 0 });
    expect(m.mensal.every((x) => x.empenhado === 0 && x.liquidado === 0)).toBe(true);
  });

  it('não divide por zero quando não há descentralizado', () => {
    const m = calcularDashboard({ atividades, empenhos, descentralizacoes: [], creditos: [] });

    expect(m.pctEmpenhadoDescentralizado).toBe(0);
    expect(m.pctLiquidadoDescentralizado).toBe(0);
  });
});

describe('mobile — PTRES', () => {
  it('reconhece o código do PTRES na origem do recurso', () => {
    expect(codigoPtresDaOrigem('231796 - PROAD')).toBe('231796');
    expect(codigoPtresDaOrigem('261941/ALIM')).toBe('261941');
    expect(codigoPtresDaOrigem('sem codigo')).toBeNull();
    expect(codigoPtresDaOrigem(null)).toBeNull();
  });

  it('compara a origem com o PTRES sem confundir códigos parecidos', () => {
    expect(origemCorrespondeAoPtres('231796', '231796')).toBe(true);
    expect(origemCorrespondeAoPtres('231796 - PROAD', '231796')).toBe(true);
    expect(origemCorrespondeAoPtres('2317960', '231796')).toBe(false);
    expect(origemCorrespondeAoPtres(null, '231796')).toBe(false);
    expect(origemCorrespondeAoPtres('qualquer', 'all')).toBe(true);
    expect(origemIgnoradaNoEmpenhado('230446 - PNAE')).toBe(true);
  });

  it('lista os PTRES com os principais primeiro e nomes conhecidos', () => {
    const opcoes = montarOpcoesPtres(
      {
        origens: ['999999', '261941 - X', '231796', null],
        creditos: [{ ptres: '123456', descricao: 'Ação X' }],
      },
      { '231796': 'PROAD · Gestão' },
    );

    expect(opcoes.map((o) => o.code)).toEqual(['all', '231796', '261941', '123456', '999999']);
    expect(opcoes[1].name).toBe('PROAD · Gestão');
    expect(opcoes[3].name).toBe('Ação X');
    expect(opcoes[4].name).toBe('PTRES 999999');
  });
});

describe('mobile — saudação', () => {
  it('usa o nome do perfil e, sem ele, o início do e-mail', () => {
    expect(primeiroNome({ email: 'maria.silva@ifrn.edu.br' })).toBe('Maria');
    expect(primeiroNome({ email: 'x@y.com', user_metadata: { full_name: 'joao pedro souza' } })).toBe('Joao');
    expect(primeiroNome({ email: 'cristiano.cnrn@gmail.com' })).toBe('Cristiano');
    expect(primeiroNome(null)).toBe('tudo bem');
  });
});
