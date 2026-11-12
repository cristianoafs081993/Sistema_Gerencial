import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { sugerir } = require('../../../scripts/siafi-sugestoes-deducoes.cjs');

describe('sugestões históricas de deduções', () => {
  const inventario = { credores: [{ credor: '03126525000166', nomes: ['Empresa'], contratos_candidatos: [{ numero: '1' }], nps: [
    { np: '2026NP000273', situacoes_importadas: ['DDF055', 'DOB035'], deducoes_observadas: [{ situacao: 'DDF055', codigo_receita: '6147', natureza: '17001', valor: '0,00' }] },
  ] }] };
  it('mostra códigos e NP de origem, distinguindo situação sem detalhe', () => {
    const resultado = sugerir(inventario, '03.126.525/0001-66');
    expect(resultado.sugestoes).toEqual([{ situacao: 'DDF055', codigo_receita: '6147', natureza: '17001', valor_historico: '0,00', np: '2026NP000273' }]);
    expect(resultado.situacoes_sem_detalhe).toEqual([{ situacao: 'DOB035', np: '2026NP000273' }]);
    expect(resultado.aviso).toContain('não vínculos comprovados');
  });
  it('não sugere código para fornecedor ausente', () => {
    expect(sugerir(inventario, '29.449.247/0001-71')).toMatchObject({ encontrado: false, sugestoes: [] });
    expect(() => sugerir(inventario, '123')).toThrow();
  });
});
