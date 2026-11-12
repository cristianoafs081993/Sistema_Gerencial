#!/usr/bin/env node
'use strict';

// O inventário é histórico: contrato candidato não é vínculo comprovado com a NP.
const fs = require('node:fs');
const path = require('node:path');
const SITUACOES = new Set(['DDF050', 'DDF055', 'DOB001', 'DOB035', 'DGR001']);
const digits = value => String(value || '').replace(/\D/g, '');

function sugerir(inventario, cnpj) {
  const id = digits(cnpj);
  if (id.length !== 14) throw new Error('Informe um CNPJ com 14 dígitos.');
  const credor = (inventario.credores || []).find(item => digits(item.credor) === id);
  if (!credor) return { cnpj: id, encontrado: false, sugestoes: [], situacoes_sem_detalhe: [] };
  const sugestoes = [];
  const semDetalhe = [];
  for (const np of credor.nps || []) {
    for (const item of np.deducoes_observadas || []) {
      if (!SITUACOES.has(item.situacao)) continue;
      sugestoes.push({ situacao: item.situacao, codigo_receita: item.codigo_receita || null,
        natureza: item.natureza || null, valor_historico: item.valor || null, np: np.np });
    }
    for (const situacao of np.situacoes_importadas || []) {
      if (SITUACOES.has(situacao) && !(np.deducoes_observadas || []).some(item => item.situacao === situacao)) {
        semDetalhe.push({ situacao, np: np.np });
      }
    }
  }
  return { cnpj: id, encontrado: true, nomes: credor.nomes || [], contratos_candidatos: credor.contratos_candidatos || [],
    sugestoes, situacoes_sem_detalhe: semDetalhe,
    aviso: 'Histórico sujeito a revisão. Contratos são candidatos por CNPJ, não vínculos comprovados; ausência não comprova isenção.' };
}

if (require.main === module) {
  try {
    const cnpj = process.argv[2];
    if (!cnpj) throw new Error('Uso: node scripts/siafi-sugestoes-deducoes.cjs <CNPJ> [inventario.json]');
    const arquivo = process.argv[3] || path.join(__dirname, '../outputs/inventario-siafi-2026-10-29/inventario-fornecedores-deducoes.json');
    console.log(JSON.stringify(sugerir(JSON.parse(fs.readFileSync(arquivo, 'utf8')), cnpj), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { sugerir };
