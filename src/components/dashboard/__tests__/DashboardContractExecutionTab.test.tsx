import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DashboardContractExecutionTab } from '@/components/dashboard/DashboardContractExecutionTab';
import type { ContractProjectionBulletItem } from '@/pages/Dashboard';

const createBullet = (overrides: Partial<ContractProjectionBulletItem>): ContractProjectionBulletItem => ({
  id: 'contract-1',
  label: 'Contrato exclusivo - Campus',
  color: '#2563eb',
  empenhado: 100,
  liquidado: 50,
  projetado: 100,
  saldoEmpenhos: 50,
  mesesConsiderados: 1,
  percentualLiquidado: 50,
  percentualProjetado: 100,
  liquidacoes: [],
  empenhos: [],
  coberturaMes: null,
  necessidadeEmpenho: 0,
  isCapped: false,
  isRenewalAllowed: false,
  valorTotalContrato: 100,
  categoria: 'Servi' + '\u00e7os',
  objeto: 'Servi' + '\u00e7o com m\u00e3o de obra exclusiva',
  ...overrides,
});

describe('DashboardContractExecutionTab', () => {
  it('inicia o heatmap filtrado por servicos continuados com mao de obra exclusiva', () => {
    const exclusivos = createBullet({ id: 'exclusive', label: 'Contrato exclusivo - Campus' });
    const gerais = createBullet({
      id: 'general',
      label: 'Contrato geral - Campus',
      objeto: 'Servico sem mao de obra exclusiva',
    });

    render(
      <DashboardContractExecutionTab
        isLoading={false}
        contractExpenseData={[]}
        contractExpenseOptions={[]}
        contractExpenseSeries={[]}
        selectedContractExpenseIds={[]}
        contractProjectionBullets={[]}
        allContractProjectionBullets={[exclusivos, gerais]}
        isContractExpenseLoading={false}
        onToggleContractExpense={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('combobox')[0]).toHaveValue('continuos_exclusiva');
    expect(screen.queryByText('Painel de Monitoramento de Cobertura Orçamentária')).not.toBeInTheDocument();
    expect(screen.getByText('Contrato exclusivo')).toBeInTheDocument();
    expect(screen.queryByText('Contrato geral')).not.toBeInTheDocument();
  });

  it('exibe 0% de cobertura no card do heatmap quando nao ha liquidacao ou projecao em vez de 100%', () => {
    const semGasto = createBullet({
      id: 'sem-gasto',
      label: '00071/2026 - ALERTA SERVICOS LTDA',
      liquidado: 0,
      projetado: 0,
      saldoEmpenhos: 50000,
      objeto: 'Serviço com dedicação exclusiva',
    });

    render(
      <DashboardContractExecutionTab
        isLoading={false}
        contractExpenseData={[]}
        contractExpenseOptions={[]}
        contractExpenseSeries={[]}
        selectedContractExpenseIds={[]}
        contractProjectionBullets={[]}
        allContractProjectionBullets={[semGasto]}
        isContractExpenseLoading={false}
        onToggleContractExpense={vi.fn()}
      />,
    );

    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
  });

  it('exibe status Sem Gasto e 0.0% na projecao detalhada quando o contrato selecionado nao possui liquidacao', () => {
    const semGasto = createBullet({
      id: 'sem-gasto',
      label: '00071/2026 - ALERTA SERVICOS LTDA',
      liquidado: 0,
      projetado: 0,
      saldoEmpenhos: 50000,
      objeto: 'Serviço com dedicação exclusiva',
    });

    render(
      <DashboardContractExecutionTab
        isLoading={false}
        contractExpenseData={[]}
        contractExpenseOptions={[]}
        contractExpenseSeries={[]}
        selectedContractExpenseIds={['sem-gasto']}
        contractProjectionBullets={[semGasto]}
        allContractProjectionBullets={[semGasto]}
        isContractExpenseLoading={false}
        onToggleContractExpense={vi.fn()}
      />,
    );

    expect(screen.getByText('Sem Gasto')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });
});
