import { AlertTriangle, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { getValorTotalFromHistorico } from '@/utils/contratosApiHistorico';
import type {
  ContratoApiDetails,
  ContratoApiFaturaEmpenhoRow,
  ContratoApiFaturaItemRow,
  ContratoApiFaturaRow,
  ContratoApiHistoricoRow,
  ContratoApiItemRow,
  ContratoApiRow,
  ContratoApiSyncRun,
} from '@/services/contratosApi';

interface ContratoApiDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrato: ContratoApiRow | null;
  details: ContratoApiDetails | null;
  lastSyncRun: ContratoApiSyncRun | null;
  loading?: boolean;
}

const normalizeStatus = (value: string | null | undefined) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const EXECUTED_ITEM_STATUSES = new Set(['pago', 'siafi apropriado']);
const REITORIA_UG = '158155';

const isFaturaExecutada = (fatura?: ContratoApiFaturaRow) =>
  EXECUTED_ITEM_STATUSES.has(normalizeStatus(fatura?.situacao));

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR').format(date);
};

const normalizeDateValue = (value: unknown) => {
  if (!value) return null;
  const normalized = String(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
};

const parseApiCurrency = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (value == null) return 0;
  const cleaned = String(value)
    .trim()
    .replace(/[^\d,.-]/g, '');
  if (!cleaned) return 0;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    return Number(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  }
  if (cleaned.includes(',')) {
    return Number(cleaned.replace(',', '.')) || 0;
  }
  return Number(cleaned) || 0;
};

const toCents = (value: number) => Math.round(value * 100);

interface ContratoApiItemHistoricoEntry {
  tipo: string;
  dataTermo: string | null;
  quantidade: number | null;
  valorUnitario: number | null;
  valorTotal: number | null;
}

const getItemContratadoTotal = (item: ContratoApiItemRow) => {
  const historico = item.historico_item ?? [];
  const historicoTotalCents = historico.reduce(
    (sum, row) => sum + toCents(parseApiCurrency(row?.valor_total)),
    0,
  );

  if (historicoTotalCents > 0) return historicoTotalCents / 100;
  return Number(item.valor_total) || 0;
};

const getItemContratadoQuantidade = (item: ContratoApiItemRow) => {
  const historico = item.historico_item ?? [];
  const quantidadeHistorico = historico.reduce(
    (sum, row) => sum + parseApiCurrency(row?.quantidade),
    0,
  );

  if (quantidadeHistorico > 0) return quantidadeHistorico;
  return Number(item.quantidade) || 0;
};

const getItemDescription = (item: ContratoApiItemRow) =>
  [item.catmatseritem_id, item.descricao_complementar].filter(Boolean).join(' - ') || `Item ${item.api_item_id}`;

const formatNumber = (value: number | null | undefined) => {
  if (value == null) return '-';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 5,
  }).format(value);
};

const getItemHistoricoEntries = (item: ContratoApiItemRow): ContratoApiItemHistoricoEntry[] =>
  (item.historico_item ?? []).map((row) => ({
    tipo: String(row?.tipo_historico ?? row?.tipo ?? '').trim() || 'Histórico',
    dataTermo: normalizeDateValue(row?.data_termo),
    quantidade: row?.quantidade == null ? null : parseApiCurrency(row.quantidade),
    valorUnitario: row?.valor_unitario == null ? null : parseApiCurrency(row.valor_unitario),
    valorTotal: row?.valor_total == null ? null : parseApiCurrency(row.valor_total),
  }));

const getHistoricoTipoLabel = (historico: ContratoApiHistoricoRow) =>
  normalizeStatus(historico.tipo) === 'contrato' ? 'Assinatura' : historico.tipo || 'Histórico';

const getQualificacaoLabel = (historico: ContratoApiHistoricoRow) => {
  const qualificacoes = historico.qualificacao_termo ?? [];
  const labels = qualificacoes
    .map((item) => item?.descricao)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return labels.join(', ');
};

function buildFaturaEmpenhosMap(faturaEmpenhos: ContratoApiFaturaEmpenhoRow[]) {
  return faturaEmpenhos.reduce((map, row) => {
    const current = map.get(row.contrato_api_fatura_id) ?? [];
    current.push(row);
    map.set(row.contrato_api_fatura_id, current);
    return map;
  }, new Map<string, ContratoApiFaturaEmpenhoRow[]>());
}

function FaturaLine({
  fatura,
  faturaItem,
  empenhos,
}: {
  fatura: ContratoApiFaturaRow;
  faturaItem?: ContratoApiFaturaItemRow;
  empenhos: ContratoApiFaturaEmpenhoRow[];
}) {
  return (
    <div className="rounded-md border border-border/70 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold">{fatura.numero_instrumento_cobranca || '-'}</span>
            <Badge variant={isFaturaExecutada(fatura) ? 'default' : 'secondary'} className="h-5 rounded-md text-[10px]">
              {fatura.situacao || 'Sem situação'}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Emissão {formatDate(fatura.data_emissao)}
            {empenhos.length > 0 ? ` | Empenho ${empenhos.map((item) => item.numero_empenho).filter(Boolean).join(', ')}` : ''}
          </p>
          {faturaItem ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Qtd. {formatNumber(faturaItem.quantidade_faturado)} | Unitário {formatCurrency(faturaItem.valor_unitario_faturado ?? 0)}
            </p>
          ) : null}
        </div>
        <div className="text-right text-xs">
          <p className="font-semibold">
            {formatCurrency(faturaItem?.valor_total_faturado ?? fatura.valor_liquido ?? fatura.valor_bruto ?? 0)}
          </p>
          <p className="text-muted-foreground">{faturaItem ? 'Valor do item' : 'Valor da fatura'}</p>
        </div>
      </div>
    </div>
  );
}

export function ContratoApiDetailsSheet({
  open,
  onOpenChange,
  contrato,
  details,
  lastSyncRun,
  loading = false,
}: ContratoApiDetailsSheetProps) {
  const faturas = details?.faturas ?? [];
  const faturaItens = details?.faturaItens ?? [];
  const historico = details?.historico ?? [];
  const itemById = new Map((details?.itens ?? []).map((item) => [item.id, item]));
  const faturaById = new Map(faturas.map((fatura) => [fatura.id, fatura]));
  const empenhosByFatura = buildFaturaEmpenhosMap(details?.faturaEmpenhos ?? []);
  const linkedFaturaIds = new Set(faturaItens.map((item) => item.contrato_api_fatura_id));
  const faturasSemItem = faturas.filter((fatura) => !linkedFaturaIds.has(fatura.id));

  const itemSummaries = (details?.itens ?? []).map((item) => {
    const links = faturaItens.filter((link) => link.contrato_api_item_id === item.id);
    const valorExecutado = links.reduce((sum, link) => {
      const fatura = faturaById.get(link.contrato_api_fatura_id);
      return isFaturaExecutada(fatura) ? sum + (Number(link.valor_total_faturado) || 0) : sum;
    }, 0);
    const quantidadeExecutada = links.reduce((sum, link) => {
      const fatura = faturaById.get(link.contrato_api_fatura_id);
      return isFaturaExecutada(fatura) ? sum + (Number(link.quantidade_faturado) || 0) : sum;
    }, 0);
    return {
      item,
      links,
      valorContratado: getItemContratadoTotal(item),
      quantidadeContratada: getItemContratadoQuantidade(item),
      valorExecutado,
      quantidadeExecutada,
    };
  });

  const unknownItemLinks = faturaItens.filter((link) => !link.contrato_api_item_id || !itemById.has(link.contrato_api_item_id));
  const hasUnlinkedFaturas = faturasSemItem.length > 0 || unknownItemLinks.length > 0;
  const hasReitoriaOrigin =
    contrato?.unidade_origem_codigo === REITORIA_UG ||
    historico.some((row) => row.codigo_unidade_origem === REITORIA_UG);
  const valorHistorico = getValorTotalFromHistorico(historico);
  const valorAcumulado = Number(contrato?.valor_acumulado) || 0;
  const valorTotalApi = valorHistorico || valorAcumulado;
  const valorTotalLabel = valorHistorico > 0 ? 'Valor total histórico' : 'Valor acumulado';
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="pr-8">
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-action-primary" />
            Contrato {contrato?.numero ?? '-'}
            {hasReitoriaOrigin ? <Badge variant="secondary" className="rounded-md">Origem Reitoria</Badge> : null}
          </SheetTitle>
          <SheetDescription>
            {contrato?.fornecedor_nome || 'Fornecedor não informado'} | Vigência {formatDate(contrato?.vigencia_inicio)} a {formatDate(contrato?.vigencia_fim)}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Carregando itens e faturas...</div>
        ) : !details ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhum detalhe da API carregado.</div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border/70 p-3">
                <p className="text-xs text-muted-foreground">{valorTotalLabel}</p>
                <p className="mt-1 font-semibold">{formatCurrency(valorTotalApi)}</p>
              </div>
              <div className="rounded-md border border-border/70 p-3">
                <p className="text-xs text-muted-foreground">Itens</p>
                <p className="mt-1 font-semibold">{details.itens.length}</p>
              </div>
              <div className="rounded-md border border-border/70 p-3">
                <p className="text-xs text-muted-foreground">Última sincronização</p>
                <p className="mt-1 text-sm font-semibold">
                  {lastSyncRun?.finished_at ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(lastSyncRun.finished_at)) : '-'}
                </p>
              </div>
            </div>

            {hasUnlinkedFaturas ? (
              <div className="flex gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 p-3 text-sm text-status-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Há faturas sem vínculo de item na API. Elas aparecem separadas e não entram na execução oficial por item.</span>
              </div>
            ) : null}

            {hasReitoriaOrigin ? (
              <div className="flex gap-2 rounded-md border border-border/70 bg-muted/40 p-3 text-sm text-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Contrato com origem na Reitoria. Valores globais do histórico podem representar o contrato central; empenhos e faturas indicam a execução da UG do campus quando constarem com UG 158366.</span>
              </div>
            ) : null}

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Histórico do contrato</h3>
                <p className="text-xs text-muted-foreground">Assinatura, aditivos, apostilamentos e demais termos conforme a API.</p>
              </div>
              <div className="overflow-x-auto rounded-md border border-border/70">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Termo</TableHead>
                      <TableHead>UG</TableHead>
                      <TableHead className="text-right">Valor do termo</TableHead>
                      <TableHead className="text-right">Novo valor</TableHead>
                      <TableHead className="text-right">Retroativo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-20 text-center text-sm text-muted-foreground">
                          Nenhum histórico sincronizado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      historico.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="min-w-[13rem]">
                              <p className="font-medium">{getHistoricoTipoLabel(row)} {row.numero ? `- ${row.numero}` : ''}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(row.data_assinatura)}
                                {getQualificacaoLabel(row) ? ` | ${getQualificacaoLabel(row)}` : ''}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <p>{row.ug || '-'}</p>
                              {row.codigo_unidade_origem ? (
                                <p className="text-muted-foreground">Origem {row.codigo_unidade_origem}</p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(row.valor_inicial ?? 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.novo_valor_global ?? 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.retroativo_valor ?? 0)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Itens</h3>
                <p className="text-xs text-muted-foreground">Execução soma faturas Pago ou Siafi Apropriado com item vinculado.</p>
              </div>
              <div className="overflow-x-auto rounded-md border border-border/70">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Contratado</TableHead>
                      <TableHead className="text-right">Executado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemSummaries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-20 text-center text-sm text-muted-foreground">
                          Nenhum item sincronizado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      itemSummaries.map(({ item, valorContratado, quantidadeContratada, valorExecutado, quantidadeExecutada }) => {
                        const historicoItem = getItemHistoricoEntries(item);
                        return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="max-w-[34rem]">
                              <p className="font-medium">{getItemDescription(item)}</p>
                              <p className="text-xs text-muted-foreground">
                                Item {item.numero_item_compra || item.api_item_id} | Qtd. {item.quantidade ?? 0}
                              </p>
                              {historicoItem.length > 0 ? (
                                <div className="mt-3 border-l-2 border-border/60 pl-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Histórico do item
                                  </p>
                                  <div className="mt-2 space-y-2">
                                    {historicoItem.map((entry, index) => (
                                      <div key={`${item.id}-historico-${index}`} className="text-xs">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                          <span className="font-medium text-foreground">{entry.tipo}</span>
                                          <span className="text-muted-foreground">{formatDate(entry.dataTermo)}</span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                                          <span>Qtd. {formatNumber(entry.quantidade)}</span>
                                          <span>Unitário {formatCurrency(entry.valorUnitario ?? 0)}</span>
                                          <span>Total {formatCurrency(entry.valorTotal ?? 0)}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <p className="font-medium">{formatCurrency(valorContratado)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Qtd. contratada {formatNumber(quantidadeContratada)}
                            </p>
                          </TableCell>
                          <TableCell className="text-right">
                            <p className="font-semibold text-status-success">{formatCurrency(valorExecutado)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Qtd. executada {formatNumber(quantidadeExecutada)}
                            </p>
                          </TableCell>
                        </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Faturas associadas</h3>
                <p className="text-xs text-muted-foreground">Agrupadas pelo item informado pela API do Comprasnet.</p>
              </div>

              {itemSummaries
                .filter(({ links }) => links.length > 0)
                .map(({ item, links }) => (
                  <div key={item.id} className="space-y-2">
                    <p className="text-xs font-bold uppercase text-muted-foreground">{getItemDescription(item)}</p>
                    {links.map((link) => {
                      const fatura = faturaById.get(link.contrato_api_fatura_id);
                      if (!fatura) return null;
                      return (
                        <FaturaLine
                          key={link.id}
                          fatura={fatura}
                          faturaItem={link}
                          empenhos={empenhosByFatura.get(fatura.id) ?? []}
                        />
                      );
                    })}
                  </div>
                ))}

              {hasUnlinkedFaturas ? (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Sem item vinculado</p>
                  {unknownItemLinks.map((link) => {
                    const fatura = faturaById.get(link.contrato_api_fatura_id);
                    if (!fatura) return null;
                    return (
                      <FaturaLine
                        key={link.id}
                        fatura={fatura}
                        faturaItem={link}
                        empenhos={empenhosByFatura.get(fatura.id) ?? []}
                      />
                    );
                  })}
                  {faturasSemItem.map((fatura) => (
                    <FaturaLine
                      key={fatura.id}
                      fatura={fatura}
                      empenhos={empenhosByFatura.get(fatura.id) ?? []}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
