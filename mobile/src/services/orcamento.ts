import { supabase, DEFAULT_CAMPUS_UASG } from '../lib/supabase';
import { origemCorrespondeAoPtres } from '../lib/dashboardRules';
import type { ContaSaldo, CreditoLinha, DescentralizacaoLinha } from '../lib/orcamentoRules';
import { lerTudo, tabelaInexistente, type Row } from './query';

const numero = (valor: unknown): number => Number(valor) || 0;

export type DescentralizacoesData = { linhas: DescentralizacaoLinha[]; contaSaldos: ContaSaldo[] };

/** Descentralizações do campus (linhas) e saldo oficial da conta por PTRES. */
export async function fetchDescentralizacoes(campusUasg: string = DEFAULT_CAMPUS_UASG): Promise<DescentralizacoesData> {
  const [rows, conta] = await Promise.all([
    lerTudo((from, to) =>
      supabase
        .from('descentralizacoes')
        .select('id, dimensao, nota_credito, operacao_tipo, origem_recurso, natureza_despesa, plano_interno, data_emissao, descricao, valor')
        .eq('campus_uasg', campusUasg)
        .order('data_emissao', { ascending: false, nullsFirst: false })
        .range(from, to),
    ),
    supabase.from('descentralizacoes_conta_saldos').select('ptres, valor').eq('campus_uasg', campusUasg),
  ]);

  if (conta.error && !tabelaInexistente(conta.error)) throw new Error(conta.error.message);

  return {
    linhas: rows.map((r) => ({
      id: r.id,
      data: r.data_emissao ?? null,
      dimensao: r.dimensao || 'Sem dimensão',
      notaCredito: r.nota_credito ?? null,
      operacao: r.operacao_tipo ?? null,
      origem: r.origem_recurso || 'Sem origem',
      naturezaDespesa: r.natureza_despesa ?? null,
      planoInterno: r.plano_interno ?? null,
      descricao: r.descricao ?? null,
      valor: numero(r.valor),
    })),
    contaSaldos: ((conta.data ?? []) as Row[]).map((c) => ({ ptres: String(c.ptres), valor: numero(c.valor) })),
  };
}

export type CreditoData = { linhas: CreditoLinha[]; importadoEm: string | null; arquivo: string | null };

/** Último relatório de crédito disponível importado (mesmo da tela web). */
export async function fetchCredito(campusUasg: string = DEFAULT_CAMPUS_UASG): Promise<CreditoData> {
  const { data: lote, error } = await supabase
    .from('creditos_disponiveis_detalhes')
    .select('import_batch_id, source_file, imported_at')
    .eq('campus_uasg', campusUasg)
    .order('imported_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lote?.import_batch_id) return { linhas: [], importadoEm: null, arquivo: null };

  const rows = await lerTudo((from, to) =>
    supabase
      .from('creditos_disponiveis_detalhes')
      .select('id, ptres, plano_interno, descricao, valor')
      .eq('import_batch_id', lote.import_batch_id)
      .eq('campus_uasg', campusUasg)
      .order('ptres', { ascending: true })
      .range(from, to),
  );

  return {
    linhas: rows.map((r) => ({
      id: r.id,
      ptres: String(r.ptres),
      planoInterno: r.plano_interno || '',
      descricao: r.descricao || '',
      valor: numero(r.valor),
    })),
    importadoEm: (lote.imported_at as string | null) ?? null,
    arquivo: (lote.source_file as string | null) ?? null,
  };
}

export type MovimentacaoEmpenho = {
  id: string;
  numero: string;
  favorecido: string;
  data: string | null;
  valor: number;
  liquidado: number;
  pago: number;
};

/** Empenhos do exercício e descentralizações de um PTRES (detalhe de uma linha de crédito). */
export async function fetchMovimentacoesPtres(
  ptres: string,
  campusUasg: string = DEFAULT_CAMPUS_UASG,
): Promise<{ empenhos: MovimentacaoEmpenho[]; descentralizacoes: DescentralizacaoLinha[] }> {
  const [empenhosRows, descentralizacoes] = await Promise.all([
    lerTudo((from, to) =>
      supabase
        .from('empenhos')
        .select('id, numero, favorecido_nome, data_empenho, valor, valor_liquidado, valor_liquidado_oficial, valor_pago_oficial, origem_recurso')
        .eq('campus_uasg', campusUasg)
        .eq('tipo', 'exercicio')
        .neq('status', 'cancelado')
        .order('data_empenho', { ascending: false })
        .range(from, to),
    ),
    fetchDescentralizacoes(campusUasg),
  ]);

  return {
    empenhos: empenhosRows
      .filter((r) => origemCorrespondeAoPtres(r.origem_recurso, ptres))
      .map((r) => ({
        id: r.id,
        numero: r.numero,
        favorecido: r.favorecido_nome || 'Fornecedor não identificado',
        data: r.data_empenho ?? null,
        valor: numero(r.valor),
        liquidado: numero(r.valor_liquidado_oficial ?? r.valor_liquidado),
        pago: numero(r.valor_pago_oficial),
      })),
    descentralizacoes: descentralizacoes.linhas.filter((l) => origemCorrespondeAoPtres(l.origem, ptres)),
  };
}
