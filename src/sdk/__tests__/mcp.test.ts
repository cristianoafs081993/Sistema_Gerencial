import { describe, expect, it, vi } from 'vitest';
import { GOVFLOW_MCP_TOOLS, dispatchMcpTool } from '../mcp/tools';

describe('GovFlow Core SDK - MCP Tools & Dispatcher', () => {
  it('deve possuir o catálogo oficial completo com ferramentas orçamentárias e contratuais', () => {
    const toolNames = GOVFLOW_MCP_TOOLS.map((t) => t.name);

    expect(toolNames).toContain('conciliar_saldo_ptres');
    expect(toolNames).toContain('consultar_painel_orcamentario');
    expect(toolNames).toContain('consultar_ficha_empenho');
    expect(toolNames).toContain('pesquisar_empenhos');
    expect(toolNames).toContain('consultar_extrato_descentralizacoes');
    expect(toolNames).toContain('consultar_ficha_contrato');
    expect(toolNames).toContain('projetar_necessidade_contrato');
    expect(toolNames).toContain('conciliar_contrato_orcamento');
    expect(toolNames).toContain('rastrear_trilha_despesa');
    expect(toolNames).toContain('auditar_inconsistencias_orcamentarias');

    // Validação de JSON Schema dos parâmetros
    for (const tool of GOVFLOW_MCP_TOOLS) {
      expect(tool.description).toBeDefined();
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.properties).toBeDefined();
    }
  });

  it('deve despachar a ferramenta conciliar_saldo_ptres para o módulo de conciliação', async () => {
    const mockSdk: any = {
      conciliacao: {
        conciliarPtresCompleto: vi.fn().mockResolvedValue({
          ptres: '231798',
          resumoGeral: { situacaoGeral: 'DESCOMPASSO_COM_SUAP' },
        }),
      },
    };

    const result = await dispatchMcpTool('conciliar_saldo_ptres', { ptres: '231798' }, mockSdk);

    expect(mockSdk.conciliacao.conciliarPtresCompleto).toHaveBeenCalledWith('231798');
    expect(result.ptres).toBe('231798');
  });

  it('deve lançar erro se parâmetro obrigatório da ferramenta não for fornecido', async () => {
    const mockSdk: any = {
      conciliacao: { conciliarPtresCompleto: vi.fn() },
    };

    await expect(dispatchMcpTool('conciliar_saldo_ptres', {}, mockSdk)).rejects.toThrow(
      'Parâmetro "ptres" é obrigatório.'
    );
  });

  it('deve lançar erro se o nome da ferramenta for inválido', async () => {
    await expect(dispatchMcpTool('ferramenta_inexistente', {})).rejects.toThrow(
      'Ferramenta MCP "ferramenta_inexistente" não reconhecida.'
    );
  });
});
