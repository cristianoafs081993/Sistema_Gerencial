import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CircleDollarSign,
  FileText,
  History,
  Package,
  ReceiptText,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
const DISPLAY_UNIDADE_CODIGO = '158366';

const isFaturaExecutada = (fatura?: ContratoApiFaturaRow) =>
  EXECUTED_ITEM_STATUSES.has(normalizeStatus(fatura?.situacao));

const getFaturaContratanteCodigo = (fatura: ContratoApiFaturaRow) => {
  const rawData = (fatura.raw_data && typeof fatura.raw_data === 'object' ? fatura.raw_data : {}) as Record<string, unknown>;
  const value = rawData.contratante ?? rawData.contratante_codigo ?? rawData.unidade_contrato;
  const match = String(value ?? '').match(/\b\d{6}\b/);
  return match?.[0] ?? null;
};

const isFaturaVisibleForDisplayUnidade = (fatura: ContratoApiFaturaRow) => {
  const codigoContratante = getFaturaContratanteCodigo(fatura);
  return !codigoContratante || codigoContratante === DISPLAY_UNIDADE_CODIGO;
};

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

function buildFaturaItensMap(faturaItens: ContratoApiFaturaItemRow[]) {
  return faturaItens.reduce((map, row) => {
    const current = map.get(row.contrato_api_fatura_id) ?? [];
    current.push(row);
    map.set(row.contrato_api_fatura_id, current);
    return map;
  }, new Map<string, ContratoApiFaturaItemRow[]>());
}

function SummaryMetric({
  icon,
  label,
  value,
  helper,
}: {
  icon: JSX.Element;
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-card p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-action-primary/10 text-action-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-sm font-bold text-foreground">{value}</p>
          {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
        </div>
      </div>
    </div>
  );
}

function AccordionSectionTitle({
  icon,
  title,
  description,
  count,
}: {
  icon: JSX.Element;
  title: string;
  description: string;
  count: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-action-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{description}</span>
      </span>
      <Badge variant="secondary" className="ml-auto mr-3 shrink-0 rounded-md">
        {count}
      </Badge>
    </div>
  );
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
  const rawFaturas = details?.faturas ?? [];
  const empenhoLinkedFaturaIds = new Set(
    (details?.faturaEmpenhos ?? []).map((fe) => fe.contrato_api_fatura_id)
  );
  const faturas = rawFaturas.filter(
    (fatura) => isFaturaVisibleForDisplayUnidade(fatura) || empenhoLinkedFaturaIds.has(fatura.id)
  );
  const visibleFaturaIds = new Set(faturas.map((fatura) => fatura.id));
  const faturaItens = (details?.faturaItens ?? []).filter((item) => visibleFaturaIds.has(item.contrato_api_fatura_id));
  const faturaEmpenhos = (details?.faturaEmpenhos ?? []).filter((item) => visibleFaturaIds.has(item.contrato_api_fatura_id));
  const historico = details?.historico ?? [];
  const itemById = new Map((details?.itens ?? []).map((item) => [item.id, item]));
  const faturaById = new Map(faturas.map((fatura) => [fatura.id, fatura]));
  const empenhosByFatura = buildFaturaEmpenhosMap(faturaEmpenhos);
  const itensByFatura = buildFaturaItensMap(faturaItens);
  const itemLinkedFaturaIds = new Set(faturaItens.map((item) => item.contrato_api_fatura_id));
  const faturasSemItem = faturas.filter((fatura) => !itemLinkedFaturaIds.has(fatura.id));

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
  const valorExecutadoItens = itemSummaries.reduce((sum, item) => sum + item.valorExecutado, 0);
  const faturasExecutadas = faturas.filter(isFaturaExecutada).length;
  const lastSyncLabel = lastSyncRun?.finished_at
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(lastSyncRun.finished_at))
    : '-';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(90vh,880px)] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 bg-background sm:rounded-2xl border border-border shadow-2xl">
        <DialogHeader className="border-b border-border px-6 py-4 bg-card shrink-0">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold text-foreground">Contrato {contrato?.numero ?? '-'}</span>
            {hasReitoriaOrigin ? <Badge variant="secondary" className="rounded-md">Origem Reitoria</Badge> : null}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            {contrato?.fornecedor_nome || 'Fornecedor não informado'} | Vigência {formatDate(contrato?.vigencia_inicio)} a {formatDate(contrato?.vigencia_fim)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5 scrollbar-thin">
          {loading ? (
            <div className="py-16 text-center text-sm font-medium text-muted-foreground flex flex-col items-center gap-2">
              <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Carregando itens, faturas e histórico do contrato...
            </div>
          ) : !details ? (
            <div className="py-16 text-center text-sm font-medium text-muted-foreground">Nenhum detalhe da API carregado.</div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                <div className="flex flex-col gap-4">

                <div>
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">Objeto</p>
                  <p className="mt-1 text-sm font-medium leading-6 text-foreground">
                    {contrato?.objeto || 'Objeto não informado'}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-action-primary" />
                    <span>{contrato?.unidade_nome || contrato?.unidade_codigo || 'Unidade não informada'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-action-primary" />
                    <span>Processo {contrato?.processo || '-'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryMetric
                icon={<CircleDollarSign className="h-4 w-4" />}
                label={valorTotalLabel}
                value={formatCurrency(valorTotalApi)}
              />
              <SummaryMetric
                icon={<Package className="h-4 w-4" />}
                label="Itens"
                value={details.itens.length}
                helper={`${formatCurrency(valorExecutadoItens)} executado`}
              />
              <SummaryMetric
                icon={<ReceiptText className="h-4 w-4" />}
                label="Faturas"
                value={faturas.length}
                helper={`${faturasExecutadas} executadas`}
              />
              <SummaryMetric
                icon={<CalendarClock className="h-4 w-4" />}
                label="Última sincronização"
                value={lastSyncLabel}
              />
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
                <span>Contrato com origem na Reitoria. Valores globais do histórico podem representar o contrato central; a tela exibe somente faturas da UG {DISPLAY_UNIDADE_CODIGO} quando a API informa o contratante.</span>
              </div>
            ) : null}

            <Accordion key={contrato?.id ?? 'sem-contrato'} type="multiple" className="space-y-3">
              <AccordionItem value="historico" className="rounded-md border border-border/70 bg-card px-4 shadow-sm">
                <AccordionTrigger className="gap-3 py-4 hover:no-underline">
                  <AccordionSectionTitle
                    icon={<History className="h-4 w-4" />}
                    title="Histórico do contrato"
                    description="Assinatura, aditivos, apostilamentos e demais termos conforme a API."
                    count={`${historico.length} registros`}
                  />
                </AccordionTrigger>
                <AccordionContent className="pb-4 pt-0">
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
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="itens" className="rounded-md border border-border/70 bg-card px-4 shadow-sm">
                <AccordionTrigger className="gap-3 py-4 hover:no-underline">
                  <AccordionSectionTitle
                    icon={<Package className="h-4 w-4" />}
                    title="Itens"
                    description="Execução soma faturas Pago ou Siafi Apropriado com item vinculado."
                    count={`${itemSummaries.length} itens`}
                  />
                </AccordionTrigger>
                <AccordionContent className="pb-4 pt-0">
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
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faturas" className="rounded-md border border-border/70 bg-card px-4 shadow-sm">
                <AccordionTrigger className="gap-3 py-4 hover:no-underline">
                  <AccordionSectionTitle
                    icon={<ReceiptText className="h-4 w-4" />}
                    title="Faturas associadas"
                    description="Consulte as faturas organizadas por item ou por documento."
                    count={`${faturas.length} faturas`}
                  />
                </AccordionTrigger>
                <AccordionContent className="pb-4 pt-0">
                  <Tabs defaultValue="item">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-muted-foreground">Agrupar faturas por</p>
                      <TabsList aria-label="Agrupar faturas por">
                        <TabsTrigger value="item">Item</TabsTrigger>
                        <TabsTrigger value="fatura">Fatura</TabsTrigger>
                      </TabsList>
                    </div>


                    <TabsContent value="item" className="space-y-4">
                      {itemSummaries
                        .filter(({ links }) => links.length > 0)
                        .map(({ item, links }) => (
                          <div key={item.id} className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3">
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
                        <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3">
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
                    </TabsContent>

                    <TabsContent value="fatura" className="space-y-3">
                      {faturas.map((fatura) => {
                        const links = itensByFatura.get(fatura.id) ?? [];
                        return (
                          <div key={fatura.id} className="rounded-md border border-border/70 bg-muted/20 p-3">
                            <FaturaLine
                              fatura={fatura}
                              empenhos={empenhosByFatura.get(fatura.id) ?? []}
                            />
                            {links.length > 0 ? (
                              <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
                                <p className="text-[11px] font-semibold uppercase text-muted-foreground">Itens vinculados</p>
                                {links.map((link) => {
                                  const item = link.contrato_api_item_id
                                    ? itemById.get(link.contrato_api_item_id)
                                    : undefined;
                                  return (
                                    <div key={link.id} className="flex flex-wrap justify-between gap-2 text-xs">
                                      <span className="max-w-[28rem] text-foreground">
                                        {item ? getItemDescription(item) : 'Item não identificado na API'}
                                      </span>
                                      <span className="text-muted-foreground">
                                        Qtd. {formatNumber(link.quantidade_faturado)} | {formatCurrency(link.valor_total_faturado ?? 0)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="mt-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                                Sem item vinculado na API.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </TabsContent>

                    {faturas.length === 0 ? (
                      <div className="mt-4 rounded-md border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">
                        Nenhuma fatura sincronizada.
                      </div>
                    ) : null}
                  </Tabs>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

